import { Client } from 'pg';

const DATABASE_URL = 'postgresql://postgres:DIDIdache2025@db.lyqspnecudllmnajrrlm.supabase.co:5432/postgres';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  console.log('📊 数据库验证报告\n');
  
  // asset_snapshots
  console.log('=== asset_snapshots ===');
  const assets = await client.query(`SELECT date, net_worth FROM asset_snapshots ORDER BY date DESC LIMIT 5`);
  assets.rows.forEach(r => console.log(`  ${r.date}: $${Number(r.net_worth).toLocaleString()}`));
  
  // dashboard_snapshots
  console.log('\n=== dashboard_snapshots ===');
  const dash = await client.query(`SELECT date, net_worth_usd, net_worth_cny, data_source FROM dashboard_snapshots ORDER BY date DESC LIMIT 5`);
  dash.rows.forEach(r => console.log(`  ${r.date}: $${Number(r.net_worth_usd).toLocaleString()} / ¥${Number(r.net_worth_cny).toLocaleString()} (${r.data_source})`));
  
  // stock_positions
  console.log('\n=== stock_positions (最新) ===');
  const pos = await client.query(`SELECT snapshot_date, ticker, quantity, market_value, unrealized_pnl FROM stock_positions ORDER BY snapshot_date DESC, market_value DESC LIMIT 10`);
  pos.rows.forEach(r => console.log(`  ${r.snapshot_date} ${r.ticker}: ${r.quantity} 股, $${Number(r.market_value).toLocaleString()}, P&L: $${Number(r.unrealized_pnl).toLocaleString()}`));
  
  // transactions
  console.log('\n=== transactions ===');
  const txns = await client.query(`SELECT date, ticker, action, quantity, price FROM transactions ORDER BY date DESC LIMIT 5`);
  txns.rows.forEach(r => console.log(`  ${r.date} ${r.action} ${r.ticker}: ${r.quantity} @ $${r.price}`));
  
  // nav_changes
  console.log('\n=== nav_changes ===');
  const nav = await client.query(`SELECT to_date, ending_value, twr FROM nav_changes ORDER BY to_date DESC LIMIT 5`);
  nav.rows.forEach(r => console.log(`  ${r.to_date}: $${Number(r.ending_value).toLocaleString()}, TWR: ${(Number(r.twr) * 100).toFixed(2)}%`));
  
  await client.end();
}

main();
