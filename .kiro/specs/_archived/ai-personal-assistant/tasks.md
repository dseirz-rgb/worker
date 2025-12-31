# Implementation Plan: Echo - AI 个人助手

## Overview

Echo 是一款多端 AI 个人助手应用，采用 Tauri v2 + React + SeekDB + Gemini API 架构。
本实现计划按模块逐步开发，优先实现核心功能，再扩展到个性化功能。

### 开发原则

⚠️ **用户不懂代码开发**，开发过程遵循以下原则：

1. **全自动执行** - 所有命令我直接运行，不给用户命令
2. **自动化测试** - 测试自动运行，不需要用户手动测试
3. **问题自行解决** - 遇到 bug 先自己修复，不让用户反复调试
4. **Checkpoint 确认** - 只在关键节点让用户确认"能正常使用吗"
5. **简洁汇报** - 告诉用户"做完了，可以试用了"，不解释技术细节

## 开发阶段

| 阶段 | 内容 | 预计周期 |
|------|------|---------|
| Phase 1 | 项目搭建 + 核心基础设施 | 1-2 周 |
| Phase 2 | 核心功能 (笔记/任务/对话) | 2-3 周 |
| Phase 3 | AI 能力 (记忆/提醒/日报) | 2-3 周 |
| Phase 4 | 系统感知 (活动监控/翻译) | 2 周 |
| Phase 5 | 外部集成 (GitHub/RiskControl/Health) | 2 周 |
| Phase 6 | 个性化功能 (家庭/团队/学习) | 2-3 周 |
| Phase 7 | 移动端适配 + 云同步 | 2 周 |
| Phase 8 | 轻量网页版 (Vercel) | 1 周 |

---

## Tasks

### Phase 1: 项目搭建与基础设施

- [x] 1. 初始化 Tauri v2 项目
  - [x] 1.1 创建 Tauri v2 项目结构
    - 使用 `npm create tauri-app@latest` 初始化
    - 选择 React + TypeScript 模板
    - 配置 Tauri v2.2 移动端支持
    - _Requirements: 8.1_

  - [x] 1.2 配置前端开发环境
    - 安装 React 19 (修复版)、TypeScript 5.x
    - 配置 Tailwind CSS v4
    - 安装 shadcn/ui 组件库
    - 配置 Vitest + fast-check 测试框架
    - _Requirements: 9.1_

  - [x] 1.3 配置 Rust 后端基础
    - 设置 Tauri 命令和事件系统
    - 配置 Rust 日志和错误处理
    - _Requirements: 8.1_

- [x] 2. 集成 SeekDB 数据库
  - [x] 2.1 安装和配置 SeekDB
    - 使用嵌入式模式配置 SeekDB
    - 创建数据库初始化脚本
    - _Requirements: 7.1, 8.1_

  - [x] 2.2 创建核心数据表
    - 创建 notes、tasks、reminders 表
    - 创建向量索引和全文索引
    - _Requirements: 1.1, 2.1_

  - [ ]* 2.3 编写数据库属性测试
    - **Property 5: Data Export/Import Round-Trip**
    - **Validates: Requirements 8.4, 8.5**

- [x] 3. 集成 AI 记忆系统
  - [x] 3.1 配置 mem0 或 memU
    - 安装 Python 依赖
    - 配置 Gemini 2.0 API
    - 设置记忆提取和检索
    - _Requirements: 1.4, 6.2_

  - [x] 3.2 创建 Tauri-Python 通信桥接
    - 使用 sidecar 或 HTTP 方式通信
    - 定义 AI 服务接口
    - _Requirements: 6.1_

- [x] 4. Checkpoint - 基础设施验证
  - 确保 Tauri 应用可以启动
  - 确保 SeekDB 可以读写数据
  - 确保 AI 服务可以调用
  - 确保所有测试通过，如有问题请询问用户

---

### Phase 2: 核心功能实现

