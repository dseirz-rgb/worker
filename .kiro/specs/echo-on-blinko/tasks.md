# Implementation Plan: Echo on Blinko

## Overview

基于 Blinko 代码库 (`get/blinko-main/`) 扩展 Echo 功能。

**开发目录**: `get/blinko-main/`

**技术栈**: TypeScript + Rust (Tauri) + React + Prisma + tRPC + PostgreSQL

**原则**: 最小侵入，扩展而非修改 Blinko 核心代码

---

## Phase 1: 环境准备与研究

### Task 1: 研究参考项目

- [x] 1.1 研究 Pot 截图实现
  - 查看 [Pot screenshot.rs](https://github.com/pot-app/pot-desktop/blob/master/src-tauri/src/screenshot.rs)
  - 理解跨平台截图 API
  - 记录区域选择 UI 实现方式
  - _Requirements: 1.1-1.6_
  - **研究结论**: 需要使用 `screenshots` crate 实现屏幕截图

- [x] 1.2 研究 Pot 划词实现
  - 查看 [Pot selection.rs](https://github.com/pot-app/pot-desktop/blob/master/src-tauri/src/selection.rs)
  - 理解剪贴板操作和恢复机制
  - 记录跨平台差异处理
  - _Requirements: 2.1-2.5_
  - **研究结论**: Blinko 已有完整实现！使用 `get-selected-text` + `arboard`，无需搬运

- [x] 1.3 研究 ActivityWatch 窗口监控
  - 查看 [aw-watcher-window](https://github.com/ActivityWatch/aw-watcher-window)
  - 理解 macOS NSWorkspace API
  - 理解 Windows Win32 API
  - _Requirements: 5.1-5.6_
  - **研究结论**: 需要使用 macOS NSWorkspace / Windows Win32 API 获取活动窗口

- [x] 1.4 Checkpoint - 确认研究完成
  - 确保理解了每个参考项目的核心 API
  - 如有问题，询问用户
  - **结论**: Blinko 已有划词、快捷键、窗口管理，只需添加截图和活动监控

---

## Phase 2: Tauri 插件扩展 (P0)

### Task 2: 截图服务

- [x] 2.1 搬运 Pot 截图代码
  - 从 Pot 搬运 `screenshot.rs` 核心逻辑
  - 创建 `app/tauri-plugin-blinko/src/screenshot.rs`
  - 适配 Blinko 的 Tauri 插件结构
  - _Requirements: 1.1, 1.4_
  - **实现**: 使用 xcap 0.8.0 crate，直接在 src-tauri/src/desktop/screenshot.rs 实现

- [x] 2.2 实现截图 Tauri 命令
  - 实现 `capture_screen_region` 命令
  - 实现 base64 编码返回
  - 处理 ESC 取消逻辑
  - _Requirements: 1.2, 1.3, 1.5_
  - **实现**: get_screens, capture_screen, capture_screen_region 三个命令

- [x] 2.3 创建 TypeScript 绑定
  - 创建 `app/src/lib/screenshot.ts`
  - 封装 Tauri invoke 调用
  - _Requirements: 1.1_

- [ ]* 2.4 编写截图服务测试
  - 测试截图返回有效 PNG
  - 测试错误处理
  - **Property 1: 截图返回有效数据**
  - **Validates: Requirements 1.2, 1.6**

---

### Task 3: 划词获取服务

- [x] 3.1 搬运 Pot 划词代码
  - 从 Pot 搬运 `selection.rs` 核心逻辑
  - 创建 `app/tauri-plugin-blinko/src/selection.rs`
  - 适配剪贴板库 (arboard)
  - _Requirements: 2.1, 2.2_
  - **结论**: Blinko 已有完整实现！使用 get-selected-text + arboard，无需搬运

- [x] 3.2 实现剪贴板保存/恢复
  - 搬运剪贴板内容保存逻辑
  - 实现获取后自动恢复
  - _Requirements: 2.3_
  - **结论**: Blinko text_selection.rs 已实现

- [x] 3.3 实现 Tauri 命令
  - 实现 `get_selected_text` 命令
  - 处理空选择情况
  - _Requirements: 2.4, 2.5_
  - **结论**: Blinko 已有 handle_text_selection 函数

- [ ]* 3.4 编写划词服务测试
  - **Property 2: 剪贴板恢复**
  - **Validates: Requirements 2.3, 2.4**

---

### Task 4: 快捷键配置

- [x] 4.1 扩展 Blinko 快捷键配置
  - 在 Blinko 已有的快捷键系统中添加翻译快捷键
  - 添加截图翻译快捷键 (默认 Cmd+Shift+S)
  - 添加划词翻译快捷键 (默认 Cmd+Shift+T)
  - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - **实现**: 在 setup.rs 添加 screenshot-translate 和 selection-translate 命令处理

- [x] 4.2 Checkpoint - Tauri 插件完成
  - 测试截图、划词、快捷键功能
  - 如有问题，询问用户
  - **状态**: Rust 代码编译通过，等待前端集成测试

---

## Phase 3: 后端服务扩展 (P0)

### Task 5: 翻译服务

- [x] 5.1 实现翻译服务
  - 创建 `server/aiServer/translation.ts`
  - 使用 Blinko 的 AiModelFactory 进行翻译
  - 实现 OCR + 翻译流程
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5.2 实现翻译 tRPC 路由
  - 创建 `server/routerTrpc/translation.ts`
  - 实现 translate、ocrAndTranslate、getHistory
  - 注册到 Blinko 的 tRPC router
  - _Requirements: 3.1_

- [ ]* 5.3 编写翻译服务测试
  - **Property 3: 翻译一致性**
  - **Validates: Requirements 3.1, 3.3**

---

### Task 6: 数据库扩展

- [x] 6.1 扩展 Prisma Schema
  - 添加 `domain` 表
  - 添加 `activityRecord` 表
  - 添加 `translationHistory` 表
  - 扩展 `notes` 表添加 `domainId`
  - _Requirements: 6.1, 5.4_

- [x] 6.2 运行数据库迁移
  - 运行 `prisma db push` 同步到 Supabase
  - 验证表结构正确
  - 启用 tRPC 路由中的 Prisma 代码
  - _Requirements: 6.1_

---

### Task 7: 领域管理服务

- [x] 7.1 实现领域 tRPC 路由
  - 创建 `server/routerTrpc/domain.ts`
  - 实现 create、list、update、delete、stats
  - 注册到 Blinko 的 tRPC router
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]* 7.2 编写领域管理测试
  - **Property 5: 领域统计准确性**
  - **Validates: Requirements 6.4**

---

## Phase 4: 活动监控 (P1)

### Task 8: 活动监控服务

- [x] 8.1 搬运 ActivityWatch 监控代码
  - 创建 `app/src-tauri/src/desktop/activity.rs`
  - 实现 `ActivityInfo` 结构体和监控状态管理
  - 使用 AppleScript (macOS) 和 Win32 API (Windows) 获取窗口信息
  - _Requirements: 5.1, 5.2, 5.5_

- [x] 8.2 实现窗口信息获取
  - 实现 macOS AppleScript 获取活动窗口和浏览器 URL
  - 实现 Windows Win32 API 获取窗口标题和进程路径
  - _Requirements: 5.5, 5.6_

- [x] 8.3 实现 Tauri 命令
  - 实现 `start_activity_monitoring`
  - 实现 `stop_activity_monitoring`
  - 实现 `get_current_activity_cmd`
  - 实现 `is_activity_monitoring`
  - 创建 TypeScript 绑定 `app/src/lib/activity.ts`
  - _Requirements: 5.1, 5.3, 5.4_

- [ ]* 8.4 编写活动监控测试
  - **Property 4: 活动记录连续性**
  - **Validates: Requirements 5.2, 5.3**

---

### Task 9: 活动记录服务

- [x] 9.1 实现活动 tRPC 路由
  - 创建 `server/routerTrpc/activity.ts`
  - 实现 getByDateRange、statsByApp、statsByDomain、todayTimeline
  - 注册到 Blinko 的 tRPC router
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 9.2 Checkpoint - 后端服务完成
  - 翻译、领域、活动 tRPC 路由已实现
  - Prisma schema 已同步到 Supabase
  - 活动监控 Rust 代码已实现
  - TypeScript 绑定已创建

---

## Phase 5: 前端页面 (P1)

### Task 10: 翻译页面

- [x] 10.1 创建翻译页面
  - 创建 `app/src/pages/translation.tsx`
  - 实现截图翻译按钮
  - 实现文本输入翻译
  - _Requirements: 8.1, 8.2, 8.4, 8.5_

- [x] 10.2 实现翻译历史
  - 显示翻译历史列表
  - 支持复制和删除
  - _Requirements: 8.3_

- [x] 10.3 添加路由和导航
  - 在 Blinko 路由中添加翻译页面 `/translation`
  - _Requirements: 8.1_

---

### Task 11: 活动统计页面

- [x] 11.1 创建活动统计页面
  - 创建 `app/src/pages/activity.tsx`
  - 实现今日时间线
  - 实现今日概览卡片
  - _Requirements: 7.1_

- [x] 11.2 实现统计图表
  - 使用 Progress 组件实现应用使用时长条形图
  - 实现按应用/领域分组统计
  - _Requirements: 7.2, 7.3_

- [x] 11.3 实现日期选择
  - 实现最近 7 天日期选择器
  - 实现数据刷新
  - _Requirements: 7.4_

- [x] 11.4 添加路由和导航
  - 在 Blinko 路由中添加活动页面 `/activity`
  - _Requirements: 7.1_

---

## Phase 6: 日报生成 (P1)

### Task 12: 日报生成任务

- [x] 12.1 实现日报生成 Job
  - 创建 `server/jobs/dailyReportJob.ts`
  - 继承 Blinko 的 `BaseScheduleJob`
  - 实现数据汇总和 AI 生成
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 12.2 注册定时任务
  - 在 Blinko 的 job 初始化中注册日报任务
  - 配置每天 21:00 运行 (UTC+8 = 13:00 UTC)
  - 创建 tRPC 路由 `server/routerTrpc/dailyReport.ts`
  - _Requirements: 11.1_

- [x] 12.3 Checkpoint - P1 功能完成
  - 翻译页面、活动页面、日报生成已实现
  - 日报任务每天 21:00 自动运行
  - 支持手动触发生成日报

---

## Phase 7: 可选增强 (P2)

### Task 13: 本地嵌入增强（可选）

- [x] 13.1 集成本地嵌入服务
  - 创建 `app/src-tauri/src/desktop/embedding.rs`
  - 实现 Ollama 嵌入 API 调用
  - 支持检查 Ollama 可用性、列出模型、生成嵌入
  - 创建 TypeScript 绑定 `app/src/lib/embedding.ts`
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

---

### Task 14: AI 记忆系统增强（可选）

- [x] 14.1 实现 mem0 记忆服务
  - 创建 `server/aiServer/memory.ts`
  - 实现三层记忆架构 (短期/长期/工作记忆)
  - 实现用户偏好提取和存储
  - 创建 tRPC 路由 `server/routerTrpc/memory.ts`
  - 添加 Prisma 模型 (memory, userPreference)
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

---

## Phase 8: 最终验收

- [ ] 15. Final Checkpoint
  - 运行所有测试
  - 验证所有功能
  - 如有问题，询问用户

---

## Notes

- 任务标记 `*` 为可选任务，可跳过以加快 MVP 进度
- 每个 Phase 结束都有 Checkpoint，确保阶段性验收
- **开发目录**: 所有代码修改都在 `get/blinko-main/` 中进行
- **搬运原则**: 每个任务都要先研究参考项目，再进行适配
- 属性测试使用 `fast-check`，每个属性至少 100 次迭代
