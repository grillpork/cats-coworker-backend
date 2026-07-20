import { db } from "../../config/db.js";
import { mapsTable, spritesTable } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "../../middleware/r2.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";

// Process sprite image upload
const processSpriteImage = async (file) => {
  if (!file) return null;

  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
  const buffer = await sharp(file.buffer)
    .resize(64, 64, { fit: "inside", withoutEnlargement: true }) // Sprites are small tiles
    .webp({ quality: 90 })
    .toBuffer();

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: `sprites/${filename}`,
    Body: buffer,
    ContentType: "image/webp",
  });

  await r2Client.send(command);

  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/sprites/${filename}`;
  }
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/sprites/${filename}`;
};

// GET current map layout (everyone can read)
export const getActiveMap = async (req, res) => {
  try {
    // Just fetch the latest map (or first map) in the database
    const maps = await db.select().from(mapsTable).limit(1);
    if (maps.length === 0) {
      return res.json(null);
    }
    res.json(maps[0]);
  } catch (error) {
    console.error("Get Active Map Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// SAVE or update map layout (ADMIN ONLY)
export const saveMap = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, rows, cols, tiles } = req.body;

    if (!rows || !cols || !tiles) {
      return res.status(400).json({ error: "rows, cols, and tiles grid are required" });
    }

    // Check if a map already exists
    const existing = await db.select().from(mapsTable).limit(1);

    let mapResult;
    if (existing.length > 0) {
      // Update
      const [updated] = await db
        .update(mapsTable)
        .set({
          name: name || existing[0].name,
          rows: parseInt(rows, 10),
          cols: parseInt(cols, 10),
          tiles,
          updatedAt: new Date(),
        })
        .where(eq(mapsTable.id, existing[0].id))
        .returning();
      mapResult = updated;
    } else {
      // Create new
      const [inserted] = await db
        .insert(mapsTable)
        .values({
          userId,
          name: name || "My Custom Map",
          rows: parseInt(rows, 10),
          cols: parseInt(cols, 10),
          tiles,
        })
        .returning();
      mapResult = inserted;
    }

    res.json({
      message: "Map saved successfully",
      map: mapResult,
    });
  } catch (error) {
    console.error("Save Map Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET all sprites (everyone can read)
export const getAllSprites = async (req, res) => {
  try {
    const sprites = await db.select().from(spritesTable);
    // Sort by tileId to keep order consistent
    sprites.sort((a, b) => a.tileId.localeCompare(b.tileId));
    res.json(sprites);
  } catch (error) {
    console.error("Get All Sprites Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// CREATE or UPDATE a sprite (ADMIN ONLY)
export const upsertSprite = async (req, res) => {
  try {
    const { tileId, name } = req.body;

    if (!tileId || !name) {
      return res.status(400).json({ error: "tileId and name are required" });
    }

    // Check if tileId exists
    const existing = await db.select().from(spritesTable).where(eq(spritesTable.tileId, tileId)).limit(1);

    let imageUrl;
    if (req.file) {
      imageUrl = await processSpriteImage(req.file);
    }

    let spriteResult;
    if (existing.length > 0) {
      // Update
      const updateData = {
        name,
        updatedAt: new Date(),
      };
      if (imageUrl) {
        updateData.image = imageUrl;
      }

      const [updated] = await db
        .update(spritesTable)
        .set(updateData)
        .where(eq(spritesTable.id, existing[0].id))
        .returning();
      spriteResult = updated;
    } else {
      // Create new (image is required for new sprites)
      if (!imageUrl) {
        return res.status(400).json({ error: "Sprite image file is required for new tiles" });
      }

      const [inserted] = await db
        .insert(spritesTable)
        .values({
          tileId,
          name,
          image: imageUrl,
        })
        .returning();
      spriteResult = inserted;
    }

    res.json({
      message: "Sprite saved successfully",
      sprite: spriteResult,
    });
  } catch (error) {
    console.error("Upsert Sprite Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteSprite = async (req, res) => {
  try {
    const { tileId } = req.params;
    const deleted = await db.delete(spritesTable).where(eq(spritesTable.tileId, tileId)).returning();
    if (deleted.length === 0) {
      return res.status(404).json({ error: "Sprite not found" });
    }
    res.json({ message: "Sprite deleted successfully" });
  } catch (error) {
    console.error("Delete Sprite Error:", error);
    res.status(500).json({ error: error.message });
  }
};
