import express from "express";
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
