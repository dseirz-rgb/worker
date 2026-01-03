import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { StockHistory, StockHistoryItem } from '../types';
import { fetchStockHistory } from '../services/marketData';

interface MarketContextType {
  vixHistory: StockHistory | null;
  spyHistory: StockHistory | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
  isSimulated: boolean;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

export function useMarketData() {
  const context = useContext(MarketContext);
  if (context === undefined) {
    throw new Error('useMarketData must be used within a MarketProvider');
  }
  return context;
}

interface MarketProviderProps {
  children: ReactNode;
}

export function MarketProvider({ children }: MarketProviderProps) {
  const [vixHistory, setVixHistory] = useState<StockHistory | null>(null);
  const [spyHistory, setSpyHistory] = useState<StockHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);

  const generateMockData = useCallback(() => {
    console.log('Generating unified mock market data...');
    setIsSimulated(true);
    
    // 模拟 VIX 数据 - 确保每次生成的趋势是一致的（虽然是随机的，但在同一次应用生命周期内）
    // 为了让用户看到一致的数据，我们在组件挂载时生成一次
    
    const mockVix: StockHistory = {
      ticker: '^VIX',
      data: Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        // 使用固定的随机种子或简单的逻辑来生成看起来真实的数据
        // 这里为了简单，我们生成一个随机漫步，但起点固定
        const baseVix = 15 + Math.random() * 5; 
        return {
          date: date.toISOString(),
          open: baseVix,
          high: baseVix + 1,
          low: baseVix - 1,
          close: baseVix + (Math.random() - 0.5),
          volume: 0
        };
      })
    };
    
    // 模拟 SPY 数据
    const mockSpy: StockHistory = {
      ticker: 'SPY',
      data: Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const basePrice = 580 + Math.random() * 10;
        return {
          date: date.toISOString(),
          open: basePrice,
          high: basePrice + 2,
          low: basePrice - 2,
          close: basePrice + (Math.random() - 0.5) * 5,
          volume: 1000000
        };
      })
    };
    
    setVixHistory(mockVix);
    setSpyHistory(mockSpy);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      // 并行获取 VIX 和 SPY 数据
      const [vixData, spyData] = await Promise.all([
        fetchStockHistory('^VIX', '1mo'),
        fetchStockHistory('SPY', '1mo')
      ]);
      
      if (vixData && spyData && vixData.data.length > 0 && spyData.data.length > 0) {
        setVixHistory(vixData);
        setSpyHistory(spyData);
        setError(null);
        setIsSimulated(false);
      } else {
        throw new Error('Incomplete data received');
      }
    } catch (err) {
      console.error('Failed to load market data, falling back to mock:', err);
      // 如果失败，使用模拟数据
      generateMockData();
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, [generateMockData]);

  // 初始加载
  useEffect(() => {
    refresh();
    
    // 每 5 分钟自动刷新一次
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <MarketContext.Provider value={{ vixHistory, spyHistory, loading, error, refresh, lastUpdated, isSimulated }}>
      {children}
    </MarketContext.Provider>
  );
}
