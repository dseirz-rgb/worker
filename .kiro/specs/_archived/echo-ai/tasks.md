# Implementation Plan: EchoAI 完整功能移植

## Overview

将 Khoj 所有前端功能完整移植到 EchoAI，实现与 Khoj 原生界面功能对等的体验。

### 开发原则

⚠️ **用户不懂代码开发**，开发过程遵循以下原则：

1. **全自动执行** - 所有命令直接运行
2. **问题自行解决** - 遇到 bug 先自己修复
3. **Checkpoint 确认** - 只在关键节点让用户确认
4. **简洁汇报** - 告诉用户"做完了，可以试用了"

### 移植原则（开源优先）

遵循 `.kiro/steering/open-source-first.md` 原则：
- 直接从 `get/khoj-main/src/interface/web/` 复制组件
- 基于源码改造，而非重写
- 保留原项目的核心逻辑和架构

---

## ✅ 已完成的功能 (Phase 1-5)

### Phase 1: 品牌重命名 ✅
- [x] 1. 重命名组件和文件
- [x] 2. 更新 UI 文本和翻译
- [x] 3. 更新 App 名称

### Phase 2: 原生对话页面 ✅
- [x] 5. 创建对话状态管理 Hook
- [x] 6. 创建对话页面组件

### Phase 3: Agent 管理 ✅
- [x] 8. 创建 Agent 组件
- [x] 9. 更新 Agents 页面

### Phase 4: 自动化任务 ✅
- [x] 11. 创建 Automation 组件
- [x] 12. 更新 Automations 页面

### Phase 5: 日报系统 ✅
- [x] 14. 实现日报功能

---

## 🆕 缺失功能 - 待实现

### Phase 6: EchoAI 首页 (Home)

- [x] 16. 创建 EchoAI 首页
  - [x] 16.1 创建 EchoAIHome 页面
    - 创建 `app/src/pages/echoai-home.tsx`
    - 显示 Agent 快速选择网格
    - 显示最近对话列表
    - 添加路由 `/echoai/home`
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 16.2 创建 SuggestionCard 组件
    - 创建 `app/src/components/echoai/suggestions/SuggestionCard.tsx`
    - 从 Khoj 源码移植 `components/suggestions/`
    - 显示建议对话卡片
    - 支持点击开始对话
    - _Requirements: 7.3, 8.1, 8.2, 8.3_

  - [x] 16.3 实现建议数据
    - 创建 `app/src/components/echoai/suggestions/suggestionsData.ts`
    - 定义建议类型和内容
    - _Requirements: 8.2, 8.4_

- [ ] 17. Checkpoint - 首页功能验收
  - 确保首页正常显示
  - 确保 Agent 选择正常
  - 确保建议卡片可点击

---

### Phase 7: 语义搜索 (Search)

- [x] 18. 创建语义搜索页面
  - [x] 18.1 创建 EchoAISearch 页面
    - 创建 `app/src/pages/echoai-search.tsx`
    - 从 Khoj 源码移植搜索逻辑
    - 实现搜索输入框
    - 添加路由 `/echoai/search`
    - _Requirements: 9.1, 9.2_

  - [x] 18.2 创建 SearchResultCard 组件
    - 在页面内实现搜索结果卡片
    - 显示相关度评分
    - 支持文件类型过滤
    - _Requirements: 9.3, 9.4_

  - [x] 18.3 实现搜索 API 调用
    - 使用已有的 tRPC `search` 端点
    - 支持防抖搜索
    - _Requirements: 9.2, 9.4, 9.5_

  - [x] 18.4 集成搜索到对话
    - 支持将搜索结果作为对话上下文
    - 添加"在对话中使用"按钮
    - _Requirements: 9.6_

- [ ] 19. Checkpoint - 搜索功能验收
  - 确保搜索正常工作
  - 确保结果显示正确
  - 确保过滤功能正常

---

