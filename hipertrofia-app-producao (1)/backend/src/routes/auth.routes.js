import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { getCurrentUser, login, register } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/require-auth.js";

const router = Router();

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "TOO_MANY_REQUESTS",
    message: "Muitas tentativas. Aguarde alguns minutos e tente novamente."
  }
});

router.post("/register", authRateLimit, register);
router.post("/login", authRateLimit, login);
router.get("/me", requireAuth, getCurrentUser);

export default router;
