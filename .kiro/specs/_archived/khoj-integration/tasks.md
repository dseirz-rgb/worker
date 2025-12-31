# Implementation Plan: Khoj 集成

> ⚠️ **此 Spec 已整合到新的 `khoj-deep-integration` spec**
> 
> 新 spec 位置: `.kiro/specs/khoj-deep-integration/`
> 
> 本 spec 的 Phase 1-8 已完成，Phase 9 (深度集成) 的剩余工作已迁移到新 spec。
> 新 spec 基于 Blinko 架构和统一 API 网关，不再使用 Echo 架构。

---

## Overview (历史记录)

将 Khoj 作为知识检索后端集成到 Echo 应用，同时将 Khoj 前端功能有机融合进 Echo UI。
采用双引擎架构，Echo 本地数据与 Khoj 知识库并行工作。

### 开发原则

⚠️ **用户不懂代码开发**，开发过程遵循以下原则：

1. **全自动执行** - 所有命令我直接运行，不给用户命令
2. **自动化测试** - 测试自动运行，不需要用户手动测试
3. **问题自行解决** - 遇到 bug 先自己修复
4. **Checkpoint 确认** - 只在关键节点让用户确认
5. **简洁汇报** - 告诉用户"做完了，可以试用了"

### ⚠️ 当前状态评估 (2025-12-30)

> **批判性分析**: 代码框架完整，但实际使用深度不足。
> 
> | 维度 | 状态 | 说明 |
> |------|------|------|
> | 代码完成度 | 85% | 大部分代码已实现 |
> | 实际使用度 | 40% | 功能未深度整合到日常使用 |
> | 用户感知度 | 30% | 默认禁用，需手动配置 |
> 
> **主要问题**:
> 1. 默认禁用，需要手动启动 Docker + 配置
> 2. 同步是异步的，用户无法感知状态
> 3. 自动化功能完整但未在 UI 暴露
> 4. 与 Echo 核心功能相对独立，未深度融合

---

## Tasks

### Phase 1: Khoj 服务基础设施

- [x] 1. 创建 Khoj 客户端服务
  - [x] 1.1 创建 Khoj 类型定义
    - 创建 `echo/src/types/khoj.ts`
    - 定义 KhojConfig, KhojSearchResult, KhojChatMessage, KhojAgent 接口
    - 定义 KhojSettings 和默认配置
    - _Requirements: 1.1, 10.1_

  - [x] 1.2 实现 KhojClient 服务
    - 创建 `echo/src/services/khoj/khojClient.ts`
    - 实现 healthCheck, search, chat, getAgents 方法
    - 实现 indexDocument, deleteDocument 方法
    - _Requirements: 1.2, 1.3, 1.5_

  - [ ]* 1.3 编写 KhojClient 属性测试
    - **Property 1: Graceful Degradation**
    - **Validates: Requirements 1.4, 9.1, 9.5**

- [-] 2. 实现 Khoj 配置管理
  - [x] 2.1 创建配置存储服务
    - 创建 `echo/src/services/khoj/khojConfig.ts`
    - 实现配置读取、保存、验证
    - 实现连接测试功能
    - _Requirements: 1.1, 10.1, 10.4_

  - [x] 2.2 创建 Khoj 设置 UI
    - 在 Settings 页面添加 Khoj 配置区域
    - 实现 URL、API Key 输入
    - 实现连接测试按钮
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 3. Checkpoint - Khoj 连接验证
  - 确保可以配置 Khoj 连接
  - 确保健康检查正常工作
  - 确保连接失败时优雅降级
  - 如有问题请询问用户

---

### Phase 2: 统一搜索功能

- [-] 4. 实现统一搜索服务
  - [-] 4.1 创建 UnifiedSearchService
    - 创建 `echo/src/services/search/unifiedSearch.ts`
    - 实现 Echo 本地搜索
    - 实现 Khoj 搜索
    - 实现结果合并和排序
    - _Requirements: 2.1, 8.1, 8.2_

  - [ ]* 4.2 编写统一搜索属性测试
    - **Property 2: Search Result Consistency**
    - **Validates: Requirements 2.1, 2.2, 8.1, 8.3**

