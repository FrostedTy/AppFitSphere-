import { verifyAccessToken } from "../lib/jwt.js";

export function requireAuth(req, res, next) {
  const authorization = req.get("authorization");
  const [scheme, token, extra] = authorization?.trim().split(/\s+/) ?? [];

  if (scheme?.toLowerCase() !== "bearer" || !token || extra) {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Envie um token válido no cabeçalho Authorization: Bearer <token>."
    });
  }

  try {
    const payload = verifyAccessToken(token);
    if (typeof payload === "string" || !payload.sub) {
      throw new Error("JWT subject ausente.");
    }

    req.auth = {
      userId: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined
    };
    return next();
  } catch {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Token inválido ou expirado. Faça login novamente."
    });
  }
}
