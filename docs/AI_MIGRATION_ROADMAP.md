# AI 服务迁移路线图: Khoj → Mastra 统一

> 版本: 1.0
> 日期: 2026-01-01
> 状态: 规划中

## 目标

将 Echo on Blinko 的 AI 能力统一到 Mastra 框架，逐步废弃 Khoj 独立服务，实现：
- 单一技术栈 (TypeScript)
- 统一数据存储 (PostgreSQL + Prisma)
- 简化部署架构
- 降低维护成本

---

## 当前状态

```
┌─────────────────────────────────────────────────────────────┐
│                    Echo on Blinko                           │
├─────────────────────────────────────────────────────────────┤
│  前端 (React + TypeScript)                                  │
│  ├── EchoAI 组件 ✅ 已完成                                   │
│  ├── Khoj 页面 (iframe) ⚠️ 待迁移                           │
│  └── Agent/Automation 页面 ⚠️ 待迁移                        │
├─────────────────────────────────────────────────────────────┤
│  后端 (Node.js + tRPC)                                      │
│  ├── Mastra AI 服务 ✅ 已完成                                │
│  │   ├── 三层记忆系统                                       │
│  │   ├── RAG 检索                                          │
│  │   └── 基础 Agent                                        │
│  └── Khoj 客户端 ⚠️ API 代理                                │
├─────────────────────────────────────────────────────────────┤
│  外部服务                                                   │
│  ├── PostgreSQL ✅                                          │
│  ├── Khoj Server (Python) ⚠️ 独立服务                       │
│  └── Janitor (Python) ✅                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 短期计划 (1-2 周)

### 目标
保持现有功能稳定，优化 Khoj 集成体验

### 任务清单

#### S1. 完善 Khoj API 网关 (3天)
```
状态: 已完成基础
待做:
- [ ] 添加请求缓存 (减少 Khoj 调用)
- [ ] 添加熔断机制 (Khoj 不可用时降级)
- [ ] 统一错误处理和日志
```

#### S2. 原生化 Khoj 对话页面 (3天)
```
当前: iframe 嵌入
目标: 原生 React 组件

文件:
- get/blinko-main/app/src/pages/khoj.tsx
- get/blinko-main/app/src/components/khoj/

任务:
- [ ] 移除 iframe，使用原生组件
- [ ] 复用 EchoAI 的 ChatPage 组件
- [ ] 通过 tRPC 调用 Khoj API
```

#### S3. 数据同步机制 (2天)
```
目标: Blinko 笔记自动同步到 Khoj 索引

实现:
- [ ] 笔记创建/更新时触发 Khoj 索引
- [ ] 使用 KhojClient.indexDocument()
- [ ] 添加同步状态指示器
```

#### S4. 健康监控增强 (1天)
```
- [ ] Khoj 服务状态实时监控
- [ ] 服务不可用时的 UI 提示
- [ ] 自动重连机制
```

### 短期交付物
- 原生 Khoj 对话页面
- 稳定的 API 网关
- 笔记自动索引

---

## 中期计划 (1-2 月)

### 目标
在 Mastra 上实现 Khoj 核心功能，开始功能平移

### 任务清单

#### M1. Research Agent 实现 (2周)

```typescript
// 目标: 实现类似 Khoj Research Mode 的多轮研究能力

// 新建文件: server/aiServer/researchAgent.ts
interface ResearchConfig {
  maxIterations: number;      // 最大迭代次数 (默认 5)
  tools: string[];            // 可用工具
  searchDepth: 'shallow' | 'deep';
}

interface ResearchResult {
  summary: string;            // 研究总结
  sources: Source[];          // 引用来源
  iterations: Iteration[];    // 迭代过程
  confidence: number;         // 置信度
}

