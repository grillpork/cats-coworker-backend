import express from "express";
import { getActiveMap, saveMap, getAllSprites, upsertSprite, deleteSprite } from "./controller.js";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";
import { upload } from "../../middleware/upload.js";

const router = express.Router();

// Map layout routes
router.get("/", getActiveMap);
router.post("/", authenticateToken, requireAdmin, saveMap);

// Sprite routes
router.get("/sprites", getAllSprites);
router.post("/sprites", authenticateToken, requireAdmin, upload.single("image"), upsertSprite);
router.delete("/sprites/:tileId", authenticateToken, requireAdmin, deleteSprite);

export default router;
