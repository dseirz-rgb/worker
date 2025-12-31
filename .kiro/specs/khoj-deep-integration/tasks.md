# Implementation Plan - Khoj 深度集成 (Blinko)

## Overview

将 Khoj 功能深度集成到 Blinko，利用已完成的统一 API 网关。
本计划整合了之前 spec 的剩余工作，聚焦于 Blinko 架构。

### 开发原则

⚠️ **用户不懂代码开发**，开发过程遵循以下原则：

1. **全自动执行** - 所有命令直接运行
2. **问题自行解决** - 遇到 bug 先自己修复
3. **Checkpoint 确认** - 只在关键节点让用户确认
4. **简洁汇报** - 告诉用户"做完了，可以试用了"

### 已完成的基础设施

| 组件 | 文件 | 状态 |
|------|------|------|
| KhojClient | `server/lib/khojClient.ts` | ✅ 完成 |
| Khoj tRPC Router | `server/routerTrpc/khoj.ts` | ✅ 完成 |
| Gateway Service | `app/src/lib/gateway.ts` | ✅ 完成 |
| Service Status | `app/src/hooks/useServiceStatus.ts` | ✅ 完成 |
| Chat Components | `app/src/components/khoj/` | ✅ 已移植 |

---

## Tasks

### Phase 1: 原生对话页面

- [ ] 1. 重构 Khoj 页面为原生组件
  - [ ] 1.1 创建对话状态管理
    - 创建 `app/src/hooks/useKhojChat.ts`
    - 实现消息列表状态
    - 实现对话 ID 管理
    - 实现发送消息逻辑
    - _Requirements: 1.1, 1.2, 1.4_

  - [ ] 1.2 重构 khoj.tsx 页面
    - 移除 iframe 方案
    - 使用已有的 ChatHistory, ChatInputArea, ChatMessage 组件
    - 集成 useKhojChat hook
    - 添加对话列表侧边栏
    - _Requirements: 1.1, 1.3, 1.5_

  - [ ] 1.3 实现对话历史加载
    - 调用 `api.khoj.getConversations`
    - 显示对话列表
    - 支持切换对话
    - 支持删除对话
    - _Requirements: 1.5_

  - [ ] 1.4 实现错误处理
    - 检测 Khoj 服务状态
    - 显示友好错误提示
    - 提供重试按钮
    - _Requirements: 1.6_

- [ ] 2. Checkpoint - 对话功能验证
  - 确保原生对话正常工作
  - 确保消息正确渲染
  - 确保历史加载正常
  - 如有问题请询问用户

---

### Phase 2: Agent 管理

- [ ] 3. 创建 Agent 组件
  - [ ] 3.1 创建 AgentCard 组件
    - 创建 `app/src/components/khoj/agentCard/AgentCard.tsx`
    - 显示 Agent 信息 (名称、头像、描述)
    - 添加选择、编辑、删除按钮
    - _Requirements: 2.1, 2.4_

  - [ ] 3.2 创建 AgentForm 组件
    - 创建 `app/src/components/khoj/agentCard/AgentForm.tsx`
    - 实现名称、人格、工具、模型配置
    - 实现颜色和图标选择
    - 实现表单验证
    - _Requirements: 2.2, 2.3_

- [ ] 4. 创建 Agents 页面
  - [ ] 4.1 创建 agents.tsx 页面
    - 创建 `app/src/pages/agents.tsx`
    - 显示 Agent 列表 (网格布局)
    - 添加"创建 Agent"入口
    - _Requirements: 2.1_

  - [ ] 4.2 实现 Agent CRUD
    - 调用 `api.khoj.getAgents`
    - 调用 `api.khoj.createAgent`
    - 调用 `api.khoj.updateAgent`
    - 调用 `api.khoj.deleteAgent`
    - _Requirements: 2.2, 2.3, 2.4_

  - [ ] 4.3 集成 Agent 选择到对话
    - 在对话页面添加 Agent 选择器
    - 切换 Agent 时更新对话上下文
    - _Requirements: 2.5_

- [ ] 5. Checkpoint - Agent 功能验证
  - 确保 Agent 列表显示正常
  - 确保 Agent 创建/编辑/删除正常
  - 确保 Agent 选择在对话中生效
  - 如有问题请询问用户

---

### Phase 3: 自动化任务

- [ ] 6. 创建 Automation 组件
  - [ ] 6.1 创建 AutomationCard 组件
    - 创建 `app/src/components/khoj/automationCard/AutomationCard.tsx`
    - 显示任务信息 (主题、查询、计划)
    - 显示下次执行时间
    - 添加运行、编辑、删除按钮
    - _Requirements: 3.1_

  - [ ] 6.2 创建 AutomationForm 组件
    - 创建 `app/src/components/khoj/automationCard/AutomationForm.tsx`
    - 实现查询输入
    - 实现 Cron 表达式配置 (使用友好的时间选择器)
    - 实现通知设置
    - _Requirements: 3.2_

