import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import morgan from "morgan";
import "dotenv/config";
import { db } from "./config/db.js";
import { usersTable } from "./db/schema.js";
import authRouter from "./module/auth/route.js";
import userRouter from "./module/user/route.js";
import catRouter from "./module/cats/route.js";
import mapRouter from "./module/map/route.js";
import characterRouter from "./module/character/route.js";
import storageRouter from "./module/storage/route.js";
import { authenticateToken, requireAdmin } from "./middleware/auth.js";
import { catPlacementsTable } from "./db/schema.js";
import { eq, and } from "drizzle-orm";

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = [
  "http://localhost:3000",
  "https://catako.site",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads folder serving
app.use("/uploads", express.static("uploads"));

// Routers
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/cats", catRouter);
app.use("/api/maps", mapRouter);
app.use("/api/characters", characterRouter);
app.use("/api/storage", storageRouter);

// Sample root route
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Brainrot Backend Running" });
});

// Sample users route to test Drizzle DB pool
app.get("/users", async (req, res) => {
  try {
    const allUsers = await db.select().from(usersTable);
    res.json(allUsers);
  } catch (error) {
    console.error("DB Query Error:", error);
    res.status(500).json({ error: error.message });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Map of socket -> player data
const players = new Map();
const roomCatsMap = new Map();
global.activePlayersMap = players;
global.activeRoomCatsMap = roomCatsMap;

wss.on("connection", (ws) => {
  ws.on("message", (messageStr) => {
    try {
      const data = JSON.parse(messageStr);
      
      if (data.type === "join") {
        const { user, room, x, y, sp } = data;
        const targetRoom = room || "Server Room A";

        if (!user || !user.id) return;

        // Disconnect duplicate connection for the same user ID if exists (Ghost session cleanup)
        for (const [socket, info] of players.entries()) {
          if (String(info.id) === String(user.id)) {
            socket.send(JSON.stringify({ type: "kicked", reason: "Logged in from another session" }));
            socket.close();
            players.delete(socket);
          }
        }

        // Count existing players in this target room
        const roomPlayers = Array.from(players.values()).filter(p => p.room === targetRoom);
        if (roomPlayers.length >= 6) {
          ws.send(JSON.stringify({
            type: "room_full",
            message: "ห้องนี้มีผู้เล่นครบ 6 คนแล้ว ไม่สามารถเข้าร่วมได้"
          }));
          return;
        }

        // Find available slotIndex (0 to 5) in this room
        const occupiedSlots = new Set(roomPlayers.map(p => p.slotIndex));
        let assignedSlot = 0;
        for (let i = 0; i < 6; i++) {
          if (!occupiedSlots.has(i)) {
            assignedSlot = i;
            break;
          }
        }

        // Save player info associated with this socket
        players.set(ws, {
          id: user.id,
          username: user.username || `User-${user.id}`,
          room: targetRoom,
          slotIndex: assignedSlot,
          x: x || 600,
          y: y || 400,
          heldCat: data.heldCat || null,
          sp: sp || 0,
          avatar: user.avatar || null
        });

        if (!roomCatsMap.has(targetRoom)) {
          roomCatsMap.set(targetRoom, {});
        }
        const currentRoomCats = roomCatsMap.get(targetRoom);

        // 1. Send currently online players, assigned slot & room cats to newly joined player
        const onlinePlayers = [];
        for (const [socket, info] of players.entries()) {
          if (socket !== ws && info.room === targetRoom) {
            onlinePlayers.push(info);
          }
        }
        ws.send(JSON.stringify({
          type: "joined_room",
          slotIndex: assignedSlot,
          room: targetRoom,
          players: onlinePlayers,
          roomCats: currentRoomCats
        }));

        // 2. Broadcast the new player only to other connected clients in the same room
        const joinAlert = JSON.stringify({
          type: "player_joined",
          player: players.get(ws)
        });
        
        for (const [socket, info] of players.entries()) {
          if (socket !== ws && info.room === targetRoom && socket.readyState === 1) {
            socket.send(joinAlert);
          }
        }
      }

      if (data.type === "move") {
        const player = players.get(ws);
        if (!player) return;

        player.x = data.x;
        player.y = data.y;

        // Broadcast move update to all other connected clients in the same room
        const moveAlert = JSON.stringify({
          type: "player_moved",
          id: player.id,
          x: player.x,
          y: player.y
        });

        for (const [socket, info] of players.entries()) {
          if (socket !== ws && info.room === player.room && socket.readyState === 1) {
            socket.send(moveAlert);
          }
        }
      }

      if (data.type === "sync_sp") {
        const player = players.get(ws);
        if (player) {
          player.sp = data.sp;
          const payload = JSON.stringify({
            type: "player_sp_updated",
            id: player.id,
            sp: player.sp
          });
          for (const [socket, info] of players.entries()) {
            if (socket !== ws && info.room === player.room && socket.readyState === 1) {
              socket.send(payload);
            }
          }
        }
      }

      // Handle Real-Time Cat Deployment Synchronization
      if (data.type === "sync_cats") {
        const player = players.get(ws);
        if (!player) return;
        const targetRoom = player.room;
        if (!roomCatsMap.has(targetRoom)) roomCatsMap.set(targetRoom, {});
        const roomCats = roomCatsMap.get(targetRoom);

        if (Array.isArray(data.cats)) {
          data.cats.forEach((cat, idx) => {
            const globalSlotIdx = player.slotIndex * 8 + idx;
            if (cat) {
              roomCats[globalSlotIdx] = cat;
            } else {
              delete roomCats[globalSlotIdx];
            }
          });
        }

        const syncPayload = JSON.stringify({
          type: "sync_cats",
          zoneIndex: player.slotIndex,
          cats: data.cats,
          roomCats
        });

        for (const [socket, info] of players.entries()) {
          if (socket !== ws && info.room === targetRoom && socket.readyState === 1) {
            socket.send(syncPayload);
          }
        }
      }

      if (data.type === "cat_placed") {
        const player = players.get(ws);
        if (!player) return;
        const targetRoom = player.room;
        if (!roomCatsMap.has(targetRoom)) roomCatsMap.set(targetRoom, {});
        const roomCats = roomCatsMap.get(targetRoom);

        roomCats[data.slotIndex] = data.cat;

        const payload = JSON.stringify({
          type: "cat_placed",
          slotIndex: data.slotIndex,
          cat: data.cat
        });

        for (const [socket, info] of players.entries()) {
          if (socket !== ws && info.room === targetRoom && socket.readyState === 1) {
            socket.send(payload);
          }
        }
      }

      if (data.type === "cat_removed") {
        const player = players.get(ws);
        if (!player) return;
        const targetRoom = player.room;
        if (!roomCatsMap.has(targetRoom)) roomCatsMap.set(targetRoom, {});
        const roomCats = roomCatsMap.get(targetRoom);

        delete roomCats[data.slotIndex];

        const payload = JSON.stringify({
          type: "cat_removed",
          slotIndex: data.slotIndex
        });

        for (const [socket, info] of players.entries()) {
          if (socket !== ws && info.room === targetRoom && socket.readyState === 1) {
            socket.send(payload);
          }
        }
      }

      if (data.type === "cat_upgraded") {
        const player = players.get(ws);
        if (!player) return;
        const targetRoom = player.room;
        if (!roomCatsMap.has(targetRoom)) roomCatsMap.set(targetRoom, {});
        const roomCats = roomCatsMap.get(targetRoom);

        roomCats[data.slotIndex] = data.cat;

        const payload = JSON.stringify({
          type: "cat_upgraded",
          slotIndex: data.slotIndex,
          cat: data.cat
        });

        for (const [socket, info] of players.entries()) {
          if (socket !== ws && info.room === targetRoom && socket.readyState === 1) {
            socket.send(payload);
          }
        }
      }

      if (data.type === "update_held_cat") {
        const player = players.get(ws);
        if (!player) return;
        
        player.heldCat = data.heldCat;

        const payload = JSON.stringify({
          type: "player_held_cat_updated",
          id: player.id,
          heldCat: data.heldCat
        });

        for (const [socket, info] of players.entries()) {
          if (socket !== ws && info.room === player.room && socket.readyState === 1) {
            socket.send(payload);
          }
        }
      }

      if (data.type === "cat_gifted") {
        const player = players.get(ws);
        if (!player) return;

        const payload = JSON.stringify({
          type: "cat_gifted",
          fromId: player.id,
          fromName: player.username,
          toId: data.giftedTo,
          toName: data.giftedToName,
          cat: data.cat
        });

        for (const [socket, info] of players.entries()) {
          if (info.room === player.room && socket.readyState === 1) {
            socket.send(payload);
          }
        }
      }

      if (data.type === "chat_message") {
        const player = players.get(ws);
        if (player) {
          const payload = JSON.stringify({
            type: "chat_broadcast",
            senderId: player.id,
            senderName: player.username,
            message: data.message,
            timestamp: new Date().toISOString()
          });
          for (const [socket, info] of players.entries()) {
            if (info.room === player.room && socket.readyState === 1) {
              socket.send(payload);
            }
          }
        }
      }
    } catch (err) {
      console.error("WS Message Error:", err);
    }
  });

  ws.on("close", () => {
    const player = players.get(ws);
    if (player) {
      const leaveAlert = JSON.stringify({
        type: "player_left",
        id: player.id
      });

      players.delete(ws);

      for (const [socket, info] of players.entries()) {
        if (info.room === player.room && socket.readyState === 1) {
          socket.send(leaveAlert);
        }
      }
    }
  });
});



// Admin management endpoints for Server Room
app.get("/api/admin/online-players", authenticateToken, requireAdmin, (req, res) => {
  const online = [];
  for (const info of players.values()) {
    online.push(info);
  }
  res.json(online);
});

app.post("/api/admin/broadcast", authenticateToken, requireAdmin, (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  const payload = JSON.stringify({
    type: "announcement",
    message,
  });

  for (const socket of players.keys()) {
    if (socket.readyState === 1) { // OPEN
      socket.send(payload);
    }
  }

  res.json({ message: "Announcement broadcasted successfully" });
});

app.post("/api/admin/kick/:id", authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  let targetSocket = null;
  for (const [socket, info] of players.entries()) {
    if (String(info.id) === String(id)) {
      targetSocket = socket;
      break;
    }
  }

  if (!targetSocket) {
    return res.status(404).json({ error: "Player not found or offline" });
  }

  targetSocket.send(JSON.stringify({ type: "kicked" }));
  targetSocket.close();

  res.json({ message: `Player ${id} kicked successfully` });
});

// Admin Cat Placements Management endpoints
app.get("/api/admin/placements", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const placements = await db
      .select({
        id: catPlacementsTable.id,
        userId: catPlacementsTable.userId,
        slotIndex: catPlacementsTable.slotIndex,
        catData: catPlacementsTable.catData,
        userName: usersTable.name,
        userEmail: usersTable.email,
      })
      .from(catPlacementsTable)
      .leftJoin(usersTable, eq(catPlacementsTable.userId, usersTable.id));
    res.json(placements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/placements", authenticateToken, requireAdmin, async (req, res) => {
  const { userId, slotIndex, catData } = req.body;
  if (!userId || slotIndex === undefined || !catData) {
    return res.status(400).json({ error: "userId, slotIndex, and catData are required" });
  }
  try {
    const existing = await db
      .select()
      .from(catPlacementsTable)
      .where(
        and(
          eq(catPlacementsTable.userId, parseInt(userId, 10)),
          eq(catPlacementsTable.slotIndex, parseInt(slotIndex, 10))
        )
      )
      .limit(1);

    let placement;
    if (existing.length > 0) {
      [placement] = await db
        .update(catPlacementsTable)
        .set({
          catData,
          updatedAt: new Date()
        })
        .where(eq(catPlacementsTable.id, existing[0].id))
        .returning();
    } else {
      [placement] = await db
        .insert(catPlacementsTable)
        .values({
          userId: parseInt(userId, 10),
          slotIndex: parseInt(slotIndex, 10),
          catData
        })
        .returning();
    }
    res.json({ message: "Placement updated successfully", placement });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/admin/placements/:id", authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [deleted] = await db
      .delete(catPlacementsTable)
      .where(eq(catPlacementsTable.id, parseInt(id, 10)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Placement not found" });
    }
    res.json({ message: "Placement deleted successfully", placement: deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
