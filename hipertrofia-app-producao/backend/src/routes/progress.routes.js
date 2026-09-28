import { Router } from "express";
import { createBodyWeight, listBodyWeight } from "../controllers/body-weight.controller.js";

const router = Router();

// O app aplica requireAuth antes deste router; o owner vem exclusivamente do JWT.
router.get("/body-weight", listBodyWeight);
router.post("/body-weight", createBodyWeight);

export default router;
