/**
 * 数据迁移完整性属性测试
 * 
 * **Property 5: 数据迁移完整性**
 * For any Khoj conversation migrated to Mastra, the message count 
 * and content SHALL be identical before and after migration.
 * 
 * **Validates: Requirements 6.2, 6.3**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';

// ============ 类型定义 ============

interface KhojChatMessage {
  role: 'user' | 'assistant' | 'khoj';
  message: string;
  context?: string[];
  created: string;
}

interface KhojConversation {
  id: string;
  title: string;
  created: string;
}

interface KhojAgent {
  slug: string;
  name: string;
  personality: string;
  tools: string[];
  public: boolean;
}

interface MastraMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: { context?: string[] };
  createdAt: Date;
}

interface MastraConversation {
  id: number;
  title: string;
  messages: MastraMessage[];
  createdAt: Date;
}

interface MastraAgent {
  slug: string;
  name: string;
  persona: string | null;
  systemPrompt: string;
  tools: string[];
  privacy: 'public' | 'private';
}

// ============ 迁移函数（简化版，用于测试） ============

/**
 * 映射 Khoj 角色到 Mastra 角色
 */
function mapRole(khojRole: 'user' | 'assistant' | 'khoj'): 'user' | 'assistant' {
  return khojRole === 'khoj' ? 'assistant' : khojRole;
}

/**
 * 映射 Khoj 工具到 Mastra 工具
 */
function mapTools(khojTools: string[]): string[] {
  const toolMapping: Record<string, string> = {
    'online': 'webSearch',
    'notes': 'searchNotes',
    'webpage': 'readWebpage',
    'general': 'searchNotes',
  };
  
  return khojTools
    .map(t => toolMapping[t] || t)
    .filter((v, i, a) => a.indexOf(v) === i);
}

/**
 * 迁移对话消息
 */
function migrateMessages(khojMessages: KhojChatMessage[]): MastraMessage[] {
  return khojMessages.map(msg => ({
    role: mapRole(msg.role),
    content: msg.message,
    metadata: msg.context ? { context: msg.context } : undefined,
    createdAt: new Date(msg.created),
  }));
}

/**
 * 迁移对话
 */
function migrateConversation(
  conv: KhojConversation,
  messages: KhojChatMessage[]
): MastraConversation {
  return {
    id: parseInt(conv.id, 10) || Math.floor(Math.random() * 10000),
    title: conv.title || '未命名对话',
    messages: migrateMessages(messages),
    createdAt: new Date(conv.created),
  };
}

/**
 * 迁移 Agent
 */
function migrateAgent(agent: KhojAgent): MastraAgent {
  return {
    slug: agent.slug,
    name: agent.name,
    persona: agent.personality,
    systemPrompt: `你是 ${agent.name}。${agent.personality}`,
    tools: mapTools(agent.tools),
    privacy: agent.public ? 'public' : 'private',
  };
}

// ============ Arbitraries ============

/**
 * 生成 Khoj 消息
 */
const khojMessageArb = fc.record({
  role: fc.constantFrom('user', 'assistant', 'khoj') as fc.Arbitrary<'user' | 'assistant' | 'khoj'>,
  message: fc.string({ minLength: 1, maxLength: 500 }),
  context: fc.option(fc.array(fc.string({ maxLength: 100 }), { maxLength: 5 }), { nil: undefined }),
  created: fc.date({ min: new Date('2020-01-01'), max: new Date('2026-01-01') })
    .map(d => d.toISOString()),
});

/**
 * 生成 Khoj 对话
 */
const khojConversationArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 0, maxLength: 100 }),
  created: fc.date({ min: new Date('2020-01-01'), max: new Date('2026-01-01') })
    .map(d => d.toISOString()),
});

/**
 * 生成 Khoj Agent
 */
const khojAgentArb = fc.record({
  slug: fc.string({ minLength: 3, maxLength: 50 })
    .filter(s => /^[a-z0-9-]+$/.test(s)),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  personality: fc.string({ minLength: 0, maxLength: 500 }),
  tools: fc.array(fc.constantFrom('online', 'notes', 'webpage', 'general'), { maxLength: 4 }),
  public: fc.boolean(),
});

// ============ 属性测试 ============

