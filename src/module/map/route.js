import express from "express";
import { getActiveMap, getAllMaps, createRoomMap, saveMap, getAllSprites, upsertSprite, deleteSprite, getAllRooms, createRoomInstance, updateRoomInstance, deleteRoomInstance } from "./controller.js";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";
import { upload } from "../../middleware/upload.js";

const router = express.Router();

// Map layout routes
router.get("/", getActiveMap);
router.get("/all", getAllMaps);
router.post("/create", authenticateToken, createRoomMap);
router.post("/", authenticateToken, requireAdmin, saveMap);

// Room instance routes (matchmaking / Roblox-style lobby)
router.get("/rooms", getAllRooms);
router.post("/rooms", authenticateToken, createRoomInstance);
router.put("/rooms/:id", authenticateToken, updateRoomInstance);
router.delete("/rooms/:id", authenticateToken, deleteRoomInstance);

// Sprite routes
router.get("/sprites", getAllSprites);
router.post("/sprites", authenticateToken, requireAdmin, upload.single("image"), upsertSprite);
router.delete("/sprites/:tileId", authenticateToken, requireAdmin, deleteSprite);

export default router;