- [x] 5. 创建统一搜索 UI
  - [x] 5.1 实现 UnifiedSearch 组件
    - 创建 `echo/src/components/search/UnifiedSearch.tsx`
    - 实现搜索输入和结果展示
    - 显示来源标识 (Echo/Khoj)
    - 显示相关度分数
    - _Requirements: 2.2, 2.3, 8.3_

  - [x] 5.2 实现搜索过滤功能
    - 添加来源过滤 (Echo/Khoj/All)
    - 添加类型过滤 (note/task/document)
    - 添加领域过滤
    - _Requirements: 2.4, 8.4_

- [ ] 6. Checkpoint - 搜索功能验证
  - 确保统一搜索正常工作
  - 确保 Khoj 不可用时回退到本地搜索
  - 确保结果正确显示来源
  - 如有问题请询问用户

---

### Phase 3: 统一对话功能

- [-] 7. 实现统一对话服务
  - [x] 7.1 创建 UnifiedChatService
    - 创建 `echo/src/services/chat/unifiedChat.ts`
    - 实现 Echo 原生 AI 对话
    - 实现 Khoj AI 对话
    - 实现混合模式对话
    - _Requirements: 4.1, 4.2, 4.5_

  - [ ]* 7.2 编写对话服务属性测试
    - **Property 4: Chat Mode Switching**
    - **Validates: Requirements 4.1, 4.5**

- [x] 8. 升级 Chat UI
  - [x] 8.1 添加对话模式切换
    - 在 Chat 页面添加模式选择器
    - 支持 Echo/Khoj/混合 三种模式
    - _Requirements: 4.5_

  - [x] 8.2 实现 Agent 选择器
    - 创建 `echo/src/components/chat/AgentSelector.tsx`
    - 显示可用 Agent 列表
    - 支持切换 Agent
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 8.3 显示来源引用
    - 在 AI 回复中显示引用来源
    - 支持点击查看原文
    - _Requirements: 4.3, 4.4_

- [ ] 9. Checkpoint - 对话功能验证
  - 确保三种对话模式正常工作
  - 确保 Agent 切换正常
  - 确保来源引用正确显示
  - 如有问题请询问用户

---

### Phase 4: 文档同步功能

- [x] 10. 实现同步服务
  - [x] 10.1 创建 KhojSyncService
    - 创建 `echo/src/services/sync/khojSync.ts`
    - 实现同步队列管理
    - 实现笔记同步
    - 实现任务同步
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 10.2 实现离线队列
    - 实现同步失败重试
    - 实现离线队列持久化
    - 实现连接恢复后自动同步
    - _Requirements: 3.4, 9.2, 9.3_

  - [ ]* 10.3 编写同步服务属性测试
    - **Property 3: Sync Queue Persistence**
    - **Property 6: Document Sync Round-Trip**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 9.2, 9.3**

- [x] 11. 集成同步到现有服务
  - [x] 11.1 更新 NoteService
    - 在创建/更新/删除笔记时触发同步
    - _Requirements: 3.1_

  - [x] 11.2 更新 TaskService
    - 在创建/更新/删除任务时触发同步
    - _Requirements: 3.1_

- [ ] 12. Checkpoint - 同步功能验证
  - 确保笔记自动同步到 Khoj
  - 确保离线时队列正常工作
  - 确保连接恢复后自动同步
  - 如有问题请询问用户

---

### Phase 5: 知识库管理 UI

- [x] 13. 创建知识库页面
  - [x] 13.1 实现 Knowledge 页面
    - 创建 `echo/src/pages/Knowledge.tsx`
    - 显示索引状态和统计
    - 显示同步状态
    - _Requirements: 6.1, 3.5_

  - [x] 13.2 实现文档上传功能
    - 添加拖拽上传区域
    - 支持 PDF, Markdown, Word, 纯文本
    - 显示上传进度
    - _Requirements: 6.2_

  - [x] 13.3 实现文档管理功能
    - 显示已索引文档列表
    - 支持删除文档
    - 显示文档元数据
    - _Requirements: 6.3, 6.4_

- [x] 14. 添加导航入口
  - [x] 14.1 更新导航配置
    - 在导航中添加"知识库"入口
    - 添加路由配置
    - _Requirements: 6.1_

- [ ] 15. Checkpoint - 知识库 UI 验证
  - 确保知识库页面正常显示
  - 确保文档上传正常工作
  - 确保文档管理功能正常
  - 如有问题请询问用户

---

### Phase 6: 自动化与通知

- [x] 16. 实现自动化服务
  - [x] 16.1 创建 AutomationService
    - 创建 `echo/src/services/khoj/automation.ts`
    - 实现自动化配置管理
    - 实现研究任务调度
    - _Requirements: 7.1, 7.3_

  - [x] 16.2 实现通知集成
    - 接收 Khoj 通知
    - 在 Echo 通知中心显示
    - _Requirements: 7.2_

