import { Router } from "express";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";
import { getStorageStats } from "./controller.js";

const router = Router();

router.get("/stats", authenticateToken, requireAdmin, getStorageStats);

export default router;
