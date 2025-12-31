# Mastra vs Khoj AI 能力评估报告

> 评估日期: 2026-01-01
> 目的: 决定在 Blinko + Echo 合并架构中保留哪个 AI 框架

## 执行摘要

| 维度 | Mastra (Blinko) | Khoj | 胜出 |
|------|-----------------|------|------|
| **技术栈一致性** | TypeScript (同 Blinko) | Python (异构) | ✅ Mastra |
| **记忆系统** | 三层记忆 + 向量检索 | 对话历史 + 文件索引 | ✅ Mastra |
| **研究能力** | 需自建 | 内置 Research Mode | ✅ Khoj |
| **工具生态** | MCP 协议 + 自定义 | 内置 6 种工具 | 平手 |
| **Agent 系统** | 基础 Agent | 完整 Agent 管理 | ✅ Khoj |
| **自动化** | 需自建 | 内置 Automation | ✅ Khoj |
| **部署复杂度** | 单体 | 独立服务 | ✅ Mastra |
| **维护成本** | 低 (同栈) | 高 (双栈) | ✅ Mastra |

**推荐方案**: 保留 Mastra 作为核心 AI 框架，选择性移植 Khoj 的高价值功能。

---

## 1. 详细能力对比

### 1.1 记忆系统

#### Mastra (Blinko 当前实现)

```typescript
// 三层记忆架构 (已实现于 server/aiServer/memory.ts)
type MemoryType = 'short_term' | 'long_term' | 'working';

// 功能:
// - 短期记忆: 24小时过期，最多50条
// - 长期记忆: 永久存储，重要信息
// - 工作记忆: 2小时过期，当前任务
// - 向量嵌入检索
// - 用户偏好提取
// - 重要性衰减算法
```

**优势**:
- 完整的三层记忆架构
- 向量相似度检索
- 自动从对话提取记忆
- 用户偏好系统
- 与 Blinko 数据库深度集成

#### Khoj

```python
# Khoj 记忆系统
# - 对话历史存储
# - 文件内容索引 (pgvector)
# - 无显式记忆层级
```

**优势**:
- 文件级别的语义搜索
- 跨文档知识检索

**结论**: Mastra 的记忆系统更完善，Khoj 的文件索引可作为补充。

---

### 1.2 研究能力 (Research Mode)

#### Khoj Research Mode

```python
# 多轮自主研究 (5次迭代)
# 工具编排:
# - semantic_search_files: 语义搜索本地文件
# - regex_search_files: 正则搜索
# - search_web: 网络搜索
# - read_webpage: 网页内容提取
# - python_coder: 代码执行
# - operate_computer: 计算机自动化
```

**核心价值**:
- 自主多轮研究，无需人工干预
- 工具自动编排
- 支持推理模型 (o1/o3, Claude 3.7/4.0, Gemini 2.5)

#### Mastra

```typescript
// 当前无内置研究模式
// 需要通过 Agent + Tools 手动实现
```

**结论**: Khoj 的 Research Mode 是高价值功能，值得移植。

---

### 1.3 工具系统

#### Mastra

```typescript
// MCP (Model Context Protocol) 支持
// - 标准化工具协议
// - 63+ LLM 提供商
// - Input/Output 处理器 (guardrails, PII 检测)
// - 语音集成 (TTS/STT)

// 当前 Blinko 工具:
// - createCommentTool
// - updateBlinkoTool
// - upsertBlinkoTool
// - searchNotesTool (RAG)
```

#### Khoj

```python
# 内置工具:
# - semantic_search_files
# - regex_search_files
# - search_web
# - read_webpage
# - python_coder
# - operate_computer (Operator)
```

**结论**: 两者各有优势，Mastra 的 MCP 协议更具扩展性。

---

### 1.4 Agent 系统

#### Khoj

```python
# 完整 Agent 管理:
# - 自定义人格 (personality)
# - 知识库范围限定
# - 工具权限控制
# - 公开/私有 Agent
# - Agent 市场
```

#### Mastra

```typescript
// 基础 Agent 实现:
// - BaseChatAgent
// - CommentAgent
// - TagAgent
// 无完整的 Agent 管理系统
```

**结论**: Khoj 的 Agent 系统更完善，但可在 Mastra 上实现。

---

### 1.5 自动化任务

#### Khoj

```python
# 内置 Automation:
# - Cron 调度
# - 自然语言调度 ("每天早上9点")
# - 自动研究并通知
# - 结果存储
```

#### Mastra