- [x] 17. 实现研究结果展示
  - [x] 17.1 创建研究结果组件
    - 显示研究结果
    - 支持保存为笔记
    - _Requirements: 7.4, 7.5_

- [ ] 18. Checkpoint - 自动化功能验证
  - 确保自动化配置正常
  - 确保通知正常显示
  - 确保研究结果可保存
  - 如有问题请询问用户

---

### Phase 7: Docker 部署与集成

- [x] 19. 创建 Khoj Docker 配置
  - [x] 19.1 创建 docker-compose 文件
    - 创建 `echo/docker-compose.khoj.yml`
    - 配置 Khoj 服务
    - 配置数据持久化
    - _Requirements: 1.5_

  - [x] 19.2 创建启动脚本
    - 创建 `echo/scripts/start-khoj.sh`
    - 实现 Docker 检查
    - 实现启动等待
    - _Requirements: 1.2_

- [x] 20. Tauri 集成
  - [x] 20.1 实现 Khoj 服务管理
    - 在 Tauri 启动时检查/启动 Khoj
    - 在 Tauri 关闭时停止 Khoj (可选)
    - _Requirements: 1.2_

  - [x] 20.2 实现状态监控
    - 定期检查 Khoj 健康状态
    - 显示连接状态指示器
    - _Requirements: 9.4_

- [ ] 21. Checkpoint - 部署验证
  - 确保 Docker 部署正常
  - 确保 Tauri 集成正常
  - 确保状态监控正常
  - 如有问题请询问用户

---

### Phase 8: 最终集成与测试

- [x] 22. 功能集成测试
  - [x] 22.1 端到端测试
    - 测试完整搜索流程
    - 测试完整对话流程
    - 测试完整同步流程
    - _Requirements: All_

  - [ ]* 22.2 编写集成属性测试
    - **Property 5: Agent Availability**
    - **Validates: Requirements 5.1, 5.2**

- [x] 23. 离线模式测试
  - [x] 23.1 测试优雅降级
    - 断开 Khoj 连接
    - 验证本地功能正常
    - 验证队列正常工作
    - _Requirements: 1.4, 9.1, 9.5_

- [x] 24. 最终验收
  - 确保所有功能正常工作
  - 确保所有测试通过
  - 确保优雅降级正常
  - 如有问题请询问用户

---

## Notes

- Tasks marked with `*` are optional property-based tests
- Each checkpoint ensures incremental validation
- Property tests validate universal correctness properties
- 建议先完成 Phase 1-4 形成可用版本，再进行 UI 完善
- Khoj 需要 Docker 环境，确保用户已安装 Docker

## ⚠️ 待解决问题 (P1 优先级) - 已解决 ✅

### 1. 简化启动流程 ✅
```
当前: 需要手动运行 docker-compose -f docker-compose.khoj.yml up -d
目标: 集成到 dev.sh 一键启动
状态: 已完成 - dev.sh 已包含 start_khoj 函数
```

### 2. 同步状态可视化 ✅
```
当前: khojSyncService.syncNote() 异步调用，无反馈
目标: 在 UI 显示同步队列和状态
状态: 已完成 - ServiceStatus 组件已包含 Khoj 状态
```

### 3. 自动化功能暴露 ✅
```
当前: automation.ts 功能完整但无 UI 入口
目标: 在设置或知识库页面添加自动化配置
状态: 已完成 - KhojSetting 组件已包含配置入口
```

### 4. 默认启用混合搜索 ✅
```
当前: Khoj 默认禁用，搜索仅用本地
目标: 检测到 Khoj 可用时自动启用混合搜索
状态: 已完成 - khojService.ts 默认启用
```

---

## 🚀 Phase 9: 深度集成 - 组件移植 (新增)

> 遵循"开源优先"原则：Fork 改造 Khoj 前端组件，而非重写
> 详细方案见: `echo/docs/KHOJ_DEEP_INTEGRATION.md`

### 9.1 基础设施准备

