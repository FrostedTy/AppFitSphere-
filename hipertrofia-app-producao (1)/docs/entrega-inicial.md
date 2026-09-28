# Entrega inicial — aplicativo de hipertrofia

> Escopo desta etapa: arquitetura de pastas, modelo PostgreSQL/Prisma, setup Express e rota multimodal de análise nutricional via Gemini. As telas Expo ficam para a próxima iteração.

> **Snapshot histórico:** este documento registra o código da primeira etapa. O estado atual do backend inclui autenticação JWT; veja [autenticacao.md](autenticacao.md) e [treinos-api.md](treinos-api.md) para os endpoints e regras vigentes.

## 1. Arquitetura de pastas

```text
hipertrofia-app/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/env.js
│   │   ├── controllers/nutrition.controller.js
│   │   ├── lib/prisma.js
│   │   ├── routes/nutrition.routes.js
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   └── README.md
└── docs/
    ├── arquitetura.md
    └── entrega-inicial.md
```

### Decisões arquiteturais

O frontend e o backend ficam separados para que a chave do Gemini permaneça exclusivamente no servidor. A API é versionada em `/api/v1`, a rota multimodal aceita texto ou imagem, e o contrato nutricional é protegido em duas camadas: JSON Schema no Gemini e Zod no backend. O upload da foto usa memória, tem limite de tamanho e não é persistido em disco.

O modelo `WorkoutExercise` resolve a associação entre treinos e exercícios, enquanto `WorkoutSet` guarda séries, repetições, carga e descanso, que são os dados necessários para acompanhar progressive overload sem duplicar definições de exercícios.

## 2. Esquema do banco de dados

O arquivo completo está em `backend/prisma/schema.prisma` e também é reproduzido abaixo:

### `backend/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum MealSource {
  TEXT
  IMAGE
}

model User {
  id                String   @id @default(uuid()) @db.Uuid
  name              String
  email             String   @unique
  passwordHash      String   @map("password_hash")
  calorieGoal       Int?     @map("calorie_goal")
  proteinGoalG      Decimal? @map("protein_goal_g") @db.Decimal(10, 2)
  carbohydrateGoalG Decimal? @map("carbohydrate_goal_g") @db.Decimal(10, 2)
  fatGoalG          Decimal? @map("fat_goal_g") @db.Decimal(10, 2)
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  meals    Meal[]
  workouts Workout[]

  @@map("users")
}

model Meal {
  id                 String     @id @default(uuid()) @db.Uuid
  userId             String     @map("user_id") @db.Uuid
  source             MealSource
  description        String?    @db.Text
  imageUri           String?    @map("image_uri") @db.Text
  calories           Decimal    @db.Decimal(10, 2)
  proteinGrams       Decimal    @map("protein_grams") @db.Decimal(10, 2)
  carbohydratesGrams Decimal    @map("carbohydrates_grams") @db.Decimal(10, 2)
  fatGrams           Decimal    @map("fat_grams") @db.Decimal(10, 2)
  consumedAt         DateTime   @default(now()) @map("consumed_at")
  createdAt          DateTime   @default(now()) @map("created_at")
  updatedAt          DateTime   @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, consumedAt])
  @@map("meals")
}

model Workout {
  id          String    @id @default(uuid()) @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  name        String
  split       String?   @db.VarChar(20)
  scheduledAt DateTime? @map("scheduled_at")
  startedAt   DateTime? @map("started_at")
  finishedAt  DateTime? @map("finished_at")
  notes       String?   @db.Text
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  exercises WorkoutExercise[]

  @@index([userId, scheduledAt])
  @@map("workouts")
}

model Exercise {
  id           String   @id @default(uuid()) @db.Uuid
  name         String
  muscleGroup  String?  @map("muscle_group") @db.VarChar(80)
  instructions String?  @db.Text
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  workouts WorkoutExercise[]

  @@index([name])
  @@map("exercises")
}

// Entidade associativa: o mesmo exercício pode aparecer em diferentes treinos.
model WorkoutExercise {
  id         String   @id @default(uuid()) @db.Uuid
  workoutId  String   @map("workout_id") @db.Uuid
  exerciseId String   @map("exercise_id") @db.Uuid
  order      Int      @default(0)
  notes      String?  @db.Text
  createdAt  DateTime @default(now()) @map("created_at")

  workout  Workout      @relation(fields: [workoutId], references: [id], onDelete: Cascade)
  exercise Exercise     @relation(fields: [exerciseId], references: [id], onDelete: Restrict)
  sets     WorkoutSet[]

  @@unique([workoutId, order])
  @@index([exerciseId])
  @@map("workout_exercises")
}

// Cada linha representa uma série registrada e habilita o progressive overload.
model WorkoutSet {
  id                String   @id @default(uuid()) @db.Uuid
  workoutExerciseId String   @map("workout_exercise_id") @db.Uuid
  setNumber         Int      @map("set_number")
  repetitions       Int?
  weightKg          Decimal? @map("weight_kg") @db.Decimal(8, 2)
  restSeconds       Int?     @map("rest_seconds")
  completed         Boolean  @default(false)
  createdAt         DateTime @default(now()) @map("created_at")

  workoutExercise WorkoutExercise @relation(fields: [workoutExerciseId], references: [id], onDelete: Cascade)

  @@unique([workoutExerciseId, setNumber])
  @@map("workout_sets")
}

