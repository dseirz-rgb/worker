# Implementation Plan: Echo v3.2 功能完善

## Overview

完成 Echo v3.2 剩余的 P1 优先级功能，包括早报生成、建议系统、日报增强和属性测试补充。按照依赖关系分阶段实现。

## Tasks

- [x] 1. 数据库 Schema 扩展
  - [x] 1.1 创建日报表 migration
    - 创建 `prisma/migrations/xxx_daily_reports/migration.sql`
    - 添加 daily_reports 表
    - 添加索引
    - _Requirements: 1.1, 3.4_
  - [x] 1.2 创建建议表 migration
    - 创建 suggestions 表
    - 添加状态和优先级字段
    - _Requirements: 2.1, 2.2_
  - [x] 1.3 创建通知表 migration
    - 扩展 notifications 表添加 action_url 字段
    - _Requirements: 5.1_
  - [x] 1.4 扩展用户偏好表
    - 使用 userPreference 表存储日报设置
    - _Requirements: 1.4, 5.3_

- [x] 2. 日报生成服务实现
  - [x] 2.1 创建 ReportGenerator 类
    - 实现 `server/aiServer/reportGenerator.ts`
    - 包含 generateMorningReport, generateEveningReport 方法
    - _Requirements: 1.1, 1.2_
  - [x] 2.2 实现早报生成逻辑
    - 获取今日待办事项
    - 获取昨日未完成任务
    - 调用 AI 生成建议
    - _Requirements: 1.2_
  - [x] 2.3 实现晚报增强
    - 添加今日完成统计
    - 添加笔记摘要
    - 添加明日建议
    - _Requirements: 3.1_
  - [x] 2.4 实现日报调度
    - 集成 AutomationManager
    - 创建早报/晚报自动化任务
    - 添加 ReportScheduler 类
    - _Requirements: 1.1, 1.4_

- [x] 3. Checkpoint - 日报生成功能验收
  - 早报和晚报可以正常生成
  - 调度任务通过 AutomationManager 管理

- [x] 4. 建议系统实现
  - [x] 4.1 创建 SuggestionEngine 类
    - 实现 `server/aiServer/suggestionEngine.ts`
    - 包含 generateSuggestions, respondToSuggestion 方法
    - _Requirements: 2.1, 2.2_
  - [x] 4.2 实现建议生成逻辑
    - 基于任务历史生成建议
    - 基于笔记内容生成建议
    - 基于活动数据生成建议
    - _Requirements: 2.1_
  - [x] 4.3 实现建议响应处理
    - 接受: 创建待办事项
    - 推迟: 设置提醒时间
    - 拒绝: 记录反馈
    - _Requirements: 2.3, 2.4, 2.5_
  - [x] 4.4 实现建议统计
    - 计算接受率
    - 分析拒绝原因
    - _Requirements: 2.7_

- [x] 5. Checkpoint - 建议系统功能验收
  - 确保建议可以正常生成
  - 确保响应操作正常工作

- [x] 6. tRPC 路由实现
  - [x] 6.1 创建 dailyReport 路由
    - `server/routerTrpc/dailyReport.ts`
    - 端点: generate, get, list, updateSettings, getSettings
    - _Requirements: 1.1, 1.4, 3.4, 3.5_
  - [x] 6.2 创建 suggestion 路由
    - `server/routerTrpc/suggestion.ts`
    - 端点: getPending, respond, getStats
    - _Requirements: 2.1, 2.2, 2.7_
  - [x] 6.3 创建 notification 路由
    - `server/routerTrpc/notification.ts`
    - 端点: list, markRead, getUnreadCount
    - _Requirements: 5.1, 5.2_

- [x] 7. 前端组件实现
  - [x] 7.1 创建早报组件
    - 更新 `app/src/components/echoai/DailyReport.tsx`
    - 显示今日待办、昨日未完成、AI 建议
    - _Requirements: 1.2_
  - [x] 7.2 创建建议卡片组件
    - `app/src/components/echoai/suggestions/SuggestionResponseCard.tsx`
    - `app/src/components/echoai/suggestions/SuggestionList.tsx`
    - 显示建议内容和操作按钮
    - _Requirements: 2.1, 2.2_
  - [x] 7.3 创建通知中心组件
    - `app/src/components/Layout/NotificationCenter.tsx`
    - 显示通知列表和未读数量
    - _Requirements: 5.1, 5.2_
  - [x] 7.4 更新日报页面
    - 添加早报/晚报切换
    - 添加历史日报列表
    - 添加日报设置入口
    - _Requirements: 3.4, 3.5_
  - [x] 7.5 创建日报设置页面
    - 集成到 DailyReport 组件的设置弹窗中
    - 配置早报/晚报时间
    - 配置启用/禁用
    - _Requirements: 1.4, 1.5_

