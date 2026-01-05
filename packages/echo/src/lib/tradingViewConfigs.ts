/**
 * TradingView Widget 配置常量
 * 
 * 从 RiskControl 迁移，适配 Echo 投资模块
 * TradingView Widget 文档: https://www.tradingview.com/widget/
 */

// ============ TradingView 脚本 URL ============

export const TRADINGVIEW_SCRIPTS = {
  /** 财经日历 Widget */
  economicCalendar: 'https://s3.tradingview.com/external-embedding/embed-widget-events.js',
  /** 外汇交叉汇率 Widget */
  forexCrossRates: 'https://s3.tradingview.com/external-embedding/embed-widget-forex-cross-rates.js',
  /** 市场数据/报价 Widget */
  marketQuotes: 'https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js',
  /** 市场概览 Widget */
  marketOverview: 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js',
  /** 股票热力图 Widget */
  stockHeatmap: 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js',
  /** 迷你图表 Widget */
  miniChart: 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js',
  /** 新闻 Widget */
  topStories: 'https://s3.tradingview.com/external-embedding/embed-widget-timeline.js',
  /** 技术分析 Widget */
  technicalAnalysis: 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js',
} as const;

// ============ 财经日历配置 ============

export const ECONOMIC_CALENDAR_CONFIG = {
  colorTheme: 'dark',
  isTransparent: true,
  width: '100%',
  height: 600,
  locale: 'zh_CN',
  importanceFilter: '-1,0,1',
  countryFilter: 'us,cn,eu,jp,gb,de,fr,au,ca',
};

// ============ 宏观数据配置 ============

export const FOREX_CROSS_RATES_CONFIG = {
  colorTheme: 'dark',
  isTransparent: true,
  width: '100%',
  height: 400,
  locale: 'zh_CN',
  currencies: ['EUR', 'USD', 'JPY', 'GBP', 'CNY', 'AUD', 'CAD'],
};

export const MARKET_OVERVIEW_CONFIG = {
  colorTheme: 'dark',
  dateRange: '12M',
  locale: 'zh_CN',
  isTransparent: true,
  showFloatingTooltip: true,
  plotLineColorGrowing: '#22c55e',
  plotLineColorFalling: '#ef4444',
  gridLineColor: 'rgba(240, 243, 250, 0)',
  scaleFontColor: '#9ca3af',
  belowLineFillColorGrowing: 'rgba(34, 197, 94, 0.12)',
  belowLineFillColorFalling: 'rgba(239, 68, 68, 0.12)',
  belowLineFillColorGrowingBottom: 'rgba(34, 197, 94, 0)',
  belowLineFillColorFallingBottom: 'rgba(239, 68, 68, 0)',
  symbolActiveColor: 'rgba(59, 130, 246, 0.1)',
  tabs: [
    {
      title: '美股指数',
      symbols: [
        { s: 'FOREXCOM:SPXUSD', d: '标普500' },
        { s: 'FOREXCOM:NSXUSD', d: '纳斯达克100' },
        { s: 'FOREXCOM:DJI', d: '道琼斯' },
        { s: 'TVC:VIX', d: 'VIX恐慌指数' },
      ],
    },
    {
      title: '亚太市场',
      symbols: [
        { s: 'HSI', d: '恒生指数' },
        { s: 'SSE:000001', d: '上证指数' },
        { s: 'TSE:NI225', d: '日经225' },
      ],
    },
    {
      title: '外汇',
      symbols: [
        { s: 'FX:EURUSD', d: '欧元/美元' },
        { s: 'FX:USDJPY', d: '美元/日元' },
        { s: 'FX:USDCNH', d: '美元/离岸人民币' },
        { s: 'FX:GBPUSD', d: '英镑/美元' },
      ],
    },
    {
      title: '大宗商品',
      symbols: [
        { s: 'TVC:GOLD', d: '黄金' },
        { s: 'TVC:SILVER', d: '白银' },
        { s: 'TVC:USOIL', d: '原油' },
        { s: 'NYMEX:NG1!', d: '天然气' },
      ],
    },
  ],
  support_host: 'https://www.tradingview.com',
  backgroundColor: 'rgba(10, 11, 15, 0)',
  width: '100%',
  height: 500,
  showSymbolLogo: true,
  showChart: true,
};

export const MACRO_MARKET_QUOTES_CONFIG = {
  title: '宏观指标',
  width: '100%',
  height: 400,
  locale: 'zh_CN',
  showSymbolLogo: true,
  colorTheme: 'dark',
  isTransparent: true,
  symbolsGroups: [
    {
      name: '美国国债',
      symbols: [
        { name: 'TVC:US10Y', displayName: '10年期国债收益率' },
        { name: 'TVC:US02Y', displayName: '2年期国债收益率' },
        { name: 'TVC:US30Y', displayName: '30年期国债收益率' },
      ],
    },
    {
      name: '中国国债',
      symbols: [
        { name: 'TVC:CN10Y', displayName: '中国10年期国债' },
        { name: 'TVC:CN02Y', displayName: '中国2年期国债' },
      ],
    },
    {
      name: '美元指数',
      symbols: [
        { name: 'TVC:DXY', displayName: '美元指数' },
      ],
    },
  ],
};

// ============ 股票热力图配置 ============

export const STOCK_HEATMAP_CONFIG = {
  dataSource: 'SPX500',
  blockSize: 'market_cap_basic',
  blockColor: 'change',
  grouping: 'sector',
  isTransparent: true,
  locale: 'zh_CN',
  symbolUrl: '',
  colorTheme: 'dark',
  exchanges: [],
  hasTopBar: false,
  isDataSetEnabled: false,
  isZoomEnabled: true,
  hasSymbolTooltip: true,
  isMonoSize: false,
  width: '100%',
  height: 500,
};

// ============ 国家/地区选项 ============

export const COUNTRY_OPTIONS = [
  { value: 'us', label: '🇺🇸 美国', code: 'US' },
  { value: 'cn', label: '🇨🇳 中国', code: 'CN' },
  { value: 'eu', label: '🇪🇺 欧元区', code: 'EU' },
  { value: 'jp', label: '🇯🇵 日本', code: 'JP' },
  { value: 'gb', label: '🇬🇧 英国', code: 'GB' },
  { value: 'de', label: '🇩🇪 德国', code: 'DE' },
  { value: 'fr', label: '🇫🇷 法国', code: 'FR' },
  { value: 'au', label: '🇦🇺 澳大利亚', code: 'AU' },
  { value: 'ca', label: '🇨🇦 加拿大', code: 'CA' },
] as const;

// ============ 重要性选项 ============

export const IMPORTANCE_OPTIONS = [
  { value: 'all', label: '全部', filter: '-1,0,1' },
  { value: 'high', label: '🔴 高', filter: '1' },
  { value: 'medium', label: '🟡 中', filter: '0' },
  { value: 'low', label: '🟢 低', filter: '-1' },
] as const;
