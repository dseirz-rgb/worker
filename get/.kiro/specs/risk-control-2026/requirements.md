# Requirements Document

## Introduction

基于2025年度投资回顾的深度分析，本功能旨在升级风控系统，实现"刚性风控规则"、"利润保护机制"和"交易心理优化"三大核心目标。2025年的数据显示：年度收益+110%，但最大回撤-45.31%，最高杠杆2.47x，连续亏损8天。2026年的核心任务是"活更久"而非"赚更多"。

## Glossary

- **Risk_Control_System**: 风控系统，负责监控和执行所有风险控制规则
- **Leverage_Monitor**: 杠杆监控器，实时追踪杠杆率并触发熔断
- **Drawdown_Monitor**: 回撤监控器，追踪净值回撤并执行止损
- **Trailing_Stop_System**: 移动止盈系统，保护已实现利润
- **Losing_Streak_Monitor**: 连败监控器，追踪连续亏损天数
- **Circuit_Breaker**: 熔断机制，强制暂停交易的自动化系统
- **High_Water_Mark (HWM)**: 历史最高净值水位
- **Monthly_Drawdown**: 月度回撤，当月净值相对月初的跌幅
- **Cooling_Period**: 冷静期，强制停止交易的时间段

## Requirements

### Requirement 1: 杠杆熔断机制

**User Story:** As a trader, I want the system to enforce leverage limits automatically, so that I never exceed dangerous leverage levels that could lead to catastrophic losses.

#### Acceptance Criteria

1. THE Risk_Control_System SHALL display current leverage ratio prominently on the dashboard with color-coded status (green < 1.2x, yellow 1.2-1.5x, red > 1.5x)
2. WHEN leverage ratio exceeds 1.5x, THE Leverage_Monitor SHALL trigger a WARNING alert with audio notification
3. WHEN leverage ratio exceeds 1.8x, THE Leverage_Monitor SHALL trigger a CRITICAL alert and send email notification
4. WHEN leverage ratio exceeds 2.0x, THE Circuit_Breaker SHALL display a full-screen blocking modal requiring manual acknowledgment
5. THE Risk_Control_System SHALL prevent any new BUY or SHORT orders WHEN leverage ratio is above 1.5x
6. WHILE in drawdown period (current NAV < HWM), THE Risk_Control_System SHALL reduce leverage limit to 1.2x
7. THE Risk_Control_System SHALL log all leverage threshold breaches with timestamp, leverage value, and portfolio snapshot

### Requirement 2: 月度回撤控制（净值止损）

**User Story:** As a trader, I want automatic position reduction when monthly drawdown exceeds thresholds, so that I can limit losses and preserve capital.

#### Acceptance Criteria

1. THE Drawdown_Monitor SHALL calculate monthly drawdown as (month_start_NAV - current_NAV) / month_start_NAV * 100
2. WHEN monthly drawdown reaches -10%, THE Risk_Control_System SHALL trigger "半仓警告" and recommend reducing leverage to 1.0x or below
3. WHEN monthly drawdown reaches -15%, THE Circuit_Breaker SHALL trigger "强制冷静期" mode with 3-day trading suspension recommendation
4. IF monthly drawdown reaches -15%, THEN THE Risk_Control_System SHALL display a prominent "冷静期倒计时" banner on all pages
5. THE Risk_Control_System SHALL track and display "距离月度止损线" distance in real-time
6. WHEN a new month begins, THE Drawdown_Monitor SHALL reset monthly drawdown calculation and record month_start_NAV
7. THE Risk_Control_System SHALL maintain historical monthly drawdown records for analysis

### Requirement 3: 高位回撤止盈（Trailing Stop）

**User Story:** As a trader, I want automatic profit protection when NAV drops significantly from all-time high, so that I can lock in gains during bull runs.

#### Acceptance Criteria

1. THE Trailing_Stop_System SHALL track High_Water_Mark (HWM) and display it prominently on dashboard
2. WHEN NAV creates new HWM, THE Trailing_Stop_System SHALL update HWM and display celebration notification
3. THE Trailing_Stop_System SHALL calculate trailing stop level as HWM * (1 - trailing_stop_percent), default 15%
4. WHEN NAV drops below trailing stop level, THE Risk_Control_System SHALL trigger "利润保护警报"
5. THE Risk_Control_System SHALL display "距离止盈线" distance as both percentage and absolute CNY amount
6. IF NAV drops below trailing stop level, THEN THE Risk_Control_System SHALL recommend specific position reduction actions
7. THE Trailing_Stop_System SHALL allow user to configure trailing_stop_percent between 10% and 25%