### Phase 8: 引用面板 (Reference Panel)

- [x] 20. 移植引用面板组件
  - [x] 20.1 移植 ReferencePanel 组件
    - 从 Khoj 源码复制 `components/referencePanel/`
    - 创建 `app/src/components/echoai/referencePanel/ReferencePanel.tsx`
    - 适配 HeroUI 组件库
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 20.2 集成到 ChatMessage
    - 修改 ChatMessage 组件
    - 添加引用图标按钮
    - 实现引用面板展开/折叠
    - _Requirements: 10.1, 10.4, 10.5_

  - [x] 20.3 实现引用高亮
    - 点击引用项时高亮显示
    - 支持跳转到源文件
    - _Requirements: 10.4_

- [ ] 21. Checkpoint - 引用面板验收
  - 确保引用图标显示正确
  - 确保面板展开/折叠正常
  - 确保引用高亮正常

---

### Phase 9: 思考过程 (Train of Thought)

- [x] 22. 移植思考过程组件
  - [x] 22.1 创建 TrainOfThought 组件
    - 创建 `app/src/components/echoai/trainOfThought/TrainOfThought.tsx`
    - 从 Khoj 源码移植相关逻辑
    - 显示 AI 推理步骤
    - 支持折叠/展开
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 22.2 集成到 ChatMessage
    - 修改 ChatMessage 组件
    - 在复杂推理时显示思考过程
    - 显示搜索查询和中间结果
    - _Requirements: 11.4, 11.5_

  - [x] 22.3 实现自动折叠
    - 思考完成后自动折叠
    - 保留展开按钮
    - _Requirements: 11.5_

- [ ] 23. Checkpoint - 思考过程验收
  - 确保思考过程显示正确
  - 确保折叠/展开正常
  - 确保自动折叠正常

---

### Phase 10: 研究模式 (Research Mode)

- [x] 24. 实现研究模式
  - [x] 24.1 添加模式切换按钮
    - 修改 ChatInputArea 组件
    - 添加 Research 模式切换按钮
    - 显示当前模式指示器
    - _Requirements: 12.1, 12.2_

  - [x] 24.2 实现研究模式逻辑
    - 修改发送消息逻辑
    - Research 模式下调用深度研究 API
    - 显示详细思考过程
    - _Requirements: 12.3, 12.4_

  - [x] 24.3 支持斜杠命令
    - 支持 `/research` 命令启用研究模式
    - _Requirements: 12.5_

- [ ] 25. Checkpoint - 研究模式验收
  - 确保模式切换正常
  - 确保研究模式正常工作
  - 确保思考过程显示正确

---

### Phase 11: 斜杠命令 (Slash Commands)

- [x] 26. 实现斜杠命令系统
  - [x] 26.1 创建 CommandMenu 组件
    - 在 ChatInputArea 中已实现命令菜单
    - 显示可用命令列表
    - _Requirements: 13.1_

  - [x] 26.2 实现命令处理
    - 实现 `/research` 命令
    - 实现 `/paint` 命令
    - 实现 `/code` 命令
    - 实现 `/help` 命令
    - _Requirements: 13.2, 13.3, 13.4, 13.5_

  - [x] 26.3 集成到 ChatInputArea
    - 监听 "/" 输入
    - 显示命令菜单
    - 选择命令后自动填充
    - _Requirements: 13.1, 13.6_

- [ ] 27. Checkpoint - 斜杠命令验收
  - 确保命令菜单显示正确
  - 确保所有命令正常工作
  - 确保自动填充正常

---

### Phase 12: 语音输入 (Voice Input)

- [x] 28. 实现语音输入功能
  - [x] 28.1 添加语音输入按钮
    - 修改 ChatInputArea 组件
    - 添加麦克风按钮
    - 显示录音状态指示器
    - _Requirements: 14.1, 14.5_

  - [x] 28.2 实现录音逻辑
    - 使用 Web Audio API 录音
    - 实现开始/停止录音
    - _Requirements: 14.2_

  - [x] 28.3 集成 Whisper API
    - 调用 Khoj Whisper 转写 API
    - 将转写文本填入输入框
    - 处理转写错误
    - _Requirements: 14.3, 14.4, 14.6_

