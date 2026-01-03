/**
 * Market Status Service - 市场状态监控服务
 * Feature: realtime-market-platform
 * 
 * 监控美股/港股/A股的交易状态，提供开盘时间和倒计时
 * 
 * Property 8: 市场状态计算正确性
 * Validates: Requirements 8.1, 8.3, 8.4
 */

// ============ 类型定义 ============

export type MarketType = 'US' | 'HK' | 'CN';

export type MarketStatus = 
  | 'pre_market'    // 盘前
  | 'open'          // 交易中
  | 'lunch_break'   // 午休（港股/A股）
  | 'post_market'   // 盘后
  | 'closed';       // 休市

export interface MarketStatusInfo {
  market: MarketType;
  status: MarketStatus;
  statusText: string;
  isTrading: boolean;
  nextSession: TradingSession | null;
  countdown: number; // 距离下一个状态的秒数
}

export interface TradingSession {
  type: 'open' | 'close' | 'lunch_start' | 'lunch_end';
  time: Date;
  description: string;
}

export interface MarketSchedule {
  market: MarketType;
  timezone: string;
  preMarketStart?: { hour: number; minute: number };
  marketOpen: { hour: number; minute: number };
  lunchStart?: { hour: number; minute: number };
  lunchEnd?: { hour: number; minute: number };
  marketClose: { hour: number; minute: number };
  postMarketEnd?: { hour: number; minute: number };
  tradingDays: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
}

// ============ 市场时间表配置 ============

const MARKET_SCHEDULES: Record<MarketType, MarketSchedule> = {
  US: {
    market: 'US',
    timezone: 'America/New_York',
    preMarketStart: { hour: 4, minute: 0 },
    marketOpen: { hour: 9, minute: 30 },
    marketClose: { hour: 16, minute: 0 },
    postMarketEnd: { hour: 20, minute: 0 },
    tradingDays: [1, 2, 3, 4, 5], // 周一到周五
  },
  HK: {
    market: 'HK',
    timezone: 'Asia/Hong_Kong',
    marketOpen: { hour: 9, minute: 30 },
    lunchStart: { hour: 12, minute: 0 },
    lunchEnd: { hour: 13, minute: 0 },
    marketClose: { hour: 16, minute: 0 },
    tradingDays: [1, 2, 3, 4, 5],
  },
  CN: {
    market: 'CN',
    timezone: 'Asia/Shanghai',
    marketOpen: { hour: 9, minute: 30 },
    lunchStart: { hour: 11, minute: 30 },
    lunchEnd: { hour: 13, minute: 0 },
    marketClose: { hour: 15, minute: 0 },
    tradingDays: [1, 2, 3, 4, 5],
  },
};

// ============ 核心函数 ============

/**
 * 获取市场当前状态
 * Property 8: 市场状态计算正确性
 * Requirements: 8.1
 */
export function getMarketStatus(market: MarketType, now: Date = new Date()): MarketStatusInfo {
  const schedule = MARKET_SCHEDULES[market];
  const marketTime = getMarketTime(now, schedule.timezone);
  
  // 检查是否为交易日
  const dayOfWeek = marketTime.getDay();
  if (!schedule.tradingDays.includes(dayOfWeek)) {
    return createClosedStatus(market, schedule, marketTime);
  }
  
  const currentMinutes = marketTime.getHours() * 60 + marketTime.getMinutes();
  const openMinutes = schedule.marketOpen.hour * 60 + schedule.marketOpen.minute;
  const closeMinutes = schedule.marketClose.hour * 60 + schedule.marketClose.minute;
  
  // 美股特殊处理：盘前和盘后
  if (market === 'US') {
    const preMarketMinutes = schedule.preMarketStart!.hour * 60 + schedule.preMarketStart!.minute;
    const postMarketMinutes = schedule.postMarketEnd!.hour * 60 + schedule.postMarketEnd!.minute;
    
    if (currentMinutes >= preMarketMinutes && currentMinutes < openMinutes) {
      return createPreMarketStatus(market, schedule, marketTime, currentMinutes);
    }
    
    if (currentMinutes >= closeMinutes && currentMinutes < postMarketMinutes) {
      return createPostMarketStatus(market, schedule, marketTime, currentMinutes);
    }
  }
  
  // 港股/A股午休处理
  if ((market === 'HK' || market === 'CN') && schedule.lunchStart && schedule.lunchEnd) {
    const lunchStartMinutes = schedule.lunchStart.hour * 60 + schedule.lunchStart.minute;
    const lunchEndMinutes = schedule.lunchEnd.hour * 60 + schedule.lunchEnd.minute;
    
    if (currentMinutes >= lunchStartMinutes && currentMinutes < lunchEndMinutes) {
      return createLunchBreakStatus(market, schedule, marketTime, currentMinutes);
    }
  }
  
  // 正常交易时间
  if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
    return createOpenStatus(market, schedule, marketTime, currentMinutes);
  }
  
  // 休市
  return createClosedStatus(market, schedule, marketTime);
}

/**
 * 获取下一个交易时段
 * Requirements: 8.3
 */
export function getNextTradingSession(market: MarketType, now: Date = new Date()): TradingSession | null {
  const status = getMarketStatus(market, now);
  return status.nextSession;
}

/**
 * 获取所有市场状态
 */
export function getAllMarketStatus(now: Date = new Date()): MarketStatusInfo[] {
  return (['US', 'HK', 'CN'] as MarketType[]).map(market => getMarketStatus(market, now));
}

/**
 * 检查市场是否正在交易
 */
export function isMarketTrading(market: MarketType, now: Date = new Date()): boolean {
  const status = getMarketStatus(market, now);
  return status.isTrading;
}

