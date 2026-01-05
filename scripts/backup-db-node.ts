/**
 * Node.js 数据库备份脚本
 * 用于没有 pg_dump 的环境
 */

import { Client } from 'pg';
import { createWriteStream } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const [,, dbName, dbUrl, outputPath] = process.argv;

if (!dbName || !dbUrl || !outputPath) {
  console.error('用法: npx tsx backup-db-node.ts <db_name> <db_url> <output_path>');
  process.exit(1);
}

async function backup() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const output: string[] = [];
  output.push(`-- Database backup: ${dbName}`);
  output.push(`-- Created: ${new Date().toISOString()}`);
  output.push('');
  
  // 获取所有表
  const tablesResult = await client.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename
  `);
  
  for (const row of tablesResult.rows) {
    const tableName = row.tablename;
    
    // 获取表结构
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tableName]);
    
    // 获取数据
    const dataResult = await client.query(`SELECT * FROM "${tableName}"`);
    
    if (dataResult.rows.length > 0) {
      output.push(`-- Table: ${tableName} (${dataResult.rows.length} rows)`);
      output.push(`DELETE FROM "${tableName}";`);
      
      const columns = columnsResult.rows.map(c => c.column_name);
      
      for (const row of dataResult.rows) {
        const values = columns.map(col => {
          const val = row[col];
          if (val === null) return 'NULL';
          if (typeof val === 'number') return val.toString();
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          if (val instanceof Date) return `'${val.toISOString()}'`;
          return `'${String(val).replace(/'/g, "''")}'`;
        });
        output.push(`INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});`);
      }
      output.push('');
    }
  }
  
  await client.end();
  
  // 写入压缩文件
  const content = output.join('\n');
  const readable = Readable.from([content]);
  const gzip = createGzip();
  const writable = createWriteStream(outputPath);
  
  await pipeline(readable, gzip, writable);
  console.log(`备份完成: ${outputPath}`);
}

backup().catch(err => {
  console.error('备份失败:', err);
  process.exit(1);
});
