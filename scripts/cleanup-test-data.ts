import { Client } from 'pg';

const DATABASE_URL = 'postgresql://postgres:DIDIdache2025@db.lyqspnecudllmnajrrlm.supabase.co:5432/postgres';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  console.log('清理测试数据...');
  
  // 删除测试数据（data_source = 'TEST' 或 ticker 是测试股票）
  await client.query(`DELETE FROM stock_positions WHERE ticker IN ('AAPL', 'GOOGL', '9988')`);
  await client.query(`DELETE FROM dashboard_snapshots WHERE data_source = 'TEST'`);
  await client.query(`DELETE FROM asset_snapshots WHERE date = '2025-01-01' OR date = '2026-01-03'`);
  
  // 验证
  const tables = ['asset_snapshots', 'dashboard_snapshots', 'nav_changes', 'transactions', 'stock_positions'];
  console.log('\n当前数据:');
  for (const table of tables) {
    const result = await client.query(`SELECT COUNT(*) FROM "${table}"`);
    console.log(`   ${table}: ${result.rows[0].count} 条记录`);
  }
  
  console.log('\n✅ 清理完成');
  await client.end();
}

main();
