# 金融数据 Schema 定义

> 本文档定义了项目中所有金融数据的结构，包括交易记录、持仓数据、风险指标等。

## 目录

1. [交易数据 Schema](#交易数据-schema)
2. [持仓数据 Schema](#持仓数据-schema)
3. [风险指标 Schema](#风险指标-schema)
4. [驾驶舱快照 Schema](#驾驶舱快照-schema)
5. [辅助数据 Schema](#辅助数据-schema)

---

## 交易数据 Schema

### Transaction（交易记录）

**数据库表名**: `transactions`

**TypeScript 接口**:
```typescript
interface Transaction {
  id: string;              // UUID, 主键
  date: string;            // 交易日期 (YYYY-MM-DD)
  ticker: string;          // 股票代码
  name: string;            // 股票名称
  market: Market;          // 市场 (US/HK/CN)
  currency: Currency;      // 币种 (USD/HKD/CNY)
  action: Action;          // 交易动作
  price: number;           // 成交价格
  quantity: number;        // 成交数量
  amount: number;          // 交易金额（原币种）
  amountCNY: number;       // 交易金额（CNY）
  fee: number;             // 手续费
  strategyNote: string;    // 交易策略/理由
  isPlanned: boolean;      // 是否为计划内交易
  watchlistDays?: number;  // 观察天数
  followedAIAdvice?: boolean; // 是否遵循 AI 建议
  aiRecommendation?: string;  // 当时的 AI 建议
  createdAt: string;       // 创建时间
}
```

**交易动作枚举**:
```typescript
enum Action {
  BUY = 'BUY',           // 买入
  SELL = 'SELL',         // 卖出
  SHORT = 'SHORT',       // 做空
  COVER = 'COVER',       // 平空
  DEPOSIT = 'DEPOSIT',   // 入金
  WITHDRAW = 'WITHDRAW', // 出金
  SYNC_BALANCE = 'SYNC_BALANCE' // 同步余额
}
```

**Drizzle Schema**:
```typescript
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull(),
  ticker: varchar("ticker", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }),
  market: varchar("market", { length: 2 }),
  currency: varchar("currency", { length: 3 }),
  action: varchar("action", { length: 20 }).notNull(),
  price: decimal("price", { precision: 15, scale: 4 }),
  quantity: integer("quantity").notNull().default(0),
  amount: decimal("amount", { precision: 15, scale: 2 }),
  amountCny: decimal("amount_cny", { precision: 15, scale: 2 }),
  fee: decimal("fee", { precision: 15, scale: 2 }).default("0"),
  strategyNote: text("strategy_note"),
  isPlanned: boolean("is_planned").default(false),
  watchlistDays: integer("watchlist_days"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

**字段说明**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | UUID | ✅ | 自动生成的唯一标识 |
| date | DATE | ✅ | 交易日期，格式 YYYY-MM-DD |
| ticker | VARCHAR(20) | ✅ | 股票代码，如 AAPL, 00700 |
| name | VARCHAR(255) | ❌ | 股票名称 |
| market | VARCHAR(2) | ❌ | 市场代码：US/HK/CN |
| currency | VARCHAR(3) | ❌ | 币种：USD/HKD/CNY |
| action | VARCHAR(20) | ✅ | 交易动作 |
| price | DECIMAL(15,4) | ❌ | 成交价格 |
| quantity | INTEGER | ✅ | 成交数量（正数） |
| amount | DECIMAL(15,2) | ❌ | 交易金额 = price × quantity |
| amount_cny | DECIMAL(15,2) | ❌ | CNY 金额 |
| fee | DECIMAL(15,2) | ❌ | 手续费，默认 0 |
| strategy_note | TEXT | ❌ | 交易策略说明 |
| is_planned | BOOLEAN | ❌ | 是否计划内交易，默认 false |

---

## 持仓数据 Schema

### StockPosition（股票持仓）

**数据库表名**: `stock_positions`

**TypeScript 接口**:
```typescript
interface StockPosition {
  id: number;                    // 主键
  snapshotDate: string;          // 快照日期
  ticker: string;                // 股票代码
  name: string;                  // 股票名称
  market: string;                // 市场
  currency: string;              // 币种
  quantity: number;              // 持仓数量
  avgCost: number;               // 平均成本
  currentPrice: number;          // 当前价格
  marketValue: number;           // 市值（原币种）
  unrealizedPnl: number;         // 未实现盈亏
  unrealizedPnlPercent: number;  // 未实现盈亏百分比
  marketValueCny: number;        // 市值（CNY）
  unrealizedPnlCny: number;      // 未实现盈亏（CNY）
  positionType: string;          // 持仓类型 (LONG/SHORT)
  weightPercent: number;         // 占比
  stopLossPrice?: number;        // 止损价
  stopLossTriggered: boolean;    // 是否触发止损
  createdAt: string;
  updatedAt: string;
}
```

**Drizzle Schema**:
```typescript
export const stockPositions = pgTable("stock_positions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  snapshotDate: date("snapshot_date").notNull(),
  ticker: varchar("ticker", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }),
  market: varchar("market", { length: 10 }),
  currency: varchar("currency", { length: 3 }),
  quantity: integer("quantity").notNull(),
  avgCost: decimal("avg_cost", { precision: 15, scale: 4 }),
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  marketValue: decimal("market_value", { precision: 15, scale: 2 }),
  unrealizedPnl: decimal("unrealized_pnl", { precision: 15, scale: 2 }),
  unrealizedPnlPercent: decimal("unrealized_pnl_percent", { precision: 10, scale: 4 }),
  marketValueCny: decimal("market_value_cny", { precision: 15, scale: 2 }),
  unrealizedPnlCny: decimal("unrealized_pnl_cny", { precision: 15, scale: 2 }),
  positionType: varchar("position_type", { length: 10 }),
  weightPercent: decimal("weight_percent", { precision: 5, scale: 2 }),
  stopLossPrice: decimal("stop_loss_price", { precision: 15, scale: 4 }),
  stopLossTriggered: boolean("stop_loss_triggered").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

### OptionPosition（期权持仓）

**数据库表名**: `option_positions`

**TypeScript 接口**:
```typescript
interface OptionPosition {
  id: number;
  snapshotDate: string;
  symbol: string;              // 期权代码
  underlyingTicker: string;    // 标的股票
  underlyingName: string;      // 标的名称
  optionType: string;          // CALL/PUT
  strikePrice: number;         // 行权价
  expiryDate: string;          // 到期日
  multiplier: number;          // 合约乘数（默认 100）
  market: string;
  currency: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  marketValueCny: number;
  unrealizedPnlCny: number;
  // Greeks
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  impliedVolatility: number;
  weightPercent: number;
  daysToExpiry: number;
  inTheMoney: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| delta | DECIMAL(10,4) | Delta 值，衡量期权价格对标的价格变化的敏感度 |
| gamma | DECIMAL(10,4) | Gamma 值，Delta 的变化率 |
| theta | DECIMAL(10,4) | Theta 值，时间衰减 |
| vega | DECIMAL(10,4) | Vega 值，对波动率的敏感度 |
| implied_volatility | DECIMAL(10,4) | 隐含波动率 |
| days_to_expiry | INTEGER | 距到期天数 |
| in_the_money | BOOLEAN | 是否价内 |

---

## 风险指标 Schema

### RiskMetrics（风险指标）

**数据库表名**: `risk_metrics`

**TypeScript 接口**:
```typescript
interface RiskMetrics {
  id: number;
  date: string;                    // 计算日期
  
  // VaR 指标
  var1day95: number;               // 1天 95% VaR
  var1day99: number;               // 1天 99% VaR
  var10day95: number;              // 10天 95% VaR
  
  // 回撤指标
  currentDrawdownPercent: number;  // 当前回撤
  maxDrawdownPercent: number;      // 最大回撤
  maxDrawdownDurationDays: number; // 最大回撤持续天数
  
  // 收益指标
  annualizedReturn: number;        // 年化收益率
  annualizedVolatility: number;    // 年化波动率
  sharpeRatio: number;             // 夏普比率
  sortinoRatio: number;            // 索提诺比率
  calmarRatio: number;             // 卡玛比率
  
  // 交易统计
  winRate: number;                 // 胜率
  profitFactor: number;            // 盈亏比
  avgWin: number;                  // 平均盈利
  avgLoss: number;                 // 平均亏损
  
  // 市场相关性
  marketBeta: number;              // 市场 Beta
  correlationSp500: number;        // 与 S&P500 相关性
  
  // 集中度指标
  topPositionConcentration: number; // 最大持仓占比
  top5Concentration: number;        // 前5持仓占比
  herfindahlIndex: number;          // 赫芬达尔指数
  
  calculationPeriodDays: number;   // 计算周期（天）
  createdAt: string;
  updatedAt: string;
}
```

**Drizzle Schema**:
```typescript
export const riskMetrics = pgTable("risk_metrics", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  date: date("date").notNull().unique(),
  
  // VaR
  var1day95: decimal("var_1day_95", { precision: 10, scale: 4 }),
  var1day99: decimal("var_1day_99", { precision: 10, scale: 4 }),
  var10day95: decimal("var_10day_95", { precision: 10, scale: 4 }),
  
  // 回撤
  currentDrawdownPercent: decimal("current_drawdown_percent", { precision: 10, scale: 4 }),
  maxDrawdownPercent: decimal("max_drawdown_percent", { precision: 10, scale: 4 }),
  maxDrawdownDurationDays: integer("max_drawdown_duration_days"),
  
  // 收益
  annualizedReturn: decimal("annualized_return", { precision: 10, scale: 4 }),
  annualizedVolatility: decimal("annualized_volatility", { precision: 10, scale: 4 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 10, scale: 4 }),
  sortinoRatio: decimal("sortino_ratio", { precision: 10, scale: 4 }),
  calmarRatio: decimal("calmar_ratio", { precision: 10, scale: 4 }),
  
  // 交易统计
  winRate: decimal("win_rate", { precision: 10, scale: 4 }),
  profitFactor: decimal("profit_factor", { precision: 10, scale: 4 }),
  avgWin: decimal("avg_win", { precision: 15, scale: 2 }),
  avgLoss: decimal("avg_loss", { precision: 15, scale: 2 }),
  
  // 市场相关性
  marketBeta: decimal("market_beta", { precision: 10, scale: 4 }),
  correlationSp500: decimal("correlation_sp500", { precision: 10, scale: 4 }),
  
  // 集中度
  topPositionConcentration: decimal("top_position_concentration", { precision: 10, scale: 4 }),
  top5Concentration: decimal("top5_concentration", { precision: 10, scale: 4 }),
  herfindahlIndex: decimal("herfindahl_index", { precision: 10, scale: 4 }),
  
  calculationPeriodDays: integer("calculation_period_days").default(365),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

**风险指标计算公式**:

| 指标 | 公式 | 说明 |
|------|------|------|
| VaR (95%) | `percentile(returns, 5%)` | 历史模拟法 |
| 夏普比率 | `(R - Rf) / σ` | R=收益率, Rf=无风险利率, σ=波动率 |
| 索提诺比率 | `(R - Rf) / σd` | σd=下行波动率 |
| 卡玛比率 | `R / MaxDD` | MaxDD=最大回撤 |
| 赫芬达尔指数 | `Σ(wi²)` | wi=各持仓权重 |

---

## 驾驶舱快照 Schema

### DashboardSnapshot（每日驾驶舱快照）

**数据库表名**: `dashboard_snapshots`

**TypeScript 接口**:
```typescript
interface DashboardSnapshot {
  id: number;
  date: string;                  // 快照日期
  
  // 净值数据
  netWorthCny: number;           // 净值（CNY）
  netWorthUsd: number;           // 净值（USD）
  highWaterMark: number;         // 历史高水位
  
  // 回撤数据
  drawdownAmount: number;        // 回撤金额
  drawdownPercent: number;       // 回撤百分比
  
  // 每日盈亏
  dailyPnl: number;              // 日盈亏
  dailyPnlPercent: number;       // 日盈亏百分比
  
  // 现金余额（多币种）
  cashUsd: number;
  cashHkd: number;
  cashCny: number;
  cashTotalCny: number;          // 现金总额（CNY）
  
  // 持仓配置
  longRatio: number;             // 多头占比
  shortRatio: number;            // 空头占比
  cashRatio: number;             // 现金占比
  longValueCny: number;          // 多头市值
  shortValueCny: number;         // 空头市值
  
  // 杠杆数据
  marginLoanUsd: number;         // 保证金贷款（USD）
  marginLoanCny: number;         // 保证金贷款（CNY）
  leverageRatio: number;         // 杠杆率
  
  // 汇率
  usdCnyRate: number;
  hkdCnyRate: number;
  
  // 统计
  totalPositions: number;        // 总持仓数
  winningPositions: number;      // 盈利持仓数
  losingPositions: number;       // 亏损持仓数
  
  dataSource: string;            // 数据来源 (IBKR)
  createdAt: string;
  updatedAt: string;
}
```

---

## 辅助数据 Schema

### Currency（币种）

```typescript
type Currency = 'USD' | 'HKD' | 'CNY';
```

### Market（市场）

```typescript
type Market = 'US' | 'HK' | 'CN';
```

### PositionDirection（持仓方向）

```typescript
type PositionDirection = 'LONG' | 'SHORT';
```

### ExchangeRates（汇率）

```typescript
interface ExchangeRates {
  USD_CNY: number;    // 美元兑人民币
  HKD_CNY: number;    // 港币兑人民币
  timestamp: number;  // 更新时间戳
}
```

### WatchlistItem（观察列表）

**数据库表名**: `watchlist`

```typescript
interface WatchlistItem {
  id: string;              // UUID
  ticker: string;          // 股票代码（唯一）
  name: string;            // 股票名称
  market: Market;
  currency: Currency;
  addedDate: string;       // 添加日期
  targetPrice?: number;    // 目标价
  notes?: string;          // 备注
  currentPrice?: number;   // 当前价格
  changePercent?: number;  // 涨跌幅
  lastPriceUpdate?: string; // 最后价格更新时间
  createdAt: string;
  updatedAt: string;
}
```

---

## 数据关系图

```
┌─────────────────┐     ┌─────────────────┐
│  transactions   │     │ stock_positions │
│  (交易记录)      │     │  (股票持仓)      │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ date            │     │ snapshot_date   │
│ ticker ─────────┼─────┤ ticker          │
│ action          │     │ quantity        │
│ quantity        │     │ avg_cost        │
│ price           │     │ current_price   │
│ ...             │     │ ...             │
└─────────────────┘     └─────────────────┘
         │                      │
         │                      │
         ▼                      ▼
┌─────────────────────────────────────────┐
│         dashboard_snapshots             │
│           (每日快照)                     │
├─────────────────────────────────────────┤
│ id (PK)                                 │
│ date (UNIQUE)                           │
│ net_worth_cny                           │
│ high_water_mark                         │
│ drawdown_percent                        │
│ cash_usd, cash_hkd, cash_cny            │
│ long_ratio, short_ratio, cash_ratio     │
│ ...                                     │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│            risk_metrics                 │
│            (风险指标)                    │
├─────────────────────────────────────────┤
│ id (PK)                                 │
│ date (UNIQUE)                           │
│ var_1day_95, var_1day_99                │
│ max_drawdown_percent                    │
│ sharpe_ratio, sortino_ratio             │
│ win_rate, profit_factor                 │
│ ...                                     │
└─────────────────────────────────────────┘
```

---

## 数据验证规则

### 交易记录验证

```typescript
const transactionValidation = {
  date: {
    required: true,
    format: /^\d{4}-\d{2}-\d{2}$/,
    range: { min: '2020-01-01', max: 'today' }
  },
  ticker: {
    required: true,
    maxLength: 20,
    pattern: /^[A-Z0-9.]+$/
  },
  action: {
    required: true,
    enum: ['BUY', 'SELL', 'SHORT', 'COVER', 'DEPOSIT', 'WITHDRAW']
  },
  quantity: {
    required: true,
    type: 'integer',
    min: 1
  },
  price: {
    required: false,
    type: 'number',
    min: 0
  },
  fee: {
    required: false,
    type: 'number',
    min: 0,
    default: 0
  }
};
```

### 持仓数据验证

```typescript
const positionValidation = {
  snapshotDate: {
    required: true,
    format: /^\d{4}-\d{2}-\d{2}$/
  },
  ticker: {
    required: true,
    maxLength: 20
  },
  quantity: {
    required: true,
    type: 'integer',
    // 可以为负数（空头）
  },
  avgCost: {
    required: false,
    type: 'number',
    min: 0
  },
  currentPrice: {
    required: false,
    type: 'number',
    min: 0
  }
};
```

---

## 索引建议

```sql
-- 交易记录索引
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_ticker ON transactions(ticker);
CREATE INDEX idx_transactions_date_ticker ON transactions(date, ticker);

-- 持仓索引
CREATE INDEX idx_stock_positions_date ON stock_positions(snapshot_date);
CREATE INDEX idx_stock_positions_ticker ON stock_positions(ticker);
CREATE UNIQUE INDEX idx_stock_positions_date_ticker ON stock_positions(snapshot_date, ticker);

-- 快照索引
CREATE UNIQUE INDEX idx_dashboard_snapshots_date ON dashboard_snapshots(date);

-- 风险指标索引
CREATE UNIQUE INDEX idx_risk_metrics_date ON risk_metrics(date);
```

---

## 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0 | 2025-01-01 | 初始版本 |
