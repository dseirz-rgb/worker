/**
 * Investment Agent - 投资对话 Agent
 * 
 * 基于 Echo 的 Mastra Agent 架构，实现投资专用 AI 助手。
 * 从 packages/riskcontrol/src/services/aiService.ts 移植核心逻辑。
 * 
 * 特性：
 * - "Investment Mirror" 人格 - 严厉但负责任的投资教练
 * - 集成 Context Builder 和 Adaptive RAG
 * - 支持流式对话
 * - 引用追踪
 * 
 * @module services/echo-server/aiServer/investment/investmentAgent
 */

import { Agent, Mastra } from '@mastra/core';
import { AiModelFactory } from '../aiModelFactory';
import { getInvestmentContext } from './adaptiveRagService';
import { getUserProfile, saveMessage, getMessages, saveAnalysis, getStockPositions, getDashboardSnapshot } from '../../lib/investmentDb';
import { MultiAgentOrchestrator, createOrchestrator } from './orchestrator';
import { createPositionAnalystAgent, createRiskAnalystAgent, createMarketAnalystAgent, createAdvisorAgent } from './agents';
import type {
  ChatRequest,
  ChatResponse,
  Citation,
  DailyInsight,
  RiskLevel,
  RiskReport,
} from './types';

// ============================================================================
// 常量
// ============================================================================

/** Agent 名称 */
const AGENT_NAME = 'investment-mirror';

/** Agent 显示名称 */
const AGENT_DISPLAY_NAME = 'Investment Mirror';

/** Agent 人格描述 */
const AGENT_PERSONA = `我是你的私人投资伙伴 (PIP - Personalized Investment Partner)。
我的角色是作为一个批判性的、数据驱动的辩论伙伴，帮助你做出更好的投资决策。
我会挑战你的假设，指出风险，但始终以你的最佳利益为出发点。`;

/**
 * 清理 AI 响应中的思考标签和多余空白
 * Gemini 有时会泄露 <think_never_used_...> 标签
 */
