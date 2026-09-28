import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY é obrigatória"),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.8-flash"),
  NUTRITION_AI_MODE: z.enum(["gemini", "mock"]).default("gemini"),
  JWT_SECRET: z.string()
    .min(32, "JWT_SECRET deve ter ao menos 32 caracteres aleatórios")
    .refine((secret) => !/substitua|change.?me|replace.?me|example/i.test(secret), {
      message: "JWT_SECRET ainda contém texto de exemplo; gere um segredo aleatório."
    }),
  JWT_ACCESS_TOKEN_TTL: z.string().regex(/^\d+[smhd]$/, "Use um TTL como 15m, 1h ou 1d").default("15m"),
  CORS_ORIGIN: z.string().default(""),
  MAX_IMAGE_SIZE_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024)
}).superRefine((config, context) => {
  if (config.NUTRITION_AI_MODE === "mock" && config.NODE_ENV !== "test") {
    context.addIssue({
      code: "custom",
      path: ["NUTRITION_AI_MODE"],
      message: "O modo mock da nutrição só pode ser usado quando NODE_ENV=test."
    });
  }
  if (config.NUTRITION_AI_MODE === "mock") {
    let databaseName = "";
    try {
      databaseName = new URL(config.DATABASE_URL).pathname.split("/").filter(Boolean).at(-1) || "";
    } catch {
      // DATABASE_URL inválida permanece sujeita às demais validações do setup Prisma.
    }
    if (!/(?:^|[_-])(test|e2e)(?:$|[_-])/i.test(databaseName)) {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "O modo mock exige que o nome do banco contenha 'test' ou 'e2e'."
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
