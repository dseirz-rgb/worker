/**
 * TradingView Widget 服务测试
 * 
 * **Validates: Requirements 36.1, 36.2**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  TradingViewService,
  TradingViewError,
  getTradingViewService,
  TRADINGVIEW_SCRIPTS,
  WIDGET_CONFIGS,
  type WidgetType,
} from './tradingview';

describe('TradingViewService', () => {
  let service: TradingViewService;

  beforeEach(() => {
    service = new TradingViewService();
  });

  // ============================================
  // 基础功能测试
  // ============================================

  describe('Script URLs', () => {
    /**
     * **Validates: Requirements 36.1**
     */
    it('should return correct script URL for each widget type', () => {
      const widgetTypes: WidgetType[] = [
        'economicCalendar',
        'forexCrossRates',
        'marketQuotes',
        'marketOverview',
        'stockHeatmap',
        'miniChart',
        'topStories',
        'technicalAnalysis',
      ];

      for (const widgetType of widgetTypes) {
        const url = service.getScriptUrl(widgetType);
        expect(url).toBeDefined();
        expect(url).toContain('tradingview.com');
        expect(url).toContain('.js');
      }
    });

    it('should have all widget types defined', () => {
      const supportedWidgets = service.getSupportedWidgets();
      expect(supportedWidgets.length).toBe(8);
      expect(supportedWidgets).toContain('economicCalendar');
      expect(supportedWidgets).toContain('stockHeatmap');
    });
  });

  describe('Default Configurations', () => {
    /**
     * **Validates: Requirements 36.2**
     */
    it('should return default config for each widget type', () => {
      const widgetTypes = service.getSupportedWidgets();

      for (const widgetType of widgetTypes) {
        const config = service.getDefaultConfig(widgetType);
        expect(config).toBeDefined();
        expect(config.colorTheme).toBe('dark');
        expect(config.locale).toBe('zh_CN');
        expect(config.isTransparent).toBe(true);
        expect(config.width).toBeDefined();
        expect(config.height).toBeGreaterThan(0);
      }
    });

    it('should return copy of config (not reference)', () => {
      const config1 = service.getDefaultConfig('economicCalendar');
      const config2 = service.getDefaultConfig('economicCalendar');
      
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('Config Merging', () => {
    it('should merge custom config with defaults', () => {
      const customConfig = {
        height: 800,
        colorTheme: 'light' as const,
      };

      const merged = service.mergeConfig('economicCalendar', customConfig);

      expect(merged.height).toBe(800);
      expect(merged.colorTheme).toBe('light');
      expect(merged.locale).toBe('zh_CN'); // 保留默认值
    });

    it('should return defaults when no custom config', () => {
      const merged = service.mergeConfig('stockHeatmap');
      const defaults = service.getDefaultConfig('stockHeatmap');

      expect(merged).toEqual(defaults);
    });
  });

  describe('Widget HTML Generation', () => {
    it('should generate valid HTML structure', () => {
      const html = service.generateWidgetHtml('economicCalendar');

      expect(html).toContain('tradingview-widget-container');
      expect(html).toContain('script');
      expect(html).toContain(TRADINGVIEW_SCRIPTS.economicCalendar);
    });

    it('should include config in HTML', () => {
      const html = service.generateWidgetHtml('stockHeatmap', { height: 600 });

      expect(html).toContain('600');
    });
  });

  describe('Script Loading State', () => {
    it('should track script loading state', () => {
      // 初始状态：未加载
      expect(service.isScriptLoaded('economicCalendar')).toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should always return available (client-side widgets)', async () => {
      const health = await service.healthCheck();
      
      expect(health.available).toBe(true);
      expect(health.message).toContain('available');
    });
  });

  // ============================================
  // 错误处理测试
  // ============================================

  describe('Error Handling', () => {
    it('should create TradingViewError with correct properties', () => {
      const error = new TradingViewError('LOAD_FAILED', 'Test error');

      expect(error.name).toBe('TradingViewError');
      expect(error.code).toBe('LOAD_FAILED');
      expect(error.message).toBe('Test error');
    });
  });

  // ============================================
  // 工厂函数测试
  // ============================================

  describe('Factory Functions', () => {
    it('should return singleton instance', () => {
      const instance1 = getTradingViewService();
      const instance2 = getTradingViewService();

      expect(instance1).toBe(instance2);
    });
  });

  // ============================================
  // 属性测试
  // ============================================

  describe('Property Tests', () => {
    /**
     * **Validates: Requirements 36.1**
     * 属性：所有 Widget 类型都应该有有效的脚本 URL
     */
    it('all widget types should have valid script URLs', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...service.getSupportedWidgets()),
          (widgetType) => {
            const url = service.getScriptUrl(widgetType);
            return (
              typeof url === 'string' &&
              url.startsWith('https://') &&
              url.includes('tradingview.com') &&
              url.endsWith('.js')
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 36.2**
     * 属性：所有 Widget 配置都应该有必需字段
     */
    it('all widget configs should have required fields', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...service.getSupportedWidgets()),
          (widgetType) => {
            const config = service.getDefaultConfig(widgetType);
            return (
              config.colorTheme !== undefined &&
              config.locale !== undefined &&
              config.isTransparent !== undefined &&
              config.width !== undefined &&
              config.height !== undefined &&
              config.height > 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性：合并配置应该保留未覆盖的默认值
     */
    it('merged config should preserve unoverridden defaults', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...service.getSupportedWidgets()),
          fc.integer({ min: 100, max: 1000 }),
          (widgetType, height) => {
            const merged = service.mergeConfig(widgetType, { height });
            const defaults = service.getDefaultConfig(widgetType);
            
            return (
              merged.height === height &&
              merged.colorTheme === defaults.colorTheme &&
              merged.locale === defaults.locale
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性：生成的 HTML 应该包含脚本 URL
     */
    it('generated HTML should contain script URL', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...service.getSupportedWidgets()),
          (widgetType) => {
            const html = service.generateWidgetHtml(widgetType);
            const scriptUrl = service.getScriptUrl(widgetType);
            return html.includes(scriptUrl);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================
  // 配置常量验证
  // ============================================

  describe('Configuration Constants', () => {
    it('TRADINGVIEW_SCRIPTS should have all widget types', () => {
      const expectedTypes: WidgetType[] = [
        'economicCalendar',
        'forexCrossRates',
        'marketQuotes',
        'marketOverview',
        'stockHeatmap',
        'miniChart',
        'topStories',
        'technicalAnalysis',
      ];

      for (const type of expectedTypes) {
        expect(TRADINGVIEW_SCRIPTS[type]).toBeDefined();
      }
    });

    it('WIDGET_CONFIGS should have all widget types', () => {
      const expectedTypes: WidgetType[] = [
        'economicCalendar',
        'forexCrossRates',
        'marketQuotes',
        'marketOverview',
        'stockHeatmap',
        'miniChart',
        'topStories',
        'technicalAnalysis',
      ];

      for (const type of expectedTypes) {
        expect(WIDGET_CONFIGS[type]).toBeDefined();
      }
    });
  });
});
