import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";
import { addCharacter, getCharacters, deleteCharacter, updateCharacter } from "./controller.js";

const router = Router();

// Configure multer storage for character avatars
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
    cb(null, `character-${uniqueSuffix}${ext}`);
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

router.get("/", authenticateToken, getCharacters);
router.post("/", authenticateToken, requireAdmin, upload.single("avatar"), addCharacter);
router.put("/:id", authenticateToken, requireAdmin, upload.single("avatar"), updateCharacter);
router.delete("/:id", authenticateToken, requireAdmin, deleteCharacter);

export default router;
