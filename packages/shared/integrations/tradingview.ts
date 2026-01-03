/**
 * TradingView Widget 集成服务
 * 
 * 提供 TradingView Widget 配置和脚本管理
 * - 支持多种 Widget 类型
 * - 统一配置管理
 * 
 * **Validates: Requirements 36.1, 36.2**
 * 
 * @module @echoai/shared/integrations/tradingview
 */

// ============================================
// 类型定义
// ============================================

export type WidgetType = 
  | 'economicCalendar'
  | 'forexCrossRates'
  | 'marketQuotes'
  | 'marketOverview'
  | 'stockHeatmap'
  | 'miniChart'
  | 'topStories'
  | 'technicalAnalysis';

export interface TradingViewConfig {
  colorTheme: 'dark' | 'light';
  locale: string;
  isTransparent: boolean;
  width: string | number;
  height: number;
  [key: string]: unknown;
}

export interface WidgetLoadResult {
  success: boolean;
  widgetType: WidgetType;
  error?: string;
}

// ============================================
// TradingView 脚本 URL
// ============================================

export const TRADINGVIEW_SCRIPTS: Record<WidgetType, string> = {
  economicCalendar: 'https://s3.tradingview.com/external-embedding/embed-widget-events.js',
  forexCrossRates: 'https://s3.tradingview.com/external-embedding/embed-widget-forex-cross-rates.js',
  marketQuotes: 'https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js',
  marketOverview: 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js',
  stockHeatmap: 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js',
  miniChart: 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js',
  topStories: 'https://s3.tradingview.com/external-embedding/embed-widget-timeline.js',
  technicalAnalysis: 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js',
};

// ============================================
// 默认配置
// ============================================

const DEFAULT_CONFIG: TradingViewConfig = {
  colorTheme: 'dark',
  locale: 'zh_CN',
  isTransparent: true,
  width: '100%',
  height: 500,
};

export const WIDGET_CONFIGS: Record<WidgetType, TradingViewConfig> = {
  economicCalendar: {
    ...DEFAULT_CONFIG,
    height: 600,
    importanceFilter: '-1,0,1',
    countryFilter: 'us,cn,eu,jp,gb,de,fr,au,ca',
  },
  forexCrossRates: {
    ...DEFAULT_CONFIG,
    height: 400,
    currencies: ['EUR', 'USD', 'JPY', 'GBP', 'CNY', 'AUD', 'CAD'],
  },
  marketQuotes: {
    ...DEFAULT_CONFIG,
    height: 400,
    showSymbolLogo: true,
  },
  marketOverview: {
    ...DEFAULT_CONFIG,
    dateRange: '12M',
    showFloatingTooltip: true,
    showSymbolLogo: true,
    showChart: true,
  },
  stockHeatmap: {
    ...DEFAULT_CONFIG,
    dataSource: 'SPX500',
    blockSize: 'market_cap_basic',
    blockColor: 'change',
    grouping: 'sector',
    hasTopBar: false,
    isZoomEnabled: true,
    hasSymbolTooltip: true,
  },
  miniChart: {
    ...DEFAULT_CONFIG,
    height: 220,
    symbol: 'NASDAQ:AAPL',
    dateRange: '12M',
  },
  topStories: {
    ...DEFAULT_CONFIG,
    displayMode: 'regular',
    feedMode: 'market',
    market: 'stock',
  },
  technicalAnalysis: {
    ...DEFAULT_CONFIG,
    height: 450,
    symbol: 'NASDAQ:AAPL',
    interval: '1D',
    showIntervalTabs: true,
  },
};

// ============================================
// TradingView 服务
// ============================================

export class TradingViewService {
  private loadedScripts: Set<string> = new Set();
  private loadingPromises: Map<string, Promise<void>> = new Map();

  /**
   * 获取 Widget 脚本 URL
   * **Validates: Requirements 36.1**
   */
  getScriptUrl(widgetType: WidgetType): string {
    return TRADINGVIEW_SCRIPTS[widgetType];
  }

  /**
   * 获取 Widget 默认配置
   * **Validates: Requirements 36.2**
   */
  getDefaultConfig(widgetType: WidgetType): TradingViewConfig {
    return { ...WIDGET_CONFIGS[widgetType] };
  }

  /**
   * 合并自定义配置
   */
  mergeConfig(widgetType: WidgetType, customConfig?: Partial<TradingViewConfig>): TradingViewConfig {
    return {
      ...WIDGET_CONFIGS[widgetType],
      ...customConfig,
    };
  }

  /**
   * 加载 Widget 脚本（浏览器环境）
   */
  async loadScript(widgetType: WidgetType): Promise<void> {
    const scriptUrl = this.getScriptUrl(widgetType);

    // 已加载
    if (this.loadedScripts.has(scriptUrl)) {
      return;
    }

    // 正在加载
    const existingPromise = this.loadingPromises.get(scriptUrl);
    if (existingPromise) {
      return existingPromise;
    }

    // 开始加载
    const loadPromise = new Promise<void>((resolve, reject) => {
      if (typeof document === 'undefined') {
        // 非浏览器环境
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.onload = () => {
        this.loadedScripts.add(scriptUrl);
        this.loadingPromises.delete(scriptUrl);
        resolve();
      };
      script.onerror = () => {
        this.loadingPromises.delete(scriptUrl);
        reject(new TradingViewError('LOAD_FAILED', `Failed to load script: ${scriptUrl}`));
      };
      document.head.appendChild(script);
    });

    this.loadingPromises.set(scriptUrl, loadPromise);
    return loadPromise;
  }

  /**
   * 检查脚本是否已加载
   */
  isScriptLoaded(widgetType: WidgetType): boolean {
    return this.loadedScripts.has(this.getScriptUrl(widgetType));
  }

  /**
   * 获取所有支持的 Widget 类型
   */
  getSupportedWidgets(): WidgetType[] {
    return Object.keys(TRADINGVIEW_SCRIPTS) as WidgetType[];
  }

  /**
   * 生成 Widget HTML
   */
  generateWidgetHtml(widgetType: WidgetType, config?: Partial<TradingViewConfig>): string {
    const mergedConfig = this.mergeConfig(widgetType, config);
    const scriptUrl = this.getScriptUrl(widgetType);

    return `
<div class="tradingview-widget-container">
  <div class="tradingview-widget-container__widget"></div>
  <script type="text/javascript" src="${scriptUrl}" async>
    ${JSON.stringify(mergedConfig)}
  </script>
</div>`;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ available: boolean; message: string }> {
    // TradingView 是客户端 Widget，总是可用
    return {
      available: true,
      message: 'TradingView widgets are client-side and always available',
    };
  }
}

// ============================================
// 错误类
// ============================================

export class TradingViewError extends Error {
  constructor(
    public code: 'LOAD_FAILED' | 'INVALID_CONFIG' | 'UNSUPPORTED_WIDGET',
    message: string
  ) {
    super(message);
    this.name = 'TradingViewError';
  }
}

// ============================================
// 工厂函数
// ============================================

let tradingViewServiceInstance: TradingViewService | null = null;

export function getTradingViewService(): TradingViewService {
  if (!tradingViewServiceInstance) {
    tradingViewServiceInstance = new TradingViewService();
  }
  return tradingViewServiceInstance;
}

export default TradingViewService;