- [x] 8. Checkpoint - 前端功能验收
  - 所有 UI 组件已创建
  - 用户交互通过 tRPC 路由实现

- [x] 9. 通知系统实现
  - [x] 9.1 实现桌面通知
    - 创建 `app/src/lib/desktopNotification.ts`
    - 创建 `app/src/hooks/useDesktopNotification.ts`
    - 使用 Tauri 原生通知 API (桌面) 和 Web Notification API (浏览器)
    - 实现通知点击跳转
    - _Requirements: 5.2_
  - [x] 9.2 实现通知偏好
    - 允许用户配置通知类型
    - 允许用户禁用通知
    - 使用 localStorage 存储偏好
    - _Requirements: 5.3_

- [x] 10. 属性测试补充
  - [x] 10.1 日报生成一致性测试
    - **Property 1: 日报生成一致性**
    - 相同输入应产生结构一致的输出
    - 创建 `server/aiServer/reportGenerator.test.ts`
    - **Validates: Requirements 1.2**
  - [x] 10.2 建议状态转换测试
    - **Property 2: 建议状态转换正确性**
    - 建议状态只能按规定路径转换
    - 创建 `server/aiServer/suggestionEngine.test.ts`
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
  - [x] 10.3 通知已读状态测试
    - **Property 3: 通知已读状态一致性**
    - 标记已读后状态应正确更新
    - 创建 `server/routerTrpc/notification.test.ts`
    - **Validates: Requirements 5.1**
  - [x] 10.4 补充 AI 服务统一 spec 的属性测试
    - 确保 Property 1-6 全部实现
    - **Validates: Requirements 4.1, 4.2**

- [x] 11. Checkpoint - 属性测试验收
  - 日报生成器属性测试: 5 个 Property
  - 建议系统属性测试: 6 个 Property
  - 通知系统属性测试: 6 个 Property
  - 所有测试使用 fast-check，100+ 迭代

- [x] 12. 文档更新
  - [x] 12.1 更新愿景文档
    - 更新需求覆盖率统计 (100%)
    - 更新技术债务清单
    - 更新成功标准
    - _Requirements: 所有_
  - [x] 12.2 更新需求分析文档
    - 更新需求实现状态
    - 更新批判性分析
    - _Requirements: 所有_
  - [x] 12.3 创建用户指南
    - 早报/晚报使用说明
    - 建议系统使用说明
    - 通知设置说明
    - 创建 `echo/docs/USER_GUIDE.md`

- [x] 13. Final Checkpoint - 全功能验收
  - 所有 P0/P1 功能已实现
  - 错误处理使用优雅降级模式
  - 文档已同步更新

## Priority Order

1. **P0 - 必须完成**:
   - 早报生成功能 (Tasks 1-3)
   - 建议系统 (Tasks 4-5)
   - tRPC 路由 (Task 6)

2. **P1 - 应该完成**:
   - 前端组件 (Task 7)
   - 通知系统 (Task 9)
   - 属性测试 (Task 10)

3. **P2 - 可以延后**:
   - 文档更新 (Task 12)

## Dependencies

- Task 2 依赖 Task 1 (数据库 Schema)
- Task 4 依赖 Task 1 (数据库 Schema)
- Task 6 依赖 Task 2, 4 (服务实现)
- Task 7 依赖 Task 6 (tRPC 路由)
- Task 9 依赖 Task 6 (tRPC 路由)
- Task 10 依赖 Task 2, 4 (服务实现)

## Notes

- 所有任务均为必做，包括属性测试
- 每个任务引用具体的需求条款以便追溯
- Checkpoint 确保增量验证
- 属性测试使用 fast-check 框架，每个测试至少 100 次迭代
- 优先实现早报功能，因为这是用户最直接的需求
