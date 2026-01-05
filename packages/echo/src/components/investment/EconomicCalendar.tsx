/**
 * EconomicCalendar - 财经日历组件
 * 
 * 使用 TradingView Economic Calendar Widget 展示即将发布的经济数据
 * 从 RiskControl 迁移，使用 HeroUI 组件
 * 
 * **Validates: Requirements 4.1**
 */

import React, { useState, useMemo } from 'react';
import { Chip, Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { TradingViewWidget } from './TradingViewWidget';
import {
  TRADINGVIEW_SCRIPTS,
  ECONOMIC_CALENDAR_CONFIG,
  COUNTRY_OPTIONS,
  IMPORTANCE_OPTIONS,
} from '@/lib/tradingViewConfigs';

interface EconomicCalendarProps {
  /** 初始国家筛选 */
  defaultCountries?: string[];
  /** 初始重要性筛选 */
  defaultImportance?: 'all' | 'high' | 'medium' | 'low';
  /** 组件高度 */
  height?: number;
  /** 是否显示筛选器 */
  showFilters?: boolean;
}

/**
 * 财经日历组件
 */
export function EconomicCalendar({
  defaultCountries = ['us', 'cn', 'eu', 'jp'],
  defaultImportance = 'all',
  height = 550,
  showFilters = true,
}: EconomicCalendarProps) {
  // 筛选状态
  const [selectedCountries, setSelectedCountries] = useState<string[]>(defaultCountries);
  const [selectedImportance, setSelectedImportance] = useState(defaultImportance);

  // 生成 Widget 配置
  const widgetConfig = useMemo(() => {
    const importanceOption = IMPORTANCE_OPTIONS.find(o => o.value === selectedImportance);
    const importanceFilter = importanceOption?.filter || '-1,0,1';
    const countryFilter = selectedCountries.length > 0 
      ? selectedCountries.join(',') 
      : 'us,cn,eu,jp,gb';

    return {
      ...ECONOMIC_CALENDAR_CONFIG,
      importanceFilter,
      countryFilter,
      height,
    };
  }, [selectedCountries, selectedImportance, height]);

  // 切换国家选择
  const toggleCountry = (country: string) => {
    setSelectedCountries(prev => {
      if (prev.includes(country)) {
        // 至少保留一个国家
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== country);
      }
      return [...prev, country];
    });
  };

  return (
    <div className="space-y-4">
      {/* 筛选器 */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 重要性筛选 */}
          <div className="flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Icon icon="mdi:filter" className="text-foreground/50" />
              <span className="text-sm text-foreground/50">重要性</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {IMPORTANCE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={selectedImportance === option.value ? 'solid' : 'flat'}
                  color={selectedImportance === option.value ? 'primary' : 'default'}
                  onPress={() => setSelectedImportance(option.value as typeof selectedImportance)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 国家/地区筛选 */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Icon icon="mdi:earth" className="text-foreground/50" />
              <span className="text-sm text-foreground/50">国家/地区</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {COUNTRY_OPTIONS.map((country) => (
                <Chip
                  key={country.value}
                  variant={selectedCountries.includes(country.value) ? 'solid' : 'flat'}
                  color={selectedCountries.includes(country.value) ? 'success' : 'default'}
                  className="cursor-pointer"
                  onClick={() => toggleCountry(country.value)}
                >
                  {country.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TradingView 财经日历 Widget */}
      <TradingViewWidget
        scriptUrl={TRADINGVIEW_SCRIPTS.economicCalendar}
        config={widgetConfig}
        height={height}
        icon={<Icon icon="mdi:calendar" className="text-xl text-secondary" />}
      />
    </div>
  );
}

export default EconomicCalendar;
