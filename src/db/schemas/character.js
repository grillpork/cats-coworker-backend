import { integer, pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

export const charactersTable = pgTable("characters", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull(),
    avatarUrl: varchar("avatar_url", { length: 255 }).notNull().unique(),
    price: integer().default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