### Requirement 4: 连败熔断机制

**User Story:** As a trader, I want the system to detect losing streaks and enforce cooling periods, so that I can avoid emotional revenge trading.

#### Acceptance Criteria

1. THE Losing_Streak_Monitor SHALL track consecutive losing days based on daily P&L
2. WHEN consecutive losing days reaches 3, THE Risk_Control_System SHALL trigger "连败警告" with trading pause recommendation
3. WHEN consecutive losing days reaches 5, THE Circuit_Breaker SHALL trigger "强制冷静期" with 1-day trading suspension
4. THE Risk_Control_System SHALL display current losing streak prominently with visual indicator (streak counter)
5. WHEN a profitable day occurs, THE Losing_Streak_Monitor SHALL reset the losing streak counter
6. THE Risk_Control_System SHALL maintain losing streak history and display "历史最长连败" statistic
7. IF in losing streak >= 3 days, THEN THE Risk_Control_System SHALL require confirmation dialog for any new trades

### Requirement 5: 风控仪表盘升级

**User Story:** As a trader, I want a comprehensive risk control dashboard, so that I can monitor all risk metrics at a glance.

#### Acceptance Criteria

1. THE Risk_Control_System SHALL display a dedicated "风控中心" page accessible from main navigation
2. THE Risk_Control_System SHALL show real-time status cards for: 杠杆率, 月度回撤, 距HWM回撤, 连败天数
3. WHEN any risk metric is in WARNING state, THE Risk_Control_System SHALL highlight the card with yellow border
4. WHEN any risk metric is in CRITICAL state, THE Risk_Control_System SHALL highlight the card with red border and pulse animation
5. THE Risk_Control_System SHALL display a "风控规则" panel showing all active rules and their current status
6. THE Risk_Control_System SHALL provide a "风控日志" section showing recent alerts and breaches
7. THE Risk_Control_System SHALL calculate and display "综合风险评分" (0-100) based on all metrics

### Requirement 6: 风控规则配置

**User Story:** As a trader, I want to customize risk control thresholds, so that I can adjust rules based on market conditions and personal risk tolerance.

#### Acceptance Criteria

1. THE Risk_Control_System SHALL provide a settings page for configuring all risk thresholds
2. THE Risk_Control_System SHALL allow configuration of: leverage_warning (default 1.5x), leverage_critical (default 2.0x)
3. THE Risk_Control_System SHALL allow configuration of: monthly_drawdown_warning (default 10%), monthly_drawdown_critical (default 15%)
4. THE Risk_Control_System SHALL allow configuration of: trailing_stop_percent (default 15%)
5. THE Risk_Control_System SHALL allow configuration of: losing_streak_warning (default 3 days), losing_streak_critical (default 5 days)
6. WHEN user saves new thresholds, THE Risk_Control_System SHALL persist them to database and apply immediately
7. THE Risk_Control_System SHALL provide "恢复默认值" button to reset all thresholds to recommended values

### Requirement 7: 季节性风险提醒

**User Story:** As a trader, I want seasonal risk warnings based on historical performance, so that I can be extra cautious during historically weak periods.

#### Acceptance Criteria

1. THE Risk_Control_System SHALL analyze historical monthly returns to identify weak months
2. WHEN entering a historically weak month (e.g., May, November based on 2025 data), THE Risk_Control_System SHALL display "季节性风险提醒"
3. THE Risk_Control_System SHALL recommend reduced position sizes during historically weak periods
4. THE Risk_Control_System SHALL display "历史同期表现" comparison on dashboard
5. IF current month is historically weak AND leverage > 1.2x, THEN THE Risk_Control_System SHALL trigger additional warning

### Requirement 8: 风控报告生成

**User Story:** As a trader, I want periodic risk control reports, so that I can review my risk management performance over time.

#### Acceptance Criteria

1. THE Risk_Control_System SHALL generate weekly risk summary report every Sunday
2. THE Risk_Control_System SHALL generate monthly risk analysis report on the 1st of each month
3. THE Risk_Control_System SHALL include in reports: max leverage reached, max drawdown, rule breaches count, losing streaks
4. THE Risk_Control_System SHALL store reports in database and make them accessible from "风控中心"
5. THE Risk_Control_System SHALL highlight improvements or deteriorations compared to previous period
