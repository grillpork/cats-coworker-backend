import { db } from "../../config/db.js";
import { RolesTable } from "../../db/schemas/user.js";
import { eq } from "drizzle-orm";

export const getAllRoles = async (req, res) => {
  try {
    const roles = await db.select().from(RolesTable);
    res.json(roles);
  } catch (error) {
    console.error("Get All Roles Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    const roles = await db.select().from(RolesTable).where(eq(RolesTable.id, parseInt(id, 10))).limit(1);
    
    if (roles.length === 0) {
      return res.status(404).json({ error: "Role not found" });
    }
    
    res.json(roles[0]);
  } catch (error) {
    console.error("Get Role Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const createRole = async (req, res) => {
  try {
    const { name, isActive } = req.body || {};
    
    if (!name) {
      return res.status(400).json({ error: "Role name is required" });
    }
    
    // Check if role already exists
    const existing = await db.select().from(RolesTable).where(eq(RolesTable.name, name)).limit(1);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Role name already exists" });
    }

    const userId = req.user ? req.user.id : 1; // Fallback to 1 if no auth middleware
    
    const [newRole] = await db.insert(RolesTable).values({
      name,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: userId,
      updatedBy: userId,
    }).returning();
    
    res.status(201).json({
      message: "Role created successfully",
      role: newRole,
    });
  } catch (error) {
    console.error("Create Role Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body || {};
    
    const userId = req.user ? req.user.id : 1;
    
    const updateData = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const [updatedRole] = await db.update(RolesTable)
      .set(updateData)
      .where(eq(RolesTable.id, parseInt(id, 10)))
      .returning();
      
    if (!updatedRole) {
      return res.status(404).json({ error: "Role not found" });
    }
    
    res.json({
      message: "Role updated successfully",
      role: updatedRole,
    });
  } catch (error) {
    console.error("Update Role Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [deletedRole] = await db.delete(RolesTable)
      .where(eq(RolesTable.id, parseInt(id, 10)))
      .returning();
      
    if (!deletedRole) {
      return res.status(404).json({ error: "Role not found" });
    }
    
    res.json({
      message: "Role deleted successfully",
      role: deletedRole,
    });
  } catch (error) {
    console.error("Delete Role Error:", error);
    res.status(500).json({ error: error.message });
  }
};
