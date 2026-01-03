-- RAG 升级 - documents_meta 表迁移
-- 用于存储文档元数据，支持书籍聚合和分页查询

-- 1. 创建 documents_meta 表
CREATE TABLE IF NOT EXISTS documents_meta (
  id BIGSERIAL PRIMARY KEY,
  
  -- 文档基本信息
  title TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'book', 'article', 'note', 'research' 等
  
  -- 分块信息
  chunk_count INTEGER DEFAULT 1,
  
  -- 扩展元数据 (作者、ISBN、URL 等)
  metadata JSONB DEFAULT '{}',
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建索引以提高查询性能
-- source_type 索引：用于按类型筛选文档
CREATE INDEX IF NOT EXISTS idx_documents_meta_source_type ON documents_meta(source_type);

-- created_at DESC 索引：用于按时间排序（最新优先）
CREATE INDEX IF NOT EXISTS idx_documents_meta_created_at ON documents_meta(created_at DESC);

-- 复合索引：用于分页查询优化
CREATE INDEX IF NOT EXISTS idx_documents_meta_type_created ON documents_meta(source_type, created_at DESC);

-- 3. 添加注释
COMMENT ON TABLE documents_meta IS 'RAG 系统文档元数据表，用于知识库管理';
COMMENT ON COLUMN documents_meta.id IS '文档唯一标识符';
COMMENT ON COLUMN documents_meta.title IS '文档标题';
COMMENT ON COLUMN documents_meta.source_type IS '来源类型：book, article, note, research 等';
COMMENT ON COLUMN documents_meta.chunk_count IS '文档分块数量';
COMMENT ON COLUMN documents_meta.metadata IS '扩展元数据 JSON，可包含作者、ISBN、URL 等';
COMMENT ON COLUMN documents_meta.created_at IS '创建时间';
COMMENT ON COLUMN documents_meta.updated_at IS '更新时间';
