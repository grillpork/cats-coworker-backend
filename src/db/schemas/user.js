import { boolean, integer, pgTable, varchar, timestamp } from "drizzle-orm/pg-core";
import { charactersTable } from "./character.js";
export const usersTable = pgTable("users", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull().unique(),
    password: varchar({ length: 255 }),
    provider: varchar({ length: 50 }).default("local").notNull(),
    providerId: varchar("provider_id", { length: 255 }),
    roleId: integer("role_id").references(() => RolesTable.id),
    avatar: varchar({ length: 255 }),
    characterId: integer("character_id").references(() => charactersTable.id),
    sp: integer().default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const RolesTable = pgTable("roles", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdBy: integer().notNull().references(() => usersTable.id),
    updatedBy: integer().notNull().references(() => usersTable.id),
    isActive: boolean().default(true).notNull(),
});