import { randomBytes } from "node:crypto";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { asyncHandler, HttpError, parseOrThrow, uuidSchema } from "../lib/http.js";
import { createAccessToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { env } from "../config/env.js";

const passwordSchema = z.string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(72, "A senha não pode ultrapassar 72 caracteres.")
  .refine((password) => Buffer.byteLength(password, "utf8") <= 72, {
    message: "A senha deve ter no máximo 72 bytes em UTF-8."
  });

const registerSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").max(120),
  email: z.string().trim().email("E-mail inválido.").max(254).transform((email) => email.toLowerCase()),
  password: passwordSchema
}).strict();

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido.").max(254).transform((email) => email.toLowerCase()),
  password: passwordSchema
}).strict();

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  calorieGoal: true,
  proteinGoalG: true,
  carbohydrateGoalG: true,
  fatGoalG: true,
  createdAt: true
};

// Faz comparação bcrypt também quando o e-mail não existe, reduzindo diferença de tempo.
const dummyPasswordHash = await hashPassword(randomBytes(32).toString("hex"));

function tokenLifetimeSeconds(lifetime) {
  const match = /^(\d+)([smhd])$/.exec(lifetime);
  const factors = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * factors[match[2]];
}

function authResponse(user) {
  return {
    user,
    accessToken: createAccessToken(user),
    tokenType: "Bearer",
    expiresIn: tokenLifetimeSeconds(env.JWT_ACCESS_TOKEN_TTL)
  };
}

export const register = asyncHandler(async (req, res) => {
  const input = parseOrThrow(registerSchema, req.body);
  const passwordHash = await hashPassword(input.password);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash
      },
      select: publicUserSelect
    });
  } catch (error) {
    if (error.code === "P2002") throw new HttpError(409, "Já existe uma conta com este e-mail.");
    throw error;
  }
  res.status(201).json(authResponse(user));
});

export const login = asyncHandler(async (req, res) => {
  const input = parseOrThrow(loginSchema, req.body);
  const userWithPassword = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...publicUserSelect, passwordHash: true }
  });
  const matches = await verifyPassword(input.password, userWithPassword?.passwordHash ?? dummyPasswordHash);

  if (!userWithPassword || !matches) {
    throw new HttpError(401, "E-mail ou senha inválidos.");
  }

  const { passwordHash: _passwordHash, ...user } = userWithPassword;
  res.json(authResponse(user));
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = parseOrThrow(uuidSchema, req.auth.userId, "Identidade do token inválida.");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw new HttpError(401, "Conta não encontrada. Faça login novamente.");
  res.json({ user });
});
