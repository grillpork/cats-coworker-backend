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
        role: usersTable.role,
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
