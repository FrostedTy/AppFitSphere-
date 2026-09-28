import { z } from "zod";
import prisma from "../lib/prisma.js";
import { asyncHandler, HttpError, parseOrThrow, uuidSchema } from "../lib/http.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(90).default(30)
});

const createSchema = z.object({
  weightKg: z.number().finite().min(20).max(500),
  measuredAt: z.string().datetime({ offset: true }).transform((value) => new Date(value)).optional(),
  notes: z.string().trim().max(500).nullable().optional()
}).strict();

function serializeEntry(entry) {
  return {
    id: entry.id,
    weightKg: Number(entry.weightKg),
    measuredAt: entry.measuredAt.toISOString(),
    notes: entry.notes,
    createdAt: entry.createdAt.toISOString()
  };
}

export const listBodyWeight = asyncHandler(async (req, res) => {
  const userId = parseOrThrow(uuidSchema, req.auth.userId, "userId inválido.");
  const query = parseOrThrow(listQuerySchema, req.query);
  const records = await prisma.bodyWeightEntry.findMany({
    where: { userId },
    orderBy: [{ measuredAt: "desc" }, { createdAt: "desc" }],
    take: query.limit
  });
  const entries = records.reverse().map(serializeEntry);
  res.json({ entries, limit: query.limit });
});

export const createBodyWeight = asyncHandler(async (req, res) => {
  const userId = parseOrThrow(uuidSchema, req.auth.userId, "userId inválido.");
  const data = parseOrThrow(createSchema, req.body);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new HttpError(404, "Usuário não encontrado.");

  const entry = await prisma.bodyWeightEntry.create({
    data: {
      userId,
      weightKg: data.weightKg,
      ...(data.measuredAt ? { measuredAt: data.measuredAt } : {}),
      ...(data.notes ? { notes: data.notes } : {})
    }
  });
  res.status(201).json({ entry: serializeEntry(entry) });
});
