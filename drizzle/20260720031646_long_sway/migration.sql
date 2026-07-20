CREATE TABLE "cats" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cats_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"breed" varchar(255),
	"age" integer,
	"image" varchar(255),
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
