CREATE TABLE "maps" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "maps_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"name" varchar(255) DEFAULT 'My Custom Map' NOT NULL,
	"rows" integer NOT NULL,
	"cols" integer NOT NULL,
	"tiles" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");