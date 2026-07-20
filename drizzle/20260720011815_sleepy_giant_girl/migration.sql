CREATE TABLE "roles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"createdBy" integer NOT NULL,
	"updatedBy" integer NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_createdBy_users_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_updatedBy_users_id_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id");