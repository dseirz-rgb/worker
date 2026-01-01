-- 文档管理系统 (Phase 2)
-- 创建文档、文档类型、通讯者、文档标签等表

-- 1. 创建 OCR 状态枚举
CREATE TYPE "OcrStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- 2. 创建文档类型表
CREATE TABLE "documentType" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "accountId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "documentType_pkey" PRIMARY KEY ("id")
);

-- 3. 创建通讯者表
CREATE TABLE "correspondent" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "accountId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "correspondent_pkey" PRIMARY KEY ("id")
);

-- 4. 创建文档标签表
CREATE TABLE "documentTag" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(20) NOT NULL DEFAULT '#3B82F6',
    "accountId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "documentTag_pkey" PRIMARY KEY ("id")
);

-- 5. 创建文档表
CREATE TABLE "document" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "content" TEXT,
    "originalFilename" VARCHAR(500) NOT NULL,
    "storagePath" VARCHAR(1000) NOT NULL,
    "archivedPath" VARCHAR(1000),
    "mimeType" VARCHAR(100) NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "checksum" VARCHAR(64),
    "ocrStatus" "OcrStatus" NOT NULL DEFAULT 'PENDING',
    "ocrError" TEXT,
    "documentTypeId" INTEGER,
    "correspondentId" INTEGER,
    "accountId" INTEGER NOT NULL,
    "documentDate" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- 6. 创建文档-标签关联表
CREATE TABLE "documentToTag" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "documentToTag_pkey" PRIMARY KEY ("id")
);

-- 7. 创建唯一约束
CREATE UNIQUE INDEX "documentType_accountId_name_key" ON "documentType"("accountId", "name");
CREATE UNIQUE INDEX "correspondent_accountId_name_key" ON "correspondent"("accountId", "name");
CREATE UNIQUE INDEX "documentTag_accountId_name_key" ON "documentTag"("accountId", "name");
CREATE UNIQUE INDEX "documentToTag_documentId_tagId_key" ON "documentToTag"("documentId", "tagId");

-- 8. 创建索引
CREATE INDEX "documentType_accountId_idx" ON "documentType"("accountId");
CREATE INDEX "correspondent_accountId_idx" ON "correspondent"("accountId");
CREATE INDEX "documentTag_accountId_idx" ON "documentTag"("accountId");
CREATE INDEX "document_accountId_idx" ON "document"("accountId");
CREATE INDEX "document_documentTypeId_idx" ON "document"("documentTypeId");
CREATE INDEX "document_correspondentId_idx" ON "document"("correspondentId");
CREATE INDEX "document_ocrStatus_idx" ON "document"("ocrStatus");
CREATE INDEX "document_createdAt_idx" ON "document"("createdAt");
CREATE INDEX "document_title_idx" ON "document"("title");
CREATE INDEX "documentToTag_documentId_idx" ON "documentToTag"("documentId");
CREATE INDEX "documentToTag_tagId_idx" ON "documentToTag"("tagId");

-- 9. 添加外键约束
ALTER TABLE "documentType" ADD CONSTRAINT "documentType_accountId_fkey" 
    FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "correspondent" ADD CONSTRAINT "correspondent_accountId_fkey" 
    FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "documentTag" ADD CONSTRAINT "documentTag_accountId_fkey" 
    FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document" ADD CONSTRAINT "document_accountId_fkey" 
    FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document" ADD CONSTRAINT "document_documentTypeId_fkey" 
    FOREIGN KEY ("documentTypeId") REFERENCES "documentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document" ADD CONSTRAINT "document_correspondentId_fkey" 
    FOREIGN KEY ("correspondentId") REFERENCES "correspondent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documentToTag" ADD CONSTRAINT "documentToTag_documentId_fkey" 
    FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documentToTag" ADD CONSTRAINT "documentToTag_tagId_fkey" 
    FOREIGN KEY ("tagId") REFERENCES "documentTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
