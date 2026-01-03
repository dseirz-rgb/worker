import React, { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { 
  Shield, 
  Target, 
  Activity,
  Calculator,
  RefreshCw,
  ChevronDown,
  MessageSquare,
  Copy,
  Check
} from 'lucide-react';
import { Card, Badge, Button } from '../ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import type { Position } from '@/types';
import { toast } from 'sonner';

interface OtherAsset {
  name: string;
  ticker: string;
  value: number; // 原币种价值
  valueCNY: number; // CNY价值
  currency: 'USD' | 'CNY' | 'HKD';
  quantity: number;
  currentPrice: number;
}

interface DeleverageSimulatorProps {
  positions: Position[];
  currentNetEquity: number;
  currentLeverage?: number;
  defaultTicker?: string;
  onClose?: () => void;
}

export function DeleverageSimulator({
  positions,
  currentNetEquity,
  currentLeverage,
  defaultTicker = 'PDD',
}: DeleverageSimulatorProps) {
  // === 标的选择 ===
  const [selectedTicker, setSelectedTicker] = useState(defaultTicker);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // === 从持仓中获取其他资产（排除主标的）===
  const otherAssets = useMemo((): OtherAsset[] => {
    return positions
      .filter(p => p.ticker !== selectedTicker && p.quantity > 0)
      .map(p => ({
        name: p.name || p.ticker,
        ticker: p.ticker,
        value: p.marketValue,
        valueCNY: p.marketValueCNY,
        currency: p.currency as 'USD' | 'CNY' | 'HKD',
        quantity: p.quantity,
        currentPrice: p.currentPrice,
      }))
      .sort((a, b) => b.valueCNY - a.valueCNY);
  }, [positions, selectedTicker]);
  
  const selectedPosition = useMemo(() => {
    return positions.find(p => p.ticker === selectedTicker) || null;
  }, [positions, selectedTicker]);
  
  const currentPrice = selectedPosition?.currentPrice || 0;
  const currentHoldings = selectedPosition?.quantity || 0;

  // === Simulation State ===
  const [simulatedPrice, setSimulatedPrice] = useState(currentPrice || 100);
  const [targetShares, setTargetShares] = useState(Math.max(0, currentHoldings - 2000));
  const [callPremium, setCallPremium] = useState(3.5);
  
  // 其他资产模拟价格变化比例 (-50% ~ +50%)
  const [otherAssetsPriceChange, setOtherAssetsPriceChange] = useState<Record<string, number>>({});
  
  // 其他资产保留股数
  const [otherAssetsKeepShares, setOtherAssetsKeepShares] = useState<Record<string, number>>({});
  
  // === 导航和策略保存 ===
  const [, setLocation] = useLocation();
  const [isCopied, setIsCopied] = useState(false);
  
  // 初始化其他资产的状态（当 otherAssets 变化时）
  React.useEffect(() => {
    setOtherAssetsPriceChange(prev => {
      const newState: Record<string, number> = {};
      otherAssets.forEach(a => {
        newState[a.ticker] = prev[a.ticker] ?? 0; // 默认不变
      });
      return newState;
    });
    setOtherAssetsKeepShares(prev => {
      const newState: Record<string, number> = {};
      otherAssets.forEach(a => {
        newState[a.ticker] = prev[a.ticker] ?? 0; // 默认全部清仓（保留0股）
      });
      return newState;
    });
  }, [otherAssets]);

  // 当选中标的变化时，重置主标的滑杆
  React.useEffect(() => {
    if (selectedPosition) {
      setSimulatedPrice(selectedPosition.currentPrice || 100);
      setTargetShares(Math.max(0, (selectedPosition.quantity || 0) - 2000));
    }
  }, [selectedTicker, selectedPosition]);

  const safeCurrentPrice = Number(currentPrice) || 0;
  const safeCurrentHoldings = Number(currentHoldings) || 0;
  const safeCurrentNetEquity = Number(currentNetEquity) || 0;
  
  const realCurrentLeverage = (currentLeverage && Number(currentLeverage) > 1) 
    ? Number(currentLeverage) 
    : 2.0;
  const safeCurrentDebt = safeCurrentNetEquity * (realCurrentLeverage - 1);

  // === Core Calculations ===
  const calculation = useMemo(() => {
    const USD_CNY = 7.04;
    const HKD_CNY = 0.91;
    
    const positionCurrency = selectedPosition?.currency || 'USD';
    const currencyRate = positionCurrency === 'CNY' ? 1 : positionCurrency === 'HKD' ? HKD_CNY : USD_CNY;
    
    // 1. 卖出主标的
    const sharesToSell = Math.max(0, safeCurrentHoldings - targetShares);
    const cashFromStock = sharesToSell * simulatedPrice;
    const cashFromStockCNY = cashFromStock * currencyRate;
    
    // 2. 卖出其他资产（按保留股数计算）
    let totalOtherAssetsCNY = 0;
    const otherAssetsDetails: { name: string; ticker: string; quantity: number; keepShares: number; sellShares: number; currentPrice: number; simulatedPrice: number; priceChange: number; cashCNY: number; currency: string }[] = [];
    
    otherAssets.forEach(asset => {
      const priceChange = otherAssetsPriceChange[asset.ticker] ?? 0;
      const keepShares = otherAssetsKeepShares[asset.ticker] ?? 0;
      const sellShares = Math.max(0, asset.quantity - keepShares);
      const assetRate = asset.currency === 'CNY' ? 1 : asset.currency === 'HKD' ? HKD_CNY : USD_CNY;
      const simulatedPrice = asset.currentPrice * (1 + priceChange / 100);
      const cashCNY = sellShares * simulatedPrice * assetRate;
      totalOtherAssetsCNY += cashCNY;
      otherAssetsDetails.push({
        name: asset.name,
        ticker: asset.ticker,
        quantity: asset.quantity,
        keepShares,
        sellShares,
        currentPrice: asset.currentPrice,
        simulatedPrice,
        priceChange,
        cashCNY,
        currency: asset.currency,
      });
    });
    
    // 3. 总现金
    const totalCashGeneratedCNY = cashFromStockCNY + totalOtherAssetsCNY;
    const totalCashGeneratedUSD = totalCashGeneratedCNY / USD_CNY;

    // 4. 还债
    const debtRepayment = Math.min(totalCashGeneratedCNY, safeCurrentDebt);
    const remainingDebt = Math.max(0, safeCurrentDebt - debtRepayment);
    const cashSurplusCNY = Math.max(0, totalCashGeneratedCNY - safeCurrentDebt);

    // 5. 股价变化对净资产的影响
    const priceChangePerShare = simulatedPrice - safeCurrentPrice;
    const pnlFromPriceChange = priceChangePerShare * safeCurrentHoldings * currencyRate;
    const newNetEquity = safeCurrentNetEquity + pnlFromPriceChange;
    
    // 6. 新杠杆
    const newLeverage = newNetEquity > 0 ? (newNetEquity + remainingDebt) / newNetEquity : 999;
    
    // 7. Payoff Timeline
    const monthlyIncome = targetShares * callPremium;
    const remainingDebtUSD = remainingDebt / USD_CNY;
    const monthsToPayoff = monthlyIncome > 0 && remainingDebtUSD > 0 
      ? Math.ceil(remainingDebtUSD / monthlyIncome) 
      : 0;

    return {
      currentLeverage: realCurrentLeverage,
      sharesToSell,
      cashFromStock,
      cashFromStockCNY,
      otherAssetsDetails,
      totalOtherAssetsCNY,
      totalCashGenerated: totalCashGeneratedUSD,
      totalCashGeneratedCNY,
      remainingDebt: remainingDebtUSD,
      remainingDebtCNY: remainingDebt,
      cashSurplus: cashSurplusCNY / USD_CNY,
      newNetEquity,
      newLeverage,
      monthlyIncome,
      monthsToPayoff,
      positionCurrency,
    };
  }, [simulatedPrice, targetShares, callPremium, safeCurrentHoldings, safeCurrentDebt, safeCurrentNetEquity, safeCurrentPrice, realCurrentLeverage, otherAssets, otherAssetsPriceChange, otherAssetsKeepShares, selectedPosition]);

  // === 生成策略摘要文本 ===
  const generateStrategySummary = () => {
    const otherSells = calculation.otherAssetsDetails
      .filter(a => a.sellShares > 0)
      .map(a => `- ${a.ticker}: 卖出 ${a.sellShares.toLocaleString()} 股 @ ${a.currency === 'CNY' ? '¥' : a.currency === 'HKD' ? 'HK$' : '$'}${a.simulatedPrice.toFixed(2)}，回笼 ¥${a.cashCNY.toLocaleString(undefined, { maximumFractionDigits: 0 })}`)
      .join('\n');

    return `## 去杠杆策略推演

### 当前状态
- 净资产: ¥${safeCurrentNetEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
- 当前杠杆: ${realCurrentLeverage.toFixed(2)}x
- 负债: ¥${safeCurrentDebt.toLocaleString(undefined, { maximumFractionDigits: 0 })}

### 主标的操作 (${selectedTicker})
- 当前持仓: ${safeCurrentHoldings.toLocaleString()} 股
- 模拟股价: ${currencySymbol}${simulatedPrice.toFixed(2)} (实时: ${currencySymbol}${safeCurrentPrice.toFixed(2)})
- 卖出股数: ${calculation.sharesToSell.toLocaleString()} 股
- 保留股数: ${targetShares.toLocaleString()} 股
- 回笼现金: ¥${calculation.cashFromStockCNY.toLocaleString(undefined, { maximumFractionDigits: 0 })}

### 其他资产操作
${otherSells || '- 无'}

### 推演结果
- 总回笼现金: ¥${calculation.totalCashGeneratedCNY.toLocaleString(undefined, { maximumFractionDigits: 0 })}
- 剩余负债: ¥${calculation.remainingDebtCNY.toLocaleString(undefined, { maximumFractionDigits: 0 })}
- 推演杠杆: ${calculation.newLeverage.toFixed(2)}x (${getLeverageStatus(calculation.newLeverage).label})
${calculation.monthsToPayoff > 0 ? `- 预计还清时间: ${calculation.monthsToPayoff} 个月 (通过 Covered Call 月收入 $${calculation.monthlyIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })})` : ''}

请帮我分析这个去杠杆策略是否合理，有什么风险和改进建议？`;
  };

  // === 复制策略到剪贴板 ===
  const handleCopyStrategy = async () => {
    const summary = generateStrategySummary();
    try {
      await navigator.clipboard.writeText(summary);
      setIsCopied(true);
      toast.success('策略已复制到剪贴板');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  // === 发送给AI交流 ===
  const handleSendToAI = () => {
    const summary = generateStrategySummary();
    // 存储策略到 localStorage，让聊天页面读取
    localStorage.setItem('deleverage_strategy_prompt', summary);
    localStorage.setItem('deleverage_strategy_timestamp', Date.now().toString());
    toast.success('正在跳转到 AI 对话...');
    setLocation('/chat');
  };

  const getLeverageColor = (leverage: number) => {
    if (leverage < 1.3) return 'text-accent-green';
    if (leverage < 1.5) return 'text-accent-yellow';
    return 'text-accent-red';
  };

  const getLeverageStatus = (leverage: number) => {
    if (leverage < 1.3) return { label: '安全区', color: 'success' };
    if (leverage < 1.5) return { label: '警示区', color: 'warning' };
    return { label: '危险区', color: 'danger' };
  };

  const chartData = useMemo(() => {
    if (calculation.remainingDebt <= 0) return [];
    const data = [];
    let debt = calculation.remainingDebt;
    for (let i = 0; i <= Math.min(24, calculation.monthsToPayoff + 2); i++) {
      data.push({ month: `M${i}`, debt: Math.max(0, debt) });
      debt -= calculation.monthlyIncome;
    }
    return data;
  }, [calculation]);

  const availableTickers = useMemo(() => {
    return positions
      .filter(p => p.quantity > 0)
      .sort((a, b) => b.marketValueCNY - a.marketValueCNY);
  }, [positions]);

  const currencySymbol = calculation.positionCurrency === 'CNY' ? '¥' : calculation.positionCurrency === 'HKD' ? 'HK$' : '$';

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Controls */}
      <Card className="border-accent-purple/30 bg-accent-purple/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calculator size={20} className="text-accent-purple" />
            <h3 className="font-bold text-lg text-text-primary">去杠杆策略推演</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="info">当前杠杆: {realCurrentLeverage.toFixed(2)}x</Badge>
            <Button variant="ghost" size="sm" onClick={handleCopyStrategy} title="复制策略">
              {isCopied ? <Check size={14} className="text-accent-green" /> : <Copy size={14} />}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSendToAI} className="text-accent-cyan hover:text-accent-cyan">
              <MessageSquare size={14} className="mr-1" /> 问AI
            </Button>
            <Button variant="ghost" size="sm" onClick={() => {
              setSimulatedPrice(safeCurrentPrice || 100);
              setTargetShares(Math.max(0, safeCurrentHoldings - 2000));
              setOtherAssetsPriceChange({});
              setOtherAssetsKeepShares({});
            }}>
              <RefreshCw size={14} className="mr-1" /> 重置
            </Button>
          </div>
        </div>

        {/* 标的选择 */}
        <div className="mb-4">
          <label className="text-sm text-text-secondary mb-2 block">去杠杆标的</label>
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full md:w-64 flex items-center justify-between px-3 py-2 bg-bg-secondary border border-border rounded-lg text-left hover:border-accent-purple/50 transition-colors"
            >
              <span className="font-medium">
                {selectedPosition ? `${selectedPosition.ticker} - ${selectedPosition.name}` : '选择标的'}
              </span>
              <ChevronDown size={16} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full md:w-64 bg-bg-secondary border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
                {availableTickers.map(pos => (
                  <button
                    key={pos.ticker}
                    onClick={() => {
                      setSelectedTicker(pos.ticker);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-bg-tertiary transition-colors ${
                      pos.ticker === selectedTicker ? 'bg-accent-purple/10 text-accent-purple' : ''
                    }`}
                  >
                    <div className="font-medium">{pos.ticker}</div>
                    <div className="text-xs text-text-muted">
                      {pos.quantity.toLocaleString()} 股 · {pos.currency === 'CNY' ? '¥' : '$'}{pos.currentPrice.toFixed(2)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 主标的滑杆 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">模拟股价</span>
              <span className="font-bold text-accent-cyan">{currencySymbol}{simulatedPrice.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={Math.floor((safeCurrentPrice || 100) * 0.5)}
              max={Math.ceil((safeCurrentPrice || 100) * 1.5)}
              step={0.5}
              value={simulatedPrice}
              onChange={(e) => setSimulatedPrice(Number(e.target.value))}
              className="w-full accent-accent-cyan"
            />
            <div className="text-xs text-text-muted text-center">实时: {currencySymbol}{safeCurrentPrice.toFixed(2)}</div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">保留股数</span>
              <span className="font-bold text-accent-yellow">{targetShares.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={0}
              max={safeCurrentHoldings || 100}
              step={100}
              value={targetShares}
              onChange={(e) => setTargetShares(Number(e.target.value))}
              className="w-full accent-accent-yellow"
            />
            <div className="text-xs text-text-muted text-center">当前: {safeCurrentHoldings.toLocaleString()} 股</div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">权利金 (CC)</span>
              <span className="font-bold text-accent-green">${callPremium.toFixed(2)}/股/月</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={10}
              step={0.1}
              value={callPremium}
              onChange={(e) => setCallPremium(Number(e.target.value))}
              className="w-full accent-accent-green"
            />
          </div>
        </div>

        {/* 其他资产 */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-text-secondary">其他可变现资产</span>
          </div>

          {/* 其他资产滑杆 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherAssets.map(asset => {
              const priceChange = otherAssetsPriceChange[asset.ticker] ?? 0;
              const keepShares = otherAssetsKeepShares[asset.ticker] ?? 0;
              const sellShares = Math.max(0, asset.quantity - keepShares);
              const simulatedPrice = asset.currentPrice * (1 + priceChange / 100);
              const simulatedValue = asset.quantity * simulatedPrice;
              const currSym = asset.currency === 'CNY' ? '¥' : asset.currency === 'HKD' ? 'HK$' : '$';
              
              return (
                <div key={asset.ticker} className="p-3 bg-bg-tertiary rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-medium">{asset.ticker}</span>
                      <span className="text-xs text-text-muted ml-2">
                        {asset.quantity.toLocaleString()}股 · {currSym}{simulatedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                  
                  {/* 模拟股价 */}
                  <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">模拟股价</span>
                      <span className={`font-medium ${priceChange >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                        {currSym}{simulatedPrice.toFixed(2)} ({priceChange >= 0 ? '+' : ''}{priceChange}%)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      step={5}
                      value={priceChange}
                      onChange={(e) => setOtherAssetsPriceChange(prev => ({
                        ...prev,
                        [asset.ticker]: Number(e.target.value)
                      }))}
                      className="w-full accent-accent-cyan h-1"
                    />
                    <div className="text-xs text-text-muted text-center">
                      实时: {currSym}{asset.currentPrice.toFixed(2)}
                    </div>
                  </div>
                  
                  {/* 保留股数 */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">保留 {keepShares.toLocaleString()} 股</span>
                      <span className="text-accent-red">卖出 {sellShares.toLocaleString()} 股</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={asset.quantity}
                      step={Math.max(1, Math.floor(asset.quantity / 100))}
                      value={keepShares}
                      onChange={(e) => setOtherAssetsKeepShares(prev => ({
                        ...prev,
                        [asset.ticker]: Number(e.target.value)
                      }))}
                      className="w-full accent-accent-yellow h-1"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Target size={18} className="text-accent-cyan" />
            <h4 className="font-bold text-text-primary">执行方案</h4>
          </div>
          
          <div className="space-y-3">
            <div className="p-2 bg-bg-tertiary rounded-lg flex justify-between items-center">
              <span className="text-sm text-text-secondary">卖出 {selectedTicker}</span>
              <div className="text-right">
                <div className="font-bold text-accent-red">-{calculation.sharesToSell.toLocaleString()} 股</div>
                <div className="text-xs text-text-muted">@ {currencySymbol}{simulatedPrice.toFixed(2)}</div>
              </div>
            </div>
            
            {calculation.otherAssetsDetails.filter(a => a.sellShares > 0).map(asset => {
              const currSym = asset.currency === 'CNY' ? '¥' : asset.currency === 'HKD' ? 'HK$' : '$';
              return (
                <div key={asset.ticker} className="p-2 bg-bg-tertiary rounded-lg flex justify-between items-center">
                  <span className="text-sm text-text-secondary">卖出 {asset.ticker} ({asset.sellShares.toLocaleString()}股)</span>
                  <div className="text-right">
                    <div className="font-bold text-text-primary">+¥{asset.cashCNY.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div className="text-xs text-text-muted">@ {currSym}{asset.simulatedPrice.toFixed(2)}</div>
                  </div>
                </div>
              );
            })}

            <div className="border-t border-border pt-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-accent-green">回笼现金</span>
                <span className="text-lg font-bold text-accent-green">
                  ¥{calculation.totalCashGeneratedCNY.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card className={`border-2 ${calculation.newLeverage < 1.3 ? 'border-accent-green/30' : calculation.newLeverage < 1.5 ? 'border-accent-yellow/30' : 'border-accent-red/30'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield size={18} className={getLeverageColor(calculation.newLeverage)} />
              <h4 className="font-bold text-text-primary">推演结果</h4>
            </div>
            <Badge variant={getLeverageStatus(calculation.newLeverage).color as any}>
              {getLeverageStatus(calculation.newLeverage).label}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <div className="text-xs text-text-muted mb-1">当前杠杆</div>
              <div className="text-lg font-bold text-text-muted line-through">
                {calculation.currentLeverage.toFixed(2)}x
              </div>
            </div>
            <div>
              <div className="text-xs text-text-muted mb-1">推演杠杆</div>
              <div className={`text-2xl font-bold ${getLeverageColor(calculation.newLeverage)}`}>
                {calculation.newLeverage.toFixed(2)}x
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">剩余债务</span>
              <span className={`font-mono font-bold ${calculation.remainingDebtCNY > 0 ? 'text-accent-red' : 'text-accent-green'}`}>
                ¥{calculation.remainingDebtCNY.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            {calculation.cashSurplus > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">现金盈余</span>
                <span className="font-mono font-bold text-accent-green">
                  +${calculation.cashSurplus.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">月现金流 (CC)</span>
              <span className="font-mono font-bold text-accent-cyan">
                +${calculation.monthlyIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Payoff Chart */}
      {calculation.remainingDebt > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Activity size={18} className="text-accent-blue" />
            <h4 className="font-bold text-text-primary">债务清偿时间线</h4>
            <Badge variant="info">{calculation.monthsToPayoff} 个月</Badge>
          </div>
          
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 10 }} />
                <YAxis tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(val) => `${val/1000}k`} />
                <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, '剩余债务']} />
                <Bar dataKey="debt" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#4a9eff'} />
                  ))}
                </Bar>
                <ReferenceLine y={0} stroke="#666" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
