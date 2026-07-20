CREATE TABLE "cat_placements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cat_placements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"cat_id" integer NOT NULL,
	"slot_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cat_placements" ADD CONSTRAINT "cat_placements_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "cat_placements" ADD CONSTRAINT "cat_placements_cat_id_cats_id_fkey" FOREIGN KEY ("cat_id") REFERENCES "cats"("id");