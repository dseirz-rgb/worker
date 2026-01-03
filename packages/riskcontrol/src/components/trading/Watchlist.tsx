import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Eye, 
  Plus, 
  Trash2, 
  Clock, 
  Target,
  Loader2,
  CheckCircle,
  AlertCircle,
  Search
} from 'lucide-react';
import { Card, Button, Modal, Badge, NumberDisplay } from '../ui';
import type { WatchlistItem } from '../../types';

// 常见股票列表（用于模糊搜索）
const COMMON_STOCKS = [
  // 港股
  { ticker: '00700', name: '腾讯控股', market: 'HK' },
  { ticker: '09988', name: '阿里巴巴-SW', market: 'HK' },
  { ticker: '03690', name: '美团-W', market: 'HK' },
  { ticker: '09618', name: '京东集团-SW', market: 'HK' },
  { ticker: '01810', name: '小米集团-W', market: 'HK' },
  { ticker: '09888', name: '百度集团-SW', market: 'HK' },
  { ticker: '00941', name: '中国移动', market: 'HK' },
  { ticker: '00388', name: '香港交易所', market: 'HK' },
  { ticker: '02318', name: '中国平安', market: 'HK' },
  { ticker: '00005', name: '汇丰控股', market: 'HK' },
  { ticker: '01299', name: '友邦保险', market: 'HK' },
  { ticker: '02020', name: '安踏体育', market: 'HK' },
  { ticker: '09999', name: '网易-S', market: 'HK' },
  { ticker: '00981', name: '中芯国际', market: 'HK' },
  { ticker: '02382', name: '舜宇光学科技', market: 'HK' },
  { ticker: '01024', name: '快手-W', market: 'HK' },
  { ticker: '06618', name: '京东健康', market: 'HK' },
  { ticker: '02269', name: '药明生物', market: 'HK' },
  { ticker: '00175', name: '吉利汽车', market: 'HK' },
  { ticker: '02015', name: '理想汽车-W', market: 'HK' },
  { ticker: '09866', name: '蔚来-SW', market: 'HK' },
  { ticker: '09868', name: '小鹏汽车-W', market: 'HK' },
  // 美股
  { ticker: 'AAPL', name: '苹果 Apple', market: 'US' },
  { ticker: 'MSFT', name: '微软 Microsoft', market: 'US' },
  { ticker: 'GOOGL', name: '谷歌 Alphabet', market: 'US' },
  { ticker: 'AMZN', name: '亚马逊 Amazon', market: 'US' },
  { ticker: 'NVDA', name: '英伟达 NVIDIA', market: 'US' },
  { ticker: 'META', name: 'Meta (Facebook)', market: 'US' },
  { ticker: 'TSLA', name: '特斯拉 Tesla', market: 'US' },
  { ticker: 'PDD', name: '拼多多 PDD Holdings', market: 'US' },
  { ticker: 'BABA', name: '阿里巴巴 ADR', market: 'US' },
  { ticker: 'JD', name: '京东 ADR', market: 'US' },
  { ticker: 'BIDU', name: '百度 ADR', market: 'US' },
  { ticker: 'NIO', name: '蔚来 ADR', market: 'US' },
  { ticker: 'XPEV', name: '小鹏 ADR', market: 'US' },
  { ticker: 'LI', name: '理想 ADR', market: 'US' },
  { ticker: 'AMD', name: 'AMD', market: 'US' },
  { ticker: 'INTC', name: '英特尔 Intel', market: 'US' },
  { ticker: 'TSM', name: '台积电 ADR', market: 'US' },
  { ticker: 'NFLX', name: '奈飞 Netflix', market: 'US' },
  { ticker: 'DIS', name: '迪士尼 Disney', market: 'US' },
  { ticker: 'BA', name: '波音 Boeing', market: 'US' },
  // A股
  { ticker: '600519', name: '贵州茅台', market: 'CN' },
  { ticker: '000858', name: '五粮液', market: 'CN' },
  { ticker: '601318', name: '中国平安', market: 'CN' },
  { ticker: '600036', name: '招商银行', market: 'CN' },
  { ticker: '000333', name: '美的集团', market: 'CN' },
  { ticker: '000001', name: '平安银行', market: 'CN' },
  { ticker: '600276', name: '恒瑞医药', market: 'CN' },
  { ticker: '002594', name: '比亚迪', market: 'CN' },
  { ticker: '300750', name: '宁德时代', market: 'CN' },
  { ticker: '601012', name: '隆基绿能', market: 'CN' },
];

