import jwt from "jsonwebtoken";
import "dotenv/config";

const JWT_SECRET = process.env.JWT_SECRET;

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token is required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

import { db } from "../config/db.js";
import { RolesTable, usersTable } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(403).json({ error: "Access denied. User not authenticated." });
    }

    const [userRecord] = await db
      .select({
        roleName: RolesTable.name,
      })
      .from(usersTable)
      .leftJoin(RolesTable, eq(usersTable.roleId, RolesTable.id))
      .where(eq(usersTable.id, req.user.id))
      .limit(1);

    if (!userRecord || !userRecord.roleName || userRecord.roleName.toLowerCase() !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin role required." });
    }

    next();
  } catch (error) {
    console.error("Require Admin Middleware Error:", error);
    res.status(500).json({ error: error.message });
  }
};