- [x] 5. 实现闪念笔记功能
  - [x] 5.1 创建笔记数据模型和服务
    - 定义 Note 接口和类型
    - 实现 NoteService CRUD 操作
    - _Requirements: 1.1, 1.2_

  - [x] 5.2 实现笔记 UI 组件
    - 创建快速输入组件 (200ms 响应)
    - 创建笔记列表和搜索组件
    - 创建标签管理组件
    - _Requirements: 1.1, 1.5, 1.6_

  - [ ]* 5.3 编写笔记属性测试
    - **Property 1: Note Save and Memory Creation**
    - **Property 2: Empty Note Rejection**
    - **Validates: Requirements 1.2, 1.3, 1.4**

- [x] 6. 实现待办事项功能
  - [x] 6.1 创建任务数据模型和服务
    - 定义 Task 接口和类型
    - 实现 TaskService CRUD 操作
    - 实现优先级和状态管理
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 6.2 实现任务 UI 组件
    - 创建任务创建/编辑组件
    - 创建任务列表 (按优先级/截止日期排序)
    - 创建任务完成交互
    - _Requirements: 2.4, 2.6_

  - [ ]* 6.3 编写任务属性测试
    - **Property 3: Task Default Priority**
    - **Property 4: Task Completion Timestamp**
    - **Validates: Requirements 2.1, 2.4**

- [x] 7. 实现 AI 对话功能
  - [x] 7.1 创建对话服务
    - 实现消息发送和接收
    - 集成 mem0 记忆上下文
    - 实现流式响应显示
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 7.2 实现对话 UI 组件
    - 创建聊天界面
    - 创建消息气泡组件
    - 创建输入框和发送按钮
    - _Requirements: 6.1, 6.4_

  - [x] 7.3 实现对话中的行动项提取
    - 检测对话中的任务和笔记
    - 提供快速创建选项
    - _Requirements: 6.5_

- [x] 8. Checkpoint - 核心功能验证
  - 确保笔记可以创建、搜索、删除
  - 确保任务可以创建、完成、排序
  - 确保 AI 对话可以正常工作
  - 确保所有测试通过，如有问题请询问用户

---

### Phase 3: AI 能力增强

- [x] 9. 实现 AI 主动提醒系统
  - [x] 9.1 创建提醒引擎
    - 实现提醒数据模型
    - 实现提醒调度器
    - 实现提醒生成逻辑
    - _Requirements: 3.1, 3.2_

  - [x] 9.2 实现行为分析
    - 分析用户行为模式
    - 检测异常和矛盾
    - 生成反馈建议
    - _Requirements: 3.3, 3.4_

  - [x] 9.3 实现提醒 UI
    - 创建通知组件
    - 实现免打扰模式
    - 实现提醒反馈学习
    - _Requirements: 3.5, 3.6_

  - [ ]* 9.4 编写提醒属性测试
    - **Property 11: Reminder Scheduling Consistency**
    - **Validates: Requirements 2.5**

- [x] 10. 实现日报生成功能
  - [x] 10.1 创建日报服务
    - 实现每日数据汇总
    - 实现 AI 总结生成
    - 实现建议生成
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 10.2 实现日报 UI
    - 创建日报展示组件
    - 实现建议接受/推迟/拒绝
    - 实现早晚报时间配置
    - _Requirements: 5.4, 5.5, 5.6_

- [x] 11. 实现周报生成功能
  - [x] 11.1 创建周报服务
    - 实现周数据汇总
    - 实现成就提取和量化
    - 实现专业语言生成
    - _Requirements: 19.1, 19.2, 19.5_

  - [x] 11.2 实现周报 UI
    - 创建周报编辑器
    - 实现导出功能
    - 实现周报提醒
    - _Requirements: 19.6, 19.7, 19.8_

- [x] 12. Checkpoint - AI 能力验证
  - 确保提醒系统正常工作
  - 确保日报/周报可以生成
  - 确保所有测试通过，如有问题请询问用户

---

### Phase 4: 系统感知功能

