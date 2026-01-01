# Requirements Document - EchoAI 完整功能移植

## Introduction

EchoAI 是 Echo 项目的 AI 对话模块，基于 Khoj 后端服务。本次开发目标是**完整移植 Khoj 的所有前端功能**，实现与 Khoj 原生界面功能对等的体验，同时将品牌重命名为 EchoAI。

## Glossary

- **EchoAI**: Echo 项目的 AI 对话模块（原 Khoj 集成）
- **Agent**: AI 助手角色，具有特定人格和工具配置
- **Automation**: 定时执行的 AI 任务，使用 Cron 表达式调度
- **Conversation**: 用户与 AI 的对话会话
- **Research_Mode**: 深度研究模式，AI 会进行多轮搜索和分析
- **Train_of_Thought**: AI 思考过程的可视化展示
- **Reference_Panel**: 显示 AI 回复引用来源的面板
- **Suggestions**: 对话建议卡片，帮助用户快速开始对话

## Requirements

### Requirement 1: 品牌重命名 ✅ 已完成

**User Story:** 作为用户，我希望看到统一的 EchoAI 品牌，而不是 Khoj，以保持产品一致性。

#### Acceptance Criteria

1. WHEN 用户访问 AI 对话页面 THEN THE System SHALL 显示 "EchoAI" 而非 "Khoj"
2. WHEN 用户查看导航菜单 THEN THE System SHALL 显示 "EchoAI" 导航组
3. WHEN 用户查看设置页面 THEN THE System SHALL 显示 "EchoAI 设置" 而非 "Khoj 设置"
4. THE System SHALL 保留所有 Khoj 后端 API 调用，仅修改前端显示名称

### Requirement 2: 原生对话页面 ✅ 已完成

**User Story:** 作为用户，我希望有流畅的原生对话体验，而不是 iframe 嵌入的页面。

#### Acceptance Criteria

1. WHEN 用户访问 /echoai 页面 THEN THE System SHALL 显示原生 React 对话界面
2. WHEN 用户发送消息 THEN THE System SHALL 通过 tRPC 调用后端并显示 AI 回复
3. WHEN 用户切换对话 THEN THE System SHALL 加载对应的历史消息
4. WHEN 用户创建新对话 THEN THE System SHALL 清空当前消息并开始新会话
5. WHEN EchoAI 服务离线 THEN THE System SHALL 显示友好的错误提示和重试按钮
6. THE System SHALL 支持 Markdown 渲染和代码高亮

### Requirement 3: Agent 管理 ✅ 已完成

**User Story:** 作为用户，我希望创建和管理不同的 AI 助手角色，以适应不同场景。

#### Acceptance Criteria

1. WHEN 用户访问 /agents 页面 THEN THE System SHALL 显示 Agent 列表（网格布局）
2. WHEN 用户点击"创建 Agent" THEN THE System SHALL 显示 Agent 配置表单
3. WHEN 用户提交 Agent 表单 THEN THE System SHALL 创建新 Agent 并刷新列表
4. WHEN 用户编辑 Agent THEN THE System SHALL 更新 Agent 配置
5. WHEN 用户删除 Agent THEN THE System SHALL 移除 Agent 并刷新列表
6. WHEN 用户在对话中选择 Agent THEN THE System SHALL 使用该 Agent 的人格进行对话

### Requirement 4: 自动化任务 ✅ 已完成

**User Story:** 作为用户，我希望设置定时 AI 任务，让系统自动执行并通知我结果。

#### Acceptance Criteria

1. WHEN 用户访问 /automations 页面 THEN THE System SHALL 显示自动化任务列表
2. WHEN 用户点击"创建任务" THEN THE System SHALL 显示任务配置表单
3. WHEN 用户配置 Cron 表达式 THEN THE System SHALL 提供友好的时间选择器
4. WHEN 自动化任务执行完成 THEN THE System SHALL 显示执行结果
5. WHEN 用户删除任务 THEN THE System SHALL 移除任务并刷新列表
6. THE System SHALL 显示每个任务的下次执行时间

### Requirement 5: 日报系统 ✅ 已完成

**User Story:** 作为用户，我希望每天收到 AI 生成的日报，总结今日并建议明日。

#### Acceptance Criteria

