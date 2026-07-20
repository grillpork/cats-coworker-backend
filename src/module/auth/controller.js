import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { db } from "../../config/db.js";
import { usersTable, RolesTable } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import "dotenv/config";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

export const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    // Check if user already exists
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Email is already registered" });
    }

    // Hash password using Argon2
    const hashedPassword = await argon2.hash(password);

    // Default name to email prefix if not provided
    const finalName = name || email.split("@")[0];

    // Insert user
    const [newUser] = await db.insert(usersTable).values({
      name: finalName,
      email,
      password: hashedPassword,
    }).returning({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      roleId: usersTable.roleId,
    });

    // Generate JWT token
    const token = jwt.sign({ id: newUser.id, email: newUser.email, roleId: newUser.roleId }, JWT_SECRET, {
      expiresIn: "24h",
    });

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: newUser,
    });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    // Find user
    const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    const user = users[0];

    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Compare passwords using Argon2
    const isValid = await argon2.verify(user.password, password);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email, roleId: user.roleId }, JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleId: user.roleId,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const users = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      roleId: usersTable.roleId,
      roleName: RolesTable.name,
      avatar: usersTable.avatar,
      sp: usersTable.sp,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(RolesTable, eq(usersTable.roleId, RolesTable.id))
    .where(eq(usersTable.id, req.user.id))
    .limit(1);

    const user = users[0];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Profile Error:", error);
    res.status(500).json({ error: error.message });
  }
};