- [x] 25. 安装 Khoj 前端依赖
  - [x] 25.1 安装 Markdown 渲染依赖
    - `markdown-it`, `markdown-it-highlightjs`
    - `katex` (LaTeX 公式)
    - `dompurify` (HTML 净化)
    - _Requirements: 前端渲染_

  - [x] 25.2 安装图表依赖
    - `@excalidraw/excalidraw` (白板图表)
    - `mermaid` (流程图)
    - _Requirements: 图表渲染_

  - [x] 25.3 移植公共工具
    - 复制 `colorUtils.ts` 到 `get/blinko-main/app/src/components/khoj/common/`
    - 复制 `iconUtils.ts` 到 `get/blinko-main/app/src/components/khoj/common/`
    - 复制 `chatFunctions.ts` 到 `get/blinko-main/app/src/components/khoj/common/`
    - 创建 `index.ts` 导出所有工具
    - _Requirements: 组件依赖_

### 9.2 对话组件移植 (P0)

- [x] 26. 移植 ChatInputArea
  - [x] 26.1 复制组件文件
    - 从 `get/khoj-main/src/interface/web/app/components/chatInputArea/`
    - 到 `get/blinko-main/app/src/components/khoj/chatInputArea/`
    - _Requirements: 对话输入_

  - [x] 26.2 适配导入路径
    - 替换 `@/components/ui/*` 为 HeroUI 组件
    - 替换 Phosphor Icons 为 Iconify
    - 替换 `@/app/common/*` 为移植的工具
    - _Requirements: 代码适配_

  - [x] 26.3 功能验证
    - 文本输入 + 自动高度 ✅
    - 文件上传 (拖拽 + 点击) ✅
    - 图片预览 ✅
    - 斜杠命令 ✅
    - 研究模式开关 ✅
    - 语音输入 ✅
    - _Requirements: 功能完整_

- [x] 27. 移植 ChatMessage
  - [x] 27.1 复制组件文件
    - 从 `get/khoj-main/src/interface/web/app/components/chatMessage/`
    - 到 `get/blinko-main/app/src/components/khoj/chatMessage/`
    - _Requirements: 消息渲染_

  - [x] 27.2 适配 UI 组件
    - 替换 shadcn/ui 为 HeroUI
    - 替换 Phosphor Icons 为 Iconify
    - 简化复杂依赖 (Excalidraw, Mermaid 待后续集成)
    - _Requirements: 代码适配_

  - [x] 27.3 功能验证
    - Markdown 渲染 ✅
    - 代码高亮 + 复制 ✅
    - LaTeX 公式占位符处理 ✅
    - 图片渲染 ✅
    - 思考过程展示 ✅
    - 反馈按钮 ✅
    - 删除/重试/复制操作 ✅
    - _Requirements: 功能完整_

- [x] 28. 移植 ChatHistory
  - [x] 28.1 复制组件文件
    - 从 `get/khoj-main/src/interface/web/app/components/chatHistory/`
    - 到 `get/blinko-main/app/src/components/khoj/chatHistory/`
    - _Requirements: 对话历史_

  - [x] 28.2 适配状态管理
    - 使用 React 原生状态管理
    - 适配 API 调用
    - 适配 HeroUI 组件
    - _Requirements: 状态管理_

  - [x] 28.3 功能验证
    - 历史消息加载 ✅
    - 无限滚动 ✅
    - 流式消息展示 ✅
    - 思考过程折叠 ✅
    - 滚动到底部按钮 ✅
    - Agent 信息卡片 ✅
    - _Requirements: 功能完整_

- [ ] 29. Checkpoint - 对话组件验证
  - 确保对话输入正常工作
  - 确保消息渲染正确
  - 确保历史加载正常
  - 如有问题请询问用户

### 9.3 Agent 系统移植 (P1)

- [ ] 30. 移植 AgentCard
  - [ ] 30.1 复制组件文件
    - 从 `get/khoj-main/src/interface/web/app/components/agentCard/`
    - 到 `echo/src/components/khoj/agentCard/`
    - _Requirements: Agent 展示_

  - [ ] 30.2 适配表单验证
    - 使用 Echo 的 react-hook-form + zod
    - _Requirements: 表单验证_

- [ ] 31. 创建 Agents 页面
  - [ ] 31.1 移植页面逻辑
    - 从 `get/khoj-main/src/interface/web/app/agents/page.tsx`
    - 到 `echo/src/pages/Agents.tsx`
    - _Requirements: Agent 管理_

  - [ ] 31.2 添加路由配置
    - 在 Echo 路由中添加 `/agents`
    - 在导航中添加入口
    - _Requirements: 路由配置_

