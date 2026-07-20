ALTER TABLE "cats" ADD COLUMN "rarity" varchar(50) DEFAULT 'COMMON' NOT NULL;--> statement-breakpoint
ALTER TABLE "cats" ADD COLUMN "type" varchar(50) DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "cats" ADD COLUMN "sp_rate" integer DEFAULT 10 NOT NULL;