- [ ] 7. 创建 Automations 页面
  - [ ] 7.1 创建 automations.tsx 页面
    - 创建 `app/src/pages/automations.tsx`
    - 显示自动化任务列表
    - 添加"创建任务"入口
    - 显示建议模板
    - _Requirements: 3.1_

  - [ ] 7.2 实现 Automation CRUD
    - 调用 `api.khoj.getAutomations`
    - 调用 `api.khoj.createAutomation`
    - 调用 `api.khoj.deleteAutomation`
    - _Requirements: 3.2, 3.4_

  - [ ] 7.3 实现结果查看
    - 显示自动化执行结果
    - 显示来源引用
    - 支持保存为笔记
    - _Requirements: 3.3, 3.4_

- [ ] 8. Checkpoint - 自动化功能验证
  - 确保自动化列表显示正常
  - 确保自动化创建/删除正常
  - 确保 Cron 配置正确
  - 如有问题请询问用户

---

### Phase 4: 导航集成

- [x] 9. 更新导航配置
  - [x] 9.1 添加路由配置
    - 在 App.tsx 添加 /agents 路由
    - 在 App.tsx 添加 /automations 路由
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 9.2 更新侧边栏
    - 添加 "Khoj AI" 导航组
    - 添加 "对话" 子项 (/khoj)
    - 添加 "Agents" 子项 (/agents)
    - 添加 "自动化" 子项 (/automations)
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 9.3 添加服务状态指示
    - 在导航项旁显示 Khoj 服务状态
    - 服务离线时显示警告图标
    - _Requirements: 6.4_

- [x] 10. Checkpoint - 导航验证
  - 确保所有导航项正常显示
  - 确保路由跳转正常
  - 确保服务状态指示正确
  - 如有问题请询问用户

---

### Phase 5: 优化与测试

- [x] 11. UI 优化
  - [x] 11.1 主题适配
    - 确保所有组件支持 dark/light 主题
    - 使用 HeroUI 组件保持一致性
    - _Requirements: 5.3, 5.4_

  - [x] 11.2 响应式布局
    - 确保移动端正常显示
    - 优化对话页面布局
    - _Requirements: 5.1_

- [x] 12. 集成测试
  - [x] 12.1 对话流程测试
    - 创建对话 → 发送消息 → 查看回复
    - 切换 Agent → 发送消息
    - _Requirements: 1.1, 1.2, 2.5_

  - [x] 12.2 Agent 流程测试
    - 创建 Agent → 编辑 → 删除
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 12.3 自动化流程测试
    - 创建自动化 → 查看结果 → 删除
    - _Requirements: 3.2, 3.3, 3.4_

- [x] 13. 最终验收
  - 确保所有功能正常工作
  - 确保 UI 风格统一
  - 确保错误处理完善
  - 如有问题请询问用户

---

## 依赖关系

```
Phase 1 (原生对话)
    ↓
Phase 2 (Agent 管理) ←→ Phase 3 (自动化)
    ↓                    ↓
Phase 4 (导航集成)
    ↓
Phase 5 (优化测试)
```

## 文件清单

```
get/blinko-main/app/src/
├── pages/
│   ├── khoj.tsx              # 重构：原生对话
│   ├── agents.tsx            # 新增：Agent 管理
│   └── automations.tsx       # 新增：自动化任务
├── components/khoj/
│   ├── chatInputArea/        # 已有
│   ├── chatMessage/          # 已有
│   ├── chatHistory/          # 已有
│   ├── agentCard/            # 新增
│   │   ├── AgentCard.tsx
│   │   └── AgentForm.tsx
│   └── automationCard/       # 新增
│       ├── AutomationCard.tsx
│       └── AutomationForm.tsx
├── hooks/
│   └── useKhojChat.ts        # 新增：对话状态管理
└── lib/
    └── gateway.ts            # 已有：khojService
```

## 完成进度

| Phase | 状态 | 预估时间 |
|-------|------|----------|
| Phase 1 | ✅ 完成 | 2 小时 |
| Phase 2 | ✅ 完成 | 2 小时 |
| Phase 3 | ✅ 完成 | 2 小时 |
| Phase 4 | ✅ 完成 | 1 小时 |
| Phase 5 | ✅ 完成 | 1 小时 |
| **总计** | **13/13 完成** | **~8 小时** |

