ALTER TABLE "cat_placements" DROP CONSTRAINT "cat_placements_cat_id_cats_id_fkey";--> statement-breakpoint
ALTER TABLE "cat_placements" ADD COLUMN "cat_data" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cat_placements" DROP COLUMN "cat_id";