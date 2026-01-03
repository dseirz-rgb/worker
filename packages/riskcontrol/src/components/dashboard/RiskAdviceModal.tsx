import React from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  TrendingDown, 
  TrendingUp,
  Clock,
  Target,
  Shield,
  ChevronRight
} from 'lucide-react';
import type { RiskAdvice } from '../../services/riskAdvice';

interface RiskAdviceModalProps {
  advice: RiskAdvice;
  isOpen: boolean;
  onClose: () => void;
}

export function RiskAdviceModal({ advice, isOpen, onClose }: RiskAdviceModalProps) {
  if (!isOpen) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'warning': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      default: return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle size={20} />;
      case 'warning': return <AlertCircle size={20} />;
      default: return <Info size={20} />;
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical': return '严重';
      case 'warning': return '警告';
      default: return '提示';
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 99999 }}
    >
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 弹窗内容 */}
      <div className="relative bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
        {/* 头部 */}
        <div className={`flex items-center justify-between p-4 border-b border-border ${getSeverityColor(advice.severity)}`}>
          <div className="flex items-center gap-3">
            {getSeverityIcon(advice.severity)}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{advice.title}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getSeverityColor(advice.severity)}`}>
                  {getSeverityLabel(advice.severity)}
                </span>
              </div>
              {advice.timeline && (
                <div className="flex items-center gap-1 text-xs text-text-muted mt-1">
                  <Clock size={12} />
                  <span>{advice.timeline}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-4 overflow-y-auto max-h-[calc(85vh-80px)] space-y-6">
          {/* 摘要 */}
          <div className="bg-bg-primary rounded-lg p-4">
            <p className="text-text-secondary leading-relaxed">{advice.summary}</p>
          </div>

          {/* 风险分析 */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
              <Shield size={16} className="text-accent-cyan" />
              风险分析
            </h3>
            <div className="bg-bg-primary rounded-lg p-4">
              <p className="text-text-secondary text-sm leading-relaxed">{advice.riskAnalysis}</p>
            </div>
          </div>

          {/* 情景分析 */}
          {advice.scenarios.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
                <TrendingDown size={16} className="text-accent-yellow" />
                情景分析
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {advice.scenarios.map((scenario, index) => (
                  <div 
                    key={index}
                    className={`bg-bg-primary rounded-lg p-3 border ${
                      scenario.priceChange.startsWith('+') 
                        ? 'border-green-500/20' 
                        : scenario.priceChange === '0%'
                        ? 'border-gray-500/20'
                        : 'border-red-500/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-text-muted">{scenario.name}</span>
                      <span className={`text-xs font-mono ${
                        scenario.priceChange.startsWith('+') 
                          ? 'text-green-500' 
                          : scenario.priceChange === '0%'
                          ? 'text-gray-500'
                          : 'text-red-500'
                      }`}>
                        {scenario.priceChange}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-text-primary mb-1">
                      {scenario.impact}
                    </div>
                    <div className="text-xs text-text-muted">
                      {scenario.result}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 优化建议 */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
              <Target size={16} className="text-accent-green" />
              优化建议
            </h3>
            <div className="space-y-3">
              {advice.recommendations.map((rec, index) => (
                <div 
                  key={index}
                  className="bg-bg-primary rounded-lg p-4 border border-border hover:border-accent-cyan/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      rec.priority === 1 
                        ? 'bg-red-500/20 text-red-500' 
                        : rec.priority === 2
                        ? 'bg-yellow-500/20 text-yellow-500'
                        : 'bg-blue-500/20 text-blue-500'
                    }`}>
                      {rec.priority}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-text-primary mb-1">{rec.action}</div>
                      <p className="text-sm text-text-secondary mb-2">{rec.detail}</p>
                      <div className="flex items-center gap-1 text-xs text-accent-green">
                        <ChevronRight size={12} />
                        <span>预期效果：{rec.expectedEffect}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 止损设置 */}
          {advice.stopLoss && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
                <AlertTriangle size={16} className="text-red-500" />
                止损设置
              </h3>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs text-text-muted mb-1">止损价位</div>
                    <div className="text-lg font-bold text-red-500 mono-nums">{advice.stopLoss.price}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted mb-1">止损幅度</div>
                    <div className="text-lg font-bold text-red-500 mono-nums">{advice.stopLoss.percentage}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted mb-1">触发动作</div>
                    <div className="text-sm text-text-secondary">{advice.stopLoss.action}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 风险提示 */}
          <div className="bg-bg-primary rounded-lg p-4 border border-border">
            <p className="text-xs text-text-muted leading-relaxed">
              <strong>风险提示：</strong>以上建议基于当前市场数据和风控参数生成，不构成投资建议。
              实际执行时请结合个人风险承受能力和投资目标，必要时咨询专业投资顾问。市场有风险，投资需谨慎。
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
