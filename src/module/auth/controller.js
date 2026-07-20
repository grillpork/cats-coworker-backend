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

export const googleOAuth = async (req, res) => {
  try {
    const { token, access_token, credential, googleToken } = req.body;
    const gToken = token || access_token || credential || googleToken || req.body.tokenResponse?.access_token;

    let email, name, picture, googleId;

    if (gToken) {
      // 1. Verify Google Access Token with Google UserInfo API
      try {
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${gToken}` },
        });

        if (userInfoRes.ok) {
          const googleUser = await userInfoRes.json();
          email = googleUser.email;
          name = googleUser.name;
          picture = googleUser.picture;
          googleId = googleUser.sub;
        } else {
          // Try verifying as ID Token (JWT)
          const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${gToken}`);
          if (tokenInfoRes.ok) {
            const googleTokenInfo = await tokenInfoRes.json();
            email = googleTokenInfo.email;
            name = googleTokenInfo.name;
            picture = googleTokenInfo.picture;
            googleId = googleTokenInfo.sub;
          }
        }
      } catch (verifyErr) {
        console.error("Google Token Verification Failed:", verifyErr);
      }
    }

    // Fallback for development if token verification is skipped or raw fallback payload provided
    if (!email && req.body.email && process.env.NODE_ENV === "development") {
      email = req.body.email;
      name = req.body.name;
      googleId = req.body.googleId || req.body.sub;
      picture = req.body.avatar;
    }

    if (!email) {
      return res.status(401).json({ error: "Invalid or unverified Google token" });
    }

    const providerId = googleId || req.body.sub;
    const finalName = name || email.split("@")[0];

    // Find existing user by email
    let users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    let user = users[0];

    if (!user) {
      // Auto-register new OAuth user
      const [newUser] = await db.insert(usersTable).values({
        name: finalName,
        email,
        password: null,
        provider: "google",
        providerId: providerId || null,
        avatar: picture || null,
      }).returning();
      user = newUser;
    } else {
      // Update provider details if missing
      if (user.provider === "local" || !user.providerId) {
        await db.update(usersTable)
          .set({ provider: "google", providerId: providerId || user.providerId, avatar: picture || user.avatar })
          .where(eq(usersTable.id, user.id));
      }
    }

    // Generate JWT token
    const jwtToken = jwt.sign({ id: user.id, email: user.email, roleId: user.roleId }, JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({
      message: "Google OAuth login successful",
      token: jwtToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleId: user.roleId,
        avatar: user.avatar,
        provider: "google",
      },
    });
  } catch (error) {
    console.error("Google OAuth Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const oauthLogin = async (req, res) => {
  try {
    const { provider = "oauth", providerId, email, name, avatar } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required for OAuth login" });
    }

    const finalName = name || email.split("@")[0];

    let users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    let user = users[0];

    if (!user) {
      const [newUser] = await db.insert(usersTable).values({
        name: finalName,
        email,
        password: null,
        provider,
        providerId: providerId || null,
        avatar: avatar || null,
      }).returning();
      user = newUser;
    } else {
      if (!user.providerId && providerId) {
        await db.update(usersTable)
          .set({ provider, providerId, avatar: avatar || user.avatar })
          .where(eq(usersTable.id, user.id));
      }
    }

    const token = jwt.sign({ id: user.id, email: user.email, roleId: user.roleId }, JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({
      message: `${provider} OAuth login successful`,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleId: user.roleId,
        avatar: user.avatar,
        provider,
      },
    });
  } catch (error) {
    console.error("OAuth Login Error:", error);
    res.status(500).json({ error: error.message });
  }
};
