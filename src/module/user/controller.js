import { db } from "../../config/db.js";
import { usersTable, charactersTable } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export const updateProfile = async (req, res) => {
  const { name, avatar } = req.body;
  const userId = req.user.id;

  try {
    const updateData = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: "Invalid name" });
      }
      updateData.name = name.trim();
    }
    
    if (avatar !== undefined) {
      const [matchingChar] = await db
        .select()
        .from(charactersTable)
        .where(eq(charactersTable.avatarUrl, avatar))
        .limit(1);

      if (!matchingChar) {
        return res.status(400).json({ error: "Invalid character selection. You must choose a character existing in the system." });
      }
      updateData.avatar = avatar;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const [updatedUser] = await db
      .update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, userId))
      .returning({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        roleId: usersTable.roleId,
        avatar: usersTable.avatar,
      });

    res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const allUsers = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      roleId: usersTable.roleId,
      avatar: usersTable.avatar,
      createdAt: usersTable.createdAt,
    }).from(usersTable);
    
    res.json(allUsers);
  } catch (error) {
    console.error("Get All Users Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const updateUserRole = async (req, res) => {
  const { userId, roleId } = req.body;

  if (!userId || !roleId) {
    return res.status(400).json({ error: "userId and roleId are required" });
  }

  try {
    const [updatedUser] = await db
      .update(usersTable)
      .set({ roleId: parseInt(roleId, 10) })
      .where(eq(usersTable.id, parseInt(userId, 10)))
      .returning({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        roleId: usersTable.roleId,
      });

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "User role updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update User Role Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getUserSp = async (req, res) => {
  try {
    const [user] = await db
      .select({ sp: usersTable.sp })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id))
      .limit(1);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ sp: user.sp });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateUserSp = async (req, res) => {
  const { sp } = req.body;
  if (sp === undefined) {
    return res.status(400).json({ error: "sp value is required" });
  }
  try {
    const [updatedUser] = await db
      .update(usersTable)
      .set({ sp: parseInt(sp, 10) })
      .where(eq(usersTable.id, req.user.id))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "SP updated successfully", sp: updatedUser.sp });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

export const getStorageInfo = async (req, res) => {
  try {
    // 1. Get database size from PostgreSQL
    const dbSizeResult = await db.execute(sql`SELECT pg_database_size(current_database())`);
    const dbSizeBytes = parseInt(dbSizeResult.rows[0]?.pg_database_size || "0", 10);

    // 2. Get uploads folder size
    let uploadsSizeBytes = 0;
    const uploadDir = "uploads/";
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      for (const file of files) {
        const stats = fs.statSync(path.join(uploadDir, file));
        if (stats.isFile()) {
          uploadsSizeBytes += stats.size;
        }
      }
    }

    // Total size used in bytes
    const totalSizeBytes = dbSizeBytes + uploadsSizeBytes;

    // Define capacity limit in bytes (e.g. 50 MB for this app context)
    const limitBytes = 50 * 1024 * 1024; // 50MB limit

    res.json({
      dbSizeBytes,
      uploadsSizeBytes,
      totalSizeBytes,
      limitBytes,
      dbSizePretty: (dbSizeBytes / 1024 / 1024).toFixed(2) + " MB",
      uploadsSizePretty: (uploadsSizeBytes / 1024 / 1024).toFixed(2) + " MB",
      totalSizePretty: (totalSizeBytes / 1024 / 1024).toFixed(2) + " MB",
      limitPretty: (limitBytes / 1024 / 1024).toFixed(2) + " MB",
      percentage: parseFloat(((totalSizeBytes / limitBytes) * 100).toFixed(1))
    });
  } catch (error) {
    console.error("Get Storage Info Error:", error);
    res.status(500).json({ error: error.message });
  }
};
