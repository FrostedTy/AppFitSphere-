import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

// Uma única instância evita abrir múltiplos pools durante o hot reload local.
const prisma = new PrismaClient({
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});

export default prisma;
