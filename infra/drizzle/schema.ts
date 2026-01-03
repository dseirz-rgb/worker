import { pgTable, serial, text, timestamp, varchar, pgEnum, date, decimal, integer, boolean, jsonb, bigserial, uuid, customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Define a custom vector type since drizzle doesn't support it natively yet in pg-core exports
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(768)";
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

/**
 * Core user table backing auth flow.
 */
export const roleEnum = pgEnum("role", ["user", "admin"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/**
 * 每日驾驶舱快照表 (dashboard_snapshots)
 * 存储每日的完整驾驶舱数据
 */
export const dashboardSnapshots = pgTable("dashboard_snapshots", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  date: date("date").notNull().unique(),
  
  // 净值数据（CNY）
  netWorthCny: decimal("net_worth_cny", { precision: 15, scale: 2 }).notNull(),
  netWorthUsd: decimal("net_worth_usd", { precision: 15, scale: 2 }).notNull(),
  highWaterMark: decimal("high_water_mark", { precision: 15, scale: 2 }).notNull(),
  
  // 回撤数据
  drawdownAmount: decimal("drawdown_amount", { precision: 15, scale: 2 }),
  drawdownPercent: decimal("drawdown_percent", { precision: 10, scale: 4 }),
  
  // 每日盈亏
  dailyPnl: decimal("daily_pnl", { precision: 15, scale: 2 }),
  dailyPnlPercent: decimal("daily_pnl_percent", { precision: 10, scale: 4 }),
  
  // 现金余额
  cashUsd: decimal("cash_usd", { precision: 15, scale: 2 }).default("0"),
  cashHkd: decimal("cash_hkd", { precision: 15, scale: 2 }).default("0"),
  cashCny: decimal("cash_cny", { precision: 15, scale: 2 }).default("0"),
  cashTotalCny: decimal("cash_total_cny", { precision: 15, scale: 2 }).default("0"),
  
  // 持仓配置
  longRatio: decimal("long_ratio", { precision: 5, scale: 2 }),
  shortRatio: decimal("short_ratio", { precision: 5, scale: 2 }),
  cashRatio: decimal("cash_ratio", { precision: 5, scale: 2 }),
  
  // 持仓市值
  longValueCny: decimal("long_value_cny", { precision: 15, scale: 2 }),
  shortValueCny: decimal("short_value_cny", { precision: 15, scale: 2 }),
  
  // 汇率
  usdCnyRate: decimal("usd_cny_rate", { precision: 10, scale: 4 }),
  hkdCnyRate: decimal("hkd_cny_rate", { precision: 10, scale: 4 }),
  
  // 统计数据
  totalPositions: integer("total_positions").default(0),
  winningPositions: integer("winning_positions").default(0),
  losingPositions: integer("losing_positions").default(0),
  
  // 杠杆和债务数据
  marginLoanUsd: decimal("margin_loan_usd", { precision: 15, scale: 2 }).default("0"),
  marginLoanCny: decimal("margin_loan_cny", { precision: 15, scale: 2 }).default("0"),
  leverageRatio: decimal("leverage_ratio", { precision: 10, scale: 4 }).default("1.0"),
  
  // 元数据
  dataSource: varchar("data_source", { length: 20 }).default("IBKR"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * 每日持仓快照 (current_positions / stock_positions)
 * 注意：SQL文件中定义为 current_positions，但 client 代码中引用为 stock_positions。
 * 这里我们映射到数据库实际表名。根据 supabase_dashboard_schema.sql 是 current_positions。
 * 但 supabaseData.ts 中使用 stock_positions。需要确认数据库实际情况。
 * 假设数据库中使用的是 stock_positions (因为 client 代码能跑通)。
 * 如果 client 代码能跑通，说明数据库里确实有 stock_positions。
 * 
 * 修正：根据 LS 结果，supabase_dashboard_schema.sql 定义了 current_positions。
 * 但 supabaseData.ts 查询的是 stock_positions。
 * 这说明数据库可能存在不一致，或者 schema 文件未同步。
 * 考虑到 supabaseData.ts 是实际运行的代码，我们优先定义 stock_positions。
 */
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

/**
 * 期权持仓快照 (option_positions)
 */
export const optionPositions = pgTable("option_positions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  snapshotDate: date("snapshot_date").notNull(),
  
  symbol: varchar("symbol", { length: 50 }).notNull(),
  underlyingTicker: varchar("underlying_ticker", { length: 20 }),
  underlyingName: varchar("underlying_name", { length: 255 }),
  
  optionType: varchar("option_type", { length: 10 }), // CALL/PUT
  strikePrice: decimal("strike_price", { precision: 15, scale: 4 }),
  expiryDate: date("expiry_date"),
  multiplier: integer("multiplier").default(100),
  
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
  
  // Greeks
  delta: decimal("delta", { precision: 10, scale: 4 }),
  gamma: decimal("gamma", { precision: 10, scale: 4 }),
  theta: decimal("theta", { precision: 10, scale: 4 }),
  vega: decimal("vega", { precision: 10, scale: 4 }),
  impliedVolatility: decimal("implied_volatility", { precision: 10, scale: 4 }),
  
  weightPercent: decimal("weight_percent", { precision: 5, scale: 2 }),
  daysToExpiry: integer("days_to_expiry"),
  inTheMoney: boolean("in_the_money").default(false),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * 交易记录表 (transactions)
 * 对应 supabase_user_data_schema.sql
 */
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull(),
  
  ticker: varchar("ticker", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }),
  market: varchar("market", { length: 2 }), // US, HK, CN
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

/**
 * 观察列表表 (watchlist)
 */
export const watchlist = pgTable("watchlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  ticker: varchar("ticker", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  market: varchar("market", { length: 2 }),
  currency: varchar("currency", { length: 3 }),
  
  addedDate: date("added_date").notNull().defaultNow(),
  targetPrice: decimal("target_price", { precision: 15, scale: 4 }),
  notes: text("notes"),
  
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  changePercent: decimal("change_percent", { precision: 10, scale: 4 }),
  lastPriceUpdate: timestamp("last_price_update", { withTimezone: true }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * 用户设置表 (user_settings)
 */
export const userSettings = pgTable("user_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").unique(),
  
  riskLimits: jsonb("risk_limits").default({
    stopLossPercent: -20,
    maxDrawdownPercent: 5,
    positionLimitPercent: 15,
    watchlistCooldownDays: 7,
    positionLimitExceptions: []
  }),
  
  ibkrLastRefresh: timestamp("ibkr_last_refresh", { withTimezone: true }),
  ibkrSyncEnabled: boolean("ibkr_sync_enabled").default(true),
  
  panicLockdown: jsonb("panic_lockdown"),
  
  defaultCurrency: varchar("default_currency", { length: 3 }).default("CNY"),
  theme: varchar("theme", { length: 20 }).default("light"),
  sidebarWidth: integer("sidebar_width").default(280),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * 风险指标表 (risk_metrics)
 */
export const riskMetrics = pgTable("risk_metrics", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  date: date("date").notNull().unique(),
  
  var1day95: decimal("var_1day_95", { precision: 10, scale: 4 }),
  var1day99: decimal("var_1day_99", { precision: 10, scale: 4 }),
  var10day95: decimal("var_10day_95", { precision: 10, scale: 4 }),
  
  currentDrawdownPercent: decimal("current_drawdown_percent", { precision: 10, scale: 4 }),
  maxDrawdownPercent: decimal("max_drawdown_percent", { precision: 10, scale: 4 }),
  maxDrawdownDurationDays: integer("max_drawdown_duration_days"),
  
  annualizedReturn: decimal("annualized_return", { precision: 10, scale: 4 }),
  annualizedVolatility: decimal("annualized_volatility", { precision: 10, scale: 4 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 10, scale: 4 }),
  sortinoRatio: decimal("sortino_ratio", { precision: 10, scale: 4 }),
  calmarRatio: decimal("calmar_ratio", { precision: 10, scale: 4 }),
  
  winRate: decimal("win_rate", { precision: 10, scale: 4 }),
  profitFactor: decimal("profit_factor", { precision: 10, scale: 4 }),
  avgWin: decimal("avg_win", { precision: 15, scale: 2 }),
  avgLoss: decimal("avg_loss", { precision: 15, scale: 2 }),
  
  marketBeta: decimal("market_beta", { precision: 10, scale: 4 }),
  correlationSp500: decimal("correlation_sp500", { precision: 10, scale: 4 }),
  
  topPositionConcentration: decimal("top_position_concentration", { precision: 10, scale: 4 }),
  top5Concentration: decimal("top5_concentration", { precision: 10, scale: 4 }),
  herfindahlIndex: decimal("herfindahl_index", { precision: 10, scale: 4 }),
  
  calculationPeriodDays: integer("calculation_period_days").default(365),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type DashboardSnapshot = typeof dashboardSnapshots.$inferSelect;
export type StockPosition = typeof stockPositions.$inferSelect;
export type OptionPosition = typeof optionPositions.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type WatchlistItem = typeof watchlist.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type RiskMetrics = typeof riskMetrics.$inferSelect;

/**
 * 知识库文档表 (documents)
 * 用于存储 RAG 知识库内容
 */
export const documents = pgTable("documents", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  content: text("content"),
  metadata: jsonb("metadata"),
  embedding: vector("embedding"),
  sourceType: text("source_type"), // 'uploaded_file', 'wechat_article', etc.
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type Document = typeof documents.$inferSelect;


/**
 * AI 分析记录表 (ai_analyses)
 * 存储 AI 生成的分析报告和多 Agent 执行追踪
 */
export const recommendationEnum = pgEnum("recommendation", ["BUY", "SELL", "HOLD", "REBALANCE", "WARNING"]);
export const riskLevelEnum = pgEnum("risk_level", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const orchestrationModeEnum = pgEnum("orchestration_mode", ["sequential", "selector", "handoff", "respond_directly"]);

export const aiAnalyses = pgTable("ai_analyses", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigserial("user_id", { mode: "number" }).notNull(),
  
  // 分析内容
  title: text("title").notNull(),
  content: text("content").notNull(),
  
  // 结构化结论
  recommendation: text("recommendation"),
  primaryTicker: text("primary_ticker"),
  riskLevel: text("risk_level"),
  
  // 上下文快照
  portfolioSnapshot: jsonb("portfolio_snapshot").notNull(),
  marketPriceSnapshot: decimal("market_price_snapshot", { precision: 15, scale: 4 }),
  
  // 事后复盘字段
  reviewStatus7d: text("review_status_7d").default("PENDING"),
  reviewReturn7d: decimal("review_return_7d", { precision: 10, scale: 4 }),
  reviewStatus30d: text("review_status_30d").default("PENDING"),
  reviewReturn30d: decimal("review_return_30d", { precision: 10, scale: 4 }),
  reviewStatus90d: text("review_status_90d").default("PENDING"),
  reviewReturn90d: decimal("review_return_90d", { precision: 10, scale: 4 }),
  
  // Multi-Agent 执行追踪 (新增)
  executionTrace: jsonb("execution_trace"),
  orchestratorState: jsonb("orchestrator_state"),
  orchestrationMode: text("orchestration_mode"),
  agentsUsed: text("agents_used").array(),
  totalExecutionTimeMs: integer("total_execution_time_ms"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type AiAnalysis = typeof aiAnalyses.$inferSelect;
export type NewAiAnalysis = typeof aiAnalyses.$inferInsert;

/**
 * Agent 长期记忆表 (agent_memories)
 * 存储跨会话的 Agent 学习记忆
 */
export const memoryTypeEnum = pgEnum("memory_type", ["insight", "pattern", "decision", "outcome"]);

export const agentMemories = pgTable("agent_memories", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  
  // 记忆标识
  agentId: text("agent_id").notNull(),
  userId: bigserial("user_id", { mode: "number" }).notNull(),
  
  // 记忆内容
  memoryType: text("memory_type").notNull(),
  content: text("content").notNull(),
  context: jsonb("context").default({}),
  
  // 记忆评分和排名
  importance: decimal("importance", { precision: 3, scale: 2 }).default("0.5"),
  
  // 访问追踪
  accessCount: integer("access_count").default(0),
  lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
  
  // 时间戳
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  
  // 关联分析
  sourceAnalysisId: bigserial("source_analysis_id", { mode: "number" }),
});

export type AgentMemory = typeof agentMemories.$inferSelect;
export type NewAgentMemory = typeof agentMemories.$inferInsert;

/**
 * Agent 警报历史表 (agent_alert_history)
 * 存储 AI 触发的风险警报
 */
export const alertTypeEnum = pgEnum("alert_type", ["risk", "market", "position", "advisor"]);
export const alertSeverityEnum = pgEnum("alert_severity", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const agentAlertHistory = pgTable("agent_alert_history", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  
  // 警报标识
  userId: bigserial("user_id", { mode: "number" }).notNull(),
  analysisId: bigserial("analysis_id", { mode: "number" }),
  
  // 警报详情
  alertType: text("alert_type").notNull(),
  severity: text("severity").notNull(),
  
  // 警报内容
  title: text("title").notNull(),
  message: text("message").notNull(),
  agentFindings: jsonb("agent_findings").default({}),
  
  // 通知追踪
  notificationSent: boolean("notification_sent").default(false),
  emailSent: boolean("email_sent").default(false),
  
  // 时间戳
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
});

export type AgentAlertHistory = typeof agentAlertHistory.$inferSelect;
export type NewAgentAlertHistory = typeof agentAlertHistory.$inferInsert;
