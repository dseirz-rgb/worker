-- Echo SeekDB 数据库初始化脚本
-- 创建 Paperless 兼容的文档管理表 + 知识库向量搜索表
--
-- 使用方法:
--   mysql -h 127.0.0.1 -P 2881 -u root -p < init_db.sql
--
-- 参考: https://github.com/oceanbase/seekdb

-- 创建数据库
CREATE DATABASE IF NOT EXISTS echo;
USE echo;

-- ============================================================
-- 1. Paperless 兼容的文档管理表
-- ============================================================

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#a6cee3',
    match_text VARCHAR(255) DEFAULT '',
    matching_algorithm INT DEFAULT 0,
    is_insensitive BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 文档类型表
CREATE TABLE IF NOT EXISTS document_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    match_text VARCHAR(255) DEFAULT '',
    matching_algorithm INT DEFAULT 0,
    is_insensitive BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 通讯者表 (Paperless 兼容，简化实现)
CREATE TABLE IF NOT EXISTS correspondents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    match_text VARCHAR(255) DEFAULT '',
    matching_algorithm INT DEFAULT 0,
    is_insensitive BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 文档表 (Paperless 兼容)
CREATE TABLE IF NOT EXISTS documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    document_type_id INT,
    correspondent_id INT,
    archive_serial_number INT,
    original_file_name VARCHAR(255),
    archived_file_name VARCHAR(255),
    file_path VARCHAR(512),           -- 原始文件存储路径
    thumbnail_path VARCHAR(512),      -- 缩略图存储路径
    
    -- 向量嵌入 (384 维，用于语义搜索)
    embedding VECTOR(384),
    
    -- 外键约束
    FOREIGN KEY (document_type_id) REFERENCES document_types(id) ON DELETE SET NULL,
    FOREIGN KEY (correspondent_id) REFERENCES correspondents(id) ON DELETE SET NULL,
    
    -- 全文索引 (使用 IK 分词器支持中文)
    FULLTEXT INDEX idx_doc_content_fts (content) WITH PARSER ik,
    FULLTEXT INDEX idx_doc_title_fts (title) WITH PARSER ik,
    
    -- 向量索引
    VECTOR INDEX idx_doc_embedding_vec (embedding) WITH (
        DISTANCE = l2,
        TYPE = hnsw,
        LIB = vsag
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 文档-标签关联表 (多对多)
CREATE TABLE IF NOT EXISTS document_tags (
    document_id INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (document_id, tag_id),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建索引
CREATE INDEX idx_documents_created ON documents(created);
CREATE INDEX idx_documents_added ON documents(added);
CREATE INDEX idx_documents_document_type ON documents(document_type_id);
CREATE INDEX idx_document_tags_tag ON document_tags(tag_id);

-- ============================================================
-- 2. 知识库表 (用于笔记、视频、PPT 等多模态内容)
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_base (
    -- 主键
    id VARCHAR(64) PRIMARY KEY,
    
    -- 核心内容 (用于搜索)
    content TEXT NOT NULL,
    
    -- 向量嵌入 (384 维，与 SeekDB 默认 embedding 模型匹配)
    embedding VECTOR(384),
    
    -- 来源信息
    source_type VARCHAR(20) NOT NULL,  -- 'note', 'video', 'ppt', 'pdf'
    source_path TEXT NOT NULL,          -- 文件路径或 Supabase ID
    
    -- 元数据 (JSON 格式)
    -- Note:  {"supabase_id": "xxx", "tags": ["work", "idea"]}
    -- Video: {"start_time": 120, "end_time": 150, "file_path": "/path/to/video.mp4"}
    -- PPT:   {"page_number": 5, "total_pages": 20, "file_path": "/path/to/slides.pptx"}
    metadata JSON,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- 全文索引 (使用 IK 分词器支持中文)
    FULLTEXT INDEX idx_kb_content_fts (content) WITH PARSER ik,
    
    -- 向量索引 (使用 HNSW 算法，L2 距离)
    VECTOR INDEX idx_kb_embedding_vec (embedding) WITH (
        DISTANCE = l2,
        TYPE = hnsw,
        LIB = vsag
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建来源类型索引，加速按类型过滤
CREATE INDEX idx_kb_source_type ON knowledge_base(source_type);
CREATE INDEX idx_kb_created_at ON knowledge_base(created_at);

-- ============================================================
-- 3. 显示表结构
-- ============================================================

SELECT '=== 表结构 ===' AS info;
SHOW TABLES;

SELECT '=== documents 表结构 ===' AS info;
DESCRIBE documents;

SELECT '=== tags 表结构 ===' AS info;
DESCRIBE tags;

SELECT '数据库初始化完成!' AS status;
