"""
数据迁移脚本
从 SQLite 迁移数据到 ChromaDB
"""

import sqlite3
import os
import json
import argparse
from datetime import datetime
from typing import Optional

import chromadb
from chromadb.config import Settings


def get_sqlite_connection(db_path: str) -> sqlite3.Connection:
    """获取 SQLite 连接"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def get_chromadb_client(data_dir: str) -> chromadb.PersistentClient:
    """获取 ChromaDB 客户端"""
    os.makedirs(data_dir, exist_ok=True)
    return chromadb.PersistentClient(
        path=os.path.join(data_dir, "echo.chromadb"),
        settings=Settings(
            anonymized_telemetry=False,
            allow_reset=True
        )
    )


def migrate_notes(sqlite_conn: sqlite3.Connection, chroma_client: chromadb.PersistentClient) -> int:
    """迁移笔记数据"""
    print("正在迁移笔记...")
    
    cursor = sqlite_conn.execute("SELECT * FROM notes")
    rows = cursor.fetchall()
    
    if not rows:
        print("  没有笔记需要迁移")
        return 0
    
    collection = chroma_client.get_or_create_collection(
        name="notes",
        metadata={"hnsw:space": "cosine"}
    )
    
    ids = []
    documents = []
    metadatas = []
    
    for row in rows:
        ids.append(row["id"])
        documents.append(row["content"])
        metadatas.append({
            "domain": row["domain"] or "general",
            "tags": row["tags"] or "",
            "type": row["type"] or "text",
            "created_at": row["created_at"] or datetime.now().isoformat(),
            "updated_at": row["updated_at"] or row["created_at"] or datetime.now().isoformat()
        })
    
    # 批量添加
    batch_size = 100
    for i in range(0, len(ids), batch_size):
        batch_ids = ids[i:i+batch_size]
        batch_docs = documents[i:i+batch_size]
        batch_meta = metadatas[i:i+batch_size]
        
        try:
            collection.add(ids=batch_ids, documents=batch_docs, metadatas=batch_meta)
        except Exception as e:
            # 可能是重复 ID，尝试更新
            for j, doc_id in enumerate(batch_ids):
                try:
                    collection.add(ids=[doc_id], documents=[batch_docs[j]], metadatas=[batch_meta[j]])
                except:
                    try:
                        collection.update(ids=[doc_id], documents=[batch_docs[j]], metadatas=[batch_meta[j]])
                    except Exception as e2:
                        print(f"  警告: 无法迁移笔记 {doc_id}: {e2}")
    
    print(f"  迁移了 {len(ids)} 条笔记")
    return len(ids)


def migrate_tasks(sqlite_conn: sqlite3.Connection, chroma_client: chromadb.PersistentClient) -> int:
    """迁移任务数据"""
    print("正在迁移任务...")
    
    cursor = sqlite_conn.execute("SELECT * FROM tasks")
    rows = cursor.fetchall()
    
    if not rows:
        print("  没有任务需要迁移")
        return 0
    
    collection = chroma_client.get_or_create_collection(
        name="tasks",
        metadata={"hnsw:space": "cosine"}
    )
    
    ids = []
    documents = []
    metadatas = []
    
    for row in rows:
        ids.append(row["id"])
        # 合并 title 和 description 作为文档内容
        content = f"{row['title']}\n{row['description'] or ''}"
        documents.append(content)
        metadatas.append({
            "title": row["title"],
            "description": row["description"] or "",
            "priority": row["priority"] or "medium",
            "status": row["status"] or "pending",
            "deadline": row["deadline"] or "",
            "domain": row["domain"] or "general",
            "created_at": row["created_at"] or datetime.now().isoformat(),
            "completed_at": row["completed_at"] or ""
        })
    
    # 批量添加
    batch_size = 100
    for i in range(0, len(ids), batch_size):
        batch_ids = ids[i:i+batch_size]
        batch_docs = documents[i:i+batch_size]
        batch_meta = metadatas[i:i+batch_size]
        
        try:
            collection.add(ids=batch_ids, documents=batch_docs, metadatas=batch_meta)
        except:
            for j, doc_id in enumerate(batch_ids):
                try:
                    collection.add(ids=[doc_id], documents=[batch_docs[j]], metadatas=[batch_meta[j]])
                except:
                    try:
                        collection.update(ids=[doc_id], documents=[batch_docs[j]], metadatas=[batch_meta[j]])
                    except Exception as e:
                        print(f"  警告: 无法迁移任务 {doc_id}: {e}")
    
    print(f"  迁移了 {len(ids)} 条任务")
    return len(ids)


def migrate_reminders(sqlite_conn: sqlite3.Connection, chroma_client: chromadb.PersistentClient) -> int:
    """迁移提醒数据"""
    print("正在迁移提醒...")
    
    try:
        cursor = sqlite_conn.execute("SELECT * FROM reminders")
        rows = cursor.fetchall()
    except sqlite3.OperationalError:
        print("  reminders 表不存在，跳过")
        return 0
    
    if not rows:
        print("  没有提醒需要迁移")
        return 0
    
    collection = chroma_client.get_or_create_collection(
        name="reminders",
        metadata={"hnsw:space": "cosine"}
    )
    
    ids = []
    documents = []
    metadatas = []
    
    for row in rows:
        ids.append(row["id"])
        content = f"{row['title']}\n{row['message'] or ''}"
        documents.append(content)
        metadatas.append({
            "type": row["type"] or "reminder",
            "title": row["title"],
            "message": row["message"] or "",
            "priority": row["priority"] or "medium",
            "scheduled_at": row["scheduled_at"] or "",
            "status": row["status"] or "pending",
            "created_at": row["created_at"] or datetime.now().isoformat()
        })
    
    # 批量添加
    batch_size = 100
    for i in range(0, len(ids), batch_size):
        batch_ids = ids[i:i+batch_size]
        batch_docs = documents[i:i+batch_size]
        batch_meta = metadatas[i:i+batch_size]
        
        try:
            collection.add(ids=batch_ids, documents=batch_docs, metadatas=batch_meta)
        except:
            for j, doc_id in enumerate(batch_ids):
                try:
                    collection.add(ids=[doc_id], documents=[batch_docs[j]], metadatas=[batch_meta[j]])
                except:
                    try:
                        collection.update(ids=[doc_id], documents=[batch_docs[j]], metadatas=[batch_meta[j]])
                    except Exception as e:
                        print(f"  警告: 无法迁移提醒 {doc_id}: {e}")
    
    print(f"  迁移了 {len(ids)} 条提醒")
    return len(ids)


def verify_migration(sqlite_conn: sqlite3.Connection, chroma_client: chromadb.PersistentClient) -> bool:
    """验证迁移数据完整性"""
    print("\n正在验证数据完整性...")
    
    tables = ["notes", "tasks", "reminders"]
    all_valid = True
    
    for table in tables:
        try:
            cursor = sqlite_conn.execute(f"SELECT COUNT(*) as count FROM {table}")
            sqlite_count = cursor.fetchone()["count"]
        except sqlite3.OperationalError:
            sqlite_count = 0
        
        try:
            collection = chroma_client.get_collection(table)
            chroma_count = collection.count()
        except:
            chroma_count = 0
        
        if sqlite_count != chroma_count:
            print(f"  ⚠️ {table}: SQLite={sqlite_count}, ChromaDB={chroma_count} (不一致)")
            all_valid = False
        else:
            print(f"  ✓ {table}: {sqlite_count} 条记录验证通过")
    
    return all_valid


def migrate(sqlite_path: str, data_dir: str, verify: bool = True) -> dict:
    """执行完整迁移"""
    print(f"开始迁移数据...")
    print(f"  SQLite 数据库: {sqlite_path}")
    print(f"  ChromaDB 目录: {data_dir}")
    print()
    
    if not os.path.exists(sqlite_path):
        print(f"错误: SQLite 数据库不存在: {sqlite_path}")
        return {"success": False, "error": "SQLite 数据库不存在"}
    
    sqlite_conn = get_sqlite_connection(sqlite_path)
    chroma_client = get_chromadb_client(data_dir)
    
    results = {
        "notes": 0,
        "tasks": 0,
        "reminders": 0,
        "success": True
    }
    
    try:
        results["notes"] = migrate_notes(sqlite_conn, chroma_client)
        results["tasks"] = migrate_tasks(sqlite_conn, chroma_client)
        results["reminders"] = migrate_reminders(sqlite_conn, chroma_client)
        
        if verify:
            results["verified"] = verify_migration(sqlite_conn, chroma_client)
        
        print("\n迁移完成!")
        print(f"  总计迁移: {results['notes'] + results['tasks'] + results['reminders']} 条记录")
        
    except Exception as e:
        print(f"\n迁移失败: {e}")
        results["success"] = False
        results["error"] = str(e)
    finally:
        sqlite_conn.close()
    
    return results


def main():
    parser = argparse.ArgumentParser(description="从 SQLite 迁移数据到 ChromaDB")
    parser.add_argument("--sqlite", default="./echo.db", help="SQLite 数据库路径")
    parser.add_argument("--data-dir", default="./data", help="ChromaDB 数据目录")
    parser.add_argument("--no-verify", action="store_true", help="跳过验证步骤")
    
    args = parser.parse_args()
    
    results = migrate(args.sqlite, args.data_dir, verify=not args.no_verify)
    
    if results["success"]:
        exit(0)
    else:
        exit(1)


if __name__ == "__main__":
    main()