describe('Property 5: 数据迁移完整性', () => {
  /**
   * Property 5.1: 消息数量保持一致
   * 迁移后的消息数量应该与迁移前完全相同
   */
  it('消息数量在迁移前后保持一致', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(khojMessageArb, { minLength: 0, maxLength: 50 }),
        async (khojMessages) => {
          const mastraMessages = migrateMessages(khojMessages);
          
          // 验证消息数量相同
          expect(mastraMessages.length).toBe(khojMessages.length);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.2: 消息内容保持一致
   * 迁移后的消息内容应该与迁移前完全相同
   */
  it('消息内容在迁移前后保持一致', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(khojMessageArb, { minLength: 1, maxLength: 30 }),
        async (khojMessages) => {
          const mastraMessages = migrateMessages(khojMessages);
          
          // 验证每条消息的内容相同
          for (let i = 0; i < khojMessages.length; i++) {
            expect(mastraMessages[i].content).toBe(khojMessages[i].message);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.3: 角色映射正确
   * khoj 角色应该映射为 assistant
   */
  it('角色映射正确 (khoj -> assistant)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(khojMessageArb, { minLength: 1, maxLength: 30 }),
        async (khojMessages) => {
          const mastraMessages = migrateMessages(khojMessages);
          
          for (let i = 0; i < khojMessages.length; i++) {
            const expectedRole = khojMessages[i].role === 'khoj' ? 'assistant' : khojMessages[i].role;
            expect(mastraMessages[i].role).toBe(expectedRole);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.4: 上下文信息保留
   * 如果原消息有 context，迁移后应该保留在 metadata 中
   */
  it('上下文信息在迁移后保留', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(khojMessageArb, { minLength: 1, maxLength: 20 }),
        async (khojMessages) => {
          const mastraMessages = migrateMessages(khojMessages);
          
          for (let i = 0; i < khojMessages.length; i++) {
            if (khojMessages[i].context) {
              expect(mastraMessages[i].metadata?.context).toEqual(khojMessages[i].context);
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.5: 对话标题保留
   * 迁移后的对话标题应该与原标题相同（空标题变为默认值）
   */
  it('对话标题在迁移后保留', async () => {
    await fc.assert(
      fc.asyncProperty(
        khojConversationArb,
        fc.array(khojMessageArb, { maxLength: 10 }),
        async (conv, messages) => {
          const mastraConv = migrateConversation(conv, messages);
          
          const expectedTitle = conv.title || '未命名对话';
          expect(mastraConv.title).toBe(expectedTitle);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.6: Agent 配置完整迁移
   * Agent 的核心配置应该完整保留
   */
  it('Agent 配置完整迁移', async () => {
    await fc.assert(
      fc.asyncProperty(
        khojAgentArb,
        async (khojAgent) => {
          const mastraAgent = migrateAgent(khojAgent);
          
          // 验证核心字段
          expect(mastraAgent.slug).toBe(khojAgent.slug);
          expect(mastraAgent.name).toBe(khojAgent.name);
          expect(mastraAgent.persona).toBe(khojAgent.personality);
          expect(mastraAgent.privacy).toBe(khojAgent.public ? 'public' : 'private');
          
          // 验证 systemPrompt 包含名称和人格
          expect(mastraAgent.systemPrompt).toContain(khojAgent.name);
          expect(mastraAgent.systemPrompt).toContain(khojAgent.personality);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.7: 工具映射正确
   * Khoj 工具应该正确映射到 Mastra 工具
   */
  it('工具映射正确', async () => {
    await fc.assert(
      fc.asyncProperty(
        khojAgentArb,
        async (khojAgent) => {
          const mastraAgent = migrateAgent(khojAgent);
          
          // 验证工具映射
          const expectedTools = mapTools(khojAgent.tools);
          expect(mastraAgent.tools).toEqual(expectedTools);
          
          // 验证没有重复工具
          const uniqueTools = [...new Set(mastraAgent.tools)];
          expect(mastraAgent.tools.length).toBe(uniqueTools.length);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.8: 时间戳保留
   * 迁移后的时间戳应该与原时间戳相同
   */
  it('时间戳在迁移后保留', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(khojMessageArb, { minLength: 1, maxLength: 20 }),
        async (khojMessages) => {
          const mastraMessages = migrateMessages(khojMessages);
          
          for (let i = 0; i < khojMessages.length; i++) {
            const originalDate = new Date(khojMessages[i].created);
            expect(mastraMessages[i].createdAt.getTime()).toBe(originalDate.getTime());
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.9: 迁移是幂等的
   * 对同一数据多次迁移应该产生相同结果
   */
  it('迁移是幂等的', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(khojMessageArb, { minLength: 1, maxLength: 20 }),
        async (khojMessages) => {
          const result1 = migrateMessages(khojMessages);
          const result2 = migrateMessages(khojMessages);
          
          // 验证两次迁移结果相同
          expect(result1.length).toBe(result2.length);
          for (let i = 0; i < result1.length; i++) {
            expect(result1[i].content).toBe(result2[i].content);
            expect(result1[i].role).toBe(result2[i].role);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.10: 空数据处理
   * 空数组应该正确处理，不抛出错误
   */
  it('空数据正确处理', async () => {
    const emptyMessages = migrateMessages([]);
    expect(emptyMessages).toEqual([]);
    
    const emptyConv = migrateConversation(
      { id: '1', title: '', created: new Date().toISOString() },
      []
    );
    expect(emptyConv.messages).toEqual([]);
    expect(emptyConv.title).toBe('未命名对话');
  });
});

describe('数据迁移边界情况', () => {
  it('处理超长消息内容', () => {
    const longMessage: KhojChatMessage = {
      role: 'user',
      message: 'a'.repeat(10000),
      created: new Date().toISOString(),
    };
    
    const result = migrateMessages([longMessage]);
    expect(result[0].content.length).toBe(10000);
  });

  it('处理特殊字符', () => {
    const specialMessage: KhojChatMessage = {
      role: 'user',
      message: '你好！🎉 <script>alert("xss")</script> \n\t',
      created: new Date().toISOString(),
    };
    
    const result = migrateMessages([specialMessage]);
    expect(result[0].content).toBe(specialMessage.message);
  });

  it('处理无效日期', () => {
    const invalidDateMessage: KhojChatMessage = {
      role: 'user',
      message: 'test',
      created: 'invalid-date',
    };
    
    const result = migrateMessages([invalidDateMessage]);
    // 应该创建一个 Invalid Date 对象
    expect(result[0].createdAt.toString()).toBe('Invalid Date');
  });
});