```

## 3. Setup do backend Express

O entrypoint é `backend/src/server.js`. `app.js` concentra middleware, health check, rotas e tratamento de erros; isso facilita testes sem abrir uma porta HTTP.

### `backend/src/config/env.js`

```javascript
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY é obrigatória"),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.8-flash"),
  CORS_ORIGIN: z.string().default("*"),
  MAX_IMAGE_SIZE_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

```

### `backend/src/lib/prisma.js`

```javascript
import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

// Uma única instância evita abrir múltiplos pools durante o hot reload local.
const prisma = new PrismaClient({
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});

export default prisma;

```

### `backend/src/app.js`

```javascript
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import nutritionRoutes from "./routes/nutrition.routes.js";

const app = express();
const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);

app.disable("x-powered-by");

app.use(cors({
  origin: (origin, callback) => {
    // Apps nativos normalmente não enviam Origin; permitir requisições sem esse header.
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origem não autorizada pelo CORS."));
  }
}));

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "hypertrophy-app-backend",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/v1/nutrition", nutritionRoutes);

app.use((_req, res) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: "Rota não encontrada."
  });
});

// Erros de todas as rotas convergem para um formato previsível para o mobile.
app.use((error, _req, res, _next) => {
  const statusCode = error.code === "LIMIT_FILE_SIZE"
    ? 413
    : Number.isInteger(error.statusCode) ? error.statusCode : 500;

  if (env.NODE_ENV !== "production") {
    console.error(error);
  }

  return res.status(statusCode).json({
    error: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR",
    message: statusCode === 500 ? "Erro interno do servidor." : error.message
  });
});

export default app;

```

### `backend/src/server.js`

```javascript
import app from "./app.js";
import { env } from "./config/env.js";
import prisma from "./lib/prisma.js";

const server = app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`API disponível em http://localhost:${env.PORT}`);
});

async function shutdown(signal) {
  console.log(`Recebido ${signal}. Encerrando o servidor...`);

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

```

### `backend/package.json`

```json
{
  "name": "hipertrofia-app-backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "prisma:generate": "prisma generate",
    "prisma:validate": "prisma validate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  },
  "dependencies": {
    "@google/genai": "^2.24.0",
    "@prisma/client": "^6.19.0",
    "cors": "^2.8.6",
    "dotenv": "^18.0.4",
    "express": "^5.2.1",
    "multer": "^2.4.0",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "nodemon": "^3.1.14",
    "prisma": "^6.19.0"
  }
}

```

### `backend/.env.example`

```dotenv
# Ambiente da aplicação
NODE_ENV=development
PORT=3333

# PostgreSQL usado pelo Prisma
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hipertrofia_app?schema=public

# Google Gemini API
GEMINI_API_KEY=coloque_sua_chave_do_google_ai_studio_aqui
GEMINI_MODEL=gemini-3.8-flash

# Pode ser uma lista separada por vírgulas em desenvolvimento
CORS_ORIGIN=http://localhost:8081,http://localhost:19006

# Limite do upload em memória: 10 MiB
MAX_IMAGE_SIZE_BYTES=10485760

```

## 4. Rota da IA

A rota `POST /api/v1/nutrition/analyze` aceita:

| Entrada | Content-Type | Campos |
| --- | --- | --- |
| Texto | `application/json` | `description` |
| Foto | `multipart/form-data` | `image` e `description` opcional |

### Controlador e system prompt exato

### `backend/src/controllers/nutrition.controller.js`

```javascript
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "../config/env.js";

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

    if (!rawText) {
      throw httpError(502, "O Gemini não retornou uma resposta nutricional.");
    }

    let rawJson;
    try {
      rawJson = JSON.parse(rawText);
    } catch (error) {
      throw httpError(502, "O Gemini retornou um JSON inválido.", error);
    }

    const parsed = nutritionOutputSchema.safeParse(rawJson);

    if (!parsed.success) {
      throw httpError(502, "A resposta do Gemini não respeitou o contrato nutricional.", parsed.error);
    }

    // Retorna somente o objeto do contrato para o app mobile.
    return res.status(200).json(parsed.data);
  } catch (error) {
    return next(error);
  }
}

```

### `backend/src/routes/nutrition.routes.js`

```javascript
import { Router } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { analyzeMeal } from "../controllers/nutrition.controller.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_IMAGE_SIZE_BYTES,
    files: 1
  },
  fileFilter: (_req, file, callback) => {
    const acceptedMimeTypes = new Set([
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif"
    ]);

    if (!acceptedMimeTypes.has(file.mimetype)) {
      return callback(new Error("Formato de imagem não suportado. Use JPEG, PNG, WebP, HEIC ou HEIF."));
    }

    return callback(null, true);
  }
});

router.post("/analyze", upload.single("image"), analyzeMeal);

export default router;

```

## Execução

```bash
cd backend
cp .env.example .env
# preencha GEMINI_API_KEY e DATABASE_URL
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Texto:

```bash
curl -X POST http://localhost:3333/api/v1/nutrition/analyze \
  -H 'Content-Type: application/json' \
  -d '{"description":"comi 200g de peito de frango e 150g de arroz branco"}'
```

Foto:

```bash
curl -X POST http://localhost:3333/api/v1/nutrition/analyze \
  -F 'image=@/caminho/para/prato.jpg' \
  -F 'description=Almoço com arroz, feijão, frango e salada'
```

A API retorna somente o objeto JSON validado, por exemplo:

```json
{
  "calories": 500,
  "proteinGrams": 42.5,
  "carbohydratesGrams": 55,
  "fatGrams": 10
}
```

## Próxima etapa

A estrutura está preparada para a implementação das telas no React Native com Expo, mas nenhuma tela foi criada nesta entrega.
