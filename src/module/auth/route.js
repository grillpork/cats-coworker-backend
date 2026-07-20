import express from "express";
import { register, login, getProfile } from "./controller.js";
import { authenticateToken } from "../../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticateToken, getProfile);

// Role CRUD Routes
import { getAllRoles, getRoleById, createRole, updateRole, deleteRole } from "./role.controller.js";

router.get("/roles", getAllRoles);
router.get("/roles/:id", getRoleById);
router.post("/roles", createRole);
router.put("/roles/:id", updateRole);
router.delete("/roles/:id", deleteRole);

export default router;
