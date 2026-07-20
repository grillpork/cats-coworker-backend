import { integer, pgTable, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./user.js";

export const mapsTable = pgTable("maps", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    name: varchar({ length: 255 }).default("My Custom Map").notNull(),
    rows: integer().notNull(),
    cols: integer().notNull(),
    tiles: jsonb("tiles").notNull(), // Stores the 2D array of tile IDs
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const spritesTable = pgTable("sprites", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    tileId: varchar("tile_id", { length: 50 }).unique().notNull(), // e.g. "01", "02"
    name: varchar({ length: 255 }).notNull(),
    image: varchar({ length: 255 }).notNull(), // URL or R2 path of sprite
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const roomsTable = pgTable("rooms", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).unique().notNull(),
    mapId: integer("map_id").references(() => mapsTable.id).notNull(),
    hostId: integer("host_id").references(() => usersTable.id).notNull(),
    maxPlayers: integer("max_players").default(10).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});