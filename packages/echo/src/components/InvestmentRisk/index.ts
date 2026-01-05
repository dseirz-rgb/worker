/**
 * InvestmentRisk 组件导出
 * 
 * 风险管理相关组件，从 RiskControl 移植并转换为 HeroUI。
 */

export { RiskDashboard } from './RiskDashboard';
export type { RiskDashboardProps, RiskDecision, RiskLevel } from './RiskDashboard';

export { RiskAlertPanel } from './RiskAlertPanel';
export type { RiskAlertPanelProps, RiskAlert, AlertSeverity } from './RiskAlertPanel';

export { RiskForecastChart } from './RiskForecastChart';
export type { RiskForecastChartProps, RiskForecast, DrawdownProbability } from './RiskForecastChart';

export { RiskHistoryChart } from './RiskHistoryChart';
export type { RiskHistoryChartProps, DataPoint } from './RiskHistoryChart';

export { RiskConfigPanel } from './RiskConfigPanel';
export type { RiskConfigPanelProps, UserRiskConfig, RiskPreference, NotificationChannel } from './RiskConfigPanel';
