-- Echo SeekDB 示例数据初始化脚本
-- 插入与前端 MOCK 数据一致的示例数据
--
-- 使用方法:
--   mysql -h 127.0.0.1 -P 2881 -u root -p echo < seed_data.sql

USE echo;

-- ============================================================
-- 1. 插入标签 (对应 MOCK_TAGS)
-- ============================================================

INSERT INTO tags (id, name, color) VALUES
    (1, '发票', '#e74c3c'),
    (2, '合同', '#3498db'),
    (3, '报告', '#2ecc71'),
    (4, '证件', '#9b59b6'),
    (5, '笔记', '#f39c12')
ON DUPLICATE KEY UPDATE name = VALUES(name), color = VALUES(color);

-- ============================================================
-- 2. 插入文档类型 (对应 MOCK_DOCUMENT_TYPES)
-- ============================================================

INSERT INTO document_types (id, name) VALUES
    (1, '财务文档'),
    (2, '法律文档'),
    (3, '技术文档'),
    (4, '个人文档')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ============================================================
-- 3. 插入示例文档 (对应 MOCK_DOCUMENTS)
-- ============================================================

INSERT INTO documents (id, title, content, created, modified, added, document_type_id, original_file_name) VALUES
    (1, '2024年度财务报告', '这是一份年度财务报告的 OCR 提取内容...', 
     '2024-12-01 10:00:00', '2024-12-15 14:30:00', '2024-12-20 09:00:00', 
     1, '2024_financial_report.pdf'),
    
    (2, '服务合同 - ABC公司', '甲方：ABC公司\n乙方：...\n合同内容...', 
     '2024-11-15 08:00:00', '2024-11-15 08:00:00', '2024-12-18 11:00:00', 
     2, 'contract_abc.pdf'),
    
    (3, '项目技术方案', '技术架构设计文档...', 
     '2024-12-10 15:00:00', '2024-12-12 16:00:00', '2024-12-15 10:00:00', 
     3, 'tech_proposal.pdf'),
    
    (4, '身份证扫描件', '姓名：张三\n身份证号：...', 
     '2024-10-01 09:00:00', '2024-10-01 09:00:00', '2024-12-10 08:00:00', 
     4, 'id_card.jpg'),
    
    (5, '会议纪要 - 12月产品评审', '会议时间：2024年12月5日\n参会人员：...', 
     '2024-12-05 14:00:00', '2024-12-05 16:00:00', '2024-12-08 09:00:00', 
     3, 'meeting_notes_dec.md'),
    
    (6, '电费发票 - 11月', '发票号码：...\n金额：￥256.80', 
     '2024-11-28 10:00:00', '2024-11-28 10:00:00', '2024-12-01 11:00:00', 
     1, 'electricity_bill_nov.pdf')
ON DUPLICATE KEY UPDATE 
    title = VALUES(title), 
    content = VALUES(content),
    document_type_id = VALUES(document_type_id);

-- ============================================================
-- 4. 插入文档-标签关联 (对应 MOCK_DOCUMENTS 中的 tags 数组)
-- ============================================================

-- 文档 1: tags: [1, 3] (发票, 报告)
INSERT INTO document_tags (document_id, tag_id) VALUES (1, 1), (1, 3)
ON DUPLICATE KEY UPDATE document_id = VALUES(document_id);

-- 文档 2: tags: [2] (合同)
INSERT INTO document_tags (document_id, tag_id) VALUES (2, 2)
ON DUPLICATE KEY UPDATE document_id = VALUES(document_id);

-- 文档 3: tags: [3, 5] (报告, 笔记)
INSERT INTO document_tags (document_id, tag_id) VALUES (3, 3), (3, 5)
ON DUPLICATE KEY UPDATE document_id = VALUES(document_id);

-- 文档 4: tags: [4] (证件)
INSERT INTO document_tags (document_id, tag_id) VALUES (4, 4)
ON DUPLICATE KEY UPDATE document_id = VALUES(document_id);

-- 文档 5: tags: [5] (笔记)
INSERT INTO document_tags (document_id, tag_id) VALUES (5, 5)
ON DUPLICATE KEY UPDATE document_id = VALUES(document_id);

-- 文档 6: tags: [1] (发票)
INSERT INTO document_tags (document_id, tag_id) VALUES (6, 1)
ON DUPLICATE KEY UPDATE document_id = VALUES(document_id);

-- ============================================================
-- 5. 验证数据
-- ============================================================

SELECT '=== 标签数据 ===' AS info;
SELECT * FROM tags;

SELECT '=== 文档类型数据 ===' AS info;
SELECT * FROM document_types;

SELECT '=== 文档数据 ===' AS info;
SELECT id, title, document_type_id, original_file_name FROM documents;

SELECT '=== 文档-标签关联 ===' AS info;
SELECT d.id, d.title, GROUP_CONCAT(t.name) AS tags
FROM documents d
LEFT JOIN document_tags dt ON d.id = dt.document_id
LEFT JOIN tags t ON dt.tag_id = t.id
GROUP BY d.id, d.title;

SELECT '示例数据初始化完成!' AS status;
