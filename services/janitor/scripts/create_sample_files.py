#!/usr/bin/env python3
"""
创建示例 PDF 文件并更新数据库中的文件路径
"""

import os
import mysql.connector
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# 存储路径
STORAGE_PATH = Path(__file__).parent.parent / 'storage' / 'documents'
STORAGE_PATH.mkdir(parents=True, exist_ok=True)

# 数据库配置
DB_CONFIG = {
    'host': 'localhost',
    'port': 2881,
    'user': 'root',
    'password': '',
    'database': 'echo',
    'charset': 'utf8mb4',
    'use_unicode': True
}

# 示例文档数据
SAMPLE_DOCS = [
    {
        'id': 1,
        'filename': '2024_financial_report.pdf',
        'title': '2024年度财务报告',
        'content': [
            '2024年度财务报告',
            '',
            '一、收入概况',
            '本年度总收入：￥1,234,567.89',
            '同比增长：15.3%',
            '',
            '二、支出明细',
            '运营成本：￥456,789.00',
            '人力成本：￥234,567.00',
            '其他支出：￥123,456.00',
            '',
            '三、净利润',
            '本年度净利润：￥419,755.89',
        ]
    },
    {
        'id': 2,
        'filename': 'contract_abc.pdf',
        'title': '服务合同 - ABC公司',
        'content': [
            '服务合同',
            '',
            '甲方：ABC科技有限公司',
            '乙方：XXX公司',
            '',
            '合同编号：2024-ABC-001',
            '签订日期：2024年11月15日',
            '',
            '第一条 服务内容',
            '甲方委托乙方提供技术咨询服务...',
            '',
            '第二条 服务期限',
            '自2024年11月15日起至2025年11月14日止',
        ]
    },
    {
        'id': 3,
        'filename': 'tech_proposal.pdf',
        'title': '项目技术方案',
        'content': [
            '项目技术方案',
            '',
            '1. 项目背景',
            '本项目旨在构建一个现代化的文档管理系统...',
            '',
            '2. 技术架构',
            '- 前端：React + TypeScript',
            '- 后端：FastAPI + SeekDB',
            '- 存储：本地文件系统 + MySQL',
            '',
            '3. 实施计划',
            '第一阶段：需求分析（2周）',
            '第二阶段：系统设计（2周）',
            '第三阶段：开发实现（4周）',
        ]
    },
    {
        'id': 5,
        'filename': 'meeting_notes_dec.pdf',
        'title': '会议纪要 - 12月产品评审',
        'content': [
            '会议纪要',
            '',
            '会议主题：12月产品评审',
            '会议时间：2024年12月5日 14:00-16:00',
            '参会人员：产品经理、技术负责人、设计师',
            '',
            '会议内容：',
            '1. 产品进度汇报',
            '2. 技术方案讨论',
            '3. 下一步计划',
            '',
            '决议事项：',
            '- 确认12月底完成第一版本',
            '- 下周进行用户测试',
        ]
    },
    {
        'id': 6,
        'filename': 'electricity_bill_nov.pdf',
        'title': '电费发票 - 11月',
        'content': [
            '电费发票',
            '',
            '发票号码：E2024112800001',
            '开票日期：2024年11月28日',
            '',
            '用户名称：XXX公司',
            '用电地址：XX市XX区XX路XX号',
            '',
            '用电量：1,024 度',
            '单价：￥0.25/度',
            '金额：￥256.80',
            '',
            '缴费截止日期：2024年12月15日',
        ]
    },
]

def create_pdf(filepath: Path, title: str, content_lines: list):
    """创建简单的 PDF 文件"""
    c = canvas.Canvas(str(filepath), pagesize=A4)
    width, height = A4
    
    # 使用内置字体（不支持中文，但能显示）
    # 如果需要中文，需要注册中文字体
    y = height - 50
    
    for line in content_lines:
        if y < 50:
            c.showPage()
            y = height - 50
        
        # 简单处理：英文和数字正常显示，中文可能显示为方块
        try:
            c.drawString(50, y, line)
        except:
            c.drawString(50, y, line.encode('ascii', 'replace').decode())
        y -= 20
    
    c.save()
    print(f"  创建: {filepath}")

def main():
    print("创建示例 PDF 文件...")
    
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    cursor.execute("SET NAMES utf8mb4")
    
    for doc in SAMPLE_DOCS:
        filepath = STORAGE_PATH / doc['filename']
        create_pdf(filepath, doc['title'], doc['content'])
        
        # 更新数据库中的文件路径
        cursor.execute(
            "UPDATE documents SET file_path = %s WHERE id = %s",
            (str(filepath), doc['id'])
        )
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"\n✅ 创建了 {len(SAMPLE_DOCS)} 个示例文件")
    print(f"   存储位置: {STORAGE_PATH}")

if __name__ == "__main__":
    main()
