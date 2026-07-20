import { db } from "../../config/db.js";
import { catsTable, userInventoryTable, catPlacementsTable } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "../../middleware/r2.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const processImage = async (file) => {
  if (!file) return null;

  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;

  let quality = 80;
  let width = 800;
  let height = 800;
  let buffer;
  const maxSize = 150 * 1024; // 150KB

  // Loop to reduce quality and dimensions until the image size is under 150KB
  do {
    buffer = await sharp(file.buffer)
      .resize(width, height, { fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

    if (buffer.length <= maxSize) {
      break;
    }

    if (quality > 20) {
      quality -= 10; // Reduce quality in steps of 10
    } else {
      // If quality is already low, start shrinking the dimensions
      width = Math.round(width * 0.8);
      height = Math.round(height * 0.8);
    }
  } while (buffer.length > maxSize && width > 100);

  // Upload to Cloudflare R2
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: `cats/${filename}`,
    Body: buffer,
    ContentType: "image/webp",
  });

  await r2Client.send(command);

  // Return public URL if configured, otherwise return the relative path or R2 URL
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/cats/${filename}`;
  }
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/cats/${filename}`;
};


export const getAllCats = async (req, res) => {
  try {
    const cats = await db.select().from(catsTable);
    res.json(cats);
  } catch (error) {
    console.error("Get All Cats Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getCatById = async (req, res) => {
  try {
    const { id } = req.params;
    const cats = await db.select().from(catsTable).where(eq(catsTable.id, parseInt(id, 10))).limit(1);
    
    if (cats.length === 0) {
      return res.status(404).json({ error: "Cat not found" });
    }
    
    res.json(cats[0]);
  } catch (error) {
    console.error("Get Cat Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const createCat = async (req, res) => {
  try {
    const { name, breed, age, description, rarity, type, spRate } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    
    const imageUrl = await processImage(req.file);
    
    const [newCat] = await db.insert(catsTable).values({
      name,
      breed,
      age: age ? parseInt(age, 10) : null,
      description,
      image: imageUrl,
      rarity: rarity || "COMMON",
      type: type || "standard",
      spRate: spRate ? parseInt(spRate, 10) : 10,
    }).returning();
    
    res.status(201).json({
      message: "Cat created successfully",
      cat: newCat,
    });
  } catch (error) {
    console.error("Create Cat Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const updateCat = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, breed, age, description, rarity, type, spRate } = req.body;
    
    const imageUrl = await processImage(req.file);
    
    const updateData = {
      name,
      breed,
      age: age ? parseInt(age, 10) : null,
      description,
      updatedAt: new Date(),
    };
    
    if (imageUrl) {
      updateData.image = imageUrl;
    }
    if (rarity !== undefined) updateData.rarity = rarity;
    if (type !== undefined) updateData.type = type;
    if (spRate !== undefined) updateData.spRate = spRate ? parseInt(spRate, 10) : 10;
    
    const [updatedCat] = await db.update(catsTable)
      .set(updateData)
      .where(eq(catsTable.id, parseInt(id, 10)))
      .returning();
      
    if (!updatedCat) {
      return res.status(404).json({ error: "Cat not found" });
    }
    
    res.json({
      message: "Cat updated successfully",
      cat: updatedCat,
    });
  } catch (error) {
    console.error("Update Cat Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteCat = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [deletedCat] = await db.delete(catsTable)
      .where(eq(catsTable.id, parseInt(id, 10)))
      .returning();
      
    if (!deletedCat) {
      return res.status(404).json({ error: "Cat not found" });
    }
    
    res.json({
      message: "Cat deleted successfully",
      cat: deletedCat,
    });
  } catch (error) {
    console.error("Delete Cat Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getUserInventory = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch active placements to identify currently working cat inventory instance IDs
    const placements = await db
      .select({
        cat: catPlacementsTable.catData,
      })
      .from(catPlacementsTable)
      .where(eq(catPlacementsTable.userId, userId));

    const occupiedInventoryIds = placements
      .map((p) => p.cat?.id)
      .filter((id) => id !== undefined && id !== null);

    const inventory = await db.select({
      id: userInventoryTable.id,
      userId: userInventoryTable.userId,
      catId: userInventoryTable.catId,
      createdAt: userInventoryTable.createdAt,
      name: catsTable.name,
      breed: catsTable.breed,
      age: catsTable.age,
      image: catsTable.image,
      description: catsTable.description,
      rarity: catsTable.rarity,
      type: catsTable.type,
      spRate: catsTable.spRate,
    })
    .from(userInventoryTable)
    .innerJoin(catsTable, eq(userInventoryTable.catId, catsTable.id))
    .where(eq(userInventoryTable.userId, userId));

    // Filter out cats that are currently deployed on desks
    const filtered = inventory.filter((item) => !occupiedInventoryIds.includes(item.id));

    const formatted = filtered.map(item => ({
      id: item.id,
      catId: item.catId,
      name: item.name,
      breed: item.breed,
      age: item.age,
      image: item.image,
      description: item.description,
      rarity: item.rarity,
      type: item.type,
      spRate: item.spRate,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Get Inventory Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const addCatToInventory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { catId } = req.body;
    
    if (!catId) {
      return res.status(400).json({ error: "catId is required" });
    }
    
    const [inserted] = await db.insert(userInventoryTable).values({
      userId,
      catId: parseInt(catId, 10),
    }).returning();
    
    res.status(201).json({
      message: "Cat added to inventory successfully",
      inventoryItem: inserted,
    });
  } catch (error) {
    console.error("Add Cat to Inventory Error:", error);
    res.status(500).json({ error: error.message });
  }
};
