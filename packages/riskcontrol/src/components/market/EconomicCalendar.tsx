/**
 * EconomicCalendar - 财经日历组件
 * 
 * 使用 TradingView Economic Calendar Widget 展示即将发布的经济数据
 * 支持按重要性和国家/地区筛选
 */

import React, { useState, useMemo } from 'react';
import { Calendar, Filter, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
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
 * 
 * @example
 * ```tsx
 * <EconomicCalendar 
 *   defaultCountries={['us', 'cn']}
 *   defaultImportance="high"
 *   height={600}
 * />
 * ```
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
              <Filter size={14} className="text-white/50" />
              <span className="text-sm text-white/50">重要性</span>
            </div>
            <div className="flex gap-1">
              {IMPORTANCE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedImportance(option.value)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-lg transition-colors',
                    selectedImportance === option.value
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-white/5 text-white/60 hover:bg-white/10 border border-transparent'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 国家/地区筛选 */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={14} className="text-white/50" />
              <span className="text-sm text-white/50">国家/地区</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {COUNTRY_OPTIONS.map((country) => (
                <button
                  key={country.value}
                  onClick={() => toggleCountry(country.value)}
                  className={cn(
                    'px-2.5 py-1 text-sm rounded-lg transition-colors',
                    selectedCountries.includes(country.value)
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-white/5 text-white/60 hover:bg-white/10 border border-transparent'
                  )}
                >
                  {country.label}
                </button>
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
        icon={<Calendar size={18} className="text-purple-400" />}
      />
    </div>
  );
}

export default EconomicCalendar;