- [ ] 29. Checkpoint - 语音输入验收
  - 确保录音正常工作
  - 确保转写正确
  - 确保错误处理正常

---

### Phase 13: 文件上传增强

- [x] 30. 增强文件上传功能
  - [x] 30.1 实现拖拽上传
    - 修改 ChatPage 组件
    - 添加拖拽区域
    - 显示拖拽提示
    - _Requirements: 15.1_

  - [x] 30.2 实现文件预览
    - 在 ChatInputArea 中已实现文件预览
    - 显示图片预览
    - 显示 PDF 缩略图
    - 支持多文件预览
    - _Requirements: 15.3, 15.4_

  - [x] 30.3 扩展支持的文件类型
    - 支持图片、PDF、文本、代码文件
    - 将文件作为对话上下文
    - _Requirements: 15.5, 15.6_

- [ ] 31. Checkpoint - 文件上传验收
  - 确保拖拽上传正常
  - 确保预览显示正确
  - 确保文件类型支持完整

---

### Phase 14: 消息反馈 (Feedback)

- [x] 32. 实现消息反馈功能
  - [x] 32.1 添加反馈按钮
    - 修改 ChatMessage 组件
    - 添加 👍/👎 按钮
    - _Requirements: 16.1_

  - [x] 32.2 实现反馈提交
    - 调用 Khoj 反馈 API
    - 支持添加反馈评论
    - 显示提交确认
    - _Requirements: 16.2, 16.3, 16.4, 16.5_

- [ ] 33. Checkpoint - 反馈功能验收
  - 确保反馈按钮显示正确
  - 确保反馈提交正常
  - 确保确认显示正常

---

### Phase 15: 文本转语音 (TTS)

- [x] 34. 实现文本转语音功能
  - [x] 34.1 添加朗读按钮
    - 修改 ChatMessage 组件
    - 添加朗读按钮
    - _Requirements: 17.1_

  - [x] 34.2 实现 TTS 播放
    - 使用 Khoj TTS API
    - 支持暂停/继续
    - _Requirements: 17.2, 17.3, 17.4_

  - [ ] 34.3 实现朗读高亮
    - 朗读时高亮当前文本
    - _Requirements: 17.5_

- [ ] 35. Checkpoint - TTS 功能验收
  - 确保朗读正常工作
  - 确保控制功能正常
  - 确保高亮显示正确

---

### Phase 16: 图表渲染 (Diagrams)

- [x] 36. 实现图表渲染功能
  - [x] 36.1 集成 Mermaid
    - 创建 `app/src/components/echoai/diagrams/MermaidDiagram.tsx`
    - 自动检测并渲染 Mermaid 代码块
    - _Requirements: 18.1, 18.4_

  - [x] 36.2 集成 Excalidraw
    - 创建 `app/src/components/echoai/diagrams/ExcalidrawDiagram.tsx`
    - 渲染 Excalidraw 图表
    - _Requirements: 18.2, 18.4_

  - [ ] 36.3 集成 KaTeX
    - 安装 katex 依赖
    - 修改 Markdown 渲染器
    - 支持 LaTeX 数学公式
    - _Requirements: 18.3_

  - [x] 36.4 实现图表导出
    - 支持导出图表为图片
    - _Requirements: 18.5_

- [ ] 37. Checkpoint - 图表渲染验收
  - 确保 Mermaid 渲染正常
  - 确保 Excalidraw 渲染正常
  - 确保 LaTeX 渲染正常
  - 确保导出功能正常

---

### Phase 17: 设置页面增强

