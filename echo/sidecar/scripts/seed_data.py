#!/usr/bin/env python3
"""
使用 Python 插入种子数据，确保 UTF-8 编码正确
"""

import mysql.connector

# 连接配置
config = {
    'host': 'localhost',
    'port': 2881,
    'user': 'root',
    'password': '',
    'database': 'echo',
    'charset': 'utf8mb4',
    'use_unicode': True
}

# 种子数据
TAGS = [
    (1, '发票', '#e74c3c'),
    (2, '合同', '#3498db'),
    (3, '报告', '#2ecc71'),
    (4, '证件', '#9b59b6'),
    (5, '笔记', '#f39c12'),
]

DOCUMENT_TYPES = [
    (1, '财务文档'),
    (2, '法律文档'),
    (3, '技术文档'),
    (4, '个人文档'),
]

DOCUMENTS = [
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
     1, 'electricity_bill_nov.pdf'),
]

DOCUMENT_TAGS = [
    (1, 1), (1, 3),  # 文档1: 发票, 报告
    (2, 2),          # 文档2: 合同
    (3, 3), (3, 5),  # 文档3: 报告, 笔记
    (4, 4),          # 文档4: 证件
    (5, 5),          # 文档5: 笔记
    (6, 1),          # 文档6: 发票
]

def main():
    conn = mysql.connector.connect(**config)
    cursor = conn.cursor()
    
    # 设置字符集
    cursor.execute("SET NAMES utf8mb4")
    cursor.execute("SET CHARACTER SET utf8mb4")
    
    print("插入标签...")
    for tag in TAGS:
        cursor.execute(
            "INSERT INTO tags (id, name, color) VALUES (%s, %s, %s) "
            "ON DUPLICATE KEY UPDATE name=VALUES(name), color=VALUES(color)",
            tag
        )
    
    print("插入文档类型...")
    for dt in DOCUMENT_TYPES:
        cursor.execute(
            "INSERT INTO document_types (id, name) VALUES (%s, %s) "
            "ON DUPLICATE KEY UPDATE name=VALUES(name)",
            dt
        )
    
    print("插入文档...")
    for doc in DOCUMENTS:
        cursor.execute(
            "INSERT INTO documents (id, title, content, created, modified, added, document_type_id, original_file_name) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) "
            "ON DUPLICATE KEY UPDATE title=VALUES(title), content=VALUES(content)",
            doc
        )
    
    print("插入文档-标签关联...")
    for dt in DOCUMENT_TAGS:
        cursor.execute(
            "INSERT IGNORE INTO document_tags (document_id, tag_id) VALUES (%s, %s)",
            dt
        )
    
    conn.commit()
    
    # 验证
    cursor.execute("SELECT id, name FROM tags")
    print("\n标签数据:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]}")
    
    cursor.execute("SELECT id, title FROM documents")
    print("\n文档数据:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]}")
    
    cursor.close()
    conn.close()
    print("\n✅ 种子数据插入完成!")

if __name__ == "__main__":
    main()
