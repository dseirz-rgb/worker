/**
 * Resend 邮件服务集成
 * 
 * 用于发送风险警报和每日报告邮件
 * - 支持 mock 模式用于测试
 * - 模板化邮件内容
 * 
 * **Validates: Requirements 38.1, 38.2**
 * 
 * @module @echoai/shared/integrations/resend
 */

// ============================================
// 类型定义
// ============================================

export interface ResendConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
  useMock?: boolean;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  tags?: { name: string; value: string }[];
}

export interface EmailResult {
  id: string;
  success: boolean;
  message?: string;
}

export interface RiskAlertEmailData {
  alertType: 'drawdown' | 'leverage' | 'sentiment' | 'circuit_breaker' | 'emotion';
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
  recommendations?: string[];
}

export interface DailyReportEmailData {
  date: Date;
  portfolioValue: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  topGainers: { ticker: string; change: number }[];
  topLosers: { ticker: string; change: number }[];
  riskMetrics: {
    leverage: number;
    drawdown: number;
    volatility: number;
  };
  alerts: string[];
}

// ============================================
// Mock 数据
// ============================================

const mockSentEmails: { options: EmailOptions; sentAt: Date }[] = [];

// ============================================
// Resend 服务
// ============================================

export class ResendService {
  private config: ResendConfig;
  private apiBaseUrl = 'https://api.resend.com';

  constructor(config: ResendConfig) {
    this.config = {
      fromName: 'RiskControl',
      useMock: false,
      ...config,
    };
  }

  /**
   * 发送邮件
   * **Validates: Requirements 38.1**
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    if (this.config.useMock) {
      return this.mockSendEmail(options);
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${this.config.fromName} <${this.config.fromEmail}>`,
          to: Array.isArray(options.to) ? options.to : [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
          reply_to: options.replyTo,
          cc: options.cc,
          bcc: options.bcc,
          tags: options.tags,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new ResendError('SEND_FAILED', error.message || 'Failed to send email');
      }

      const result = await response.json();
      return {
        id: result.id,
        success: true,
      };
    } catch (error) {
      if (error instanceof ResendError) throw error;
      throw new ResendError('SEND_FAILED', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * 发送风险警报邮件
   * **Validates: Requirements 38.2**
   */
  async sendRiskAlert(to: string, data: RiskAlertEmailData): Promise<EmailResult> {
    const html = this.buildRiskAlertHtml(data);
    const subject = `[${data.severity.toUpperCase()}] ${data.title}`;

    return this.sendEmail({
      to,
      subject,
      html,
      tags: [
        { name: 'type', value: 'risk_alert' },
        { name: 'alert_type', value: data.alertType },
        { name: 'severity', value: data.severity },
      ],
    });
  }

  /**
   * 发送每日报告邮件
   * **Validates: Requirements 38.2**
   */
  async sendDailyReport(to: string, data: DailyReportEmailData): Promise<EmailResult> {
    const html = this.buildDailyReportHtml(data);
    const dateStr = data.date.toISOString().split('T')[0];
    const subject = `📊 每日投资报告 - ${dateStr}`;

    return this.sendEmail({
      to,
      subject,
      html,
      tags: [
        { name: 'type', value: 'daily_report' },
        { name: 'date', value: dateStr },
      ],
    });
  }

  /**
   * 检查服务是否可用
   */
  async healthCheck(): Promise<{ available: boolean; message: string }> {
    if (this.config.useMock) {
      return { available: true, message: 'Mock mode enabled' };
    }

    if (!this.config.apiKey) {
      return { available: false, message: 'Missing Resend API key' };
    }

    try {
      // 验证 API key
      const response = await fetch(`${this.apiBaseUrl}/domains`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });

      if (response.ok) {
        return { available: true, message: 'Resend connection successful' };
      } else {
        return { available: false, message: `Resend API error: ${response.status}` };
      }
    } catch (error) {
      return { 
        available: false, 
        message: `Resend connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * 是否使用 Mock 模式
   */
  isMockMode(): boolean {
    return this.config.useMock ?? false;
  }

  /**
   * 获取 Mock 模式下发送的邮件（用于测试）
   */
  getMockSentEmails(): { options: EmailOptions; sentAt: Date }[] {
    return [...mockSentEmails];
  }

  /**
   * 清除 Mock 邮件记录
   */
  clearMockEmails(): void {
    mockSentEmails.length = 0;
  }

  // ============================================
  // 私有方法
  // ============================================

  private mockSendEmail(options: EmailOptions): EmailResult {
    mockSentEmails.push({ options, sentAt: new Date() });
    return {
      id: `mock_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      success: true,
      message: 'Email sent (mock mode)',
    };
  }

