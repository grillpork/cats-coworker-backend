import { db } from "../../config/db.js";
import { usersTable } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export const updateProfile = async (req, res) => {
  const { name, avatar } = req.body;
  const userId = req.user.id;

  try {
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (avatar !== undefined) updateData.avatar = avatar;

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
