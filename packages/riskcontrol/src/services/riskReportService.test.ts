/**
 * 风控报告服务测试 - Risk Report Service Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getWeekRange,
  getMonthRange,
  formatDate,
  filterByDateRange,
  calculateMaxLosingStreak,
  calculateMaxDrawdown,
  calculatePeriodRiskScore,
  generateWeeklyReport,
  generateMonthlyReport,
  getRiskScoreLevel,
  getRiskScoreLevelName,
  getChangeTrend,
  formatChange,
} from './riskReportService';
import type { DailyPnL, RiskThresholds } from './riskMetricsService';

// 默认测试阈值
const testThresholds: RiskThresholds = {
  leverageWarning: 1.5,
  leverageCritical: 2.0,
  leverageInDrawdown: 1.2,
  monthlyDrawdownWarning: 10,
  monthlyDrawdownCritical: 15,
  trailingStopPercent: 15,
  losingStreakWarning: 3,
  losingStreakCritical: 5,
};

describe('日期范围函数', () => {
  it('getWeekRange 应返回正确的周范围', () => {
    // 2024年1月15日是周一
    const date = new Date('2024-01-15');
    const { start, end } = getWeekRange(date, 0);
    
    expect(formatDate(start)).toBe('2024-01-15');
    expect(formatDate(end)).toBe('2024-01-21');
  });

  it('getWeekRange 应正确处理上周', () => {
    const date = new Date('2024-01-15');
    const { start, end } = getWeekRange(date, -1);
    
    expect(formatDate(start)).toBe('2024-01-08');
    expect(formatDate(end)).toBe('2024-01-14');
  });

  it('getMonthRange 应返回正确的月范围', () => {
    const date = new Date('2024-01-15');
    const { start, end } = getMonthRange(date, 0);
    
    expect(formatDate(start)).toBe('2024-01-01');
    expect(formatDate(end)).toBe('2024-01-31');
  });

  it('getMonthRange 应正确处理上月', () => {
    const date = new Date('2024-02-15');
    const { start, end } = getMonthRange(date, -1);
    
    expect(formatDate(start)).toBe('2024-01-01');
    expect(formatDate(end)).toBe('2024-01-31');
  });
});

describe('filterByDateRange', () => {
  it('应正确过滤日期范围内的记录', () => {
    const records = [
      { date: '2024-01-01', value: 1 },
      { date: '2024-01-05', value: 2 },
      { date: '2024-01-10', value: 3 },
      { date: '2024-01-15', value: 4 },
    ];
    
    const start = new Date('2024-01-03');
    const end = new Date('2024-01-12');
    
    const filtered = filterByDateRange(records, start, end);
    
    expect(filtered).toHaveLength(2);
    expect(filtered[0].date).toBe('2024-01-05');
    expect(filtered[1].date).toBe('2024-01-10');
  });
});

describe('calculateMaxLosingStreak', () => {
  it('应正确计算最大连败天数', () => {
    const dailyPnL: DailyPnL[] = [
      { date: '2024-01-01', pnl: 100, pnlPercent: 1 },
      { date: '2024-01-02', pnl: -50, pnlPercent: -0.5 },
      { date: '2024-01-03', pnl: -30, pnlPercent: -0.3 },
      { date: '2024-01-04', pnl: -20, pnlPercent: -0.2 },
      { date: '2024-01-05', pnl: 80, pnlPercent: 0.8 },
      { date: '2024-01-06', pnl: -10, pnlPercent: -0.1 },
    ];
    
    expect(calculateMaxLosingStreak(dailyPnL)).toBe(3);
  });

  it('空数组应返回0', () => {
    expect(calculateMaxLosingStreak([])).toBe(0);
  });

  it('全部盈利应返回0', () => {
    const dailyPnL: DailyPnL[] = [
      { date: '2024-01-01', pnl: 100, pnlPercent: 1 },
      { date: '2024-01-02', pnl: 50, pnlPercent: 0.5 },
    ];
    
    expect(calculateMaxLosingStreak(dailyPnL)).toBe(0);
  });
});

describe('calculateMaxDrawdown', () => {
  it('应正确计算最大回撤', () => {
    const dailyPnL: DailyPnL[] = [
      { date: '2024-01-01', pnl: 100, pnlPercent: 1 },
      { date: '2024-01-02', pnl: 200, pnlPercent: 2 },
      { date: '2024-01-03', pnl: -150, pnlPercent: -1.5 },
      { date: '2024-01-04', pnl: -100, pnlPercent: -1 },
      { date: '2024-01-05', pnl: 50, pnlPercent: 0.5 },
    ];
    
    // 累计: 1, 3, 1.5, 0.5, 1
    // 峰值: 1, 3, 3, 3, 3
    // 回撤: 0, 0, 1.5, 2.5, 2
    // 最大回撤: 2.5
    expect(calculateMaxDrawdown(dailyPnL)).toBe(2.5);
  });

  it('空数组应返回0', () => {
    expect(calculateMaxDrawdown([])).toBe(0);
  });
});

describe('calculatePeriodRiskScore', () => {
  it('低风险情况应返回低分', () => {
    const score = calculatePeriodRiskScore(1.0, 5, 0, 1, testThresholds);
    expect(score).toBeLessThan(30);
  });

  it('高风险情况应返回高分', () => {
    const score = calculatePeriodRiskScore(2.5, 20, 5, 6, testThresholds);
    expect(score).toBeGreaterThan(60);
  });

  it('评分应在0-100范围内', () => {
    const score1 = calculatePeriodRiskScore(0, 0, 0, 0, testThresholds);
    const score2 = calculatePeriodRiskScore(10, 50, 20, 20, testThresholds);
    
    expect(score1).toBeGreaterThanOrEqual(0);
    expect(score1).toBeLessThanOrEqual(100);
    expect(score2).toBeGreaterThanOrEqual(0);
    expect(score2).toBeLessThanOrEqual(100);
  });
});

describe('getRiskScoreLevel', () => {
  it('低分应返回safe', () => {
    expect(getRiskScoreLevel(20)).toBe('safe');
  });

  it('中分应返回caution', () => {
    expect(getRiskScoreLevel(45)).toBe('caution');
  });

  it('高分应返回danger', () => {
    expect(getRiskScoreLevel(75)).toBe('danger');
  });
});

describe('getRiskScoreLevelName', () => {
  it('应返回正确的中文名称', () => {
    expect(getRiskScoreLevelName(20)).toBe('安全');
    expect(getRiskScoreLevelName(45)).toBe('谨慎');
    expect(getRiskScoreLevelName(75)).toBe('危险');
  });
});

describe('getChangeTrend', () => {
  it('负变化应返回improved', () => {
    expect(getChangeTrend(-0.5)).toBe('improved');
  });

  it('正变化应返回worsened', () => {
    expect(getChangeTrend(0.5)).toBe('worsened');
  });

  it('小变化应返回stable', () => {
    expect(getChangeTrend(0.005)).toBe('stable');
    expect(getChangeTrend(-0.005)).toBe('stable');
  });
});

describe('formatChange', () => {
  it('应正确格式化正变化', () => {
    expect(formatChange(1.5, '%')).toBe('+1.50%');
  });

  it('应正确格式化负变化', () => {
    expect(formatChange(-1.5, '%')).toBe('-1.50%');
  });

  it('小变化应返回持平', () => {
    expect(formatChange(0.005)).toBe('持平');
  });
});

describe('generateWeeklyReport', () => {
  it('应生成正确的周报', () => {
    const history = [
      { date: '2024-01-15', leverage: 1.2, nav: 100000 },
      { date: '2024-01-16', leverage: 1.5, nav: 101000 },
      { date: '2024-01-17', leverage: 1.3, nav: 100500 },
    ];
    
    const dailyPnL: DailyPnL[] = [
      { date: '2024-01-15', pnl: 1000, pnlPercent: 1 },
      { date: '2024-01-16', pnl: -500, pnlPercent: -0.5 },
      { date: '2024-01-17', pnl: 200, pnlPercent: 0.2 },
    ];
    
    const report = generateWeeklyReport(
      history,
      dailyPnL,
      testThresholds,
      new Date('2024-01-17')
    );
    
    expect(report.period).toBe('weekly');
    expect(report.maxLeverage).toBe(1.5);
    expect(report.tradingDays).toBe(3);
    expect(report.profitableDays).toBe(2);
    expect(report.losingDays).toBe(1);
    expect(report.totalPnL).toBe(700);
  });
});

describe('generateMonthlyReport', () => {
  it('应生成正确的月报', () => {
    const history = [
      { date: '2024-01-05', leverage: 1.2, nav: 100000 },
      { date: '2024-01-10', leverage: 1.8, nav: 102000 },
      { date: '2024-01-15', leverage: 1.4, nav: 101000 },
    ];
    
    const dailyPnL: DailyPnL[] = [
      { date: '2024-01-05', pnl: 1000, pnlPercent: 1 },
      { date: '2024-01-10', pnl: 2000, pnlPercent: 2 },
      { date: '2024-01-15', pnl: -1000, pnlPercent: -1 },
    ];
    
    const report = generateMonthlyReport(
      history,
      dailyPnL,
      testThresholds,
      new Date('2024-01-20')
    );
    
    expect(report.period).toBe('monthly');
    expect(report.maxLeverage).toBe(1.8);
    expect(report.tradingDays).toBe(3);
    expect(report.totalPnL).toBe(2000);
  });
});
