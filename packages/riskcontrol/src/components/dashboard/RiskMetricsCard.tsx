import React from 'react';
import { Shield, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { Card, Badge } from '../ui';
import type { RiskMetrics } from '../../services/supabaseData';

interface RiskMetricsCardProps {
  riskMetrics: RiskMetrics | null;
}

export function RiskMetricsCard({ riskMetrics }: RiskMetricsCardProps) {
  if (!riskMetrics) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-accent-purple" />
          <span className="text-xs text-text-secondary uppercase tracking-wider">风险指标</span>
        </div>
        <div className="text-sm text-text-muted">暂无数据</div>
      </Card>
    );
  }

  return (
    <Card className="relative">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={16} className="text-accent-purple" />
        <span className="text-xs text-text-secondary uppercase tracking-wider">风险指标</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-text-muted mb-1">夏普比率</div>
          <div className="text-xl font-bold text-text-primary mono-nums">
            {(riskMetrics.sharpe_ratio ?? 0).toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">索提诺比率</div>
          <div className="text-xl font-bold text-text-primary mono-nums">
            {(riskMetrics.sortino_ratio ?? 0).toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">年化收益</div>
          <div className={`text-xl font-bold mono-nums ${(riskMetrics.annualized_return ?? 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {((riskMetrics.annualized_return ?? 0) >= 0 ? '+' : '')}{(riskMetrics.annualized_return ?? 0).toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">年化波动</div>
          <div className="text-xl font-bold text-accent-yellow mono-nums">
            {(riskMetrics.annualized_volatility ?? 0).toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">最大回撤</div>
          <div className="text-xl font-bold text-accent-red mono-nums">
            {(riskMetrics.max_drawdown_percent ?? 0).toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">VaR (1天, 95%)</div>
          <div className="text-xl font-bold text-accent-yellow mono-nums">
            ¥{((riskMetrics.var_1day_95 ?? 0)).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">胜率</div>
          <div className={`text-xl font-bold mono-nums ${(riskMetrics.win_rate ?? 0) >= 50 ? 'text-accent-green' : 'text-accent-red'}`}>
            {(riskMetrics.win_rate ?? 0).toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">盈亏比</div>
          <div className={`text-xl font-bold mono-nums ${(riskMetrics.profit_factor ?? 0) >= 1 ? 'text-accent-green' : 'text-accent-red'}`}>
            {(riskMetrics.profit_factor ?? 0).toFixed(2)}
          </div>
        </div>
      </div>
    </Card>
  );
}

