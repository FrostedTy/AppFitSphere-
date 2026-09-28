import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "../config/env.js";
import prisma from "../lib/prisma.js";

/**
 * Prompt de sistema enviado em toda análise.
 * A redundância entre prompt e JSON Schema reduz respostas conversacionais
 * e torna o contrato explícito para o modelo e para o backend.
 */
export const NUTRITION_SYSTEM_PROMPT = `Você é um estimador nutricional para um aplicativo de hipertrofia.
Analise exclusivamente a descrição textual e/ou a imagem do alimento fornecida pelo usuário.
Estime a quantidade total da refeição e responda EXATAMENTE com um único objeto JSON válido.
NÃO use Markdown, NÃO use bloco de código, NÃO escreva explicações, NÃO inclua texto antes ou depois do JSON.
O objeto deve conter SOMENTE estas quatro propriedades numéricas:
- calories: calorias totais em kcal;
- proteinGrams: proteína total em gramas;
- carbohydratesGrams: carboidratos totais em gramas;
- fatGrams: gordura total em gramas.
Use números reais não negativos, sem unidades, sem separadores de milhar e arredondados a no máximo duas casas decimais.
Se a imagem ou descrição tiver incerteza, faça a melhor estimativa plausível com base na porção visível/informada; nunca substitua um número por texto, null ou string.`;

const nutritionJsonSchema = {
  type: "object",
  properties: {
    calories: {
      type: "number",
      minimum: 0,
      description: "Total de calorias da refeição em kcal."
    },
    proteinGrams: {
      type: "number",
      minimum: 0,
      description: "Proteína total em gramas."
    },
    carbohydratesGrams: {
      type: "number",
      minimum: 0,
      description: "Carboidratos totais em gramas."
    },
    fatGrams: {
      type: "number",
      minimum: 0,
      description: "Gordura total em gramas."
    }
  },
  required: ["calories", "proteinGrams", "carbohydratesGrams", "fatGrams"],
  additionalProperties: false
};

const nutritionOutputSchema = z.object({
  calories: z.number().finite().nonnegative(),
  proteinGrams: z.number().finite().nonnegative(),
  carbohydratesGrams: z.number().finite().nonnegative(),
  fatGrams: z.number().finite().nonnegative()
}).strict();

const gemini = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const historyQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeZone: z.string().trim().min(1).max(100).optional()
});

function httpError(statusCode, message, cause) {
  const error = new Error(message, { cause });
  error.statusCode = statusCode;
  return error;
}

function buildGeminiInput(description, imageFile) {
  const text = description || "Identifique os alimentos, estime as porções e calcule os macronutrientes da refeição mostrada.";

  if (!imageFile) {
    return text;
  }

  return [
    { type: "text", text },
    {
      type: "image",
      data: imageFile.buffer.toString("base64"),
      mime_type: imageFile.mimetype
    }
  ];
}