/**
 * 获取市场时区的当前时间
 */
export function getMarketTime(now: Date, timezone: string): Date {
  // 使用 Intl.DateTimeFormat 获取目标时区的时间
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
  
  return new Date(
    parseInt(getPart('year')),
    parseInt(getPart('month')) - 1,
    parseInt(getPart('day')),
    parseInt(getPart('hour')),
    parseInt(getPart('minute')),
    parseInt(getPart('second'))
  );
}

// ============ 状态创建辅助函数 ============

function createOpenStatus(
  market: MarketType,
  schedule: MarketSchedule,
  marketTime: Date,
  currentMinutes: number
): MarketStatusInfo {
  const closeMinutes = schedule.marketClose.hour * 60 + schedule.marketClose.minute;
  let nextMinutes = closeMinutes;
  let nextType: TradingSession['type'] = 'close';
  let nextDescription = '收盘';
  
  // 港股/A股检查午休
  if (schedule.lunchStart) {
    const lunchStartMinutes = schedule.lunchStart.hour * 60 + schedule.lunchStart.minute;
    if (currentMinutes < lunchStartMinutes) {
      nextMinutes = lunchStartMinutes;
      nextType = 'lunch_start';
      nextDescription = '午休开始';
    }
  }
  
  const countdown = (nextMinutes - currentMinutes) * 60;
  
  return {
    market,
    status: 'open',
    statusText: '交易中',
    isTrading: true,
    nextSession: {
      type: nextType,
      time: createTimeFromMinutes(marketTime, nextMinutes),
      description: nextDescription,
    },
    countdown,
  };
}

function createPreMarketStatus(
  market: MarketType,
  schedule: MarketSchedule,
  marketTime: Date,
  currentMinutes: number
): MarketStatusInfo {
  const openMinutes = schedule.marketOpen.hour * 60 + schedule.marketOpen.minute;
  const countdown = (openMinutes - currentMinutes) * 60;
  
  return {
    market,
    status: 'pre_market',
    statusText: '盘前交易',
    isTrading: false,
    nextSession: {
      type: 'open',
      time: createTimeFromMinutes(marketTime, openMinutes),
      description: '开盘',
    },
    countdown,
  };
}

function createPostMarketStatus(
  market: MarketType,
  schedule: MarketSchedule,
  marketTime: Date,
  currentMinutes: number
): MarketStatusInfo {
  const postMarketMinutes = schedule.postMarketEnd!.hour * 60 + schedule.postMarketEnd!.minute;
  const countdown = (postMarketMinutes - currentMinutes) * 60;
  
  return {
    market,
    status: 'post_market',
    statusText: '盘后交易',
    isTrading: false,
    nextSession: {
      type: 'close',
      time: createTimeFromMinutes(marketTime, postMarketMinutes),
      description: '盘后结束',
    },
    countdown,
  };
}

function createLunchBreakStatus(
  market: MarketType,
  schedule: MarketSchedule,
  marketTime: Date,
  currentMinutes: number
): MarketStatusInfo {
  const lunchEndMinutes = schedule.lunchEnd!.hour * 60 + schedule.lunchEnd!.minute;
  const countdown = (lunchEndMinutes - currentMinutes) * 60;
  
  return {
    market,
    status: 'lunch_break',
    statusText: '午休',
    isTrading: false,
    nextSession: {
      type: 'lunch_end',
      time: createTimeFromMinutes(marketTime, lunchEndMinutes),
      description: '午盘开始',
    },
    countdown,
  };
}

function createClosedStatus(
  market: MarketType,
  schedule: MarketSchedule,
  marketTime: Date
): MarketStatusInfo {
  // 计算下一个交易日的开盘时间
  const nextTradingDay = getNextTradingDay(marketTime, schedule.tradingDays);
  const openMinutes = schedule.marketOpen.hour * 60 + schedule.marketOpen.minute;
  const nextOpenTime = createTimeFromMinutes(nextTradingDay, openMinutes);
  
  // 计算倒计时（秒）
  const countdown = Math.max(0, Math.floor((nextOpenTime.getTime() - marketTime.getTime()) / 1000));
  
  return {
    market,
    status: 'closed',
    statusText: '休市',
    isTrading: false,
    nextSession: {
      type: 'open',
      time: nextOpenTime,
      description: '开盘',
    },
    countdown,
  };
}

// ============ 辅助函数 ============

function createTimeFromMinutes(baseDate: Date, minutes: number): Date {
  const result = new Date(baseDate);
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
}

function getNextTradingDay(currentDate: Date, tradingDays: number[]): Date {
  const result = new Date(currentDate);
  result.setDate(result.getDate() + 1);
  
  // 最多查找 7 天
  for (let i = 0; i < 7; i++) {
    if (tradingDays.includes(result.getDay())) {
      result.setHours(0, 0, 0, 0);
      return result;
    }
    result.setDate(result.getDate() + 1);
  }
  
  return result;
}

/**
 * 格式化倒计时
 */
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '00:00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}天 ${remainingHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 获取市场名称
 */
export function getMarketName(market: MarketType): string {
  switch (market) {
    case 'US': return '美股';
    case 'HK': return '港股';
    case 'CN': return 'A股';
  }
}

/**
 * 获取状态颜色
 */
export function getStatusColor(status: MarketStatus): string {
  switch (status) {
    case 'open': return 'text-green-500';
    case 'pre_market':
    case 'post_market': return 'text-yellow-500';
    case 'lunch_break': return 'text-orange-500';
    case 'closed': return 'text-gray-500';
  }
}
