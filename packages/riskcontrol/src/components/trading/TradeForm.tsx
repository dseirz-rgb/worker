import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  ArrowRightLeft,
  Loader2,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { Card, Button, Input, Select, Modal, Badge, RiskAlertModal } from '../ui';
import { Action } from '../../types';
import type { RiskAlert, StockInfo } from '../../types';
import { fetchStockData, detectMarket, getCurrency } from '../../services/marketData';

interface TradeFormProps {
  onSubmit: (
    ticker: string,
    action: Action,
    price: number,
    quantity: number,
    strategyNote: string,
    fee: number,
    skipFOMOCheck: boolean
  ) => Promise<{ success: boolean; alert?: RiskAlert }>;
  pendingAlert: RiskAlert | null;
  onAcknowledgeAlert: () => void;
}

export function TradeForm({ onSubmit, pendingAlert, onAcknowledgeAlert }: TradeFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [ticker, setTicker] = useState('');
  const [action, setAction] = useState<Action>(Action.BUY);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [strategyNote, setStrategyNote] = useState('');
  const [fee, setFee] = useState('0');
  
  const [isSearching, setIsSearching] = useState(false);
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);
  const [searchError, setSearchError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFOMOAlert, setShowFOMOAlert] = useState(false);

  // 搜索股票
  const handleSearch = async () => {
    if (!ticker.trim()) return;
    
    setIsSearching(true);
    setSearchError('');
    setStockInfo(null);

    try {
      const response = await fetchStockData(ticker.trim().toUpperCase());
      if (response.success && response.data) {
        setStockInfo(response.data);
        setPrice(response.data.currentPrice.toFixed(2));
      } else {
        setSearchError(response.error || '未找到该股票');
      }
    } catch (error) {
      setSearchError('搜索失败，请重试');
    } finally {
      setIsSearching(false);
    }
  };

  // 处理提交
  const handleSubmit = async (skipFOMO: boolean = false) => {
    if (!ticker || !price || !quantity) return;

    setIsSubmitting(true);
    try {
      const result = await onSubmit(
        ticker.trim().toUpperCase(),
        action,
        parseFloat(price),
        parseFloat(quantity),
        strategyNote,
        parseFloat(fee) || 0,
        skipFOMO
      );

      if (result.success) {
        // 成功，重置表单
        resetForm();
        setIsOpen(false);
      } else if (result.alert) {
        // 显示 FOMO 警告
        setShowFOMOAlert(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理 FOMO 确认
  const handleFOMOConfirm = async () => {
    setShowFOMOAlert(false);
    onAcknowledgeAlert();
    await handleSubmit(true);
  };

  const handleFOMOCancel = () => {
    setShowFOMOAlert(false);
    onAcknowledgeAlert();
  };

  // 重置表单
  const resetForm = () => {
    setTicker('');
    setAction(Action.BUY);
    setPrice('');
    setQuantity('');
    setStrategyNote('');
    setFee('0');
    setStockInfo(null);
    setSearchError('');
  };

  // 计算交易金额
  const amount = parseFloat(price) * parseFloat(quantity) || 0;

  // 交易类型选项
  const actionOptions = [
    { value: 'BUY', label: '买入 (BUY)' },
    { value: 'SELL', label: '卖出 (SELL)' },
    { value: 'SHORT', label: '做空 (SHORT)' },
    { value: 'COVER', label: '平仓 (COVER)' },
    { value: 'DEPOSIT', label: '入金 (DEPOSIT)' },
    { value: 'WITHDRAW', label: '出金 (WITHDRAW)' },
    { value: 'SYNC_BALANCE', label: '资金校准 (SYNC)' },
  ];

  // 是否为资金操作
  const isCashAction = ['DEPOSIT', 'WITHDRAW', 'SYNC_BALANCE'].includes(action);

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="flex items-center gap-2">
        <Plus size={16} />
        录入交易
      </Button>

      <Modal 
        isOpen={isOpen} 
        onClose={() => { setIsOpen(false); resetForm(); }}
        title="录入交易"
        size="lg"
      >
        <div className="space-y-4">
          {/* 交易类型 */}
          <Select
            label="交易类型"
            value={action}
            onChange={(e) => setAction(e.target.value as Action)}
            options={actionOptions}
          />

          {!isCashAction && (
            <>
              {/* 股票代码搜索 */}
              <div className="space-y-1">
                <label className="block text-xs text-text-secondary uppercase tracking-wider">
                  股票代码
                </label>
                <div className="flex gap-2">
                  <Input
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    placeholder="输入代码，如 00700, AAPL, 600519"
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button 
                    variant="secondary" 
                    onClick={handleSearch}
                    disabled={isSearching || !ticker}
                  >
                    {isSearching ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Search size={16} />
                    )}
                  </Button>
                </div>
                {searchError && (
                  <p className="text-xs text-accent-red">{searchError}</p>
                )}
              </div>

              {/* 股票信息卡片 */}
              {stockInfo && (
                <Card className="bg-bg-tertiary">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">{stockInfo.name}</span>
                        <Badge variant="info">
                          {stockInfo.market === 'CN' ? 'A股' : stockInfo.market === 'HK' ? '港股' : '美股'}
                        </Badge>
                      </div>
                      <div className="text-xs text-text-muted mt-1">
                        {stockInfo.ticker} · {stockInfo.currency}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-text-primary mono-nums">
                        {stockInfo.currentPrice.toFixed(2)}
                      </div>
                      <div className={`text-sm mono-nums ${stockInfo.changePercent >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                        {stockInfo.changePercent >= 0 ? '+' : ''}{stockInfo.changePercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* 价格和数量 */}
          <div className="grid grid-cols-2 gap-4">
            {isCashAction ? (
              <div className="col-span-2">
                <Select
                  label="货币"
                  value={ticker || 'CNY'}
                  onChange={(e) => setTicker(e.target.value)}
                  options={[
                    { value: 'CNY', label: '人民币 (CNY)' },
                    { value: 'USD', label: '美元 (USD)' },
                    { value: 'HKD', label: '港币 (HKD)' },
                  ]}
                />
              </div>
            ) : (
              <Input
                label="价格"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            )}
            
            <Input
              label={isCashAction ? '金额' : '数量'}
              type="number"
              step={isCashAction ? '0.01' : '1'}
              value={isCashAction ? price : quantity}
              onChange={(e) => isCashAction ? setPrice(e.target.value) : setQuantity(e.target.value)}
              placeholder={isCashAction ? '0.00' : '0'}
            />

            {!isCashAction && (
              <Input
                label="手续费"
                type="number"
                step="0.01"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0.00"
              />
            )}
          </div>

          {/* 交易金额显示 */}
          {!isCashAction && amount > 0 && (
            <div className="p-3 bg-bg-tertiary rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">交易金额</span>
                <span className="text-lg font-bold text-text-primary mono-nums">
                  {stockInfo?.currency || 'CNY'} {amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* 策略备注 */}
          <div className="space-y-1">
            <label className="block text-xs text-text-secondary uppercase tracking-wider">
              交易理由/策略
            </label>
            <textarea
              value={strategyNote}
              onChange={(e) => setStrategyNote(e.target.value)}
              placeholder="记录你的交易逻辑，便于日后复盘..."
              className="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan transition-colors min-h-[80px] resize-none"
            />
          </div>

          {/* 提交按钮 */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
              className="flex-1 flex items-center justify-center gap-2"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting || (!isCashAction && (!ticker || !price || !quantity)) || (isCashAction && !price)}
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : action === 'BUY' || action === 'SHORT' ? (
                <TrendingUp size={16} />
              ) : action === 'SELL' || action === 'COVER' ? (
                <TrendingDown size={16} />
              ) : (
                <DollarSign size={16} />
              )}
              {isSubmitting ? '处理中...' : '确认录入'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setIsOpen(false); resetForm(); }}
            >
              取消
            </Button>
          </div>
        </div>
      </Modal>

      {/* FOMO 警告弹窗 */}
      {pendingAlert && (
        <RiskAlertModal
          isOpen={showFOMOAlert}
          type={pendingAlert.type}
          title={pendingAlert.title}
          message={pendingAlert.message}
          onConfirm={handleFOMOConfirm}
          onCancel={handleFOMOCancel}
        />
      )}
    </>
  );
}

// 快速入金/出金组件
interface QuickCashFormProps {
  onSubmit: (
    ticker: string,
    action: Action,
    price: number,
    quantity: number,
    strategyNote: string,
    fee: number,
    skipFOMOCheck: boolean
  ) => Promise<{ success: boolean; alert?: RiskAlert }>;
}

export function QuickCashForm({ onSubmit }: QuickCashFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [action, setAction] = useState<Action.DEPOSIT | Action.WITHDRAW>(Action.DEPOSIT);
  const [currency, setCurrency] = useState('CNY');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!amount) return;

    setIsSubmitting(true);
    try {
      const result = await onSubmit(
        currency,
        action,
        parseFloat(amount),
        1,
        action === Action.DEPOSIT ? '入金' : '出金',
        0,
        true
      );

      if (result.success) {
        setAmount('');
        setIsOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)} className="flex items-center gap-2">
        <ArrowRightLeft size={16} />
        资金操作
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="资金操作"
        size="sm"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`p-3 rounded-lg border transition-colors ${
                action === Action.DEPOSIT 
                  ? 'border-accent-green bg-accent-green/10 text-accent-green' 
                  : 'border-border text-text-secondary hover:border-accent-green'
              }`}
              onClick={() => setAction(Action.DEPOSIT)}
            >
              <TrendingUp size={20} className="mx-auto mb-1" />
              <div className="text-sm font-medium">入金</div>
            </button>
            <button
              className={`p-3 rounded-lg border transition-colors ${
                action === Action.WITHDRAW 
                  ? 'border-accent-red bg-accent-red/10 text-accent-red' 
                  : 'border-border text-text-secondary hover:border-accent-red'
              }`}
              onClick={() => setAction(Action.WITHDRAW)}
            >
              <TrendingDown size={20} className="mx-auto mb-1" />
              <div className="text-sm font-medium">出金</div>
            </button>
          </div>

          <Select
            label="货币"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={[
              { value: 'CNY', label: '人民币 (CNY)' },
              { value: 'USD', label: '美元 (USD)' },
              { value: 'HKD', label: '港币 (HKD)' },
            ]}
          />

          <Input
            label="金额"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />

          <Button
            variant={action === 'DEPOSIT' ? 'primary' : 'danger'}
            className="w-full"
            onClick={handleSubmit}
            disabled={isSubmitting || !amount}
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin mx-auto" />
            ) : (
              `确认${action === 'DEPOSIT' ? '入金' : '出金'}`
            )}
          </Button>
        </div>
      </Modal>
    </>
  );
}
