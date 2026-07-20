import { boolean, integer, pgTable, varchar, timestamp } from "drizzle-orm/pg-core";
export const usersTable = pgTable("users", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull().unique(),
    password: varchar({ length: 255 }).notNull(),
    role: varchar({ length: 50 }).default("employee").notNull(),
    avatar: varchar({ length: 255 }),
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