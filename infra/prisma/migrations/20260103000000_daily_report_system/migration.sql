-- Echo v3.2: 日报系统数据库扩展
-- 包含: 日报表、建议表、通知表扩展

-- ============ 日报表 ============
CREATE TABLE IF NOT EXISTS "daily_reports" (
    "id" SERIAL PRIMARY KEY,
    "type" VARCHAR(20) NOT NULL,  -- 'morning' | 'evening'
    "date" DATE NOT NULL,
    "content" JSONB NOT NULL,     -- 日报内容 (任务摘要、笔记摘要、建议等)
    "generated_at" TIMESTAMP(3) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "account_id" INT NOT NULL,
    CONSTRAINT "daily_reports_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "daily_reports_unique" UNIQUE("type", "date", "account_id")
);

-- 日报表索引
CREATE INDEX IF NOT EXISTS "idx_daily_reports_date" ON "daily_reports"("date", "account_id");
CREATE INDEX IF NOT EXISTS "idx_daily_reports_type" ON "daily_reports"("type", "account_id");

-- ============ 建议表 ============
CREATE TABLE IF NOT EXISTS "suggestions" (
    "id" SERIAL PRIMARY KEY,
    "type" VARCHAR(20) NOT NULL,           -- 'task' | 'reminder' | 'habit' | 'insight'
    "content" TEXT NOT NULL,               -- 建议内容
    "source" TEXT,                         -- 建议来源说明
    "priority" VARCHAR(10) DEFAULT 'medium', -- 'high' | 'medium' | 'low'
    "status" VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'accepted' | 'postponed' | 'rejected'
    "postponed_until" TIMESTAMP(3) WITH TIME ZONE, -- 推迟到的时间
    "reject_reason" TEXT,                  -- 拒绝原因
    "created_at" TIMESTAMP(3) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3) WITH TIME ZONE,
    "account_id" INT NOT NULL,
    CONSTRAINT "suggestions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 建议表索引
CREATE INDEX IF NOT EXISTS "idx_suggestions_status" ON "suggestions"("status", "account_id");
CREATE INDEX IF NOT EXISTS "idx_suggestions_priority" ON "suggestions"("priority", "account_id");
CREATE INDEX IF NOT EXISTS "idx_suggestions_created" ON "suggestions"("created_at", "account_id");

-- ============ 扩展通知表 ============
-- 添加 action_url 字段用于点击跳转
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "action_url" VARCHAR(500);
