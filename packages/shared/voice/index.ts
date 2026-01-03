/**
 * 双 Agent 语音服务 (DualAgentVoiceService)
 * 
 * 管理 Investment Agent 和 Daily Agent 的语音会话
 * - Investment Agent: 投资顾问，访问 RiskControl 数据
 * - Daily Agent: 日常助手，访问 Echo 数据
 * 
 * @module @echoai/shared/voice
 */

// ============================================
// 类型定义
// ============================================

export type AgentType = 'investment' | 'daily';

export interface AgentPersonality {
  name: string;
  voice: string;
  language: string;
  style: 'professional' | 'friendly' | 'casual';
}

export interface AgentConfig {
  type: AgentType;
  systemPrompt: string;
  personality: AgentPersonality;
  knowledgeNamespace: string;
  databaseTarget: 'echo' | 'riskcontrol';
  tools: AgentTool[];
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface VoiceSession {
  id: string;
  roomName: string;
  currentAgent: AgentType;
  participantId: string;
  token: string;
  serverUrl: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface VoiceServiceConfig {
  livekitUrl: string;
  livekitApiKey: string;
  livekitApiSecret: string;
  voiceAgentUrl: string;
  echoApiUrl?: string;
  rcApiUrl?: string;
}

export interface SessionCreateOptions {
  agentType: AgentType;
  participantId: string;
  roomName?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Agent 配置
// ============================================

/**
 * Investment Agent 系统提示词
 * **重要**: 此提示词必须与原 RiskControl 实现保持一致
 * **Validates: Requirements 4.3, 4.9**
 */
export const INVESTMENT_AGENT_PROMPT = `你是一个专业的投资顾问 AI 助手。

你的特点：
- 专业、严谨、有洞察力
- 回答简洁明了，适合语音交互
- 不使用 emoji、markdown 或特殊字符
- 使用中文与用户交流

你可以帮助用户：
- 分析投资组合
- 讨论市场趋势
- 提供风险管理建议
- 解读财务数据
- 评估投资机会

重要原则：
- 不提供具体的买卖建议
- 强调风险意识
- 基于数据和逻辑分析
- 尊重用户的投资决策`;

/**
 * Daily Agent 系统提示词
 */
export const DAILY_AGENT_PROMPT = `你是一个智能日常助手 AI。

你的特点：
- 友好、耐心、乐于助人
- 回答简洁明了，适合语音交互
- 不使用 emoji、markdown 或特殊字符
- 使用中文与用户交流

你可以帮助用户：
- 管理笔记和任务
- 安排日程和提醒
- 回答日常问题
- 提供信息查询
- 进行轻松对话

重要原则：
- 保护用户隐私
- 不涉及投资建议
- 专注于日常生活和工作效率`;

/**
 * Agent 配置映射
 */
export const AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  investment: {
    type: 'investment',
    systemPrompt: INVESTMENT_AGENT_PROMPT,
    personality: {
      name: 'Investment Advisor',
      voice: 'Puck', // Gemini 支持中文的语音
      language: 'zh-CN',
      style: 'professional',
    },
    knowledgeNamespace: 'investment',
    databaseTarget: 'riskcontrol',
    tools: [
      {
        name: 'query_portfolio',
        description: '查询投资组合详细信息',
        parameters: { query: { type: 'string' } },
      },
      {
        name: 'get_risk_metrics',
        description: '获取风险指标',
        parameters: {},
      },
      {
        name: 'get_market_data',
        description: '获取市场数据',
        parameters: { symbol: { type: 'string' } },
      },
    ],
  },
  daily: {
    type: 'daily',
    systemPrompt: DAILY_AGENT_PROMPT,
    personality: {
      name: 'Daily Assistant',
      voice: 'Puck',
      language: 'zh-CN',
      style: 'friendly',
    },
    knowledgeNamespace: 'daily',
    databaseTarget: 'echo',
    tools: [
      {
        name: 'search_notes',
        description: '搜索笔记',
        parameters: { query: { type: 'string' } },
      },
      {
        name: 'get_tasks',
        description: '获取任务列表',
        parameters: { status: { type: 'string', enum: ['pending', 'completed', 'all'] } },
      },
      {
        name: 'get_calendar',
        description: '获取日程',
        parameters: { date: { type: 'string' } },
      },
    ],
  },
};

// ============================================
// 双 Agent 语音服务
// ============================================

export class DualAgentVoiceService {
  private config: VoiceServiceConfig;
  private activeSessions: Map<string, VoiceSession> = new Map();

  constructor(config: VoiceServiceConfig) {
    this.config = config;
  }

  /**
   * 创建语音会话
   */
  async createSession(options: SessionCreateOptions): Promise<VoiceSession> {
    const { agentType, participantId, roomName, metadata } = options;
    
    // 生成房间名
    const room = roomName || `voice_${agentType}_${Date.now()}`;
    
    // 请求 token
    const tokenResponse = await this.requestToken(participantId, room);
    
    // 创建会话
    const session: VoiceSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      roomName: room,
      currentAgent: agentType,
      participantId,
      token: tokenResponse.token,
      serverUrl: tokenResponse.serverUrl,
      createdAt: new Date(),
      metadata,
    };

    // 保存会话
    this.activeSessions.set(session.id, session);

    // 通知 Voice Agent 服务使用指定的 Agent 类型
    await this.notifyAgentType(room, agentType);

    return session;
  }

  /**
   * 切换 Agent（保持会话）
   */
  async switchAgent(sessionId: string, newAgent: AgentType): Promise<VoiceSession> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new VoiceServiceError('SESSION_NOT_FOUND', 'Session not found');
    }