interface WatchlistProps {
  items: WatchlistItem[];
  onAdd: (ticker: string, targetPrice?: number, notes?: string) => Promise<void>;
  onRemove: (id: string) => void;
  cooldownDays: number;
}

export function Watchlist({ items, onAdd, onRemove, cooldownDays }: WatchlistProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [ticker, setTicker] = useState('');
  const [selectedStock, setSelectedStock] = useState<{ ticker: string; name: string; market: string } | null>(null);
  const [targetPrice, setTargetPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lastClosePrice, setLastClosePrice] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 模糊搜索
  const suggestions = useMemo(() => {
    if (!ticker.trim()) return [];
    const query = ticker.toLowerCase();
    return COMMON_STOCKS.filter(stock => 
      stock.ticker.toLowerCase().includes(query) ||
      stock.name.toLowerCase().includes(query)
    ).slice(0, 8);
  }, [ticker]);

  // 点击外部关闭建议列表
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 获取股票昨收价（模拟，实际可接入 API）
  const fetchLastClosePrice = async (ticker: string, market: string) => {
    setLoadingPrice(true);
    try {
      // 模拟价格数据 - 实际应从 API 获取
      // 这里用一些常见股票的近似价格
      const mockPrices: Record<string, number> = {
        '00700': 380, '09988': 85, '03690': 145, '09618': 135, '01810': 18,
        '09888': 88, '00941': 72, '00388': 280, '02318': 42, '00005': 62,
        '01299': 58, '02020': 85, '09999': 165, '00981': 28, '02382': 75,
        '01024': 52, '06618': 28, '02269': 18, '00175': 12, '02015': 115,
        '09866': 42, '09868': 55,
        'AAPL': 195, 'MSFT': 430, 'GOOGL': 175, 'AMZN': 195, 'NVDA': 135,
        'META': 580, 'TSLA': 250, 'PDD': 135, 'BABA': 85, 'JD': 28,
        'BIDU': 95, 'NIO': 5, 'XPEV': 15, 'LI': 32, 'AMD': 125,
        'INTC': 22, 'TSM': 185, 'NFLX': 890, 'DIS': 115, 'BA': 175,
        '600519': 1680, '000858': 145, '601318': 48, '600036': 35, '000333': 62,
        '000001': 12, '600276': 42, '002594': 265, '300750': 185, '601012': 22,
      };
      
      // 模拟网络延迟
      await new Promise(r => setTimeout(r, 300));
      
      const price = mockPrices[ticker] || Math.round(Math.random() * 100 + 20);
      setLastClosePrice(price);
    } catch (e) {
      console.error('获取价格失败:', e);
      setLastClosePrice(null);
    } finally {
      setLoadingPrice(false);
    }
  };

  const handleSelectStock = (stock: typeof COMMON_STOCKS[0]) => {
    setTicker(stock.ticker);
    setSelectedStock(stock);
    setShowSuggestions(false);
    setLastClosePrice(null);
    fetchLastClosePrice(stock.ticker, stock.market);
  };

  // 快捷设置目标价
  const setQuickTargetPrice = (discount: number) => {
    if (lastClosePrice) {
      const target = lastClosePrice * (1 + discount);
      setTargetPrice(target.toFixed(2));
    }
  };

  const handleAdd = async () => {
    if (!ticker.trim()) return;

    setIsAdding(true);
    try {
      await onAdd(
        ticker.trim().toUpperCase(),
        targetPrice ? parseFloat(targetPrice) : undefined,
        notes || undefined
      );
      setTicker('');
      setSelectedStock(null);
      setTargetPrice('');
      setNotes('');
      setIsAddModalOpen(false);
    } finally {
      setIsAdding(false);
    }
  };

  // 计算观察天数
  const getDaysInWatchlist = (addedDate: string): number => {
    return Math.floor((Date.now() - new Date(addedDate).getTime()) / (1000 * 60 * 60 * 24));
  };

  // 检查是否满足冷静期
  const isCooldownComplete = (addedDate: string): boolean => {
    return getDaysInWatchlist(addedDate) >= cooldownDays;
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-accent-purple" />
          <span className="text-xs text-text-secondary uppercase tracking-wider">观察列表</span>
          <Badge variant="info">{items.length}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={14} />
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-text-muted">
          <Eye size={48} className="mx-auto mb-3 opacity-30" />
          <p>观察列表为空</p>
          <p className="text-xs mt-1">添加股票到观察列表进行研究</p>
          <Button 
            variant="secondary" 
            size="sm" 
            className="mt-4"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={14} className="mr-1" />
            添加观察
          </Button>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {items.map(item => {
            const days = getDaysInWatchlist(item.addedDate);
            const ready = isCooldownComplete(item.addedDate);
            const progress = Math.min(100, (days / cooldownDays) * 100);

            return (
              <div 
                key={item.id}
                className="p-3 bg-bg-tertiary rounded-lg hover:bg-bg-tertiary/80 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-primary">{item.ticker}</span>
                      <Badge variant="info">
                        {item.market === 'CN' ? 'A股' : item.market === 'HK' ? '港股' : '美股'}
                      </Badge>
                      {ready ? (
                        <Badge variant="success">
                          <CheckCircle size={10} className="mr-1" />
                          可交易
                        </Badge>
                      ) : (
                        <Badge variant="warning">
                          <Clock size={10} className="mr-1" />
                          冷静期
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-text-muted mt-1 truncate max-w-[200px]">
                      {item.name}
                    </div>
                  </div>

                  <div className="text-right">
                    {item.currentPrice && (
                      <div className="text-sm text-text-primary mono-nums">
                        {item.currentPrice.toFixed(2)}
                      </div>
                    )}
                    {item.changePercent !== undefined && (
                      <NumberDisplay 
                        value={item.changePercent} 
                        suffix="%" 
                        decimals={2}
                        size="sm"
                      />
                    )}
                  </div>
                </div>

                {/* 冷静期进度 */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-text-muted">
                      观察 {days} 天 / {cooldownDays} 天
                    </span>
                    {item.targetPrice && (
                      <span className="text-text-secondary">
                        <Target size={10} className="inline mr-1" />
                        目标: {item.targetPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="w-full h-1 bg-bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${ready ? 'bg-accent-green' : 'bg-accent-yellow'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* 备注 */}
                {item.notes && (
                  <div className="mt-2 text-xs text-text-secondary line-clamp-2">
                    {item.notes}
                  </div>
                )}

                {/* 删除按钮 */}
                <button
                  className="absolute top-2 right-2 p-1 text-text-muted hover:text-accent-red opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRemove(item.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 添加观察弹窗 */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="添加到观察列表"
        size="sm"
      >
        <div className="space-y-4">
          {/* 股票代码输入 + 模糊搜索 */}
          <div className="relative" ref={inputRef}>
            <label className="block text-xs text-text-secondary uppercase tracking-wider mb-1">
              股票代码
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={ticker}
                onChange={(e) => {
                  setTicker(e.target.value.toUpperCase());
                  setSelectedStock(null);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="输入代码或名称搜索，如 700、腾讯"
                className="w-full bg-bg-tertiary border border-border rounded pl-9 pr-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan transition-colors"
              />
            </div>
            
            {/* 搜索建议下拉 */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-bg-secondary border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {suggestions.map(stock => (
                  <button
                    key={stock.ticker}
                    onClick={() => handleSelectStock(stock)}
                    className="w-full px-3 py-2 text-left hover:bg-bg-tertiary transition-colors flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium text-text-primary">{stock.ticker}</span>
                      <span className="text-text-secondary ml-2 text-sm">{stock.name}</span>
                    </div>
                    <Badge variant="info" className="text-[10px]">
                      {stock.market === 'CN' ? 'A股' : stock.market === 'HK' ? '港股' : '美股'}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
            
            {/* 已选中的股票显示 + 昨收价 */}
            {selectedStock && (
              <div className="mt-2 p-3 bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-accent-cyan">{selectedStock.ticker}</span>
                    <span className="text-text-secondary ml-2 text-sm">{selectedStock.name}</span>
                  </div>
                  <Badge variant="info">
                    {selectedStock.market === 'CN' ? 'A股' : selectedStock.market === 'HK' ? '港股' : '美股'}
                  </Badge>
                </div>
                {/* 昨收价显示 */}
                <div className="mt-2 pt-2 border-t border-accent-cyan/20 flex items-center justify-between">
                  <span className="text-xs text-text-muted">昨收价</span>
                  {loadingPrice ? (
                    <Loader2 size={14} className="animate-spin text-accent-cyan" />
                  ) : lastClosePrice ? (
                    <span className="font-mono font-medium text-text-primary">
                      {selectedStock.market === 'CN' ? '¥' : selectedStock.market === 'HK' ? 'HK$' : '$'}
                      {lastClosePrice.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-text-muted text-xs">获取中...</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 目标价格 + 快捷按钮 */}
          <div>
            <label className="block text-xs text-text-secondary uppercase tracking-wider mb-1">
              目标价格（可选）
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan transition-colors"
              />
            </div>
            {/* 快捷目标价按钮 */}
            {lastClosePrice && (
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setQuickTargetPrice(-0.05)}
                  className="flex-1 px-2 py-1.5 text-xs bg-accent-green/10 text-accent-green border border-accent-green/30 rounded hover:bg-accent-green/20 transition-colors"
                >
                  -5% ({(lastClosePrice * 0.95).toFixed(1)})
                </button>
                <button
                  type="button"
                  onClick={() => setQuickTargetPrice(-0.07)}
                  className="flex-1 px-2 py-1.5 text-xs bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30 rounded hover:bg-accent-yellow/20 transition-colors"
                >
                  -7% ({(lastClosePrice * 0.93).toFixed(1)})
                </button>
                <button
                  type="button"
                  onClick={() => setQuickTargetPrice(-0.10)}
                  className="flex-1 px-2 py-1.5 text-xs bg-accent-red/10 text-accent-red border border-accent-red/30 rounded hover:bg-accent-red/20 transition-colors"
                >
                  -10% ({(lastClosePrice * 0.90).toFixed(1)})
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-text-secondary uppercase tracking-wider">
              研究备注（可选）
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="记录你关注这只股票的原因..."
              className="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-cyan transition-colors min-h-[80px] resize-none"
            />
          </div>

          <div className="p-3 bg-bg-tertiary rounded-lg">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <AlertCircle size={14} className="text-accent-yellow" />
              <span>
                添加后需观察 <strong className="text-accent-yellow">{cooldownDays} 天</strong> 冷静期才能交易
              </span>
            </div>
          </div>

          <Button
            variant="primary"
            className="w-full"
            onClick={handleAdd}
            disabled={isAdding || !ticker.trim()}
          >
            {isAdding ? (
              <Loader2 size={16} className="animate-spin mx-auto" />
            ) : (
              <>
                <Eye size={16} className="mr-2" />
                添加到观察列表
              </>
            )}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
