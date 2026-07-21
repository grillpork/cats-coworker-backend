import { db } from "../../config/db.js";
import { charactersTable } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export const addCharacter = async (req, res) => {
  const { name, avatarUrl } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Character name is required" });
  }

  if (!avatarUrl || !avatarUrl.trim()) {
    return res.status(400).json({ error: "avatarUrl is required" });
  }

  // Enforce validation to match relative files or standard URLs
  if (!avatarUrl.startsWith('/') && !avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://')) {
    return res.status(400).json({ error: "Invalid avatarUrl format. It must start with '/' or HTTP scheme." });
  }

  try {
    const [newChar] = await db
      .insert(charactersTable)
      .values({
        name: name.trim(),
        avatarUrl: avatarUrl.trim(),
      })
      .returning();

    res.status(201).json({
      message: "Character added successfully",
      character: newChar
    });
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation (avatarUrl)
      return res.status(400).json({ error: "A character with this avatarUrl already exists" });
    }
    console.error("Add Character Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getCharacters = async (req, res) => {
  try {
    const list = await db.select().from(charactersTable);
    res.json(list);
  } catch (error) {
    console.error("Get Characters Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteCharacter = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Character ID is required" });
  }

  try {
    const [deleted] = await db
      .delete(charactersTable)
      .where(eq(charactersTable.id, parseInt(id, 10)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Character not found" });
    }

    res.json({
      message: "Character deleted successfully",
      character: deleted
    });
  } catch (error) {
    console.error("Delete Character Error:", error);
    res.status(500).json({ error: error.message });
  }
};