function localDateAt(instant, timeZone) {
  const fields = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(instant).map(({ type, value }) => [type, value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function nextDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

// Resolve meia-noite no calendário do usuário para UTC sem assumir um offset fixo.
function localMidnightToUtc(date, timeZone) {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  let candidate = target;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const fields = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map(({ type, value }) => [type, value]));
    const localEpoch = Date.UTC(
      Number(fields.year), Number(fields.month) - 1, Number(fields.day),
      Number(fields.hour), Number(fields.minute), Number(fields.second)
    );
    const delta = target - localEpoch;
    candidate += delta;
    if (delta === 0) break;
  }
  return new Date(candidate);
}

function serializeMeal(meal) {
  return {
    id: meal.id,
    source: meal.source,
    description: meal.description,
    calories: Number(meal.calories),
    proteinGrams: Number(meal.proteinGrams),
    carbohydratesGrams: Number(meal.carbohydratesGrams),
    fatGrams: Number(meal.fatGrams),
    consumedAt: meal.consumedAt.toISOString(),
    createdAt: meal.createdAt.toISOString()
  };
}

/** GET /api/v1/nutrition/history?date=YYYY-MM-DD&timeZone=America/Sao_Paulo */
export async function getDailyMealHistory(req, res, next) {
  try {
    const query = historyQuerySchema.safeParse(req.query);
    if (!query.success) throw httpError(400, "Data ou fuso horário inválido.", query.error.issues);

    const timeZone = query.data.timeZone || "UTC";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone });
    } catch {
      throw httpError(400, "Fuso horário IANA inválido.");
    }

    const date = query.data.date || localDateAt(new Date(), timeZone);
    const [year, month, day] = date.split("-").map(Number);
    if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== date) {
      throw httpError(400, "A data deve ser uma data válida no formato YYYY-MM-DD.");
    }

    const [start, end] = [date, nextDate(date)].map((dayKey) => localMidnightToUtc(dayKey, timeZone));
    const records = await prisma.meal.findMany({
      where: { userId: req.auth.userId, consumedAt: { gte: start, lt: end } },
      orderBy: [{ consumedAt: "desc" }, { createdAt: "desc" }]
    });
    const meals = records.map(serializeMeal);
    const summary = meals.reduce((total, meal) => ({
      mealCount: total.mealCount + 1,
      calories: total.calories + meal.calories,
      proteinGrams: total.proteinGrams + meal.proteinGrams,
      carbohydratesGrams: total.carbohydratesGrams + meal.carbohydratesGrams,
      fatGrams: total.fatGrams + meal.fatGrams
    }), { mealCount: 0, calories: 0, proteinGrams: 0, carbohydratesGrams: 0, fatGrams: 0 });

    for (const key of ["calories", "proteinGrams", "carbohydratesGrams", "fatGrams"]) {
      summary[key] = Number(summary[key].toFixed(2));
    }
    return res.status(200).json({ date, timeZone, summary, meals });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/nutrition/analyze
 *
 * Texto: application/json { "description": "..." }
 * Foto: multipart/form-data com campo "image" e, opcionalmente, "description".
 */
export async function analyzeMeal(req, res, next) {
  try {
    const description = typeof req.body?.description === "string"
      ? req.body.description.trim()
      : "";

    if (!description && !req.file) {
      throw httpError(400, "Informe uma descrição ou envie uma imagem no campo image.");
    }

    let rawJson;
    const analysisMode = env.NUTRITION_AI_MODE;

    if (analysisMode === "mock") {
      // Fixture fixa para E2E: não usa Gemini e nunca deve ser habilitada fora de NODE_ENV=test.
      rawJson = { calories: 520, proteinGrams: 45, carbohydratesGrams: 65, fatGrams: 12 };
    } else {
      const interaction = await gemini.interactions.create({
        model: env.GEMINI_MODEL,
        input: buildGeminiInput(description, req.file),
        system_instruction: NUTRITION_SYSTEM_PROMPT,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: nutritionJsonSchema
        },
        generation_config: {
          max_output_tokens: 300
        },
        // Fotos de refeições e informações de saúde não precisam ser retidas pela API.
        store: false
      });

      const rawText = interaction.output_text?.trim();
      if (!rawText) throw httpError(502, "O Gemini não retornou uma resposta nutricional.");

      try {
        rawJson = JSON.parse(rawText);
      } catch (error) {
        throw httpError(502, "O Gemini retornou um JSON inválido.", error);
      }
    }

    const parsed = nutritionOutputSchema.safeParse(rawJson);

    if (!parsed.success) {
      throw httpError(502, "A resposta do Gemini não respeitou o contrato nutricional.", parsed.error);
    }

    // A foto é processada em memória; somente origem, descrição e macros são persistidos.
    const meal = await prisma.meal.create({
      data: {
        userId: req.auth.userId,
        source: req.file ? "IMAGE" : "TEXT",
        description: analysisMode === "mock"
          ? `[E2E MOCK] ${description || (req.file ? "análise de foto de teste" : "análise de texto de teste")}`
          : description || null,
        calories: parsed.data.calories,
        proteinGrams: parsed.data.proteinGrams,
        carbohydratesGrams: parsed.data.carbohydratesGrams,
        fatGrams: parsed.data.fatGrams
      }
    });

    return res.status(201).json({ ...serializeMeal(meal), analysisMode });
  } catch (error) {
    return next(error);
  }
}
