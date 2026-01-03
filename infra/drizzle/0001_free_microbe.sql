CREATE TABLE "documents" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"content" text,
	"metadata" jsonb,
	"embedding" vector(768),
	"source_type" text,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now()
);