- [x] 13. 实现电脑活动监控
  - [x] 13.1 创建活动监控服务 (Rust)
    - 实现应用切换检测
    - 实现窗口标题捕获
    - 实现键盘输入捕获
    - 实现剪贴板监控
    - _Requirements: 15.1, 15.2, 15.7, 15.8_

  - [x] 13.2 实现活动分类和存储
    - 按领域分类活动
    - 关联到项目上下文
    - 存储到 SeekDB
    - _Requirements: 15.3, 15.4_

  - [x] 13.3 实现活动统计 UI
    - 创建时间分布图表
    - 创建生产力趋势
    - 创建活动详情查看
    - _Requirements: 15.5, 15.9_

  - [ ]* 13.4 编写活动监控属性测试
    - **Property 9: Activity Capture Completeness**
    - **Validates: Requirements 15.1, 15.7, 15.8**

- [x] 14. 实现截图翻译功能
  - [x] 14.1 创建截图服务 (Rust)
    - 实现区域截图
    - 实现 OCR 文字提取
    - _Requirements: 4.1, 4.2_

  - [x] 14.2 创建翻译服务
    - 集成 Gemini 翻译
    - 实现划词翻译
    - _Requirements: 4.3, 4.4_

  - [x] 14.3 实现翻译 UI
    - 创建翻译弹窗
    - 实现快捷键触发
    - _Requirements: 4.5, 4.6_

  - [ ]* 14.4 编写翻译属性测试
    - **Property 8: OCR and Translation Pipeline**
    - **Validates: Requirements 4.2, 4.3**

- [x] 15. 实现文件管理功能
  - [x] 15.1 创建文件索引服务
    - 实现文件夹监控
    - 实现文档 OCR
    - 实现内容提取和分类
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 15.2 实现文件搜索
    - 实现混合搜索 (向量+全文)
    - 实现搜索结果排序
    - _Requirements: 7.4, 7.5_

  - [x] 15.3 实现文件管理 UI
    - 创建文件夹配置
    - 创建搜索界面
    - 创建文档预览
    - _Requirements: 7.5, 7.6_

  - [ ]* 15.4 编写文件管理属性测试
    - **Property 6: File Indexing Completeness**
    - **Property 7: Search Result Relevance**
    - **Validates: Requirements 7.1, 7.4**

- [x] 16. Checkpoint - 系统感知验证
  - 确保活动监控正常工作
  - 确保截图翻译正常工作
  - 确保文件搜索正常工作
  - 确保所有测试通过，如有问题请询问用户

---

### Phase 5: 外部系统集成

- [x] 17. 集成 GitHub 监控
  - [x] 17.1 实现 GitHub API 客户端
    - 实现 OAuth 认证
    - 实现仓库列表获取
    - 实现活动追踪
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 17.2 实现 GitHub 数据展示
    - 创建项目状态卡片
    - 集成到日报/周报
    - 实现不活跃提醒
    - _Requirements: 11.4, 11.5, 11.6_

- [x] 18. 集成 RiskControl 系统
  - [x] 18.1 实现 RiskControl API 客户端
    - 实现 API 连接配置
    - 实现投资组合数据获取
    - 实现定期同步
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 18.2 实现投资数据展示
    - 创建投资摘要卡片
    - 集成到 AI 对话上下文
    - 集成到日报
    - _Requirements: 10.4, 10.5_

- [x] 19. 集成 Apple Health
  - [x] 19.1 实现 HealthKit 集成 (iOS)
    - 请求健康数据权限
    - 获取心率、睡眠、活动数据
    - _Requirements: 21.1_

  - [x] 19.2 实现健康数据分析
    - 检测压力指标
    - 关联情绪状态
    - 生成健康建议
    - _Requirements: 21.2, 21.3, 21.8_

- [x] 20. Checkpoint - 外部集成验证
  - 确保 GitHub 集成正常
  - 确保 RiskControl 集成正常
  - 确保 Apple Health 集成正常 (iOS)
  - 确保所有测试通过，如有问题请询问用户

