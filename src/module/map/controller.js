import { db } from "../../config/db.js";
import { mapsTable, spritesTable, roomsTable, usersTable } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "../../middleware/r2.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";

// Process sprite image upload
const processSpriteImage = async (file) => {
  if (!file) return null;

  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
  const buffer = await sharp(file.buffer)
    .resize(64, 64, { fit: "inside", withoutEnlargement: true }) // Sprites are small tiles
    .webp({ quality: 90 })
    .toBuffer();

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: `sprites/${filename}`,
    Body: buffer,
    ContentType: "image/webp",
  });

  await r2Client.send(command);

  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/sprites/${filename}`;
  }
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/sprites/${filename}`;
};

// GET current map layout (everyone can read)
export const getActiveMap = async (req, res) => {
  try {
    // Just fetch the latest map (or first map) in the database
    const maps = await db.select().from(mapsTable).limit(1);
    if (maps.length === 0) {
      return res.json(null);
    }
    res.json(maps[0]);
  } catch (error) {
    console.error("Get Active Map Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getAllMaps = async (req, res) => {
  try {
    const maps = await db.select().from(mapsTable);
    res.json(maps);
  } catch (error) {
    console.error("Get All Maps Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const createRoomMap = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Room name is required" });
    }

    // Check if room name already exists
    const existing = await db.select().from(mapsTable).where(eq(mapsTable.name, name)).limit(1);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Room name already exists" });
    }

    // Generate default tiles grid (15x20)
    const rows = 15;
    const cols = 20;
    const tiles = Array(rows).fill(null).map((_, r) =>
      Array(cols).fill(null).map((_, c) => {
        if (r === 0 && c === 0) return "09";
        if (r === 0 && c === cols - 1) return "10";
        if (r === rows - 1 && c === 0) return "11";
        if (r === rows - 1 && c === cols - 1) return "12";
        if (r === 0) return "05";
        if (r === rows - 1) return "06";
        if (c === 0) return "07";
        if (c === cols - 1) return "08";
        return "01";
      })
    );

    const [newMap] = await db.insert(mapsTable).values({
      userId,
      name,
      rows,
      cols,
      tiles,
    }).returning();

    res.status(201).json(newMap);
  } catch (error) {
    console.error("Create Room Map Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// SAVE or update map layout (ADMIN ONLY)
export const saveMap = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, rows, cols, tiles } = req.body;

    if (!rows || !cols || !tiles) {
      return res.status(400).json({ error: "rows, cols, and tiles grid are required" });
    }

    // Check if a map already exists
    const existing = await db.select().from(mapsTable).limit(1);

    let mapResult;
    if (existing.length > 0) {
      // Update
      const [updated] = await db
        .update(mapsTable)
        .set({
          name: name || existing[0].name,
          rows: parseInt(rows, 10),
          cols: parseInt(cols, 10),
          tiles,
          updatedAt: new Date(),
        })
        .where(eq(mapsTable.id, existing[0].id))
        .returning();
      mapResult = updated;
    } else {
      // Create new
      const [inserted] = await db
        .insert(mapsTable)
        .values({
          userId,
          name: name || "My Custom Map",
          rows: parseInt(rows, 10),
          cols: parseInt(cols, 10),
          tiles,
        })
        .returning();
      mapResult = inserted;
    }

    res.json({
      message: "Map saved successfully",
      map: mapResult,
    });
  } catch (error) {
    console.error("Save Map Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET all sprites (everyone can read)
export const getAllSprites = async (req, res) => {
  try {
    const sprites = await db.select().from(spritesTable);
    // Sort by tileId to keep order consistent
    sprites.sort((a, b) => a.tileId.localeCompare(b.tileId));
    res.json(sprites);
  } catch (error) {
    console.error("Get All Sprites Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// CREATE or UPDATE a sprite (ADMIN ONLY)
export const upsertSprite = async (req, res) => {
  try {
    const { tileId, name } = req.body;

    if (!tileId || !name) {
      return res.status(400).json({ error: "tileId and name are required" });
    }

    // Check if tileId exists
    const existing = await db.select().from(spritesTable).where(eq(spritesTable.tileId, tileId)).limit(1);

    let imageUrl;
    if (req.file) {
      imageUrl = await processSpriteImage(req.file);
    }

    let spriteResult;
    if (existing.length > 0) {
      // Update
      const updateData = {
        name,
        updatedAt: new Date(),
      };
      if (imageUrl) {
        updateData.image = imageUrl;
      }

      const [updated] = await db
        .update(spritesTable)
        .set(updateData)
        .where(eq(spritesTable.id, existing[0].id))
        .returning();
      spriteResult = updated;
    } else {
      // Create new (image is required for new sprites)
      if (!imageUrl) {
        return res.status(400).json({ error: "Sprite image file is required for new tiles" });
      }

      const [inserted] = await db
        .insert(spritesTable)
        .values({
          tileId,
          name,
          image: imageUrl,
        })
        .returning();
      spriteResult = inserted;
    }

    res.json({
      message: "Sprite saved successfully",
      sprite: spriteResult,
    });
  } catch (error) {
    console.error("Upsert Sprite Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteSprite = async (req, res) => {
  try {
    const { tileId } = req.params;
    const deleted = await db.delete(spritesTable).where(eq(spritesTable.tileId, tileId)).returning();
    if (deleted.length === 0) {
      return res.status(404).json({ error: "Sprite not found" });
    }
    res.json({ message: "Sprite deleted successfully" });
  } catch (error) {
    console.error("Delete Sprite Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getAllRooms = async (req, res) => {
  try {
    const rooms = await db.select().from(roomsTable);
    const roomsWithDetails = [];

    for (const room of rooms) {
      // Fetch map layout details
      const maps = await db.select().from(mapsTable).where(eq(mapsTable.id, room.mapId)).limit(1);
      const mapData = maps[0] || null;

      // Fetch host details
      const hostUsers = await db.select().from(usersTable).where(eq(usersTable.id, room.hostId)).limit(1);
      const hostUsername = hostUsers[0]?.username || hostUsers[0]?.email?.split('@')[0] || "Unknown Host";

      // Get player count from active WebSocket sessions
      const activePlayersMap = global.activePlayersMap;
      let playerCount = 0;
      if (activePlayersMap) {
        playerCount = Array.from(activePlayersMap.values()).filter(
          (p) => p.room === room.name
        ).length;
      }

      roomsWithDetails.push({
        ...room,
        maxPlayers: 6,
        hostUsername,
        map: mapData,
        playerCount,
      });
    }

    res.json(roomsWithDetails);
  } catch (error) {
    console.error("Get All Rooms Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const createRoomInstance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, mapId } = req.body;

    if (!name || !mapId) {
      return res.status(400).json({ error: "Room name and mapId are required" });
    }

    // Check if room name already exists
    const existing = await db.select().from(roomsTable).where(eq(roomsTable.name, name)).limit(1);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Room name already exists" });
    }

    // Check if map template exists
    const mapTemplate = await db.select().from(mapsTable).where(eq(mapsTable.id, mapId)).limit(1);
    if (mapTemplate.length === 0) {
      return res.status(400).json({ error: "Selected Map template does not exist" });
    }

    const [newRoom] = await db.insert(roomsTable).values({
      name,
      mapId,
      hostId: userId,
      maxPlayers: 6,
    }).returning();

    const hostUsers = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const hostUsername = hostUsers[0]?.username || hostUsers[0]?.email?.split('@')[0] || "Unknown Host";

    // Attach map layout details, host username, and 0 players
    res.status(201).json({
      ...newRoom,
      maxPlayers: 6,
      hostUsername,
      map: mapTemplate[0],
      playerCount: 0
    });
  } catch (error) {
    console.error("Create Room Instance Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const updateRoomInstance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, mapId } = req.body;

    // Find the room
    const rooms = await db.select().from(roomsTable).where(eq(roomsTable.id, id)).limit(1);
    if (rooms.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    const room = rooms[0];
    // Check authorization (only host or admin can edit)
    const userRole = req.user.roleName || "";
    if (room.hostId !== userId && userRole.toLowerCase() !== "admin") {
      return res.status(403).json({ error: "You are not authorized to edit this room" });
    }

    const updateData = {};
    if (name) {
      // Check if name is taken
      const existingName = await db.select().from(roomsTable)
        .where(eq(roomsTable.name, name))
        .limit(1);
      if (existingName.length > 0 && existingName[0].id !== Number(id)) {
        return res.status(400).json({ error: "Room name already exists" });
      }
      updateData.name = name;
    }

    if (mapId) {
      const mapTemplate = await db.select().from(mapsTable).where(eq(mapsTable.id, mapId)).limit(1);
      if (mapTemplate.length === 0) {
        return res.status(400).json({ error: "Selected Map template does not exist" });
      }
      updateData.mapId = mapId;
    }

    const [updatedRoom] = await db
      .update(roomsTable)
      .set(updateData)
      .where(eq(roomsTable.id, id))
      .returning();

    // Retrieve full details
    const maps = await db.select().from(mapsTable).where(eq(mapsTable.id, updatedRoom.mapId)).limit(1);
    res.json({
      ...updatedRoom,
      map: maps[0] || null
    });
  } catch (error) {
    console.error("Update Room Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteRoomInstance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find the room
    const rooms = await db.select().from(roomsTable).where(eq(roomsTable.id, id)).limit(1);
    if (rooms.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    const room = rooms[0];
    // Check authorization (only host or admin can delete)
    const userRole = req.user.roleName || "";
    if (room.hostId !== userId && userRole.toLowerCase() !== "admin") {
      return res.status(403).json({ error: "You are not authorized to delete this room" });
    }

    // Delete the room
    await db.delete(roomsTable).where(eq(roomsTable.id, id));

    // Also tell any online players in that room to disconnect/go home!
    const activePlayersMap = global.activePlayersMap;
    if (activePlayersMap) {
      const payload = JSON.stringify({ type: "kicked", reason: "The host has closed this server room." });
      for (const [socket, info] of activePlayersMap.entries()) {
        if (info.room === room.name) {
          if (socket.readyState === 1) {
            socket.send(payload);
            socket.close();
          }
        }
      }
    }

    res.json({ message: "Room deleted successfully" });
  } catch (error) {
    console.error("Delete Room Error:", error);
    res.status(500).json({ error: error.message });
  }
};
