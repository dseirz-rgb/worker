-- PostgreSQL 初始化脚本
-- 启用中文搜索支持 (使用 pg_trgm + GIN 索引)

-- 启用 pg_trgm 扩展 (用于模糊搜索，对中文有效)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 设置 pg_trgm 参数以更好支持中文
-- 降低相似度阈值，让更多结果匹配
ALTER SYSTEM SET pg_trgm.similarity_threshold = 0.1;

-- 输出初始化完成信息
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PostgreSQL Chinese search initialized';
    RAISE NOTICE 'Using pg_trgm for fuzzy search';
    RAISE NOTICE '========================================';
END $$;