1. WHEN 用户请求生成日报 THEN THE System SHALL 调用 AI 生成当日总结
2. WHEN 日报生成完成 THEN THE System SHALL 显示今日完成事项和明日建议
3. WHEN 用户接受建议 THEN THE System SHALL 将建议转为待办事项
4. WHEN 用户拒绝建议 THEN THE System SHALL 标记该建议为已忽略
5. THE System SHALL 支持手动触发日报生成

### Requirement 6: 导航与路由 ✅ 已完成

**User Story:** 作为用户，我希望通过侧边栏快速访问 EchoAI 的各项功能。

#### Acceptance Criteria

1. THE System SHALL 在侧边栏显示 "EchoAI" 导航组
2. THE System SHALL 提供 "对话" 子项链接到 /echoai
3. THE System SHALL 提供 "Agents" 子项链接到 /agents
4. THE System SHALL 提供 "自动化" 子项链接到 /automations
5. WHEN EchoAI 服务离线 THEN THE System SHALL 在导航项旁显示警告图标

---

## 🆕 缺失功能 - 需要补充

### Requirement 7: EchoAI 首页 (Home)

**User Story:** 作为用户，我希望有一个 EchoAI 首页，快速选择 Agent 并开始对话。

#### Acceptance Criteria

1. WHEN 用户访问 /echoai/home 页面 THEN THE System SHALL 显示 EchoAI 首页
2. THE System SHALL 在首页显示 Agent 快速选择网格
3. THE System SHALL 在首页显示建议对话卡片（Suggestions）
4. THE System SHALL 在首页显示最近对话列表
5. WHEN 用户点击 Agent 卡片 THEN THE System SHALL 跳转到对话页面并使用该 Agent
6. WHEN 用户点击建议卡片 THEN THE System SHALL 开始新对话并发送建议内容

### Requirement 8: 建议卡片 (Suggestions)

**User Story:** 作为用户，我希望看到对话建议，帮助我快速开始有意义的对话。

#### Acceptance Criteria

1. THE System SHALL 在首页和空对话页面显示建议卡片
2. THE System SHALL 根据用户历史和笔记内容生成个性化建议
3. WHEN 用户点击建议卡片 THEN THE System SHALL 自动发送建议内容开始对话
4. THE System SHALL 支持刷新建议列表
5. THE System SHALL 显示不同类型的建议（研究、写作、分析等）

### Requirement 9: 语义搜索 (Search)

**User Story:** 作为用户，我希望使用 AI 语义搜索我的笔记和知识库。

#### Acceptance Criteria

1. WHEN 用户访问 /echoai/search 页面 THEN THE System SHALL 显示语义搜索界面
2. WHEN 用户输入搜索词 THEN THE System SHALL 调用 Khoj 语义搜索 API
3. THE System SHALL 显示搜索结果卡片，包含相关度评分
4. THE System SHALL 支持按文件类型过滤搜索结果
5. WHEN 用户点击搜索结果 THEN THE System SHALL 显示完整内容或跳转到源文件
6. THE System SHALL 支持将搜索结果作为对话上下文

### Requirement 10: 引用面板 (Reference Panel)

**User Story:** 作为用户，我希望看到 AI 回复的引用来源，验证信息准确性。

#### Acceptance Criteria

1. WHEN AI 回复包含引用 THEN THE System SHALL 在消息旁显示引用图标
2. WHEN 用户点击引用图标 THEN THE System SHALL 展开引用面板
3. THE Reference_Panel SHALL 显示引用来源列表（文件名、片段、相关度）
4. WHEN 用户点击引用项 THEN THE System SHALL 高亮显示引用内容
5. THE System SHALL 支持折叠/展开引用面板

### Requirement 11: 思考过程 (Train of Thought)

**User Story:** 作为用户，我希望看到 AI 的思考过程，理解它如何得出结论。

#### Acceptance Criteria

1. WHEN AI 进行复杂推理 THEN THE System SHALL 显示思考过程区域
2. THE Train_of_Thought SHALL 显示 AI 的推理步骤
3. THE System SHALL 支持折叠/展开思考过程
4. THE System SHALL 在思考过程中显示搜索查询和中间结果
5. WHEN 思考完成 THEN THE System SHALL 自动折叠思考过程，显示最终回复

### Requirement 12: 研究模式 (Research Mode)

**User Story:** 作为用户，我希望使用深度研究模式，让 AI 进行多轮搜索和分析。

#### Acceptance Criteria

