import { Platform } from "react-native";
import { API_BASE_URL, apiRequest } from "./api";
import type { DailyMealHistory, MealHistoryItem } from "../types/nutrition";

export type MealPhoto = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export type AnalyzeNutritionInput = {
  description: string;
  photo?: MealPhoto | null;
};

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validateMeal(payload: unknown): MealHistoryItem {
  if (!payload || typeof payload !== "object") {
    throw new Error("O servidor não retornou a refeição salva.");
  }
  const value = payload as Partial<MealHistoryItem>;
  if (
    typeof value.id !== "string" ||
    (value.source !== "TEXT" && value.source !== "IMAGE") ||
    (value.analysisMode !== undefined && value.analysisMode !== "gemini" && value.analysisMode !== "mock") ||
    !(value.description === null || typeof value.description === "string") ||
    !isNonNegativeNumber(value.calories) ||
    !isNonNegativeNumber(value.proteinGrams) ||
    !isNonNegativeNumber(value.carbohydratesGrams) ||
    !isNonNegativeNumber(value.fatGrams) ||
    typeof value.consumedAt !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    throw new Error("O servidor retornou dados inválidos para a refeição salva.");
  }
  return value as MealHistoryItem;
}

async function sendImage(token: string, input: AnalyzeNutritionInput): Promise<MealHistoryItem> {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_URL não foi configurada para este build. Defina a URL HTTPS da API no ambiente EAS.");
  }

  const body = new FormData();
  if (input.description.trim()) body.append("description", input.description.trim());

  const photo = input.photo!;
  const fileName = photo.fileName || "refeicao.jpg";
  const mimeType = photo.mimeType || "image/jpeg";

  if (Platform.OS === "web") {
    let imageResponse: Response;
    try {
      imageResponse = await fetch(photo.uri);
    } catch {
      throw new Error("Não foi possível ler a foto selecionada.");
    }
    if (!imageResponse.ok) throw new Error("Não foi possível ler a foto selecionada.");
    const imageBlob = await imageResponse.blob();
    body.append("image", imageBlob, fileName);
  } else {
    body.append("image", {
      uri: photo.uri,
      name: fileName,
      type: mimeType
    } as unknown as Blob);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/nutrition/analyze`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      body
    });
  } catch {
    throw new Error(`Não foi possível conectar à API em ${API_BASE_URL}. Verifique o backend e a rede.`);
  }

  const payload = await response.json().catch(() => null) as (MealHistoryItem & { message?: string }) | null;
  if (!response.ok) throw new Error(payload?.message || `A análise falhou (HTTP ${response.status}).`);
  return validateMeal(payload);
}

export function analyzeNutrition(token: string, input: AnalyzeNutritionInput): Promise<MealHistoryItem> {
  if (input.photo) return sendImage(token, input);
  return apiRequest<unknown>("/api/v1/nutrition/analyze", {
    method: "POST",
    token,
    body: { description: input.description.trim() }
  }).then(validateMeal);
}

export async function getDailyMealHistory(token: string, date: string, timeZone: string): Promise<DailyMealHistory> {
  const query = `date=${encodeURIComponent(date)}&timeZone=${encodeURIComponent(timeZone)}`;
  const payload = await apiRequest<unknown>(`/api/v1/nutrition/history?${query}`, { token });
  if (!payload || typeof payload !== "object") throw new Error("O servidor não retornou o histórico diário.");
  const value = payload as Partial<DailyMealHistory>;
  const summary = value.summary;
  if (
    value.date !== date ||
    typeof value.timeZone !== "string" ||
    !summary || typeof summary !== "object" ||
    !Number.isInteger(summary.mealCount) || summary.mealCount! < 0 ||
    !isNonNegativeNumber(summary.calories) ||
    !isNonNegativeNumber(summary.proteinGrams) ||
    !isNonNegativeNumber(summary.carbohydratesGrams) ||
    !isNonNegativeNumber(summary.fatGrams) ||
    !Array.isArray(value.meals)
  ) {
    throw new Error("O servidor retornou um histórico diário inválido.");
  }
  return {
    date,
    timeZone: value.timeZone,
    summary: summary as DailyMealHistory["summary"],
    meals: value.meals.map(validateMeal)
  };
}
