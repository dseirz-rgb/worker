import { ragService } from './ragService';
import type { Message, Citation } from '../types';
import { getClient } from './supabaseData'; // Import Supabase client
import { API_ENDPOINTS } from './apiConfig';

// 使用 apiConfig 统一管理 API URL
const API_URL = API_ENDPOINTS.CHAT;

// Helper to parse JSON stream
export function parseJSONStream(buffer: string): { objects: any[], remaining: string } {
  const objects: any[] = [];
  let depth = 0;
  let inString = false;
  let start = -1;
  let escape = false;
  let processedUpTo = 0;

  for (let i = 0; i < buffer.length; i++) {
    const char = buffer[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          try {
            const jsonStr = buffer.substring(start, i + 1);
            objects.push(JSON.parse(jsonStr));
            processedUpTo = i + 1;
          } catch (e) {
            // Ignore malformed JSON
          }
          start = -1;
        }
      }
    }
  }

  // Keep remaining buffer, skipping processed parts.
  return { objects, remaining: buffer.slice(processedUpTo) };
}

export const aiService = {
  /**
   * 发送消息给 AI，支持流式响应
   * @param history 历史消息
   * @param onChunk 接收流式片段的回调
   * @param onDone 完成回调
   */
  async sendMessage(
    history: Message[], 
    onChunk: (text: string) => void,
    onDone?: (fullText: string, citations?: Citation[]) => void,
    onContextDebug?: (systemInstruction: string, contextPrompt: string) => void,
    onStatus?: (status: string) => void,
    model: 'smart' | 'fast' = 'fast' // Add model preference parameter
  ) {
    try {
      const supabase = getClient();
      onStatus?.("正在连接知识库...");
      
      // 1. 获取最后一条用户消息
      const lastUserMsg = history[history.length - 1];
      if (lastUserMsg.role !== 'user') throw new Error('Last message must be from user');

      // 2. 并行获取上下文：RAG + User Profile
      onStatus?.("🔍 正在检索投资组合与笔记...");
      const [ragResult, profileResult] = await Promise.all([
         ragService.getInvestmentContext(lastUserMsg.content),
         supabase ? supabase.from('user_profiles').select('content').eq('user_id', 1).single() : Promise.resolve({ data: null })
      ]);

      onStatus?.("🧠 正在构建思维模型...");
      const { text: context, citations } = ragResult;
      const userProfile = profileResult.data?.content || "暂无详细档案";

      // 3. 构建 Prompt (作为 System Instruction)
      const systemInstructionText = `
You are "Investment Mirror" (PIP - Personalized Investment Partner).
Your role is to act as a critical, data-driven, and debating partner for the user's investment decisions.

### 👤 USER PROFILE
${userProfile}

### 📊 CONTEXT DATA (Real-time Portfolio & Notes)
${context}

### 🎯 INSTRUCTIONS
1. **Debate & Challenge**: Do not just agree. Challenge the user's assumptions based on their profile and the data. If they are taking risks that contradict their "Steady Growth" profile, point it out.
2. **Data-Driven**: Always backup your arguments with the provided portfolio data or notes.
3. **Citation Format**: You MUST use inline citations when referencing notes or books. Format: \`[Title-Part X]\` or \`[Book Title]\`.
4. **Markdown**: Use bolding for key figures and headers for structure.
5. **Responsiveness**: Be concise and to the point. Avoid long preambles. Start directly with the analysis.

### 🚫 CONSTRAINTS
- Do not give specific financial advice (e.g., "Buy AAPL now"). Instead, analyze the *implications* of buying AAPL.
- Keep responses under 500 words unless asked for a detailed report.
`;

      // Call the debug callback with the prompt data
      if (onContextDebug) {
          onContextDebug(systemInstructionText, context);
      }

      // 转换消息格式
      const contents = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      // 4. 构建 Request Body
      const requestBody: any = {
        contents: contents,
        systemInstruction: {
          role: 'system',
          parts: [
            { text: systemInstructionText }
          ]
        }
      };

      // Removed Vertex AI tools configuration
      /*
      if (DATA_STORE_ID) {
        requestBody.tools = [
          {
            retrieval: {
              vertexAiSearch: {
                datastore: DATA_STORE_ID,
              },
            },
          },
        ];
        console.log('[AI Service] Using Vertex AI RAG with Data Store:', DATA_STORE_ID);
      }
      */

      // 5. 调用 API (本地代理)
      onStatus?.("💭 AI 正在思考中...");
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-model': model === 'smart' ? 'gemini-3-pro-preview' : 'gemini-3-pro-preview'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`AI API Error: ${response.status} - ${errText}`);
      }

      if (!response.body) throw new Error('No response body');

      // 5. 处理流式响应
      onStatus?.("✍️ 正在生成回答...");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let vertexCitations: Citation[] = [];
      let buffer = ''; 

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk; 

        // 使用健壮的 JSON Stream 解析
        const { objects, remaining } = parseJSONStream(buffer);
        buffer = remaining;

        for (const data of objects) {
            // 1. 提取文本
            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                const text = data.candidates[0].content.parts[0].text;
                fullText += text;
                onChunk(text);
            }

            // 2. 提取 Grounding Metadata
            if (data.candidates && data.candidates[0]?.groundingMetadata?.retrievedContexts) {
                const contexts = data.candidates[0].groundingMetadata.retrievedContexts;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                contexts.forEach((ctx: any) => {
                     if (ctx.uri || ctx.title) {
                        vertexCitations.push({
                            source: '书籍知识库',
                            title: ctx.title || (ctx.uri ? ctx.uri : '未知文档'),
                            url: ctx.uri,
                            content_snippet: ctx.text ? ctx.text.slice(0, 50) + '...' : undefined
                        });
                    }
                });
            }
        }
        
        // 防止缓冲区无限增长
        if (buffer.length > 1000000) {
            console.warn('Buffer overflow protection triggered');
            buffer = buffer.slice(-20000); 
        }
      }
      
      // 合并 Supabase 引用 (citations) 和 Vertex AI 引用 (vertexCitations)
      const allCitations = [...(citations || []), ...vertexCitations];
      
      // 去重
      const uniqueCitations = Array.from(new Map(allCitations.map(c => [c.title + c.content_snippet, c])).values());

      onDone?.(fullText, uniqueCitations);

    } catch (error) {
      console.error('AI Service Error:', error);
      onChunk(`(Error: ${error instanceof Error ? error.message : String(error)})`);
      onDone?.(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  /**
   * 生成每日洞察 (Daily Insight) - 使用统一智能系统
   * 结合多 Agent 分析生成更全面的每日洞察
   * @see Requirements 6.1, 6.2, 6.3, 6.4
   */
  async generateDailyInsightWithAgents(portfolio: any): Promise<{
    summary: string;
    positionInsights?: { summary: string; keyChanges: string[] };
    riskInsights?: { summary: string; riskLevel: string; warnings: string[] };
    marketInsights?: { summary: string; headlines: string[] };
    recommendation?: { summary: string; actions: string[] };
  }> {
    try {
      // 动态导入统一智能服务
      const { unifiedIntelligenceService } = await import('./unifiedIntelligence');
      
      // 构建 PortfolioState
      const portfolioState = {
        positions: (portfolio.positions || []).map((p: any) => ({
          ticker: p.ticker || p.symbol,
          weight: p.weight || p.weight_percent || 0,
          marketValue: p.marketValue || p.market_value || 0,
          costBasis: p.costBasis || p.cost_basis || 0,
          unrealizedPnL: p.unrealizedPnL || p.unrealized_pnl || 0,
          market: p.market || 'US',
          sector: p.sector,
        })),
        totalValue: portfolio.totalValue || portfolio.total_value || portfolio.net_worth_cny || 0,
        cashBalance: portfolio.cashBalance || portfolio.cash_balance || 0,
        marginLoan: portfolio.marginLoan || portfolio.margin_loan || 0,
        highWaterMark: portfolio.highWaterMark || portfolio.high_water_mark || 0,
        timestamp: Date.now(),
      };

      // 使用统一智能服务生成每日洞察
      const dailyInsight = await unifiedIntelligenceService.generateDailyInsight(portfolioState);

      return {
        summary: dailyInsight.summary,
        positionInsights: dailyInsight.positionInsights ? {
          summary: dailyInsight.positionInsights.summary,
          keyChanges: dailyInsight.positionInsights.keyChanges,
        } : undefined,
        riskInsights: dailyInsight.riskInsights ? {
          summary: dailyInsight.riskInsights.summary,
          riskLevel: dailyInsight.riskInsights.riskLevel,
          warnings: dailyInsight.riskInsights.warnings,
        } : undefined,
        marketInsights: dailyInsight.marketInsights ? {
          summary: dailyInsight.marketInsights.summary,
          headlines: dailyInsight.marketInsights.headlines,
        } : undefined,
        recommendation: dailyInsight.recommendation ? {
          summary: dailyInsight.recommendation.summary,
          actions: dailyInsight.recommendation.actions,
        } : undefined,
      };
    } catch (error) {
      console.error('generateDailyInsightWithAgents failed:', error);
      // 回退到简单洞察
      const simpleInsight = await this.generateDailyInsight();
      return { summary: simpleInsight };
    }
  },

  /**
   * 生成每日洞察 (Daily Insight) - 旧版
   * 基于完整的 RAG 上下文 (持仓、交易、风险、笔记)
   */
  async generateDailyInsight(): Promise<string> {
    try {
        // 1. 调用 RAG 获取丰富的上下文
        // 使用一个通用的查询来检索相关的风险和原则笔记
        const ragQuery = "当前市场风险与我的投资原则";
        const { text: context } = await ragService.getInvestmentContext(ragQuery);

        // 2. 准备 Prompt
        const prompt = `
你是一位专业的私人投资顾问 (Investment Mirror)。请阅读以下用户的完整投资组合上下文（包含最新持仓、风险指标、近期交易、相关笔记和历史对话）。

### 📊 完整上下文数据
${context}

### 🎯 任务
基于上述所有数据，为用户生成一条“今日每日洞察 (Daily Insight)”。
要求：
1. **针对性强**：必须结合用户当前的具体持仓风险（如某只股票占比过高、回撤过大）或最近的交易行为。
2. **结合笔记**：如果用户的行为与其笔记中的原则（如“截断亏损”）有冲突或一致，请明确指出。
3. **简短有力**：不超过 100 字。
4. **拒绝空洞**：不要说“注意风险”这种废话，要说“你的腾讯控股占比已达30%，建议根据笔记中的分散原则考虑减仓”。
5. **语气**：像一个严厉但负责任的教练。

请直接输出内容，不要带 Markdown 标题或引号。
        `;

        // 3. 调用 AI API
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: 200,
                    temperature: 0.7
                }
            })
        });

        if (!response.ok) throw new Error('API Failed');

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                     (Array.isArray(data) ? data[0]?.candidates?.[0]?.content?.parts?.[0]?.text : '');
        
        return text || "市场波动是常态，保持冷静，坚守原则。";

    } catch (e) {
        console.error('Generate Insight Error:', e);
        return "保持耐心，市场总是奖励有纪律的投资者。"; // Fallback
    }
  },

  /**
   * 生成深度风控研报 (Full Risk Report)
   * 包含：宏观分析、持仓诊断、风险预警、操作建议
   * 
   * 重构版本：使用多 Agent 编排系统生成更全面的分析
   * @param dashboard 仪表盘数据
   * @param positions 持仓列表
   * @param onChunk 流式输出回调
   * @param watchlist 可选的观察列表
   * @param onProgress 进度回调
   * @param onAlert 警报回调
   */
  async generateRiskReport(
    dashboard: any, 
    positions: any[], 
    onChunk?: (text: string) => void, 
    watchlist?: any[],
    onProgress?: (status: { phase: string; progress: number; message?: string }) => void,
    onAlert?: (alert: any) => void
  ): Promise<any> {
      try {
          const supabase = getClient();
          if (!supabase) throw new Error('Supabase client not available');

          // 尝试使用多 Agent 系统
          const useMultiAgent = import.meta.env.VITE_USE_MULTI_AGENT !== 'false';
          
          if (useMultiAgent) {
              return await this.generateRiskReportWithMultiAgent(
                  dashboard, 
                  positions, 
                  onChunk, 
                  watchlist,
                  onProgress,
                  onAlert
              );
          }

          // 回退到原有实现
          return await this.generateRiskReportLegacy(dashboard, positions, onChunk, watchlist);

      } catch (error) {
          console.error('Generate Risk Report Error:', error);
          // 如果多 Agent 失败，回退到旧实现
          console.warn('Multi-agent failed, falling back to legacy implementation');
          return await this.generateRiskReportLegacy(dashboard, positions, onChunk, watchlist);
      }
  },

  /**
   * 使用多 Agent 编排系统生成风控研报
   * @see Requirements 7.1, 7.2, 7.3, 10.8
   */
  async generateRiskReportWithMultiAgent(
    dashboard: any,
    positions: any[],
    onChunk?: (text: string) => void,
    watchlist?: any[],
    onProgress?: (status: { phase: string; progress: number; message?: string }) => void,
    onAlert?: (alert: any) => void
  ): Promise<any> {
      const supabase = getClient();
      if (!supabase) throw new Error('Supabase client not available');

      // 动态导入多 Agent 服务以避免循环依赖
      const { analyzePortfolio } = await import('./agents');

      // 构建 PortfolioState
      const portfolioState = {
          positions: positions.map(p => ({
              ticker: p.ticker || p.symbol,
              weight: p.weight || 0,
              marketValue: p.marketValue || p.market_value || (p.quantity * p.currentPrice) || 0,
              costBasis: p.costBasis || p.cost_basis || p.avgCost || 0,
              unrealizedPnL: p.unrealizedPnL || p.unrealized_pnl || p.pnl || 0,
              market: p.market || (p.ticker?.includes('.HK') ? 'HK' : 'US'),
              sector: p.sector,
          })),
          totalValue: dashboard.totalValue || dashboard.total_value || 0,
          cashBalance: dashboard.cashBalance || dashboard.cash_balance || 0,
          marginLoan: dashboard.marginLoan || dashboard.margin_loan || dashboard.marginUsed || dashboard.margin_used || 0,
          highWaterMark: dashboard.highWaterMark || dashboard.high_water_mark || dashboard.totalValue || dashboard.total_value || 0,
          timestamp: Date.now(),
      };

      // 构建查询
      let query = "深度投资组合诊断与风险分析";
      if (watchlist && watchlist.length > 0) {
          const readyItems = watchlist.filter((w: any) => {
              const days = Math.floor((Date.now() - new Date(w.addedDate || w.added_date).getTime()) / (1000 * 60 * 60 * 24));
              return days >= 7;
          });
          if (readyItems.length > 0) {
              query += `，同时分析观察列表中的标的：${readyItems.map((w: any) => w.ticker).join(', ')}`;
          }
      }

      // 执行多 Agent 分析
      const result = await analyzePortfolio(portfolioState, {
          query,
          mode: (import.meta.env.VITE_ORCHESTRATION_MODE as any) || 'sequential',
          onProgress: onProgress ? (status) => {
              onProgress({
                  phase: status.phase,
                  progress: status.progress,
                  message: status.message,
              });
              // 流式输出进度信息
              if (onChunk && status.message) {
                  onChunk(`\n> ${status.phase}: ${status.message}\n`);
              }
          } : undefined,
          onAlert,
      });

      // 转换为兼容的输出格式
      const finalReport = result.finalReport;
      
      // 构建 content，包含所有 agent 的分析结果
      let content = '';
      
      // 添加摘要
      if (finalReport.summary) {
          content += `> **摘要**：${finalReport.summary}\n\n`;
      }

      // 添加各 Agent 的分析结果
      for (const agentResult of result.results) {
          if (agentResult.status === 'success') {
              content += `### ${this.getAgentDisplayName(agentResult.agentId)}\n\n`;
              content += agentResult.summary + '\n\n';
              
              // 添加详细数据（如果有）
              if (agentResult.data.detailed_analysis) {
                  content += agentResult.data.detailed_analysis + '\n\n';
              }
          }
      }

      // 添加行动计划
      if (finalReport.action_plan) {
          content += `### 💡 操作建议\n\n${finalReport.action_plan}\n\n`;
      }

      // 注入元数据
      content = `<!--RISK_LEVEL:${finalReport.risk_level}-->\n` + content;
      if (finalReport.action_plan) {
          content = `<!--ACTION_PLAN:${finalReport.action_plan}-->\n` + content;
      }

      // 构建数据库 payload
      const payload = {
          user_id: 1,
          title: finalReport.title || `投资研报 ${new Date().toLocaleDateString()}`,
          content: content,
          recommendation: finalReport.recommendation || 'HOLD',
          primary_ticker: finalReport.primary_ticker || 'PORTFOLIO',
          portfolio_snapshot: {
              ...dashboard,
              positions: positions || []
          },
          market_price_snapshot: 0,
          // 新增：存储执行追踪
          execution_trace: result.executionTrace,
      };

      // 插入数据库
      const { data: insertedData, error } = await supabase
          .from('ai_analyses')
          .insert(payload)
          .select()
          .single();

      if (error) throw error;

      // 流式输出最终内容
      if (onChunk) {
          onChunk(content);
      }

      return insertedData;
  },

  /**
   * 获取 Agent 的显示名称
   */
  getAgentDisplayName(agentId: string): string {
      const names: Record<string, string> = {
          'position_analyst': '📊 持仓分析',
          'risk_analyst': '🚨 风险评估',
          'market_analyst': '📈 市场分析',
          'advisor': '💼 投资建议',
          'web_surfer': '🌐 深度研究',
      };
      return names[agentId] || agentId;
  },

  /**
   * 旧版风控研报生成（保持向后兼容）
   */
  async generateRiskReportLegacy(dashboard: any, positions: any[], onChunk?: (text: string) => void, watchlist?: any[]): Promise<any> {
      const supabase = getClient();
      if (!supabase) throw new Error('Supabase client not available');

      // 1. 获取上下文
      const { text: context } = await ragService.getInvestmentContext("深度投资组合诊断与风险分析");

      // 2. 构造观察列表上下文
      let watchlistContext = '';
      if (watchlist && watchlist.length > 0) {
          const readyItems = watchlist.filter((w: any) => {
              const days = Math.floor((Date.now() - new Date(w.addedDate || w.added_date).getTime()) / (1000 * 60 * 60 * 24));
              return days >= 7; // 冷静期已过
          });
          if (readyItems.length > 0) {
              watchlistContext = `
### 📋 观察列表（冷静期已过，可交易）
${readyItems.map((w: any) => `- ${w.ticker} (${w.name}): 目标价 ${w.targetPrice || '未设置'}, 备注: ${w.notes || '无'}`).join('\n')}
`;
          }
      }

      // 3. 构造 Prompt (复用 AIAnalysisDashboard 的逻辑)
      const prompt = `
你是一位顶级的华尔街投资风控专家。请基于以下完整的投资组合数据、市场风险指标和用户的投资笔记，生成一份**结构化、专业、高易读性**的中文风控研报。

### 📊 完整投资组合上下文
${context}
${watchlistContext}

### 🎯 任务要求
请进行深度的逻辑推演，分析宏观环境、持仓结构与用户投资原则（笔记）之间的匹配度。
特别注意：
1. **原则一致性检查**：检查用户的实际持仓是否违背了其笔记中的原则（如"永不满仓"、"截断亏损"）。
2. **风险定量分析**：引用具体的风险指标（Sharpe, Drawdown, VaR）来支持你的观点。
3. **前瞻性预判**：基于当前市场周期，预测未来可能的风险点。
4. **观察列表分析**：如果有观察列表中的标的已过冷静期，分析是否适合当前买入。

### 📝 报告结构 (Markdown)
请严格按照以下结构输出内容：

#### 1. 宏观与原则映射 (Macro & Principles)
*   **市场周期定位**：当前处于什么周期？
*   **原则匹配度**：用户的持仓是否符合其"稳健增长"或"积极进取"的设定？(引用笔记内容)

#### 2. 持仓结构深度诊断 (Portfolio Diagnosis)
*   **集中度分析**：Top 3 持仓是否过重？
*   **相关性检查**：持仓之间是否存在隐性相关性风险？
*   **盈亏归因**：近期的盈亏主要来源于哪里？是运气还是实力？

#### 3. 观察列表机会分析 (Watchlist Opportunities)
*   **买入时机评估**：观察列表中哪些标的当前适合买入？
*   **与现有持仓的互补性**：新买入是否会增加集中度风险？

#### 4. 核心风险预警 (Risk Alerts)
*   **🚨 风险预警**：潜在的下行风险点。
*   **💡 操作建议**：具体的调仓或对冲建议。

### 响应格式要求 (Strict JSON)
请返回一个标准的 JSON 对象，不要包含 Markdown 代码块标记。JSON 结构如下：
{
  "title": "研报标题 (例如：'2025Q4 投资组合风控与机会分析')",
  "risk_level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "summary": "一句话摘要，概括当前最核心的建议。",
  "content": "详细分析内容。请使用 Markdown 格式，并严格遵循以下排版规则：\n1. **标题清晰**：使用 ### 三级标题区分板块。\n2. **重点突出**：关键数据和核心结论必须使用 **加粗**。\n3. **结合笔记**：在分析中必须引用用户的笔记内容（如：'正如您在[笔记标题]中所述...'）。\n\n内容必须包含：\n*   **📊 宏观与原则映射**：市场环境与用户原则的匹配度。\n*   **🏗 持仓结构诊断**：集中度、相关性分析。\n*   **🚨 风险预警**：潜在的下行风险点。\n*   **💡 操作建议**：具体的调仓或对冲建议。",
  "recommendation": "BUY" | "SELL" | "HOLD" | "REBALANCE" | "WARNING",
  "action_plan": "具体的实操建议，必须包含数字或明确标的（例如：'建议将仓位降至 130% 以下'，'卖出 NVDA 止盈'）。限制在 50 字以内。",
  "primary_ticker": "最相关的股票代码，如果是整体建议则填 'PORTFOLIO'"
}
      `;

      // 3. 调用 API
      const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'x-gemini-model': 'gemini-3-pro-preview' // Use Pro model for deep analysis
          },
          body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              // 强制 JSON 模式 (如果模型支持)
              generationConfig: {
                  responseMimeType: "application/json"
              }
          })
      });

      if (!response.ok) throw new Error('AI API Failed');
      if (!response.body) throw new Error('No response body');

      // 4. 获取响应文本 (非流式，更稳健)
      const data = await response.json();
      let jsonText = '';
      
      // 处理可能的不同响应结构 (Streamed array vs Single object)
      if (Array.isArray(data)) {
          // 如果是数组，拼接所有 parts
          jsonText = data.map(item => item.candidates?.[0]?.content?.parts?.[0]?.text || '').join('');
      } else {
          // 单个对象
          jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      if (!jsonText) {
          console.error("Empty AI response", data);
          throw new Error("AI returned empty content");
      }

      // 5. 解析最终 JSON
      let jsonResponse: any;
      try {
          const cleanJsonText = jsonText.replace(/```json\n?|\n?```/g, '').trim();
          jsonResponse = JSON.parse(cleanJsonText);
      } catch (e) {
          console.error("JSON Parse Failed", e);
          console.log("Raw Text:", jsonText);
          throw new Error("AI response was not valid JSON");
      }

      // 6. 插入数据库
      const payload = {
          user_id: 1, // Hardcoded for now
          title: jsonResponse.title || `投资研报 ${new Date().toLocaleDateString()}`,
          content: jsonResponse.content || "AI 未生成详细内容",
          recommendation: jsonResponse.recommendation || 'HOLD',
          primary_ticker: jsonResponse.primary_ticker || 'PORTFOLIO',
          portfolio_snapshot: {
              ...dashboard,
              positions: positions || []
          },
          market_price_snapshot: 0
      };

      // 注入元数据到 content (兼容旧 UI)
      if (jsonResponse.summary) {
          payload.content = `> **摘要**：${jsonResponse.summary}\n\n` + payload.content;
      }
      if (jsonResponse.risk_level) {
          payload.content = `<!--RISK_LEVEL:${jsonResponse.risk_level}-->\n` + payload.content;
      }
      if (jsonResponse.action_plan) {
          payload.content = `<!--ACTION_PLAN:${jsonResponse.action_plan}-->\n` + payload.content;
      }

      const { data: insertedData, error } = await supabase
          .from('ai_analyses')
          .insert(payload)
          .select()
          .single();

      if (error) throw error;
      
      return insertedData;
  },

  // 保留旧方法但标记为废弃或更新
  async processStreamChunk(chunk: string, onChunk: (text: string) => void): Promise<string> {
     try {
       const cleanChunk = chunk.trim().replace(/^,/, '').replace(/,$/, '').replace(/^\[/, '').replace(/\]$/, '');
       if (!cleanChunk) return '';
       const data = JSON.parse(cleanChunk);
       if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
         const text = data.candidates[0].content.parts[0].text;
         onChunk(text);
         return text;
       }
     } catch (e) {
       // ignore
     }
     return '';
  }
};