  private buildRiskAlertHtml(data: RiskAlertEmailData): string {
    const severityColor = data.severity === 'critical' ? '#dc2626' : '#f59e0b';
    const severityEmoji = data.severity === 'critical' ? '🚨' : '⚠️';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${severityColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .recommendations { background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 15px; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${severityEmoji} ${data.title}</h1>
    </div>
    <div class="content">
      <p>${data.description}</p>
      <div class="metric">
        <span>当前值</span>
        <strong>${data.currentValue.toFixed(2)}</strong>
      </div>
      <div class="metric">
        <span>阈值</span>
        <strong>${data.threshold.toFixed(2)}</strong>
      </div>
      <div class="metric">
        <span>触发时间</span>
        <strong>${data.timestamp.toLocaleString('zh-CN')}</strong>
      </div>
      ${data.recommendations?.length ? `
      <div class="recommendations">
        <strong>建议操作：</strong>
        <ul>
          ${data.recommendations.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>
    <div class="footer">
      <p>此邮件由 RiskControl 风控系统自动发送</p>
    </div>
  </div>
</body>
</html>`;
  }

  private buildDailyReportHtml(data: DailyReportEmailData): string {
    const pnlColor = data.dailyPnL >= 0 ? '#16a34a' : '#dc2626';
    const pnlSign = data.dailyPnL >= 0 ? '+' : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
    .summary-item { background: white; padding: 15px; border-radius: 8px; text-align: center; }
    .summary-value { font-size: 24px; font-weight: bold; }
    .section { margin-top: 20px; }
    .section-title { font-weight: bold; margin-bottom: 10px; }
    .stock-list { display: flex; flex-wrap: wrap; gap: 10px; }
    .stock-item { background: white; padding: 8px 12px; border-radius: 4px; }
    .positive { color: #16a34a; }
    .negative { color: #dc2626; }
    .alerts { background: #fef3c7; padding: 15px; border-radius: 8px; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 每日投资报告</h1>
      <p>${data.date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    <div class="content">
      <div class="summary">
        <div class="summary-item">
          <div>投资组合价值</div>
          <div class="summary-value">$${data.portfolioValue.toLocaleString()}</div>
        </div>
        <div class="summary-item">
          <div>今日盈亏</div>
          <div class="summary-value" style="color: ${pnlColor}">
            ${pnlSign}$${Math.abs(data.dailyPnL).toLocaleString()} (${pnlSign}${data.dailyPnLPercent.toFixed(2)}%)
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">📈 今日涨幅前三</div>
        <div class="stock-list">
          ${data.topGainers.map(s => `
            <div class="stock-item">
              <strong>${s.ticker}</strong>
              <span class="positive">+${s.change.toFixed(2)}%</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="section">
        <div class="section-title">📉 今日跌幅前三</div>
        <div class="stock-list">
          ${data.topLosers.map(s => `
            <div class="stock-item">
              <strong>${s.ticker}</strong>
              <span class="negative">${s.change.toFixed(2)}%</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="section">
        <div class="section-title">⚡ 风险指标</div>
        <div class="summary">
          <div class="summary-item">
            <div>杠杆率</div>
            <div>${data.riskMetrics.leverage.toFixed(2)}x</div>
          </div>
          <div class="summary-item">
            <div>回撤</div>
            <div>${(data.riskMetrics.drawdown * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      ${data.alerts.length ? `
      <div class="section">
        <div class="alerts">
          <div class="section-title">⚠️ 今日警报</div>
          <ul>
            ${data.alerts.map(a => `<li>${a}</li>`).join('')}
          </ul>
        </div>
      </div>
      ` : ''}
    </div>
    <div class="footer">
      <p>此邮件由 RiskControl 风控系统自动发送</p>
    </div>
  </div>
</body>
</html>`;
  }
}

// ============================================
// 错误类
// ============================================

export class ResendError extends Error {
  constructor(
    public code: 'SEND_FAILED' | 'INVALID_CONFIG' | 'RATE_LIMITED',
    message: string
  ) {
    super(message);
    this.name = 'ResendError';
  }
}

// ============================================
// 工厂函数
// ============================================

let resendServiceInstance: ResendService | null = null;

export function initResendService(config: ResendConfig): ResendService {
  resendServiceInstance = new ResendService(config);
  return resendServiceInstance;
}

export function getResendService(): ResendService | null {
  return resendServiceInstance;
}

/**
 * 从环境变量创建 Resend 服务
 */
export function createResendServiceFromEnv(): ResendService {
  const apiKey = process.env.RESEND_API_KEY || '';
  const useMock = !apiKey;

  return new ResendService({
    apiKey,
    fromEmail: 'alerts@riskcontrol.app',
    fromName: 'RiskControl',
    useMock,
  });
}

export default ResendService;
