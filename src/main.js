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
global.activePlayersMap = players;

wss.on("connection", (ws) => {
  ws.on("message", (messageStr) => {
    try {
      const data = JSON.parse(messageStr);
      
      if (data.type === "join") {
        const { user, x, y, room } = data;
        if (!user || !user.id) return;
        
        const targetRoom = room || "Server Room A";

        // Save player info associated with this socket
        players.set(ws, {
          id: user.id,
          username: user.username || `User-${user.id}`,
          room: targetRoom,
          x: x || 600,
          y: y || 400
        });

        // 1. Send currently online players in the same room to the newly joined player
        const onlinePlayers = [];
        for (const [socket, info] of players.entries()) {
          if (socket !== ws && info.room === targetRoom) {
            onlinePlayers.push(info);
          }
        }
        ws.send(JSON.stringify({ type: "players_list", players: onlinePlayers }));

        // 2. Broadcast the new player only to other connected clients in the same room
        const joinAlert = JSON.stringify({
          type: "player_joined",
          player: players.get(ws)
        });
        
        for (const [socket, info] of players.entries()) {
          if (socket !== ws && info.room === targetRoom && socket.readyState === ws.OPEN) {
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
          if (socket !== ws && info.room === player.room && socket.readyState === ws.OPEN) {
            socket.send(moveAlert);
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
        if (info.room === player.room && socket.readyState === ws.OPEN) {
          socket.send(leaveAlert);
        }
      }
    }
  });
});

// Admin management endpoints for Server Room
app.get("/api/admin/online-players", (req, res) => {
  const online = [];
  for (const info of players.values()) {
    online.push(info);
  }
  res.json(online);
});

app.post("/api/admin/broadcast", (req, res) => {
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

app.post("/api/admin/kick/:id", (req, res) => {
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

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
