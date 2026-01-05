-- 为 documents 表添加投资笔记所需的字段
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "user_id" integer DEFAULT 1;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "tags" text[] DEFAULT '{}';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "related_ticker" varchar(20);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "portfolio_snapshot" jsonb;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();

-- 创建 conversations 表（用于历史对话）
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" integer DEFAULT 1,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
