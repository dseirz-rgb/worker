import React from 'react';
import { Card, Badge, LoadingSpinner } from '../ui';
import { useMarketData } from '@/contexts/MarketContext';
import { Activity, AlertTriangle, CheckCircle, XCircle, TrendingDown, TrendingUp, Minus } from 'lucide-react';

export function MarketStatusCard() {
  const { vixHistory, spyHistory, loading, error } = useMarketData();

  if (loading) {
    return (
      <Card className="h-full flex items-center justify-center p-6">
        <LoadingSpinner size={24} />
        <span className="ml-2 text-text-muted">分析市场状态中...</span>
      </Card>
    );
  }

  if (error || !vixHistory || !spyHistory || vixHistory.data.length < 3 || spyHistory.data.length < 3) {
    return (
      <Card className="p-4 border-l-4 border-accent-yellow">
        <div className="flex items-center gap-2 text-accent-yellow mb-2">
          <AlertTriangle size={20} />
          <span className="font-bold">数据不足</span>
        </div>
        <div className="text-sm text-text-muted">
          无法获取足够的历史数据来分析市场状态。请稍后再试。
        </div>
      </Card>
    );
  }

  // === 核心逻辑 ===
  const currentVix = vixHistory.data[0];
  const prevVix = vixHistory.data[1];
  
  // 计算 VIX 涨跌幅
  const vixChangePercent = ((currentVix.close - prevVix.close) / prevVix.close) * 100;
  
  // 1. 判断 RED 状态
  // 条件: VIX >= 22 且 单日上涨 >= 5%
  const isRed = currentVix.close >= 22 && vixChangePercent >= 5;

  // 2. 判断 GREEN 状态
  // 条件: 
  // - VIX 不再加速 (连续 3 天 VIX 单日涨幅 < 3%)
  // - 价格不再创新低 (连续 3 天 Low >= 前一日 Low)
  // - 且不满足 RED 条件
  
  // 检查 VIX 加速 (检查最近 3 天)
  const recentVixDays = vixHistory.data.slice(0, 3);
  const isVixStabilizing = recentVixDays.every((day, index) => {
    // 如果是最后一天(最早的一天)，需要更早一天的数据来计算涨跌幅
    // 为简化，我们只检查每天的 Close 相对于 Open 是否暴涨，或者 Close 相对于 Prev Close
    // 这里使用: (Close - Open) / Open < 3% 作为一个近似代理，或者如果有前一日数据更好
    
    // 正确做法：获取对应的前一日
    const prevDay = vixHistory.data[index + 1];
    if (!prevDay) return true; // 数据不足，默认通过
    
    const change = ((day.close - prevDay.close) / prevDay.close) * 100;
    return change < 3; // 每日涨幅小于 3%
  });

  // 检查价格新低 (检查最近 3 天)
  // 逻辑：Today.Low >= Yesterday.Low AND Yesterday.Low >= DayBefore.Low
  const recentSpyDays = spyHistory.data.slice(0, 3);
  const isPriceStabilizing = recentSpyDays.every((day, index) => {
    const prevDay = spyHistory.data[index + 1];
    if (!prevDay) return true;
    return day.low >= prevDay.low; // 没有创新低
  });

  const isGreen = !isRed && isVixStabilizing && isPriceStabilizing;

  // 3. 默认为 YELLOW
  const status = isRed ? 'RED' : isGreen ? 'GREEN' : 'YELLOW';

  // === 界面渲染 ===
  return (
    <Card className={`relative overflow-hidden border-l-4 ${
      status === 'RED' ? 'border-accent-red bg-accent-red/5' : 
      status === 'GREEN' ? 'border-accent-green bg-accent-green/5' : 
      'border-accent-yellow bg-accent-yellow/5'
    }`}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={20} className={
            status === 'RED' ? 'text-accent-red' : 
            status === 'GREEN' ? 'text-accent-green' : 
            'text-accent-yellow'
          } />
          <span className="font-bold text-lg tracking-wide">市场状态监视器</span>
        </div>
        <Badge variant={status === 'RED' ? 'danger' : status === 'GREEN' ? 'success' : 'warning'}>
          {status === 'RED' ? '禁止加仓' : status === 'GREEN' ? '分批加仓' : '观望'}
        </Badge>
      </div>

      {/* 主状态大字 */}
      <div className="flex items-center gap-6 mb-6">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 ${
          status === 'RED' ? 'border-accent-red text-accent-red bg-accent-red/10' : 
          status === 'GREEN' ? 'border-accent-green text-accent-green bg-accent-green/10' : 
          'border-accent-yellow text-accent-yellow bg-accent-yellow/10'
        }`}>
          {status === 'RED' ? <XCircle size={32} /> : 
           status === 'GREEN' ? <CheckCircle size={32} /> : 
           <Minus size={32} />}
        </div>
        
        <div className="flex-1">
          <div className={`text-2xl font-bold mb-1 ${
            status === 'RED' ? 'text-accent-red' : 
            status === 'GREEN' ? 'text-accent-green' : 
            'text-accent-yellow'
          }`}>
            {status === 'RED' ? 'RED LIGHT' : status === 'GREEN' ? 'GREEN LIGHT' : 'YELLOW LIGHT'}
          </div>
          <p className="text-sm text-text-secondary">
            {status === 'RED' ? '市场极度恐慌，严禁任何加仓操作。' : 
             status === 'GREEN' ? '市场企稳，恐慌情绪消退，可分批建仓。' : 
             '市场方向未明或处于震荡期，建议保持观望。'}
          </p>
        </div>
      </div>

      {/* 详细指标 */}
      <div className="grid grid-cols-3 gap-4 text-sm border-t border-border pt-4">
        {/* VIX 状态 */}
        <div className="space-y-1">
          <div className="text-xs text-text-muted">VIX 恐慌指数</div>
          <div className="flex items-center gap-2">
            <span className={`font-bold mono-nums ${currentVix.close >= 22 ? 'text-accent-red' : 'text-text-primary'}`}>
              {currentVix.close.toFixed(2)}
            </span>
            <span className={`text-xs ${vixChangePercent >= 0 ? 'text-accent-red' : 'text-accent-green'}`}>
              {vixChangePercent > 0 ? '+' : ''}{vixChangePercent.toFixed(1)}%
            </span>
          </div>
          <div className="text-xs text-text-muted flex items-center gap-1">
            {isVixStabilizing ? (
              <span className="text-accent-green flex items-center gap-0.5"><CheckCircle size={10} /> 已企稳 (3天)</span>
            ) : (
              <span className="text-accent-yellow flex items-center gap-0.5"><Activity size={10} /> 波动中</span>
            )}
          </div>
        </div>

        {/* 价格趋势 */}
        <div className="space-y-1">
          <div className="text-xs text-text-muted">SPY 价格支撑</div>
          <div className="font-bold mono-nums text-text-primary">
            ${spyHistory.data[0].close.toFixed(2)}
          </div>
          <div className="text-xs text-text-muted flex items-center gap-1">
            {isPriceStabilizing ? (
              <span className="text-accent-green flex items-center gap-0.5"><CheckCircle size={10} /> 3天未创新低</span>
            ) : (
              <span className="text-accent-yellow flex items-center gap-0.5"><TrendingDown size={10} /> 寻找支撑中</span>
            )}
          </div>
        </div>

        {/* 综合建议 */}
        <div className="space-y-1">
          <div className="text-xs text-text-muted">操作建议</div>
          <div className="font-bold text-text-primary">
            {status === 'RED' ? '停止买入' : status === 'GREEN' ? '按计划加仓' : '多看少动'}
          </div>
          <div className="text-xs text-text-muted">
            {status === 'RED' ? '等待恐慌消退' : status === 'GREEN' ? '注意控制仓位' : '等待明确信号'}
          </div>
        </div>
      </div>
    </Card>
  );
}