---

### Phase 6: 个性化功能

- [x] 21. 实现情绪管理功能
  - [x] 21.1 创建情绪追踪服务
    - 实现情绪记录
    - 实现模式分析
    - 实现投资情绪检测
    - _Requirements: 21.3, 21.4, 22.1-22.7_

  - [x] 21.2 实现情绪反馈
    - 实现 FOMO 检测和提醒
    - 实现交易前原则检查
    - 实现情绪化交易报告
    - _Requirements: 22.3, 22.4, 22.5_

  - [x] 21.3 实现多领域情绪支持
    - 工作压力检测
    - 家庭情绪管理
    - 学习挫折支持
    - _Requirements: 22.8-22.17_

- [x] 22. 实现家庭关怀功能
  - [x] 22.1 创建家庭成员管理
    - 实现家庭成员数据模型
    - 实现里程碑记录
    - _Requirements: 26.1, 26.2_

  - [x] 22.2 实现女儿成长追踪
    - 成长记录时间线
    - 性格养成追踪
    - 英语启蒙追踪
    - _Requirements: 26.1-26.15_

  - [x] 22.3 实现父母关怀
    - 健康记录追踪
    - 联系提醒
    - 医疗预约提醒
    - _Requirements: 26.16-26.20_

  - [ ]* 22.4 编写家庭记录属性测试
    - **Property 10: Family Record Chronological Order**
    - **Validates: Requirements 26.1**

- [x] 23. 实现团队管理功能
  - [x] 23.1 创建团队成员管理
    - 实现团队成员数据模型
    - 实现 1:1 追踪
    - _Requirements: 23.4, 23.5, 23.6_

  - [x] 23.2 实现任务分配
    - 实现任务分配功能
    - 实现工作量追踪
    - 实现进度报告
    - _Requirements: 25.1-25.11_

  - [x] 23.3 实现管理技能追踪
    - 管理知识学习记录
    - 激励技巧建议
    - 管理反思提示
    - _Requirements: 23.1-23.16_

- [x] 24. 实现语音笔记功能
  - [x] 24.1 创建语音录制服务
    - 实现音频录制
    - 实现 AI 转写
    - _Requirements: 24.1, 24.2_

  - [x] 24.2 实现智能整理
    - 提取行动项
    - 提取截止日期
    - 关联人员
    - _Requirements: 24.3-24.8_

- [x] 25. 实现学习追踪功能
  - [x] 25.1 实现 AI 学习追踪
    - 检测学习活动
    - 提取关键概念
    - 生成学习报告
    - _Requirements: 16.1-16.6_

  - [x] 25.2 实现英语沉浸学习
    - DejaVocab 使用追踪
    - 翻译词汇学习建议
    - 间隔重复提醒
    - _Requirements: 20.1-20.14_

  - [x] 25.3 实现投资学习追踪
    - 投资内容学习记录
    - 理论与实践关联
    - _Requirements: 18.1-18.5_

- [x] 26. Checkpoint - 个性化功能验证
  - 确保情绪管理正常工作
  - 确保家庭关怀正常工作
  - 确保学习追踪正常工作
  - 确保所有测试通过，如有问题请询问用户

---

### Phase 7: 移动端与同步

- [-] 27. 移动端适配
  - [ ] 27.1 配置 iOS 构建
    - 配置 Xcode 项目
    - 适配 iOS UI
    - 测试 iOS 功能
    - _Requirements: 8.7_

  - [ ] 27.2 配置 Android 构建
    - 配置 Android Studio 项目
    - 适配 Android UI
    - 测试 Android 功能
    - _Requirements: 8.7_

