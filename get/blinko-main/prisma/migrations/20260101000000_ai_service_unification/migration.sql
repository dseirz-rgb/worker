-- AI 服务统一迁移: 添加 agent, automationRun, researchSession, featureFlag 表

-- Agent 管理表
CREATE TABLE "agent" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "persona" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "tools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "modelId" INTEGER,
    "privacy" VARCHAR(20) NOT NULL DEFAULT 'private',
    "accountId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "agent_pkey" PRIMARY KEY ("id")
);

-- 自动化运行记录表
CREATE TABLE "automationRun" (
    "id" SERIAL NOT NULL,
    "automationId" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "result" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMPTZ(6) NOT NULL,
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "automationRun_pkey" PRIMARY KEY ("id")
);

-- 研究会话表
CREATE TABLE "researchSession" (
    "id" SERIAL NOT NULL,
    "query" TEXT NOT NULL,
    "summary" TEXT,
    "iterations" JSON NOT NULL,
    "sources" JSON NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL,
    "accountId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "researchSession_pkey" PRIMARY KEY ("id")
);

-- 功能开关表
CREATE TABLE "featureFlag" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" BOOLEAN NOT NULL DEFAULT false,
    "accountId" INTEGER,
    "metadata" JSON,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "featureFlag_pkey" PRIMARY KEY ("id")
);

-- 创建唯一索引
CREATE UNIQUE INDEX "agent_slug_key" ON "agent"("slug");
CREATE UNIQUE INDEX "featureFlag_key_key" ON "featureFlag"("key") WHERE "accountId" IS NULL;
CREATE UNIQUE INDEX "featureFlag_key_accountId_key" ON "featureFlag"("key", "accountId") WHERE "accountId" IS NOT NULL;

-- 创建普通索引
CREATE INDEX "agent_accountId_idx" ON "agent"("accountId");
CREATE INDEX "agent_privacy_idx" ON "agent"("privacy");
CREATE INDEX "automationRun_automationId_idx" ON "automationRun"("automationId");
CREATE INDEX "automationRun_status_idx" ON "automationRun"("status");
CREATE INDEX "researchSession_accountId_idx" ON "researchSession"("accountId");
CREATE INDEX "researchSession_status_idx" ON "researchSession"("status");

-- 添加外键约束
ALTER TABLE "agent" ADD CONSTRAINT "agent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent" ADD CONSTRAINT "agent_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "aiModels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "automationRun" ADD CONSTRAINT "automationRun_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "aiScheduledTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "researchSession" ADD CONSTRAINT "researchSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "featureFlag" ADD CONSTRAINT "featureFlag_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
