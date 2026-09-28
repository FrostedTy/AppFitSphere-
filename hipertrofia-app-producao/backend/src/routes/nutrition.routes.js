import { Router } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { analyzeMeal, getDailyMealHistory } from "../controllers/nutrition.controller.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_IMAGE_SIZE_BYTES,
    files: 1
  },
  fileFilter: (_req, file, callback) => {
    const acceptedMimeTypes = new Set([
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif"
    ]);

    if (!acceptedMimeTypes.has(file.mimetype)) {
      return callback(new Error("Formato de imagem não suportado. Use JPEG, PNG, WebP, HEIC ou HEIF."));
    }

    return callback(null, true);
  }
});

router.get("/history", getDailyMealHistory);
router.post("/analyze", upload.single("image"), analyzeMeal);

export default router;
