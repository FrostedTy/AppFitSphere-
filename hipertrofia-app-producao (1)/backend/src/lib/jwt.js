import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const JWT_ISSUER = "hipertrofia-app-api";
const JWT_ALGORITHM = "HS256";

export function createAccessToken(user) {
  return jwt.sign(
    { email: user.email },
    env.JWT_SECRET,
    {
      algorithm: JWT_ALGORITHM,
      subject: user.id,
      issuer: JWT_ISSUER,
      expiresIn: env.JWT_ACCESS_TOKEN_TTL
    }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: [JWT_ALGORITHM],
    issuer: JWT_ISSUER
  });
}
