
import { SupabaseClient } from '@supabase/supabase-js';

// 定义分析记录的类型
interface Analysis {
  id: number;
  created_at: string;
  recommendation: 'BUY' | 'SELL' | 'HOLD' | 'REBALANCE' | 'WARNING';
  primary_ticker: string;
  portfolio_snapshot: any;
  review_status_7d: string;
  review_return_7d: number | null;
  review_status_30d: string;
  review_return_30d: number | null;
  review_status_90d: string;
  review_return_90d: number | null;
}

interface Snapshot {
  date: string;
  net_worth_cny: number;
}

// 检查并更新复盘状态
export async function runAnalysisReview(supabase: SupabaseClient) {
  // 1. 获取所有待复盘的记录
  const { data: analyses, error } = await supabase
    .from('ai_analyses')
    .select('*')
    .or('review_status_7d.eq.PENDING,review_status_30d.eq.PENDING,review_status_90d.eq.PENDING');

  if (error || !analyses) {
    console.error('Failed to fetch analyses for review:', error);
    return;
  }

  // 2. 获取历史净值数据 (一次性获取所有，或者按需获取)
  // 为了简单起见，我们获取最近 90 天的 snapshots
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 100);
  
  const { data: history, error: historyError } = await supabase
    .from('dashboard_snapshots')
    .select('date, net_worth_cny')
    .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (historyError || !history) {
    console.error('Failed to fetch history for review:', historyError);
    return;
  }

  const historyMap = new Map<string, number>();
  history.forEach((h: any) => historyMap.set(h.date, h.net_worth_cny));

  // 3. 遍历分析记录进行复盘
  const now = new Date();
  
  for (const analysis of analyses) {
    const createdAt = new Date(analysis.created_at);
    let updates: any = {};
    let needsUpdate = false;

    // 获取当时的净值 (Initial Value)
    // 优先从 portfolio_snapshot 中取，因为那是“当时”的精确值
    let initialValue = 0;
    try {
        // portfolio_snapshot 可能是 JSON 对象或字符串
        const snapshot = typeof analysis.portfolio_snapshot === 'string' 
            ? JSON.parse(analysis.portfolio_snapshot) 
            : analysis.portfolio_snapshot;
        
        // 兼容不同的存储结构 (dashboard.totalNetWorth or 总净值)
        initialValue = snapshot.totalNetWorth || snapshot.总净值 || snapshot.netWorth;
    } catch (e) {
        console.warn(`Failed to parse snapshot for analysis ${analysis.id}`, e);
        continue;
    }

    if (!initialValue) continue;

    // --- 7 Day Review ---
    if (analysis.review_status_7d === 'PENDING') {
        const targetDate = new Date(createdAt);
        targetDate.setDate(targetDate.getDate() + 7);
        
        if (now >= targetDate) {
            const result = calculateReview(targetDate, initialValue, historyMap, analysis.recommendation);
            if (result) {
                updates.review_status_7d = result.status;
                updates.review_return_7d = result.returnVal;
                needsUpdate = true;
            }
        }
    }

    // --- 30 Day Review ---
    if (analysis.review_status_30d === 'PENDING') {
        const targetDate = new Date(createdAt);
        targetDate.setDate(targetDate.getDate() + 30);
        
        if (now >= targetDate) {
            const result = calculateReview(targetDate, initialValue, historyMap, analysis.recommendation);
            if (result) {
                updates.review_status_30d = result.status;
                updates.review_return_30d = result.returnVal;
                needsUpdate = true;
            }
        }
    }

    // --- 90 Day Review ---
    if (analysis.review_status_90d === 'PENDING') {
        const targetDate = new Date(createdAt);
        targetDate.setDate(targetDate.getDate() + 90);
        
        if (now >= targetDate) {
            const result = calculateReview(targetDate, initialValue, historyMap, analysis.recommendation);
            if (result) {
                updates.review_status_90d = result.status;
                updates.review_return_90d = result.returnVal;
                needsUpdate = true;
            }
        }
    }

    // 4. 更新数据库
    if (needsUpdate) {
        await supabase
            .from('ai_analyses')
            .update(updates)
            .eq('id', analysis.id);
        console.log(`Updated analysis review for ID ${analysis.id}`, updates);
    }
  }
}

function calculateReview(
    targetDate: Date, 
    initialValue: number, 
    historyMap: Map<string, number>,
    recommendation: string
): { status: string, returnVal: number } | null {
    // 寻找最接近 targetDate 的历史数据 (容差 +/- 1天)
    const dateStr = targetDate.toISOString().split('T')[0];
    let finalValue = historyMap.get(dateStr);

    if (!finalValue) {
        // 尝试找前后一天的
        const prevDate = new Date(targetDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const nextDate = new Date(targetDate);
        nextDate.setDate(nextDate.getDate() + 1);
        
        finalValue = historyMap.get(prevDate.toISOString().split('T')[0]) || 
                     historyMap.get(nextDate.toISOString().split('T')[0]);
    }

    // 如果还是找不到（可能是今天，或者数据缺失），且 targetDate 就是今天或过去几天，
    // 我们可以尝试用“最新”的数据作为近似（如果 targetDate 很接近 now）
    // 但为了严谨，如果没有那天的数据，我们暂不复盘
    if (!finalValue) return null;

    const returnVal = ((finalValue - initialValue) / initialValue) * 100;
    
    let status = 'FAIL';
    // 判定逻辑
    // Bullish: BUY, HOLD, REBALANCE (通常意味着看好或中性偏多)
    const isBullish = ['BUY', 'HOLD', 'REBALANCE'].includes(recommendation);
    // Bearish: SELL, WARNING
    const isBearish = ['SELL', 'WARNING'].includes(recommendation);

    if (isBullish && returnVal >= -1.0) { // 允许微跌也算成功 (HOLD)
        status = 'SUCCESS';
    } else if (isBearish && returnVal <= 1.0) { // 允许微涨也算成功 (避险)
        status = 'SUCCESS';
    }
    // 如果是大跌 (returnVal < -5%) 且建议是 WARNING -> SUCCESS
    
    return { status, returnVal };
}
