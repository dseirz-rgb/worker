/**
 * 解析 IBKR XML 报表并写入数据库
 */

import { Client } from 'pg';
import { readFileSync } from 'fs';

const DATABASE_URL = 'postgresql://postgres:DIDIdache2025@db.lyqspnecudllmnajrrlm.supabase.co:5432/postgres';
const USD_CNY = 7.04;

function log(msg: string) { process.stdout.write(msg + '\n'); }

function parseXMLAttributes(xml: string, tagName: string): Record<string, string>[] {
  const results: Record<string, string>[] = [];
  const regex = new RegExp(`<${tagName}\\s+([^>]+)\\s*\\/?>`, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+)="([^"]*)"/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(match[1])) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }
    results.push(attrs);
  }
  return results;
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

function detectMarket(symbol: string): string {
  if (/^\d{4,5}$/.test(symbol)) return 'HK';
  if (/^\d{6}$/.test(symbol)) return 'CN';
  return 'US';
}

async function main() {
  const xmlPath = process.argv[2];
  if (!xmlPath) { log('用法: npx tsx parse-and-insert.ts <xml文件路径>'); process.exit(1); }
  
  const reportXML = readFileSync(xmlPath, 'utf-8');
  log(`📄 报表大小: ${(reportXML.length / 1024).toFixed(1)} KB`);
  
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    log('✅ 已连接到数据库\n');
    
    const summaryAttrs = parseXMLAttributes(reportXML, 'EquitySummaryByReportDateInBase');
    log(`📊 找到 ${summaryAttrs.length} 条账户摘要记录`);
    if (summaryAttrs.length === 0) throw new Error('No summary data found');
    
    const latestSummary = summaryAttrs.reduce((latest, current) => 
      (!latest || current.reportDate > latest.reportDate) ? current : latest, summaryAttrs[0]);
    
    const reportDate = formatDate(latestSummary.reportDate);
    const cash = parseFloat(latestSummary.cash || '0');
    const stock = parseFloat(latestSummary.stock || '0');
    const options = parseFloat(latestSummary.options || '0');
    const totalEquity = cash + stock + options;
    const netWorthCNY = totalEquity * USD_CNY;
    
    log(`   最新日期: ${reportDate}`);
    log(`   总净值 (USD): ${totalEquity.toLocaleString()}`);
    log(`   总净值 (CNY): ¥${netWorthCNY.toLocaleString()}`);
    
    const navChangeAttrs = parseXMLAttributes(reportXML, 'ChangeInNAV');
    log(`\n📈 找到 ${navChangeAttrs.length} 条净值变化记录`);

    // 同步 asset_snapshots
    log('\n💾 同步 asset_snapshots...');
    let assetCount = 0;
    for (const nav of navChangeAttrs) {
      const toDate = formatDate(nav.toDate);
      const endingValue = parseFloat(nav.endingValue) || 0;
      try {
        await client.query(`INSERT INTO asset_snapshots (date, net_worth) VALUES ($1, $2) ON CONFLICT (date) DO UPDATE SET net_worth = $2, updated_at = NOW()`, [toDate, endingValue]);
        assetCount++;
      } catch (e: any) { log(`   错误: ${e.message}`); }
    }
    log(`   ✅ 成功插入/更新 ${assetCount} 条记录`);
    
    // 同步 dashboard_snapshots
    log('\n💾 同步 dashboard_snapshots...');
    const stockValue = stock + options;
    const cashRatio = totalEquity > 0 ? (cash / totalEquity) * 100 : 0;
    const longRatio = totalEquity > 0 ? (Math.max(0, stockValue) / totalEquity) * 100 : 0;
    
    const prevResult = await client.query(`SELECT high_water_mark, net_worth_cny FROM dashboard_snapshots ORDER BY date DESC LIMIT 1`);
    const prevHighWaterMark = Number(prevResult.rows[0]?.high_water_mark) || 0;
    const prevNetWorthCNY = Number(prevResult.rows[0]?.net_worth_cny) || 0;
    const highWaterMark = Math.max(netWorthCNY, prevHighWaterMark) || netWorthCNY;
    const drawdownAmount = netWorthCNY - highWaterMark;
    const drawdownPercent = highWaterMark > 0 ? (drawdownAmount / highWaterMark) * 100 : 0;
    const dailyPnl = prevNetWorthCNY > 0 ? netWorthCNY - prevNetWorthCNY : 0;
    const dailyPnlPercent = prevNetWorthCNY > 0 ? (dailyPnl / prevNetWorthCNY) * 100 : 0;
    
    // 杠杆率 = 总资产 / 净资产 = (多头价值 + 空头价值) / 净值
    // 当现金为负时（借款），杠杆率 > 1
    const totalAssets = Math.max(0, stockValue); // 多头价值（已包含期权）
    const leverageRatio = totalEquity > 0 ? totalAssets / totalEquity : 1.0;
    
    log(`   杠杆率: ${leverageRatio.toFixed(2)}x (总资产: ${totalAssets.toLocaleString()}, 净值: ${totalEquity.toLocaleString()})`);
    
    try {
      await client.query(`
        INSERT INTO dashboard_snapshots (date, net_worth_usd, net_worth_cny, high_water_mark, drawdown_amount, drawdown_percent, max_drawdown_percent, daily_pnl, daily_pnl_percent, cash_usd, cash_ratio, long_ratio, short_ratio, long_value_cny, short_value_cny, leverage_ratio, usd_cny_rate, hkd_cny_rate, data_source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (date) DO UPDATE SET net_worth_usd = $2, net_worth_cny = $3, high_water_mark = $4, leverage_ratio = $16, updated_at = NOW()
      `, [reportDate, totalEquity, netWorthCNY, highWaterMark, drawdownAmount, drawdownPercent, drawdownPercent, dailyPnl, dailyPnlPercent, cash, cashRatio, longRatio, 0, Math.max(0, stockValue) * USD_CNY, 0, leverageRatio, USD_CNY, 0.93, 'IBKR']);
      log('   ✅ 成功');
    } catch (e: any) { log(`   错误: ${e.message}`); }
    
    // 同步 nav_changes
    log('\n💾 同步 nav_changes...');
    let navCount = 0;
    for (const nav of navChangeAttrs) {
      try {
        await client.query(`
          INSERT INTO nav_changes (account_id, from_date, to_date, starting_value, ending_value, twr, mtm, realized, change_in_unrealized, deposits_withdrawals, dividends, interest, commissions, broker_fees, withholding_tax, other_fees, fx_translation)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (account_id, to_date) DO UPDATE SET ending_value = $5
        `, [nav.accountId || 'default', formatDate(nav.fromDate), formatDate(nav.toDate), parseFloat(nav.startingValue) || 0, parseFloat(nav.endingValue) || 0, parseFloat(nav.twr) || 0, parseFloat(nav.mtm) || 0, parseFloat(nav.realized) || 0, parseFloat(nav.changeInUnrealized) || 0, parseFloat(nav.depositsWithdrawals) || 0, parseFloat(nav.dividends) || 0, parseFloat(nav.interest) || 0, parseFloat(nav.commissions) || 0, parseFloat(nav.brokerFees) || 0, parseFloat(nav.withholdingTax) || 0, parseFloat(nav.otherFees) || 0, parseFloat(nav.fxTranslation) || 0]);
        navCount++;
      } catch (e: any) { log(`   错误: ${e.message}`); }
    }
    log(`   ✅ 成功插入/更新 ${navCount} 条记录`);
    
    // 同步交易记录
    const tradeAttrs = parseXMLAttributes(reportXML, 'Trade');
    log(`\n💾 同步 transactions (${tradeAttrs.length} 条)...`);
    let tradeCount = 0;
    for (const trade of tradeAttrs) {
      const dateTime = trade.dateTime || trade.tradeDate || '';
      const dateStr = dateTime.split(';')[0];
      // 生成 UUID v5 风格的 ID（基于内容哈希）
      const crypto = await import('crypto');
      const tradeContent = `${trade.symbol}-${dateTime}-${trade.quantity}-${trade.price}`;
      const tradeId = crypto.createHash('md5').update(tradeContent).digest('hex');
      const uuid = `${tradeId.slice(0,8)}-${tradeId.slice(8,12)}-${tradeId.slice(12,16)}-${tradeId.slice(16,20)}-${tradeId.slice(20,32)}`;
      try {
        await client.query(`INSERT INTO transactions (id, date, ticker, name, market, currency, action, price, quantity, fee) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO UPDATE SET price = $8`, [uuid, formatDate(dateStr), trade.symbol || '', trade.description || '', detectMarket(trade.symbol || ''), trade.currency || 'USD', trade.buySell || '', parseFloat(trade.price) || 0, parseInt(trade.quantity) || 0, parseFloat(trade.commission) || 0]);
        tradeCount++;
      } catch (e: any) { log(`   错误: ${e.message}`); }
    }
    log(`   ✅ 成功插入/更新 ${tradeCount} 条记录`);
    
    // 同步持仓 - 只保留最新日期的数据
    // 注意：使用 positionValueInBase 和 fifoPnlUnrealized（已转换为 Base Currency USD）
    const positionAttrs = parseXMLAttributes(reportXML, 'OpenPosition');
    // 找出最新的 reportDate
    const latestPosDate = positionAttrs.reduce((latest, pos) => {
      const d = pos.reportDate || '';
      return d > latest ? d : latest;
    }, '');
    const latestPositions = positionAttrs.filter(pos => pos.reportDate === latestPosDate);
    log(`\n💾 同步 stock_positions (${latestPositions.length} 条, 日期: ${formatDate(latestPosDate)})...`);
    const posReportDate = formatDate(latestPosDate);
    await client.query(`DELETE FROM stock_positions WHERE snapshot_date = $1`, [posReportDate]);
    let posCount = 0;
    for (const pos of latestPositions) {
      const symbol = pos.symbol || '';
      const quantity = parseFloat(pos.position) || 0;
      // 使用 positionValueInBase（已转换为 USD）而不是 positionValue（本地货币）
      const marketValueUSD = parseFloat(pos.positionValueInBase) || parseFloat(pos.positionValue) || 0;
      const unrealizedPnlUSD = parseFloat(pos.fifoPnlUnrealized) || 0;
      const costBasis = parseFloat(pos.costBasisMoney) || 0;
      // 盈亏百分比直接从 IBKR 获取
      const unrealizedPnlPercent = costBasis > 0 ? (unrealizedPnlUSD / costBasis) * 100 : 0;
      // 权重百分比直接从 IBKR 获取
      const percentOfNAV = parseFloat(pos.percentOfNAV) || 0;
      try {
        await client.query(`INSERT INTO stock_positions (snapshot_date, ticker, name, market, currency, quantity, avg_cost, current_price, market_value, unrealized_pnl, unrealized_pnl_percent, market_value_cny, unrealized_pnl_cny, position_type, weight_percent) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`, [posReportDate, symbol, pos.description || '', detectMarket(symbol), pos.currency || 'USD', quantity, quantity !== 0 ? costBasis / quantity : 0, parseFloat(pos.markPrice) || 0, marketValueUSD, unrealizedPnlUSD, unrealizedPnlPercent, marketValueUSD * USD_CNY, unrealizedPnlUSD * USD_CNY, quantity > 0 ? 'LONG' : 'SHORT', percentOfNAV]);
        posCount++;
      } catch (e: any) { log(`   错误: ${e.message}`); }
    }
    log(`   ✅ 成功插入 ${posCount} 条记录`);
    
    // 验证数据
    log('\n🔍 验证数据完整性...');
    const tables = ['asset_snapshots', 'dashboard_snapshots', 'nav_changes', 'transactions', 'stock_positions'];
    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) FROM "${table}"`);
      log(`   ${table}: ${result.rows[0].count} 条记录`);
    }
    
    log('\n✅ IBKR 数据同步完成！');
  } catch (error) {
    log(`\n❌ 同步失败: ${error}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