- [x] 38. 增强 EchoAI 设置页面
  - [x] 38.1 添加默认配置
    - 修改 EchoAISetting.tsx
    - 添加默认 Agent 选择
    - 添加默认模式选择
    - _Requirements: 19.2, 19.3_

  - [x] 38.2 添加语音设置
    - 添加语音输入/输出开关
    - 添加 TTS 速度设置
    - _Requirements: 19.4_

  - [x] 38.3 添加索引配置
    - 显示索引状态
    - _Requirements: 19.5_

  - [x] 38.4 添加服务信息
    - 显示 Khoj 服务连接状态
    - 显示 Khoj 版本信息
    - _Requirements: 19.6_

- [ ] 39. Checkpoint - 设置页面验收
  - 确保所有设置项正常工作
  - 确保配置保存正常
  - 确保服务信息显示正确

---

### Phase 18: 导航更新

- [x] 40. 更新导航菜单
  - [x] 40.1 添加新导航项
    - 添加 "首页" 导航项 (/echoai/home)
    - 添加 "搜索" 导航项 (/echoai/search)
    - _Requirements: 7.1, 9.1_

  - [x] 40.2 更新导航结构
    - 调整 EchoAI 导航组结构
    - 确保与 Khoj 原生导航一致
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 41. Final Checkpoint - 全功能验收
  - 确保所有功能正常工作
  - 确保 UI 风格统一
  - 确保与 Khoj 原生界面功能对等

---

## 文件变更清单

```
新增组件:
- app/src/pages/echoai-home.tsx          # 首页
- app/src/pages/echoai-search.tsx        # 搜索页面
- app/src/components/echoai/SuggestionCard.tsx    # 建议卡片
- app/src/components/echoai/SearchResultCard.tsx  # 搜索结果卡片
- app/src/components/echoai/ReferencePanel.tsx    # 引用面板
- app/src/components/echoai/TrainOfThought.tsx    # 思考过程
- app/src/components/echoai/CommandMenu.tsx       # 斜杠命令菜单
- app/src/components/echoai/FilePreview.tsx       # 文件预览
- app/src/components/echoai/MermaidDiagram.tsx    # Mermaid 图表
- app/src/components/echoai/ExcalidrawDiagram.tsx # Excalidraw 图表

修改组件:
- app/src/components/echoai/ChatInputArea.tsx  # 添加语音、命令、模式切换
- app/src/components/echoai/ChatMessage.tsx    # 添加引用、思考、反馈、TTS
- app/src/components/echoai/ChatPage.tsx       # 添加拖拽上传
- app/src/components/BlinkoSettings/EchoAISetting.tsx  # 增强设置

新增依赖:
- mermaid
- @excalidraw/excalidraw
- katex

后端 API 扩展:
- server/routerTrpc/khoj.ts  # 添加 search, suggestions, feedback 端点
```

## 完成进度

| Phase | 功能 | 状态 | 预估时间 |
|-------|------|------|----------|
| 1-5 | 基础功能 | ✅ 完成 | - |
| 6 | 首页 | ✅ 完成 | 2h |
| 7 | 语义搜索 | ✅ 完成 | 3h |
| 8 | 引用面板 | ✅ 完成 | 2h |
| 9 | 思考过程 | ✅ 完成 | 2h |
| 10 | 研究模式 | ✅ 完成 | 2h |
| 11 | 斜杠命令 | ✅ 完成 | 2h |
| 12 | 语音输入 | ✅ 完成 | 3h |
| 13 | 文件上传 | ✅ 完成 | 2h |
| 14 | 消息反馈 | ✅ 完成 | 1h |
| 15 | TTS | ✅ 完成 | 2h |
| 16 | 图表渲染 | ✅ 完成 | 3h |
| 17 | 设置增强 | ✅ 完成 | 2h |
| 18 | 导航更新 | ✅ 完成 | 1h |
| **总计** | **13 个新 Phase** | **13/13** | **~27h** |
