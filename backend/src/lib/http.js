import { z } from "zod";

export class HttpError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message, options);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

export function parseOrThrow(schema, value, message = "Dados de entrada inválidos.") {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }));
    throw new HttpError(400, message, { cause: details });
  }
  return result.data;
}

export const uuidSchema = z.string().uuid();

export function paginationFromQuery(query, defaults = {}) {
  const schema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(defaults.limit ?? 20),
    offset: z.coerce.number().int().min(0).max(100_000).default(0)
  });
  return parseOrThrow(schema, query);
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