```typescript
// Blinko 已有基础:
// - aiScheduledTask 表
// - 但无完整实现
```

**结论**: Khoj 的自动化更成熟，但 Blinko 已有数据模型基础。

---

## 2. 架构影响分析

### 2.1 保留 Khoj 的影响

```
优点:
- 获得成熟的 Research Mode
- 获得完整的 Agent 系统
- 获得自动化功能

缺点:
- 维护双技术栈 (TypeScript + Python)
- 部署复杂度增加 (需要独立 Khoj 服务)
- 数据同步问题 (两套数据库)
- 用户体验割裂 (iframe 或 API 代理)
```

### 2.2 保留 Mastra 的影响

```
优点:
- 单一技术栈，维护成本低
- 与 Blinko 深度集成
- 记忆系统更完善
- 部署简单 (单体应用)

缺点:
- 需要自建 Research Mode
- 需要完善 Agent 管理
- 需要实现自动化功能
```

---

## 3. 推荐方案: Mastra + 功能移植

### 3.1 核心决策

**保留 Mastra 作为 AI 核心**，原因:
1. 技术栈一致性 (TypeScript)
2. 记忆系统已完善
3. 部署和维护成本低
4. 与 Blinko 数据深度集成

### 3.2 从 Khoj 移植的功能

| 功能 | 优先级 | 实现方式 | 工作量 |
|------|--------|----------|--------|
| Research Mode | P0 | 基于 Mastra Agent + Tools | 2-3 周 |
| Agent 管理 | P1 | 扩展 aiModels 表 + UI | 1-2 周 |
| 自动化任务 | P1 | 完善 aiScheduledTask | 1 周 |
| 网络搜索 | P0 | 集成 Tavily/Serper | 2-3 天 |
| 代码执行 | P2 | 沙箱环境 | 1 周 |

### 3.3 实现路线图

```
Phase 1: 核心能力 (2周)
├── 实现 Research Agent
│   ├── 多轮迭代逻辑
│   ├── 工具编排
│   └── 结果聚合
├── 集成网络搜索
│   └── Tavily API
└── 完善 RAG 检索

Phase 2: Agent 系统 (2周)
├── Agent 数据模型
├── Agent CRUD API
├── Agent 选择 UI
└── 工具权限控制

Phase 3: 自动化 (1周)
├── 完善调度系统
├── 自然语言解析
└── 结果通知
```

---

## 4. 数据迁移计划

### 4.1 需要迁移的数据

如果已有 Khoj 数据:
- 对话历史 → Blinko conversation/message 表
- Agent 配置 → 新建 agent 表
- 自动化任务 → aiScheduledTask 表

### 4.2 迁移脚本

```typescript
// 示例: 迁移 Khoj 对话到 Blinko
async function migrateKhojConversations(khojClient: KhojClient, accountId: number) {
  const conversations = await khojClient.getConversations();
  
  for (const conv of conversations) {
    const messages = await khojClient.getConversation(conv.id);
    
    // 创建 Blinko 对话
    const blinkoConv = await prisma.conversation.create({
      data: {
        title: conv.title,
        accountId,
      },
    });
    
    // 迁移消息
    for (const msg of messages) {
      await prisma.message.create({
        data: {
          conversationId: blinkoConv.id,
          role: msg.role === 'khoj' ? 'assistant' : msg.role,
          content: msg.message,
        },
      });
    }
  }
}
```

---

## 5. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Research Mode 实现复杂度超预期 | 中 | 高 | 分阶段实现，先做基础版 |
| 用户依赖 Khoj 特定功能 | 低 | 中 | 提供迁移期并行运行 |
| 性能问题 | 低 | 中 | 使用流式响应，优化向量检索 |

---

## 6. 结论

**最终建议**: 

1. **短期 (1-2周)**: 继续使用 Khoj 作为独立服务，通过 API 网关集成
2. **中期 (1-2月)**: 在 Mastra 上实现 Research Mode 和 Agent 系统
3. **长期**: 完全迁移到 Mastra，废弃 Khoj 服务

这个方案平衡了:
- 技术债务最小化
- 功能完整性
- 开发资源效率
- 用户体验一致性

---

## 附录: 代码参考

### A. Blinko AI 服务入口
`get/blinko-main/server/aiServer/index.ts`

### B. Blinko 记忆系统
`get/blinko-main/server/aiServer/memory.ts`

### C. Khoj 客户端
`get/blinko-main/server/lib/khojClient.ts`

### D. 数据库 Schema
`get/blinko-main/prisma/schema.prisma`
