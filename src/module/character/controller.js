import { db } from "../../config/db.js";
import { charactersTable } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export const addCharacter = async (req, res) => {
  const { name, price } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Character name is required" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "Please upload an image file for the character avatar" });
  }

  const avatarUrl = `/uploads/${req.file.filename}`;

  try {
    const [newChar] = await db
      .insert(charactersTable)
      .values({
        name: name.trim(),
        avatarUrl,
        price: price ? parseInt(price, 10) : 0,
      })
      .returning();

    res.status(201).json({
      message: "Character added successfully",
      character: newChar
    });
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation (avatarUrl)
      return res.status(400).json({ error: "A character with this avatar already exists" });
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

export const updateCharacter = async (req, res) => {
  const { id } = req.params;
  const { name, price } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Character ID is required" });
  }

  try {
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (price !== undefined) updateData.price = parseInt(price, 10);
    if (req.file) {
      updateData.avatarUrl = `/uploads/${req.file.filename}`;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const [updated] = await db
      .update(charactersTable)
      .set(updateData)
      .where(eq(charactersTable.id, parseInt(id, 10)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Character not found" });
    }

    res.json({
      message: "Character updated successfully",
      character: updated
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: "A character with this avatar already exists" });
    }
    console.error("Update Character Error:", error);
    res.status(500).json({ error: error.message });
  }
};
