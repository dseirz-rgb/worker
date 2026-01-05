import { Client } from 'pg';

const DATABASE_URL = 'postgresql://postgres:DIDIdache2025@db.lyqspnecudllmnajrrlm.supabase.co:5432/postgres';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  console.log('修复字段长度...');
  await client.query(`ALTER TABLE stock_positions ALTER COLUMN ticker TYPE VARCHAR(50);`);
  await client.query(`ALTER TABLE transactions ALTER COLUMN ticker TYPE VARCHAR(50);`);
  console.log('✅ 完成');
  
  await client.end();
}

main();