1. THE System SHALL 在输入框提供 Research 模式切换按钮
2. WHEN 用户启用 Research 模式 THEN THE System SHALL 显示模式指示器
3. WHEN 用户发送消息（Research 模式） THEN THE System SHALL 进行多轮搜索和分析
4. THE System SHALL 在 Research 模式下显示详细的思考过程
5. THE System SHALL 支持通过斜杠命令 `/research` 启用研究模式

### Requirement 13: 斜杠命令 (Slash Commands)

**User Story:** 作为用户，我希望使用斜杠命令快速切换 AI 模式和功能。

#### Acceptance Criteria

1. WHEN 用户输入 "/" THEN THE System SHALL 显示命令菜单
2. THE System SHALL 支持 `/research` 命令启用研究模式
3. THE System SHALL 支持 `/paint` 命令生成图片
4. THE System SHALL 支持 `/code` 命令进入代码模式
5. THE System SHALL 支持 `/help` 命令显示帮助信息
6. WHEN 用户选择命令 THEN THE System SHALL 自动填充命令并聚焦输入框

### Requirement 14: 语音输入 (Voice Input)

**User Story:** 作为用户，我希望使用语音输入消息，解放双手。

#### Acceptance Criteria

1. THE System SHALL 在输入框显示语音输入按钮
2. WHEN 用户点击语音按钮 THEN THE System SHALL 开始录音
3. THE System SHALL 使用 Whisper API 将语音转为文本
4. WHEN 录音结束 THEN THE System SHALL 将转写文本填入输入框
5. THE System SHALL 显示录音状态指示器
6. IF 语音识别失败 THEN THE System SHALL 显示错误提示

### Requirement 15: 文件上传增强

**User Story:** 作为用户，我希望在对话中上传文件，让 AI 分析文件内容。

#### Acceptance Criteria

1. THE System SHALL 支持拖拽文件到对话区域上传
2. THE System SHALL 支持点击上传按钮选择文件
3. THE System SHALL 显示上传文件预览（图片、PDF 缩略图）
4. THE System SHALL 支持上传多个文件
5. WHEN 文件上传完成 THEN THE System SHALL 将文件作为对话上下文
6. THE System SHALL 支持的文件类型：图片、PDF、文本、代码文件

### Requirement 16: 消息反馈 (Feedback)

**User Story:** 作为用户，我希望对 AI 回复进行反馈，帮助改进 AI 质量。

#### Acceptance Criteria

1. THE System SHALL 在每条 AI 回复下方显示反馈按钮（👍/👎）
2. WHEN 用户点击反馈按钮 THEN THE System SHALL 记录反馈
3. THE System SHALL 支持添加反馈评论
4. THE System SHALL 将反馈发送到 Khoj 后端
5. THE System SHALL 显示反馈已提交的确认

### Requirement 17: 文本转语音 (Text-to-Speech)

**User Story:** 作为用户，我希望让 AI 朗读回复内容。

#### Acceptance Criteria

1. THE System SHALL 在 AI 回复旁显示朗读按钮
2. WHEN 用户点击朗读按钮 THEN THE System SHALL 使用 TTS 朗读内容
3. THE System SHALL 支持暂停/继续朗读
4. THE System SHALL 支持调整朗读速度
5. THE System SHALL 在朗读时高亮当前朗读的文本

### Requirement 18: 图表渲染 (Diagrams)

**User Story:** 作为用户，我希望 AI 能生成和显示图表。

#### Acceptance Criteria

1. THE System SHALL 支持渲染 Mermaid 图表
2. THE System SHALL 支持渲染 Excalidraw 图表
3. THE System SHALL 支持 LaTeX 数学公式渲染
4. WHEN AI 回复包含图表代码 THEN THE System SHALL 自动渲染图表
5. THE System SHALL 支持导出图表为图片

### Requirement 19: 设置页面增强

**User Story:** 作为用户，我希望在设置页面配置 EchoAI 的各项功能。

#### Acceptance Criteria

1. THE System SHALL 在设置页面显示 EchoAI 配置区域
2. THE System SHALL 支持配置默认 Agent
3. THE System SHALL 支持配置默认模式（普通/研究）
4. THE System SHALL 支持配置语音输入/输出设置
5. THE System SHALL 支持配置文件索引目录
6. THE System SHALL 显示 Khoj 服务连接状态和版本信息
