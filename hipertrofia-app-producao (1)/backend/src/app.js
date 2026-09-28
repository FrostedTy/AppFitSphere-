import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { requireAuth } from "./middleware/require-auth.js";
import authRoutes from "./routes/auth.routes.js";
import nutritionRoutes from "./routes/nutrition.routes.js";
import workoutRoutes from "./routes/workouts.routes.js";
import progressRoutes from "./routes/progress.routes.js";

const app = express();
const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);

app.disable("x-powered-by");
// Render termina TLS atrás de um proxy; em produção, confiar só no hop frontal
// permite IP correto no rate limit sem aceitar toda a cadeia X-Forwarded-For.
app.set("trust proxy", env.NODE_ENV === "production" ? 1 : false);

app.use(cors({
  origin: (origin, callback) => {
    // Apps nativos normalmente não enviam Origin; permitir requisições sem esse header.
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const error = new Error("Origem não autorizada pelo CORS.");
    error.statusCode = 403;
    return callback(error);
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

// Cadastro e login são públicos; /auth/me aplica requireAuth dentro do router.
app.use("/api/v1/auth", authRoutes);

// Toda API funcional exige Bearer JWT: nutrição, catálogo, treinos e progressão.
app.use("/api/v1", requireAuth);
app.use("/api/v1/nutrition", nutritionRoutes);
app.use("/api/v1", workoutRoutes);
app.use("/api/v1/progress", progressRoutes);

app.use((_req, res) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: "Rota não encontrada."
  });
});

// Erros de validação, autenticação, upload e constraints do Prisma são traduzidos para HTTP.
app.use((error, _req, res, _next) => {
  const prismaStatuses = {
    P2000: 400,
    P2002: 409,
    P2003: 409,
    P2025: 404
  };
  const statusCode = error.code === "LIMIT_FILE_SIZE"
    ? 413
    : Number.isInteger(error.statusCode)
      ? error.statusCode
      : prismaStatuses[error.code] ?? 500;

  if (env.NODE_ENV !== "production" && statusCode >= 500) {
    console.error(error);
  }

  const response = {
    error: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR",
    message: statusCode === 500 ? "Erro interno do servidor." : error.message
  };

  if (Array.isArray(error.cause) && statusCode < 500) {
    response.details = error.cause;
  }

  return res.status(statusCode).json(response);
});

export default app;
