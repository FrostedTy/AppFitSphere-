import { apiRequest } from "./api";
import type { BodyWeightEntry, BodyWeightHistory } from "../types/progress";

function validateEntry(payload: unknown): BodyWeightEntry {
  if (!payload || typeof payload !== "object") throw new Error("O servidor não retornou a medição de peso.");
  const entry = payload as Partial<BodyWeightEntry>;
  if (
    typeof entry.id !== "string" ||
    typeof entry.weightKg !== "number" || !Number.isFinite(entry.weightKg) || entry.weightKg <= 0 ||
    typeof entry.measuredAt !== "string" || Number.isNaN(Date.parse(entry.measuredAt)) ||
    !(entry.notes === null || typeof entry.notes === "string") ||
    typeof entry.createdAt !== "string" || Number.isNaN(Date.parse(entry.createdAt))
  ) throw new Error("O servidor retornou uma medição inválida.");
  return entry as BodyWeightEntry;
}

export async function getBodyWeightHistory(token: string, limit = 30): Promise<BodyWeightHistory> {
  const payload = await apiRequest<unknown>(`/api/v1/progress/body-weight?limit=${limit}`, { token });
  if (!payload || typeof payload !== "object") throw new Error("O servidor não retornou o histórico de peso.");
  const value = payload as { entries?: unknown; limit?: unknown };
  if (!Array.isArray(value.entries) || !Number.isInteger(value.limit)) throw new Error("O servidor retornou um histórico de peso inválido.");
  const entries = value.entries.map(validateEntry);
  for (let index = 1; index < entries.length; index += 1) {
    if (Date.parse(entries[index - 1].measuredAt) > Date.parse(entries[index].measuredAt)) {
      throw new Error("O histórico de peso veio fora da ordem esperada.");
    }
  }
  return { entries, limit: value.limit as number };
}

export async function createBodyWeightEntry(token: string, weightKg: number): Promise<BodyWeightEntry> {
  const payload = await apiRequest<unknown>("/api/v1/progress/body-weight", {
    method: "POST", token, body: { weightKg }
  });
  if (!payload || typeof payload !== "object" || !("entry" in payload)) throw new Error("O servidor não confirmou a pesagem.");
  return validateEntry((payload as { entry: unknown }).entry);
}
