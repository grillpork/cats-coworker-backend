import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";
import { updateProfile, getAllUsers, updateUserRole, getUserSp, updateUserSp } from "./controller.js";

const router = Router();

router.get("/all", authenticateToken, requireAdmin, getAllUsers);
router.put("/role", authenticateToken, requireAdmin, updateUserRole);
router.get("/sp", authenticateToken, getUserSp);
router.put("/sp", authenticateToken, updateUserSp);

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only images (.jpeg, .jpg, .png, .webp) are allowed"));
  },
});

router.put("/", authenticateToken, updateProfile);

router.post(
  "/upload-avatar",
  authenticateToken,
  upload.single("avatar"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload an image file" });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    res.json({
      message: "Avatar uploaded successfully",
      avatarUrl,
    });
  },
  (error, req, res, next) => {
    res.status(400).json({ error: error.message });
  }
);

export default router;