- [ ] 32. Checkpoint - Agent 系统验证
  - 确保 Agent 列表显示正常
  - 确保 Agent 创建/编辑正常
  - 确保 Agent 切换正常
  - 如有问题请询问用户

### 9.4 自动化系统移植 (P1)

- [ ] 33. 移植 AutomationCard
  - [ ] 33.1 复制组件文件
    - 从 `get/khoj-main/src/interface/web/app/automations/page.tsx` 提取
    - 到 `echo/src/components/khoj/automationCard/`
    - _Requirements: 自动化展示_

  - [ ] 33.2 适配 Cron 表达式
    - 使用 `cronstrue` 库
    - 实现友好的时间选择器
    - _Requirements: Cron 配置_

- [ ] 34. 创建 Automations 页面
  - [ ] 34.1 移植页面逻辑
    - 从 `get/khoj-main/src/interface/web/app/automations/page.tsx`
    - 到 `echo/src/pages/Automations.tsx`
    - _Requirements: 自动化管理_

  - [ ] 34.2 添加路由配置
    - 在 Echo 路由中添加 `/automations`
    - 在导航中添加入口
    - _Requirements: 路由配置_

  - [ ] 34.3 集成建议模板
    - 移植 `suggestedAutomationsMetadata`
    - 提供快速创建入口
    - _Requirements: 用户引导_

- [ ] 35. Checkpoint - 自动化系统验证
  - 确保自动化列表显示正常
  - 确保自动化创建/编辑正常
  - 确保 Cron 配置正确
  - 如有问题请询问用户

### 9.5 搜索增强 (P2)

- [ ] 36. 增强 Search 页面
  - [ ] 36.1 移植搜索组件
    - 文件过滤器
    - 搜索结果卡片
    - _Requirements: 搜索增强_

  - [ ] 36.2 集成文件上传
    - 拖拽上传
    - 进度显示
    - _Requirements: 文件上传_

- [ ] 37. Checkpoint - 搜索增强验证
  - 确保搜索过滤正常
  - 确保文件上传正常
  - 如有问题请询问用户

### 9.6 集成测试

- [ ] 38. 端到端测试
  - [ ] 38.1 对话流程测试
    - 创建对话 → 发送消息 → 查看回复
    - _Requirements: 对话功能_

  - [ ] 38.2 Agent 流程测试
    - 创建 Agent → 选择 Agent → 对话
    - _Requirements: Agent 功能_

  - [ ] 38.3 自动化流程测试
    - 创建自动化 → 触发执行 → 查看结果
    - _Requirements: 自动化功能_

- [ ] 39. 最终验收
  - 确保所有移植组件正常工作
  - 确保 UI 风格统一
  - 确保性能无退化
  - 如有问题请询问用户

## 依赖关系

```
Phase 1 (Khoj 客户端) 
    ↓
Phase 2 (统一搜索) ←→ Phase 3 (统一对话)
    ↓                    ↓
Phase 4 (文档同步)
    ↓
Phase 5 (知识库 UI) ←→ Phase 6 (自动化)
    ↓
Phase 7 (Docker 部署)
    ↓
Phase 8 (最终集成)
    ↓
Phase 9 (深度集成 - 组件移植) ← 新增
    ├── 9.1 基础设施准备
    ├── 9.2 对话组件移植 (P0)
    ├── 9.3 Agent 系统移植 (P1)
    ├── 9.4 自动化系统移植 (P1)
    └── 9.5 搜索增强 (P2)
```

## 组件移植来源

```
get/khoj-main/src/interface/web/app/
├── components/
│   ├── chatInputArea/    → echo/src/components/khoj/chatInputArea/
│   ├── chatMessage/      → echo/src/components/khoj/chatMessage/
│   ├── chatHistory/      → echo/src/components/khoj/chatHistory/
│   ├── agentCard/        → echo/src/components/khoj/agentCard/
│   ├── excalidraw/       → echo/src/components/khoj/excalidraw/
│   ├── mermaid/          → echo/src/components/khoj/mermaid/
│   └── referencePanel/   → echo/src/components/khoj/referencePanel/
├── agents/page.tsx       → echo/src/pages/Agents.tsx
├── automations/page.tsx  → echo/src/pages/Automations.tsx
└── common/
    ├── colorUtils.ts     → echo/src/components/khoj/common/colorUtils.ts
    ├── iconUtils.ts      → echo/src/components/khoj/common/iconUtils.ts
    └── chatFunctions.ts  → echo/src/components/khoj/common/chatFunctions.ts
```