class ResearchAgent {
  async research(query: string, config: ResearchConfig): Promise<ResearchResult>;
}
```

**子任务:**
- [ ] M1.1 设计 Research Agent 架构
- [ ] M1.2 实现多轮迭代逻辑
- [ ] M1.3 集成网络搜索 (Tavily/Serper)
- [ ] M1.4 实现结果聚合和引用追踪
- [ ] M1.5 添加流式输出支持

#### M2. Agent 管理系统 (2周)

```sql
-- 新增数据模型
CREATE TABLE agents (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  persona TEXT,
  system_prompt TEXT,
  tools TEXT[],              -- 可用工具列表
  model_id INT REFERENCES ai_models(id),
  privacy VARCHAR(20),       -- public/private
  account_id INT REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**子任务:**
- [ ] M2.1 添加 Prisma schema
- [ ] M2.2 实现 Agent CRUD API
- [ ] M2.3 创建 Agent 管理 UI
- [ ] M2.4 实现 Agent 选择器
- [ ] M2.5 工具权限控制

#### M3. 自动化任务完善 (1周)

```typescript
// 完善现有 aiScheduledTask

// 新增功能:
interface EnhancedScheduledTask {
  // 现有字段...
  
  // 新增:
  naturalLanguageSchedule?: string;  // "每天早上9点"
  notificationChannels: string[];    // email, push, in-app
  resultStorage: 'note' | 'memory' | 'both';
  agentId?: number;                  // 使用特定 Agent
}
```

**子任务:**
- [ ] M3.1 自然语言调度解析
- [ ] M3.2 结果存储到笔记
- [ ] M3.3 通知系统集成
- [ ] M3.4 任务执行历史

#### M4. 工具系统扩展 (1周)

```typescript
// 新增工具
const tools = {
  // 现有
  searchNotes: '...',
  createNote: '...',
  
  // 新增
  webSearch: '网络搜索 (Tavily)',
  readWebpage: '网页内容提取',
  executeCode: '代码执行 (沙箱)',
  searchFiles: '文件语义搜索',
};
```

**子任务:**
- [ ] M4.1 集成 Tavily API
- [ ] M4.2 实现网页内容提取
- [ ] M4.3 代码执行沙箱 (可选)
- [ ] M4.4 工具注册机制

### 中期交付物
- Research Agent (多轮研究)
- Agent 管理系统
- 增强的自动化任务
- 扩展工具集

### 中期里程碑检查点

```
Week 2: Research Agent 基础版可用
Week 4: Agent 管理 UI 完成
Week 6: 自动化任务增强完成
Week 8: 功能平移完成，开始并行测试
```

---

## 长期计划 (2-3 月)

### 目标
完全迁移到 Mastra，废弃 Khoj 服务

### 任务清单

#### L1. 数据迁移 (1周)

```typescript
// 迁移脚本: scripts/migrate-khoj-data.ts

async function migrateKhojData() {
  const khojClient = getKhojClient();
  
  // 1. 迁移对话历史
  const conversations = await khojClient.getConversations();
  for (const conv of conversations) {
    await migrateConversation(conv);
  }
  
  // 2. 迁移 Agent 配置
  const agents = await khojClient.getAgents();
  for (const agent of agents) {
    await migrateAgent(agent);
  }
  
  // 3. 迁移自动化任务
  const automations = await khojClient.getAutomations();
  for (const auto of automations) {
    await migrateAutomation(auto);
  }
  
  // 4. 验证迁移完整性
  await validateMigration();
}
```

**子任务:**
- [ ] L1.1 编写迁移脚本
- [ ] L1.2 数据验证工具
- [ ] L1.3 回滚机制
- [ ] L1.4 迁移文档

#### L2. 功能对等测试 (1周)

```
测试矩阵:
┌─────────────────┬─────────┬─────────┬─────────┐
│ 功能            │ Khoj    │ Mastra  │ 状态    │
├─────────────────┼─────────┼─────────┼─────────┤
│ 基础对话        │ ✅      │ ✅      │ 对等    │
│ RAG 检索        │ ✅      │ ✅      │ 对等    │
│ 多轮研究        │ ✅      │ ✅      │ 待验证  │
│ Agent 管理      │ ✅      │ ✅      │ 待验证  │
│ 自动化任务      │ ✅      │ ✅      │ 待验证  │
│ 网络搜索        │ ✅      │ ✅      │ 待验证  │
│ 文件索引        │ ✅      │ ✅      │ 对等    │
│ 记忆系统        │ ⚠️      │ ✅      │ Mastra优│
└─────────────────┴─────────┴─────────┴─────────┘
```

**子任务:**
- [ ] L2.1 编写对比测试用例
- [ ] L2.2 性能基准测试
- [ ] L2.3 用户体验对比
- [ ] L2.4 问题修复

#### L3. 渐进式切换 (2周)

```typescript
// 功能开关配置
interface AIServiceConfig {
  // 使用哪个服务
  provider: 'mastra' | 'khoj' | 'hybrid';
  
  // 混合模式下的功能路由
  routing: {
    chat: 'mastra' | 'khoj';
    research: 'mastra' | 'khoj';
    agents: 'mastra' | 'khoj';
    automation: 'mastra' | 'khoj';
  };
  
  // 回退配置
  fallback: {
    enabled: boolean;
    fallbackTo: 'mastra' | 'khoj';
  };
}
```

**切换阶段:**
```
阶段 1: 混合模式 (2周)
├── 新用户默认使用 Mastra
├── 老用户可选择切换
└── 收集反馈

阶段 2: Mastra 优先 (2周)
├── 所有用户默认 Mastra
├── Khoj 作为备选
└── 监控稳定性

阶段 3: 完全切换 (1周)
├── 禁用 Khoj 入口
├── 保留 Khoj 服务 (紧急回滚)
└── 最终验证

阶段 4: 清理 (1周)
├── 移除 Khoj 相关代码
├── 移除 Khoj 服务
└── 更新文档
```

#### L4. 清理和文档 (1周)

**代码清理:**
- [ ] 移除 `server/lib/khojClient.ts`
- [ ] 移除 `server/routerTrpc/khoj.ts`
- [ ] 移除 `docker-compose.khoj.yml`
- [ ] 移除 Khoj 相关配置

**文档更新:**
- [ ] 更新部署文档
- [ ] 更新 API 文档
- [ ] 更新用户指南
- [ ] 归档 Khoj 集成文档

### 长期交付物
- 完全迁移到 Mastra
- 清理后的代码库
- 更新的文档
- 简化的部署架构

---

## 风险管理

### 风险矩阵

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Research Mode 实现复杂度超预期 | 中 | 高 | 分阶段实现，先做 MVP |
| 用户依赖 Khoj 特定功能 | 低 | 中 | 提供迁移期并行运行 |
| 性能回归 | 中 | 中 | 基准测试，性能监控 |
| 数据迁移丢失 | 低 | 高 | 备份，验证，回滚机制 |

### 回滚计划

```
触发条件:
- 关键功能不可用 > 1小时
- 用户投诉率 > 5%
- 数据丢失或损坏

回滚步骤:
1. 切换功能开关到 Khoj
2. 通知用户
3. 分析问题
4. 修复后重新切换
```

---

## 资源需求

### 人力

| 阶段 | 前端 | 后端 | 测试 |
|------|------|------|------|
| 短期 | 0.5人 | 0.5人 | 0.2人 |
| 中期 | 1人 | 1.5人 | 0.5人 |
| 长期 | 0.5人 | 1人 | 0.5人 |

### 基础设施

```
短期: 无变化
中期: 可能需要增加 API 调用配额 (Tavily)
长期: 减少一个 Docker 容器 (Khoj)
```

---

## 成功指标

### 短期 (2周后)
- [ ] Khoj 对话页面原生化完成
- [ ] API 网关稳定性 > 99%
- [ ] 笔记自动索引延迟 < 5秒

### 中期 (2月后)
- [ ] Research Agent 可用
- [ ] Agent 管理功能完整
- [ ] 自动化任务增强完成
- [ ] 用户满意度无下降

### 长期 (3月后)
- [ ] Khoj 服务完全废弃
- [ ] 部署复杂度降低 50%
- [ ] 维护成本降低 30%
- [ ] 单一技术栈

---

## 附录

### A. 相关文档
- [Mastra vs Khoj 评估报告](./MASTRA_VS_KHOJ_ANALYSIS.md)
- [Khoj 深度集成设计](../.kiro/specs/khoj-deep-integration/design.md)
- [Echo AI 设计](../.kiro/specs/echo-ai/design.md)

### B. 关键代码路径
```
Mastra AI 服务:
├── server/aiServer/index.ts
├── server/aiServer/memory.ts
├── server/aiServer/aiModelFactory.ts
└── server/routerTrpc/ai.ts

Khoj 集成 (待废弃):
├── server/lib/khojClient.ts
├── server/routerTrpc/khoj.ts
└── docker-compose.khoj.yml
```

### C. 决策记录

| 日期 | 决策 | 原因 |
|------|------|------|
| 2026-01-01 | 选择 Mastra 作为核心 | 技术栈一致性，维护成本 |
| 2026-01-01 | 移植 Research Mode | 高价值功能 |
| 2026-01-01 | 渐进式迁移 | 降低风险 |
