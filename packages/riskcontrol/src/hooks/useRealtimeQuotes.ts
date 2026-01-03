/**
 * useRealtimeQuotes Hook - 实时行情 Hook
 * Feature: realtime-market-platform
 * 
 * 封装 Realtime Market Service 订阅逻辑
 * 提供响应式的实时行情数据
 * 
 * Requirements: 1.1, 7.1
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  realtimeMarketService,
  type LiveQuote,
  type SubscriptionPriority,
} from '../services/realtimeMarketService';

// ============ 类型定义 ============

export interface UseRealtimeQuotesOptions {
  priority?: SubscriptionPriority;
  autoStart?: boolean;
  onUpdate?: (quotes: Map<string, LiveQuote>) => void;
}

export interface UseRealtimeQuotesReturn {
  quotes: Map<string, LiveQuote>;
  getQuote: (ticker: string) => LiveQuote | null;
  subscribe: (ticker: string) => void;
  unsubscribe: (ticker: string) => void;
  refresh: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

// ============ Hook 实现 ============

/**
 * 订阅单个股票的实时行情
 */
export function useRealtimeQuote(
  ticker: string | null,
  priority: SubscriptionPriority = 'normal'
): LiveQuote | null {
  const [quote, setQuote] = useState<LiveQuote | null>(null);

  useEffect(() => {
    if (!ticker) {
      setQuote(null);
      return;
    }

    const handleUpdate = (newQuote: LiveQuote) => {
      setQuote(newQuote);
    };

    const unsubscribe = realtimeMarketService.subscribe(
      ticker,
      priority,
      handleUpdate
    );

    // 获取已有的行情数据
    const existingQuote = realtimeMarketService.getQuote(ticker);
    if (existingQuote) {
      setQuote(existingQuote);
    }

    return () => {
      unsubscribe();
    };
  }, [ticker, priority]);

  return quote;
}

/**
 * 订阅多个股票的实时行情
 */
export function useRealtimeQuotes(
  tickers: string[],
  options: UseRealtimeQuotesOptions = {}
): UseRealtimeQuotesReturn {
  const {
    priority = 'normal',
    autoStart = true,
    onUpdate,
  } = options;

  const [quotes, setQuotes] = useState<Map<string, LiveQuote>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribesRef = useRef<Array<() => void>>([]);
  const onUpdateRef = useRef(onUpdate);

  // 更新 onUpdate ref
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // 订阅行情
  useEffect(() => {
    if (tickers.length === 0) {
      setQuotes(new Map());
      return;
    }

    setIsLoading(true);
    setError(null);

    // 清理之前的订阅
    unsubscribesRef.current.forEach(unsub => unsub());
    unsubscribesRef.current = [];

    // 创建新订阅
    const newUnsubscribes = tickers.map(ticker => {
      return realtimeMarketService.subscribe(ticker, priority, (quote) => {
        setQuotes(prev => {
          const newQuotes = new Map(prev);
          newQuotes.set(ticker, quote);
          return newQuotes;
        });
      });
    });

    unsubscribesRef.current = newUnsubscribes;

    // 获取已有的行情数据
    const existingQuotes = new Map<string, LiveQuote>();
    tickers.forEach(ticker => {
      const quote = realtimeMarketService.getQuote(ticker);
      if (quote) {
        existingQuotes.set(ticker, quote);
      }
    });
    
    if (existingQuotes.size > 0) {
      setQuotes(existingQuotes);
    }

    setIsLoading(false);

    return () => {
      unsubscribesRef.current.forEach(unsub => unsub());
      unsubscribesRef.current = [];
    };
  }, [tickers.join(','), priority]);

  // 监听全局更新
  useEffect(() => {
    if (!onUpdateRef.current) return;

    const unsubscribe = realtimeMarketService.onDataUpdate((updatedQuotes) => {
      onUpdateRef.current?.(updatedQuotes);
    });

    return unsubscribe;
  }, []);

  // 启动服务
  useEffect(() => {
    if (autoStart && tickers.length > 0) {
      realtimeMarketService.start();
    }

    return () => {
      // 不在这里停止服务，因为可能有其他组件在使用
    };
  }, [autoStart, tickers.length]);

  // 获取单个行情
  const getQuote = useCallback((ticker: string): LiveQuote | null => {
    return quotes.get(ticker.toUpperCase()) || null;
  }, [quotes]);

  // 手动订阅
  const subscribe = useCallback((ticker: string) => {
    const unsubscribe = realtimeMarketService.subscribe(ticker, priority, (quote) => {
      setQuotes(prev => {
        const newQuotes = new Map(prev);
        newQuotes.set(ticker, quote);
        return newQuotes;
      });
    });
    unsubscribesRef.current.push(unsubscribe);
  }, [priority]);

  // 手动取消订阅
  const unsubscribe = useCallback((ticker: string) => {
    realtimeMarketService.unsubscribe(ticker);
    setQuotes(prev => {
      const newQuotes = new Map(prev);
      newQuotes.delete(ticker.toUpperCase());
      return newQuotes;
    });
  }, []);

  // 刷新所有行情
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await realtimeMarketService.refresh();
      // 更新本地状态
      const allQuotes = realtimeMarketService.getAllQuotes();
      const filteredQuotes = new Map<string, LiveQuote>();
      tickers.forEach(ticker => {
        const quote = allQuotes.get(ticker.toUpperCase());
        if (quote) {
          filteredQuotes.set(ticker.toUpperCase(), quote);
        }
      });
      setQuotes(filteredQuotes);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh quotes'));
    } finally {
      setIsLoading(false);
    }
  }, [tickers]);

  return {
    quotes,
    getQuote,
    subscribe,
    unsubscribe,
    refresh,
    isLoading,
    error,
  };
}

/**
 * 获取持仓的实时行情（高优先级）
 */
export function usePortfolioQuotes(tickers: string[]): UseRealtimeQuotesReturn {
  return useRealtimeQuotes(tickers, { priority: 'high' });
}

/**
 * 获取观察列表的实时行情（普通优先级）
 */
export function useWatchlistQuotes(tickers: string[]): UseRealtimeQuotesReturn {
  return useRealtimeQuotes(tickers, { priority: 'normal' });
}

// ============ 导出 ============

export default useRealtimeQuotes;
