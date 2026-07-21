import { Router } from "express";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";
import { addCharacter, getCharacters, deleteCharacter } from "./controller.js";

const router = Router();

router.get("/", authenticateToken, getCharacters);
router.post("/", authenticateToken, requireAdmin, addCharacter);
router.delete("/:id", authenticateToken, requireAdmin, deleteCharacter);

export default router;