- [x] 28. 实现云端同步 (Supabase)
  - [ ] 28.1 配置 Supabase 项目
    - 创建 Supabase 项目和数据库
    - 配置 PostgreSQL 表结构 (notes, tasks, reminders 等)
    - 启用 pgvector 扩展用于向量存储
    - 配置 Row Level Security (RLS) 策略
    - _Requirements: 8.4, 8.5_

  - [ ] 28.2 创建同步服务
    - 实现 SeekDB ↔ Supabase 双向同步
    - 实现变更追踪 (sync_status 表)
    - 实现冲突检测和解决策略
    - 实现增量同步 (只同步变更)
    - _Requirements: 8.4, 8.5, 8.6_

  - [ ] 28.3 实现实时订阅
    - 使用 Supabase Realtime 监听云端变更
    - 当其他设备修改数据时，自动同步到本地
    - _Requirements: 8.4_

  - [ ] 28.4 实现离线支持
    - 实现离线变更队列
    - 实现重连后自动同步
    - 实现长时间离线警告
    - _Requirements: 8.8, 8.9, 8.10_

  - [ ] 28.5 实现云端备份恢复
    - 实现从云端完整恢复数据
    - 实现新设备首次同步
    - _Requirements: 8.3, 8.7_

  - [ ]* 28.6 编写同步属性测试
    - **Property 12: Sync Consistency**
    - **Validates: Requirements 8.4**

- [ ] 29. 实现设置和偏好
  - [ ] 29.1 创建设置页面
    - AI 模型配置
    - 反馈风格配置
    - 免打扰时段配置
    - 语言偏好配置
    - _Requirements: 9.1-9.6_

  - [ ] 29.2 实现设置同步
    - 设置跨设备同步
    - 设置导入导出
    - _Requirements: 9.6_

- [ ] 30. 最终验收
  - 确保所有功能正常工作
  - 确保所有测试通过
  - 确保桌面和移动端体验一致
  - 确保数据同步正常
  - 如有问题请询问用户

---

### Phase 8: 轻量网页版 (Vercel)

- [ ] 31. 搭建网页版项目
  - [ ] 31.1 创建 Next.js 项目
    - 使用 `npx create-next-app@latest` 初始化
    - 配置 TypeScript + Tailwind CSS
    - 复用客户端的 shadcn/ui 组件
    - _Requirements: 27.1_

  - [ ] 31.2 配置 Supabase 认证
    - 集成 Supabase Auth
    - 实现登录/注册页面
    - 配置 OAuth (GitHub/Google)
    - _Requirements: 27.1_

  - [ ] 31.3 部署到 Vercel
    - 连接 GitHub 仓库
    - 配置环境变量 (Supabase, Gemini API)
    - 设置自定义域名 (可选)
    - _Requirements: 27.1_

- [ ] 32. 实现网页版核心功能
  - [ ] 32.1 实现笔记功能
    - 笔记列表展示
    - 创建/编辑笔记
    - 搜索笔记
    - _Requirements: 27.2, 27.3_

  - [ ] 32.2 实现任务功能
    - 任务列表展示
    - 创建/编辑任务
    - 标记完成
    - _Requirements: 27.2, 27.4_

  - [ ] 32.3 实现 AI 对话
    - 创建 Edge Function 调用 Gemini API
    - 实现聊天界面
    - 从 Supabase 获取记忆上下文
    - _Requirements: 27.5, 27.6, 27.7_

- [ ] 33. 网页版优化
  - [ ] 33.1 响应式设计
    - 移动端布局适配
    - 桌面端布局优化
    - _Requirements: 27.12, 27.13_

  - [ ] 33.2 性能优化
    - 实现数据缓存
    - 优化首屏加载
    - _Requirements: 27.1_

- [ ] 34. 网页版验收
  - 确保认证流程正常
  - 确保笔记/任务 CRUD 正常
  - 确保 AI 对话正常
  - 确保与客户端数据同步
  - 如有问题请询问用户

---

## Notes

- Tasks marked with `*` are optional property-based tests
- Each checkpoint ensures incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- 开发顺序可以根据实际情况调整
- 建议先完成 Phase 1-3 形成 MVP，再逐步扩展
