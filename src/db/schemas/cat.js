import { integer, pgTable, varchar, timestamp, text, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./user.js";

export const catsTable = pgTable("cats", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull(),
    breed: varchar({ length: 255 }),
    age: integer(),
    image: varchar({ length: 255 }),
    description: text(),
    rarity: varchar({ length: 50 }).default("COMMON").notNull(),
    type: varchar({ length: 50 }).default("standard").notNull(),
    spRate: integer("sp_rate").default(10).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const catPlacementsTable = pgTable("cat_placements", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    slotIndex: integer("slot_index").notNull(), // index of slot (0 to 5) on the desk grid
    catData: jsonb("cat_data").notNull(), // Stores the entire cat object dynamically
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userInventoryTable = pgTable("user_inventory", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    catId: integer("cat_id").notNull().references(() => catsTable.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
