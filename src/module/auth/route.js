import express from "express";
import { register, login, getProfile, googleOAuth, oauthLogin } from "./controller.js";
import { authenticateToken } from "../../middleware/auth.js";
import { rateLimiter } from "../../middleware/rateLimit.js";

const router = express.Router();

const authRateLimiter = rateLimiter(20, 15 * 60 * 1000); // 20 requests per 15 mins for login/register
const standardRateLimiter = rateLimiter(100, 15 * 60 * 1000); // 100 requests per 15 mins

router.post("/register", authRateLimiter, register);
router.post("/login", authRateLimiter, login);
router.post("/google", authRateLimiter, googleOAuth);
router.post("/google-login", authRateLimiter, googleOAuth);
router.post("/oauth", authRateLimiter, oauthLogin);
router.get("/me", standardRateLimiter, authenticateToken, getProfile);

// Role CRUD Routes
import { getAllRoles, getRoleById, createRole, updateRole, deleteRole } from "./role.controller.js";

router.get("/roles", getAllRoles);
router.get("/roles/:id", getRoleById);
router.post("/roles", createRole);
router.put("/roles/:id", updateRole);
router.delete("/roles/:id", deleteRole);

export default router;