function cleanAIResponse(text: string): string {
  if (!text) return text;
  
  // 移除 Gemini 思考标签及其内容
  let cleaned = text.replace(/<think_never_used_[^>]*>[\s\S]*?<\/think_never_used_[^>]*>/g, '');
  
  // 移除未闭合的思考标签
  cleaned = cleaned.replace(/<\/?think_never_used_[^>]*>/g, '');
  
  // 移除连续的空行（保留最多2个换行）
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // 移除末尾多余的空白
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * 构建 System Prompt
 */
function buildSystemPrompt(userProfile: string, context: string): string {
  return `You are "Investment Mirror" (PIP - Personalized Investment Partner).
Your role is to act as a critical, data-driven, and debating partner for the user's investment decisions.

### 👤 USER PROFILE
${userProfile}

### 📊 CONTEXT DATA (Real-time Portfolio & Notes)
${context}

### 🎯 INSTRUCTIONS
1. **Debate & Challenge**: Do not just agree. Challenge the user's assumptions based on their profile and the data. If they are taking risks that contradict their profile, point it out.
2. **Data-Driven**: Always backup your arguments with the provided portfolio data or notes.
3. **Citation Format**: You MUST use inline citations when referencing notes or books. Format: \`[Title-Part X]\` or \`[Book Title]\`.
4. **Markdown**: Use bolding for key figures and headers for structure.
5. **Responsiveness**: Be concise and to the point. Avoid long preambles. Start directly with the analysis.
6. **Language**: Respond in Chinese unless the user asks in English.

### 🚫 CONSTRAINTS
- Do not give specific financial advice (e.g., "Buy AAPL now"). Instead, analyze the *implications* of buying AAPL.
- Keep responses under 500 words unless asked for a detailed report.
- Never fabricate data. If information is not available, say so.`;
}

/**
 * 每日洞察 System Prompt
 */
const DAILY_INSIGHT_PROMPT = `你是一位专业的私人投资顾问 (Investment Mirror)。
请基于用户的完整投资组合上下文，生成一条"今日每日洞察 (Daily Insight)"。

要求：
1. **针对性强**：必须结合用户当前的具体持仓风险或最近的交易行为。
2. **结合笔记**：如果用户的行为与其笔记中的原则有冲突或一致，请明确指出。
3. **简短有力**：不超过 100 字。
4. **拒绝空洞**：不要说"注意风险"这种废话，要说具体的问题和建议。
5. **语气**：像一个严厉但负责任的教练。

请直接输出内容，不要带 Markdown 标题或引号。`;

// ============================================================================
// Investment Agent 类
// ============================================================================

/**
 * Investment Agent - 投资对话 Agent
 */
export class InvestmentAgent {
  private mastra: Mastra | null = null;
  private agent: Agent | null = null;
  private initialized = false;

  /**
   * 初始化 Agent
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const provider = await AiModelFactory.GetProvider();
      if (!provider.LLM) {
        throw new Error('LLM provider not available');
      }

      this.agent = new Agent({
        name: AGENT_NAME,
        instructions: AGENT_PERSONA,
        model: provider.LLM,
      });

      this.mastra = new Mastra({
        agents: { [AGENT_NAME]: this.agent },
      });

      this.initialized = true;
      console.log('[InvestmentAgent] Initialized successfully');
    } catch (error) {
      console.error('[InvestmentAgent] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * 确保 Agent 已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }


  /**
   * 发送消息并获取响应
   */
  async chat(request: ChatRequest, accountId: number = 1): Promise<ChatResponse> {
    await this.ensureInitialized();

    const { conversationId, message, contextType = 'general', includeContext = true } = request;

    // 获取或创建对话
    let convId = conversationId;
    if (!convId) {
      const { createConversation } = await import('../../lib/investmentDb');
      const conv = await createConversation(accountId, message.slice(0, 50));
      if (!conv) throw new Error('Failed to create conversation');
      convId = conv.id;
    }

    // 保存用户消息
    const userMsg = await saveMessage({
      conversation_id: convId,
      role: 'user',
      content: message,
    });

    // 构建上下文
    let context = '';
    let citations: Citation[] = [];

    if (includeContext) {
      const ragResult = await getInvestmentContext(message);
      context = ragResult.text;
      citations = ragResult.citations;
    }

    // 获取用户档案
    const profile = await getUserProfile(accountId);
    const userProfile = profile?.content || '暂无详细档案';

    // 构建系统提示
    const systemPrompt = buildSystemPrompt(userProfile, context);

    // 获取历史消息
    const historyMessages = await getMessages(convId);
    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...historyMessages.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // 调用 Agent
    const agent = this.mastra!.getAgent(AGENT_NAME);
    const response = await agent.generate(messages);

    const responseText = cleanAIResponse(response.text || '抱歉，我无法生成回答。');

    // 保存 AI 响应
    const assistantMsg = await saveMessage({
      conversation_id: convId,
      role: 'assistant',
      content: responseText,
      citations,
    });

    return {
      message: responseText,
      citations,
      conversationId: convId,
      messageId: assistantMsg?.id || 0,
    };
  }

  /**
   * 流式对话
   */
  async *streamChat(
    request: ChatRequest,
    accountId: number = 1
  ): AsyncGenerator<string, ChatResponse, undefined> {
    await this.ensureInitialized();

    const { conversationId, message, contextType = 'general', includeContext = true } = request;

    // 获取或创建对话
    let convId = conversationId;
    if (!convId) {
      const { createConversation } = await import('../../lib/investmentDb');
      const conv = await createConversation(accountId, message.slice(0, 50));
      if (!conv) throw new Error('Failed to create conversation');
      convId = conv.id;
    }

    // 保存用户消息
    await saveMessage({
      conversation_id: convId,
      role: 'user',
      content: message,
    });

    // 构建上下文
    let context = '';
    let citations: Citation[] = [];

    if (includeContext) {
      const ragResult = await getInvestmentContext(message);
      context = ragResult.text;
      citations = ragResult.citations;
    }

    // 获取用户档案
    const profile = await getUserProfile(accountId);
    const userProfile = profile?.content || '暂无详细档案';

    // 构建系统提示
    const systemPrompt = buildSystemPrompt(userProfile, context);

    // 获取历史消息
    const historyMessages = await getMessages(convId);
    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...historyMessages.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // 流式调用 Agent
    const agent = this.mastra!.getAgent(AGENT_NAME);
    const stream = await agent.stream(messages);

    let fullText = '';
    for await (const chunk of stream.textStream) {
      fullText += chunk;
      yield chunk;
    }

    // 清理完整响应
    fullText = cleanAIResponse(fullText);

    // 保存 AI 响应
    const assistantMsg = await saveMessage({
      conversation_id: convId,
      role: 'assistant',
      content: fullText,
      citations,
    });

    return {
      message: fullText,
      citations,
      conversationId: convId,
      messageId: assistantMsg?.id || 0,
    };
  }


  /**
   * 生成每日洞察
   */
  async generateDailyInsight(accountId: number = 1): Promise<DailyInsight> {
    await this.ensureInitialized();

    try {
      // 获取完整上下文
      const ragResult = await getInvestmentContext('当前市场风险与我的投资原则');
      const context = ragResult.text;

      // 构建提示
      const prompt = `${DAILY_INSIGHT_PROMPT}

### 📊 完整上下文数据
${context}

请直接输出洞察内容（不超过100字）：`;

      // 调用 Agent
      const agent = this.mastra!.getAgent(AGENT_NAME);
      const response = await agent.generate([
        { role: 'user', content: prompt },
      ]);

      const content = cleanAIResponse(response.text?.slice(0, 100) || '保持耐心，市场总是奖励有纪律的投资者。');

      // 简单的风险等级判断
      let riskLevel: RiskLevel = 'LOW';
      if (content.includes('警告') || content.includes('风险') || content.includes('注意')) {
        riskLevel = 'MEDIUM';
      }
      if (content.includes('严重') || content.includes('危险') || content.includes('立即')) {
        riskLevel = 'HIGH';
      }

      return {
        date: new Date().toISOString().split('T')[0],
        content,
        riskLevel,
      };
    } catch (error) {
      console.error('[InvestmentAgent] generateDailyInsight failed:', error);
      return {
        date: new Date().toISOString().split('T')[0],
        content: '保持耐心，市场总是奖励有纪律的投资者。',
        riskLevel: 'LOW',
      };
    }
  }

  /**
   * 生成风控研报
   * 
   * 使用 Multi-Agent Orchestrator 的 Sequential 模式
   * 返回结构化 JSON 报告
   * 
   * **Validates: Requirements 7.1, 7.2, 7.3**
   */
  async generateRiskReport(accountId: number = 1): Promise<RiskReport> {
    await this.ensureInitialized();

    try {
      // 获取投资组合数据
      const positions = await getStockPositions(accountId);
      const snapshot = await getDashboardSnapshot(accountId);

      // 构建 PortfolioState
      const portfolioState = {
        positions: positions.map(p => ({
          ticker: p.ticker,
          weight: p.weight_percent || 0,
          marketValue: p.market_value_cny || 0,
          costBasis: p.avg_cost || 0,
          unrealizedPnL: p.unrealized_pnl_cny || 0,
          market: p.market || 'US',
          sector: undefined,
        })),
        totalValue: snapshot?.net_worth_cny || 0,
        cashBalance: snapshot?.cash_total_cny || 0,
        marginLoan: snapshot?.margin_loan_cny || 0,
        highWaterMark: snapshot?.high_water_mark || snapshot?.net_worth_cny || 0,
        timestamp: Date.now(),
      };

      // 创建 Orchestrator 并注册 Agents
      const orchestrator = createOrchestrator({ mode: 'sequential' });
      orchestrator.registerAgent(createPositionAnalystAgent());
      orchestrator.registerAgent(createRiskAnalystAgent());
      orchestrator.registerAgent(createMarketAnalystAgent());
      orchestrator.registerAgent(createAdvisorAgent());

      // 执行分析
      const result = await orchestrator.execute(portfolioState, {
        query: '请对我的投资组合进行全面风险分析',
        mode: 'sequential',
        accountId,
      });

      // 构建报告
      const report: RiskReport = {
        title: result.finalReport.title,
        riskLevel: result.finalReport.riskLevel,
        summary: result.finalReport.summary,
        content: result.finalReport.content,
        recommendation: result.finalReport.recommendation,
        actionPlan: result.finalReport.actionPlan,
        primaryTicker: result.finalReport.primaryTicker,
        portfolioSnapshot: {
          totalValue: portfolioState.totalValue,
          positionCount: portfolioState.positions.length,
          cashRatio: snapshot?.cash_ratio || 0,
          drawdownPercent: snapshot?.drawdown_percent || 0,
        },
      };

      // 持久化到 ai_analyses 表
      await saveAnalysis({
        user_id: accountId,
        title: report.title,
        risk_level: report.riskLevel,
        summary: report.summary,
        content: report.content,
        recommendation: report.recommendation,
        action_plan: report.actionPlan,
        primary_ticker: report.primaryTicker,
        portfolio_snapshot: report.portfolioSnapshot,
      });

      return report;
    } catch (error) {
      console.error('[InvestmentAgent] generateRiskReport failed:', error);
      
      // 返回降级报告
      return {
        title: '风险分析报告生成失败',
        riskLevel: 'MEDIUM',
        summary: `报告生成过程中发生错误: ${(error as Error).message}`,
        content: '请稍后重试或联系支持。',
        recommendation: 'HOLD',
        actionPlan: '1. 检查数据连接\n2. 稍后重试',
        primaryTicker: '',
        portfolioSnapshot: {},
      };
    }
  }

  /**
   * 获取 Agent 配置
   */
  getConfig() {
    return {
      name: AGENT_NAME,
      displayName: AGENT_DISPLAY_NAME,
      persona: AGENT_PERSONA,
    };
  }
}

// ============================================================================
// 导出
// ============================================================================

/** 默认 Agent 实例 */
export const investmentAgent = new InvestmentAgent();

/** 便捷函数 */
export async function chat(request: ChatRequest, accountId?: number): Promise<ChatResponse> {
  return investmentAgent.chat(request, accountId);
}

export async function* streamChat(
  request: ChatRequest,
  accountId?: number
): AsyncGenerator<string, ChatResponse, undefined> {
  return yield* investmentAgent.streamChat(request, accountId);
}

export async function generateDailyInsight(accountId?: number): Promise<DailyInsight> {
  return investmentAgent.generateDailyInsight(accountId);
}

export async function generateRiskReport(accountId?: number): Promise<RiskReport> {
  return investmentAgent.generateRiskReport(accountId);
}

export default investmentAgent;
