import express from "express";
import { getAllCats, getCatById, createCat, updateCat, deleteCat, getUserInventory, addCatToInventory } from "./controller.js";
import { authenticateToken } from "../../middleware/auth.js";
import { upload } from "../../middleware/upload.js";
import { getUserPlacements, placeCat, pickupCat } from "./placement.controller.js";

const router = express.Router();

router.get("/", getAllCats);

// Cat Inventory Routes
router.get("/inventory", authenticateToken, getUserInventory);
router.post("/inventory", authenticateToken, addCatToInventory);

// Cat Placement Routes (Static routes must be above dynamic :id routes)
router.get("/placements", authenticateToken, getUserPlacements);
router.post("/placements", authenticateToken, placeCat);
router.delete("/placements/:slotIndex", authenticateToken, pickupCat);

// Dynamic routes
router.get("/:id", getCatById);
router.post("/", authenticateToken, upload.single("image"), createCat);
router.put("/:id", authenticateToken, upload.single("image"), updateCat);
router.delete("/:id", authenticateToken, deleteCat);

export default router;