    const previousAgent = session.currentAgent;
    
    // 更新会话
    session.currentAgent = newAgent;
    session.metadata = {
      ...session.metadata,
      previousAgent,
      switchedAt: new Date().toISOString(),
    };

    // 通知 Voice Agent 服务切换 Agent
    await this.notifyAgentSwitch(session.roomName, previousAgent, newAgent);

    return session;
  }

  /**
   * 获取 Agent 配置
   */
  getAgentConfig(agentType: AgentType): AgentConfig {
    return AGENT_CONFIGS[agentType];
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): VoiceSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * 结束会话
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      // 通知 Voice Agent 服务结束会话
      await this.notifySessionEnd(session.roomName);
      this.activeSessions.delete(sessionId);
    }
  }

  /**
   * 获取所有活跃会话
   */
  getActiveSessions(): VoiceSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * 预热 Voice Agent 服务
   */
  async warmup(): Promise<{ status: string; warmupTime: number }> {
    const start = Date.now();
    
    try {
      const response = await fetch(`${this.config.voiceAgentUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(60000),
      });

      const warmupTime = Date.now() - start;

      if (response.ok) {
        return {
          status: 'ready',
          warmupTime,
        };
      }

      return {
        status: 'error',
        warmupTime,
      };
    } catch (error) {
      return {
        status: 'error',
        warmupTime: Date.now() - start,
      };
    }
  }

  /**
   * 检测话题类型
   * 用于自动选择合适的 Agent
   */
  detectTopicAgent(text: string): AgentType {
    // 投资相关关键词
    const investmentKeywords = [
      '股票', '基金', '投资', '持仓', '收益', '风险', '市场',
      '交易', '买入', '卖出', '涨', '跌', '分红', '估值',
      'stock', 'fund', 'investment', 'portfolio', 'return',
    ];

    // 日常相关关键词
    const dailyKeywords = [
      '笔记', '任务', '日程', '提醒', '会议', '工作', '生活',
      '天气', '时间', '日期', '计划', '安排',
      'note', 'task', 'calendar', 'reminder', 'meeting',
    ];

    const lowerText = text.toLowerCase();
    
    const investmentScore = investmentKeywords.filter(k => lowerText.includes(k)).length;
    const dailyScore = dailyKeywords.filter(k => lowerText.includes(k)).length;

    if (investmentScore > dailyScore) {
      return 'investment';
    } else if (dailyScore > investmentScore) {
      return 'daily';
    }

    // 默认返回 daily
    return 'daily';
  }

  // ============================================
  // 私有方法
  // ============================================

  private async requestToken(
    identity: string,
    roomName: string
  ): Promise<{ token: string; serverUrl: string }> {
    // 如果配置了 Echo API，使用它来获取 token
    if (this.config.echoApiUrl) {
      const response = await fetch(`${this.config.echoApiUrl}/api/livekit/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, roomName }),
      });

      if (!response.ok) {
        throw new VoiceServiceError('TOKEN_REQUEST_FAILED', 'Failed to request token');
      }

      const data = await response.json();
      return {
        token: data.token,
        serverUrl: data.serverUrl,
      };
    }

    // 否则直接使用 LiveKit SDK 生成 token（需要在服务端）
    throw new VoiceServiceError(
      'CONFIG_ERROR',
      'Echo API URL not configured for token generation'
    );
  }

  private async notifyAgentType(roomName: string, agentType: AgentType): Promise<void> {
    // 通知 Voice Agent 服务使用指定的 Agent 类型
    // 这可以通过 room metadata 或专门的 API 实现
    try {
      await fetch(`${this.config.voiceAgentUrl}/api/room/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          agentType,
          config: AGENT_CONFIGS[agentType],
        }),
      });
    } catch (error) {
      // 非关键操作，记录警告但不抛出错误
      console.warn('Failed to notify agent type:', error);
    }
  }

  private async notifyAgentSwitch(
    roomName: string,
    fromAgent: AgentType,
    toAgent: AgentType
  ): Promise<void> {
    try {
      await fetch(`${this.config.voiceAgentUrl}/api/room/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          fromAgent,
          toAgent,
          config: AGENT_CONFIGS[toAgent],
        }),
      });
    } catch (error) {
      console.warn('Failed to notify agent switch:', error);
    }
  }

  private async notifySessionEnd(roomName: string): Promise<void> {
    try {
      await fetch(`${this.config.voiceAgentUrl}/api/room/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName }),
      });
    } catch (error) {
      console.warn('Failed to notify session end:', error);
    }
  }
}

// ============================================
// 错误类
// ============================================

export class VoiceServiceError extends Error {
  constructor(
    public code: 'SESSION_NOT_FOUND' | 'TOKEN_REQUEST_FAILED' | 'CONFIG_ERROR' | 'SERVICE_UNAVAILABLE',
    message: string
  ) {
    super(message);
    this.name = 'VoiceServiceError';
  }
}

// ============================================
// 单例导出
// ============================================

let voiceServiceInstance: DualAgentVoiceService | null = null;

export function initVoiceService(config: VoiceServiceConfig): DualAgentVoiceService {
  voiceServiceInstance = new DualAgentVoiceService(config);
  return voiceServiceInstance;
}

export function getVoiceService(): DualAgentVoiceService | null {
  return voiceServiceInstance;
}

export default DualAgentVoiceService;
