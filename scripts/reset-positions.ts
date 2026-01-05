import { Client } from 'pg';

const DATABASE_URL = 'postgresql://postgres:DIDIdache2025@db.lyqspnecudllmnajrrlm.supabase.co:5432/postgres';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  console.log('清理 stock_positions...');
  await client.query(`DELETE FROM stock_positions`);
  console.log('✅ 完成');
  
  await client.end();
}

main();
