-- 为 attachments 表添加全文搜索支持
-- 使用 pg_trgm 扩展实现中文模糊搜索

-- 1. 启用 pg_trgm 扩展
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. 添加 content 字段存储文档内容
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';

-- 3. 创建 GIN 索引用于快速搜索
-- 使用 gin_trgm_ops 操作符类，支持 LIKE/ILIKE 和相似度搜索
CREATE INDEX IF NOT EXISTS idx_attachments_name_trgm 
    ON attachments USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_attachments_content_trgm 
    ON attachments USING GIN (content gin_trgm_ops);

-- 4. 创建复合索引用于常用查询
CREATE INDEX IF NOT EXISTS idx_attachments_account_created 
    ON attachments (accountId, createdAt DESC);

CREATE INDEX IF NOT EXISTS idx_attachments_type 
    ON attachments (type);

-- 5. 创建搜索函数
CREATE OR REPLACE FUNCTION search_attachments(
    search_query TEXT,
    account_id INT DEFAULT NULL,
    limit_count INT DEFAULT 20,
    offset_count INT DEFAULT 0
)
RETURNS TABLE (
    id INT,
    name VARCHAR,
    path VARCHAR,
    type VARCHAR,
    size DECIMAL,
    content TEXT,
    "noteId" INT,
    "accountId" INT,
    "createdAt" TIMESTAMPTZ,
    "updatedAt" TIMESTAMPTZ,
    similarity_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.name,
        a.path,
        a.type,
        a.size,
        a.content,
        a."noteId",
        a."accountId",
        a."createdAt",
        a."updatedAt",
        GREATEST(
            similarity(a.name, search_query),
            similarity(a.content, search_query)
        ) AS similarity_score
    FROM attachments a
    WHERE 
        (account_id IS NULL OR a."accountId" = account_id)
        AND (
            a.name ILIKE '%' || search_query || '%'
            OR a.content ILIKE '%' || search_query || '%'
        )
    ORDER BY similarity_score DESC, a."createdAt" DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建统计视图
CREATE OR REPLACE VIEW attachment_stats AS
SELECT 
    COUNT(*) as total_count,
    COUNT(DISTINCT "accountId") as account_count,
    SUM(size) as total_size,
    COUNT(CASE WHEN content != '' THEN 1 END) as indexed_count
FROM attachments;
