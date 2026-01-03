/**
 * Resend 邮件服务测试
 * 
 * **Validates: Requirements 38.1, 38.2**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  ResendService,
  ResendError,
  initResendService,
  getResendService,
  createResendServiceFromEnv,
  type ResendConfig,
  type RiskAlertEmailData,
  type DailyReportEmailData,
} from './resend';

describe('ResendService', () => {
  let service: ResendService;

  beforeEach(() => {
    service = new ResendService({
      apiKey: 'test-api-key',
      fromEmail: 'test@example.com',
      fromName: 'Test',
      useMock: true,
    });
    service.clearMockEmails();
  });

  // ============================================
  // 基础功能测试
  // ============================================

  describe('Mock Mode', () => {
    /**
     * **Validates: Requirements 38.1**
     */
    it('should send email in mock mode', async () => {
      const result = await service.sendEmail({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      });

      expect(result.success).toBe(true);
      expect(result.id).toContain('mock_');
    });

    it('should identify mock mode correctly', () => {
      expect(service.isMockMode()).toBe(true);

      const realService = new ResendService({
        apiKey: 'key',
        fromEmail: 'from@example.com',
        useMock: false,
      });
      expect(realService.isMockMode()).toBe(false);
    });

    it('should return healthy status in mock mode', async () => {
      const health = await service.healthCheck();
      expect(health.available).toBe(true);
      expect(health.message).toContain('Mock');
    });

    it('should track sent emails in mock mode', async () => {
      await service.sendEmail({
        to: 'test1@example.com',
        subject: 'Test 1',
        text: 'Content 1',
      });

      await service.sendEmail({
        to: 'test2@example.com',
        subject: 'Test 2',
        text: 'Content 2',
      });

      const sentEmails = service.getMockSentEmails();
      expect(sentEmails.length).toBe(2);
      expect(sentEmails[0].options.to).toBe('test1@example.com');
      expect(sentEmails[1].options.to).toBe('test2@example.com');
    });

    it('should clear mock emails', async () => {
      await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Content',
      });

      expect(service.getMockSentEmails().length).toBe(1);
      
      service.clearMockEmails();
      
      expect(service.getMockSentEmails().length).toBe(0);
    });
  });

  // ============================================
  // 风险警报邮件测试
  // ============================================

  describe('sendRiskAlert', () => {
    /**
     * **Validates: Requirements 38.2**
     */
    it('should send risk alert email with correct format', async () => {
      const alertData: RiskAlertEmailData = {
        alertType: 'drawdown',
        severity: 'critical',
        title: '回撤警报',
        description: '投资组合回撤超过阈值',
        currentValue: 18.5,
        threshold: 15,
        timestamp: new Date(),
        recommendations: ['减少仓位', '检查风险敞口'],
      };

      const result = await service.sendRiskAlert('user@example.com', alertData);

      expect(result.success).toBe(true);

      const sentEmails = service.getMockSentEmails();
      expect(sentEmails.length).toBe(1);
      expect(sentEmails[0].options.subject).toContain('CRITICAL');
      expect(sentEmails[0].options.subject).toContain('回撤警报');
      expect(sentEmails[0].options.tags).toContainEqual({ name: 'type', value: 'risk_alert' });
      expect(sentEmails[0].options.tags).toContainEqual({ name: 'alert_type', value: 'drawdown' });
    });

    it('should handle warning severity', async () => {
      const alertData: RiskAlertEmailData = {
        alertType: 'leverage',
        severity: 'warning',
        title: '杠杆警告',
        description: '杠杆率接近阈值',
        currentValue: 2.3,
        threshold: 2.5,
        timestamp: new Date(),
      };

      const result = await service.sendRiskAlert('user@example.com', alertData);

      expect(result.success).toBe(true);

      const sentEmails = service.getMockSentEmails();
      expect(sentEmails[0].options.subject).toContain('WARNING');
    });

    it('should support all alert types', async () => {
      const alertTypes: RiskAlertEmailData['alertType'][] = [
        'drawdown', 'leverage', 'sentiment', 'circuit_breaker', 'emotion'
      ];

      for (const alertType of alertTypes) {
        service.clearMockEmails();
        
        const alertData: RiskAlertEmailData = {
          alertType,
          severity: 'warning',
          title: `${alertType} Alert`,
          description: 'Test description',
          currentValue: 1,
          threshold: 2,
          timestamp: new Date(),
        };

        const result = await service.sendRiskAlert('user@example.com', alertData);
        expect(result.success).toBe(true);

        const sentEmails = service.getMockSentEmails();
        expect(sentEmails[0].options.tags).toContainEqual({ name: 'alert_type', value: alertType });
      }
    });
  });

  // ============================================
  // 每日报告邮件测试
  // ============================================

  describe('sendDailyReport', () => {
    /**
     * **Validates: Requirements 38.2**
     */
    it('should send daily report email with correct format', async () => {
      const reportData: DailyReportEmailData = {
        date: new Date('2026-01-03'),
        portfolioValue: 100000,
        dailyPnL: 1500,
        dailyPnLPercent: 1.52,
        topGainers: [
          { ticker: 'AAPL', change: 3.5 },
          { ticker: 'GOOGL', change: 2.1 },
        ],
        topLosers: [
          { ticker: 'MSFT', change: -1.2 },
          { ticker: 'AMZN', change: -0.8 },
        ],
        riskMetrics: {
          leverage: 1.2,
          drawdown: 0.05,
          volatility: 0.15,
        },
        alerts: ['杠杆率接近阈值'],
      };

      const result = await service.sendDailyReport('user@example.com', reportData);

      expect(result.success).toBe(true);

      const sentEmails = service.getMockSentEmails();
      expect(sentEmails.length).toBe(1);
      expect(sentEmails[0].options.subject).toContain('每日投资报告');
      expect(sentEmails[0].options.subject).toContain('2026-01-03');
      expect(sentEmails[0].options.tags).toContainEqual({ name: 'type', value: 'daily_report' });
    });

    it('should handle negative PnL', async () => {
      const reportData: DailyReportEmailData = {
        date: new Date(),
        portfolioValue: 98000,
        dailyPnL: -2000,
        dailyPnLPercent: -2.0,
        topGainers: [],
        topLosers: [{ ticker: 'TSLA', change: -5.0 }],
        riskMetrics: {
          leverage: 1.0,
          drawdown: 0.08,
          volatility: 0.2,
        },
        alerts: [],
      };

      const result = await service.sendDailyReport('user@example.com', reportData);
      expect(result.success).toBe(true);
    });

    it('should handle empty alerts', async () => {
      const reportData: DailyReportEmailData = {
        date: new Date(),
        portfolioValue: 100000,
        dailyPnL: 500,
        dailyPnLPercent: 0.5,
        topGainers: [{ ticker: 'AAPL', change: 1.0 }],
        topLosers: [],
        riskMetrics: {
          leverage: 0.8,
          drawdown: 0.02,
          volatility: 0.1,
        },
        alerts: [],
      };

      const result = await service.sendDailyReport('user@example.com', reportData);
      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 邮件选项测试
  // ============================================

  describe('Email Options', () => {
    it('should support multiple recipients', async () => {
      const result = await service.sendEmail({
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Multi-recipient test',
        text: 'Content',
      });

      expect(result.success).toBe(true);

      const sentEmails = service.getMockSentEmails();
      expect(sentEmails[0].options.to).toEqual(['user1@example.com', 'user2@example.com']);
    });

    it('should support CC and BCC', async () => {
      const result = await service.sendEmail({
        to: 'main@example.com',
        subject: 'CC/BCC test',
        text: 'Content',
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
      });

      expect(result.success).toBe(true);

      const sentEmails = service.getMockSentEmails();
      expect(sentEmails[0].options.cc).toEqual(['cc@example.com']);
      expect(sentEmails[0].options.bcc).toEqual(['bcc@example.com']);
    });

    it('should support reply-to', async () => {
      const result = await service.sendEmail({
        to: 'user@example.com',
        subject: 'Reply-to test',
        text: 'Content',
        replyTo: 'reply@example.com',
      });

      expect(result.success).toBe(true);

      const sentEmails = service.getMockSentEmails();
      expect(sentEmails[0].options.replyTo).toBe('reply@example.com');
    });

    it('should support tags', async () => {
      const result = await service.sendEmail({
        to: 'user@example.com',
        subject: 'Tags test',
        text: 'Content',
        tags: [
          { name: 'campaign', value: 'test' },
          { name: 'source', value: 'unit-test' },
        ],
      });

      expect(result.success).toBe(true);

      const sentEmails = service.getMockSentEmails();
      expect(sentEmails[0].options.tags).toHaveLength(2);
    });
  });

  // ============================================
  // 错误处理测试
  // ============================================

  describe('Error Handling', () => {
    it('should report unavailable when API key missing', async () => {
      const noKeyService = new ResendService({
        apiKey: '',
        fromEmail: 'from@example.com',
        useMock: false,
      });

      const health = await noKeyService.healthCheck();
      expect(health.available).toBe(false);
      expect(health.message).toContain('Missing');
    });

    it('should create ResendError with correct properties', () => {
      const error = new ResendError('SEND_FAILED', 'Test error');

      expect(error.name).toBe('ResendError');
      expect(error.code).toBe('SEND_FAILED');
      expect(error.message).toBe('Test error');
    });
  });

  // ============================================
  // 工厂函数测试
  // ============================================

  describe('Factory Functions', () => {
    it('should initialize and get service instance', () => {
      const config: ResendConfig = {
        apiKey: 'test',
        fromEmail: 'test@example.com',
        useMock: true,
      };

      const instance = initResendService(config);
      expect(instance).toBeInstanceOf(ResendService);

      const retrieved = getResendService();
      expect(retrieved).toBe(instance);
    });

    it('should create service from env with mock when no API key', () => {
      const originalKey = process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_KEY;

      const envService = createResendServiceFromEnv();
      expect(envService.isMockMode()).toBe(true);

      if (originalKey) process.env.RESEND_API_KEY = originalKey;
    });
  });

  // ============================================
  // 属性测试
  // ============================================

  describe('Property Tests', () => {
    /**
     * **Validates: Requirements 38.1**
     * 属性：发送邮件应该总是返回成功（mock 模式）
     */
    it('mock send should always succeed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 1000 }),
          async (to, subject, content) => {
            service.clearMockEmails();
            const result = await service.sendEmail({
              to,
              subject,
              text: content,
            });
            return result.success === true && result.id.startsWith('mock_');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性：发送的邮件应该被记录
     */
    it('sent emails should be tracked', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (count) => {
            service.clearMockEmails();
            
            for (let i = 0; i < count; i++) {
              await service.sendEmail({
                to: `user${i}@example.com`,
                subject: `Test ${i}`,
                text: 'Content',
              });
            }
            
            return service.getMockSentEmails().length === count;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 38.2**
     * 属性：风险警报邮件主题应该包含严重程度
     */
    it('risk alert subject should contain severity', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('warning', 'critical') as fc.Arbitrary<'warning' | 'critical'>,
          fc.string({ minLength: 1, maxLength: 50 }),
          async (severity, title) => {
            service.clearMockEmails();
            
            const alertData: RiskAlertEmailData = {
              alertType: 'drawdown',
              severity,
              title,
              description: 'Test',
              currentValue: 1,
              threshold: 2,
              timestamp: new Date(),
            };
            
            await service.sendRiskAlert('user@example.com', alertData);
            
            const sentEmails = service.getMockSentEmails();
            const subject = sentEmails[0].options.subject;
            return subject.includes(severity.toUpperCase());
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 属性：每日报告邮件主题应该包含日期
     */
    it('daily report subject should contain date', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          async (date) => {
            service.clearMockEmails();
            
            const reportData: DailyReportEmailData = {
              date,
              portfolioValue: 100000,
              dailyPnL: 0,
              dailyPnLPercent: 0,
              topGainers: [],
              topLosers: [],
              riskMetrics: { leverage: 1, drawdown: 0, volatility: 0 },
              alerts: [],
            };
            
            await service.sendDailyReport('user@example.com', reportData);
            
            const sentEmails = service.getMockSentEmails();
            const subject = sentEmails[0].options.subject;
            const dateStr = date.toISOString().split('T')[0];
            return subject.includes(dateStr);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
