# Requirements Document - Echo on Blinko

## Introduction

本文档定义在 Blinko 代码库基础上扩展 Echo 功能的需求。

### 项目策略

**基础项目**: `get/blinko-main/` (Blinko 完整代码库)

**开发方式**: 直接在 Blinko 代码库上进行扩展开发，不保留 Echo 原有前端

### Blinko 已提供的能力（直接使用）

| 能力 | Blinko 实现 | 状态 |
|------|------------|------|
| 笔记系统 | Markdown + 标签 + 附件 | ✅ 保留 |
| AI 增强 | 自动标签、智能编辑、AI 评论 | ✅ 保留 |
| 向量搜索 | @mastra/rag + LibSQLVector | ✅ 保留 |
| 定时任务 | pg-boss | ✅ 保留 |
| 文件处理 | PDF/DOCX/CSV/TXT 加载 | ✅ 保留 |
| 语音转写 | AI 语音模型 | ✅ 保留 |
| MCP 服务器 | 内置支持 | ✅ 保留 |
| 多 AI 提供商 | OpenAI/Anthropic/Google/Ollama | ✅ 保留 |
| tRPC API | 类型安全 API | ✅ 保留 |
| Prisma ORM | PostgreSQL 数据库 | ✅ 保留 |
| Tauri 桌面 | 跨平台桌面应用 | ✅ 保留 |
| 快捷键 | Quick Note / Quick AI | ✅ 保留 |

### Echo 需要扩展的功能

| 功能 | 参考项目 | 优先级 | 说明 |
|------|---------|--------|------|
| 截图翻译 | Pot | P0 | 截取屏幕区域进行 OCR + 翻译 |
| 划词翻译 | Pot | P0 | 获取选中文本进行翻译 |
| 活动监控 | ActivityWatch | P1 | 追踪电脑使用情况 |
| 多领域管理 | Echo 原设计 | P1 | 工作/投资/家庭/学习分类 |
| 本地嵌入增强 | fastembed-rs | P2 | 可选：完全离线向量生成 |
| mem0 记忆系统 | mem0 | P2 | 可选：更智能的 AI 记忆 |

## Glossary

- **Blinko_Core**: Blinko 原有的核心功能模块
- **Echo_Extension**: 在 Blinko 基础上扩展的 Echo 功能
- **Tauri_Plugin**: Blinko 的 Tauri 插件 (`app/tauri-plugin-blinko`)
- **Screenshot_Service**: 截图服务，负责屏幕区域截取
- **Selection_Service**: 划词服务，获取系统选中文本
- **Activity_Monitor**: 活动监控服务，追踪用户电脑活动
- **Domain_Manager**: 领域管理器，管理工作/投资/家庭等领域
- **Translation_Service**: 翻译服务，使用 AI 进行翻译

---

## Requirements

### P0: 核心扩展功能

### Requirement 1: 截图翻译功能

**User Story:** 作为用户，我想要截取屏幕区域进行 OCR 和翻译，以便快速理解外语内容。

**参考实现:** [Pot - screenshot.rs](https://github.com/pot-app/pot-desktop/blob/master/src-tauri/src/screenshot.rs)

**扩展位置:** `app/tauri-plugin-blinko/src/screenshot.rs`

#### Acceptance Criteria

1. WHEN 用户触发截图快捷键 THEN Tauri_Plugin SHALL 显示全屏遮罩并允许用户拖拽选择区域
2. WHEN 用户完成区域选择 THEN Screenshot_Service SHALL 返回该区域的 PNG 图片数据（base64 编码）
3. WHEN 用户按 ESC 键 THEN Screenshot_Service SHALL 取消截图并返回空结果
4. THE Screenshot_Service SHALL 支持 macOS 和 Windows 两个平台
5. WHEN 截图完成 THEN Screenshot_Service SHALL 在 500ms 内返回结果
6. IF 截图过程中发生错误 THEN Screenshot_Service SHALL 返回具体错误信息

---

### Requirement 2: 划词翻译功能

**User Story:** 作为用户，我想要选中任意文本后快速翻译，以便在阅读时即时理解内容。

**参考实现:** [Pot - selection.rs](https://github.com/pot-app/pot-desktop/blob/master/src-tauri/src/selection.rs)

**扩展位置:** `app/tauri-plugin-blinko/src/selection.rs`

#### Acceptance Criteria

1. WHEN 用户触发划词翻译快捷键 THEN Tauri_Plugin SHALL 获取当前系统选中的文本
2. THE Selection_Service SHALL 通过模拟 Cmd+C (macOS) 或 Ctrl+C (Windows) 获取选中文本
3. WHEN 获取选中文本后 THEN Selection_Service SHALL 恢复原剪贴板内容
4. IF 没有选中任何文本 THEN Selection_Service SHALL 返回空字符串
5. THE Selection_Service SHALL 在 200ms 内完成文本获取

---

### Requirement 3: 翻译服务集成

**User Story:** 作为用户，我想要对截图或选中文本进行翻译，以便理解外语内容。

**扩展位置:** `server/aiServer/translation.ts`

#### Acceptance Criteria

1. THE Translation_Service SHALL 使用 Blinko 已配置的 AI 模型进行翻译
2. WHEN 截图完成 THEN Translation_Service SHALL 先进行 OCR 识别再翻译
3. THE Translation_Service SHALL 支持中英日韩等多语言互译
4. THE Translation_Service SHALL 自动检测源语言
5. WHEN 翻译完成 THEN Translation_Service SHALL 返回原文、译文和检测到的语言

---

### Requirement 4: 翻译快捷键配置

**User Story:** 作为用户，我想要自定义翻译相关的快捷键，以便符合我的使用习惯。

**扩展位置:** Blinko 已有的快捷键系统

#### Acceptance Criteria

1. THE Hotkey_Service SHALL 支持配置截图翻译快捷键（默认 Cmd+Shift+S）
2. THE Hotkey_Service SHALL 支持配置划词翻译快捷键（默认 Cmd+Shift+T）
3. THE Hotkey_Service SHALL 允许用户在设置页面自定义快捷键
4. IF 快捷键与系统冲突 THEN Hotkey_Service SHALL 提示用户

---

### P1: 业务功能扩展

### Requirement 5: 活动监控服务

**User Story:** 作为用户，我想要 Echo 自动追踪我的电脑使用情况，以便了解时间分配。

**参考实现:** [ActivityWatch - aw-watcher-window](https://github.com/ActivityWatch/aw-watcher-window)

**扩展位置:** `app/tauri-plugin-blinko/src/activity.rs`

#### Acceptance Criteria

1. WHEN Activity_Monitor 启动 THEN 它 SHALL 每 5 秒记录一次当前活动窗口信息
2. THE Activity_Monitor SHALL 记录：应用名称、窗口标题、开始时间、持续时间
3. WHEN 用户切换窗口 THEN Activity_Monitor SHALL 结束上一条记录并开始新记录
4. THE Activity_Monitor SHALL 将数据存储到 PostgreSQL 数据库
5. THE Activity_Monitor SHALL 支持 macOS 和 Windows
6. IF 无法获取窗口信息 THEN Activity_Monitor SHALL 记录为"未知应用"

---

### Requirement 6: 领域管理

**User Story:** 作为用户，我想要将笔记和活动按领域（工作/投资/家庭/学习）分类，以便更好地管理生活。

**扩展位置:** `prisma/schema.prisma` + `server/routerTrpc/domain.ts`

#### Acceptance Criteria

1. THE Domain_Manager SHALL 支持创建自定义领域（工作、投资、家庭、学习等）
2. WHEN 用户创建笔记 THEN 用户 SHALL 能够选择所属领域
3. THE Domain_Manager SHALL 支持按领域过滤笔记
4. THE Domain_Manager SHALL 为每个领域提供独立的统计数据
5. WHEN 用户查看仪表盘 THEN Domain_Manager SHALL 显示各领域的时间分配

---

### Requirement 7: 活动统计页面

**User Story:** 作为用户，我想要查看我的电脑使用统计图表，了解时间分配。

**扩展位置:** `app/src/pages/activity.tsx`

#### Acceptance Criteria

1. THE Activity_Page SHALL 显示今日活动时间线
2. THE Activity_Page SHALL 显示按应用分组的时间饼图
3. THE Activity_Page SHALL 显示按领域分组的时间统计
4. THE Activity_Page SHALL 支持选择日期范围查看历史数据

---

### Requirement 8: 翻译页面

**User Story:** 作为用户，我想要有一个专门的翻译页面，方便进行截图翻译和文本翻译。

**扩展位置:** `app/src/pages/translation.tsx`

#### Acceptance Criteria

1. THE Translation_Page SHALL 显示截图翻译按钮
2. THE Translation_Page SHALL 显示文本输入框用于手动输入翻译
3. THE Translation_Page SHALL 显示翻译历史记录
4. WHEN 用户点击截图翻译 THEN Translation_Page SHALL 触发截图流程
5. WHEN 翻译完成 THEN Translation_Page SHALL 显示原文和译文

---

### P2: 可选增强功能

### Requirement 9: 本地嵌入增强（可选）

**User Story:** 作为用户，我想要完全离线使用语义搜索功能，不依赖外部 API。

**参考实现:** [fastembed-rs](https://github.com/Anush008/fastembed-rs)

**扩展位置:** `app/tauri-plugin-blinko/src/embedding.rs`

#### Acceptance Criteria

1. THE Embedding_Service SHALL 使用 fastembed-rs 在本地生成向量
2. THE Embedding_Service SHALL 使用 `all-MiniLM-L6-v2` 模型（384 维向量）
3. WHEN 首次运行 THEN Embedding_Service SHALL 自动下载模型
4. THE Embedding_Service SHALL 完全离线工作

---

### Requirement 10: AI 记忆系统增强（可选）

**User Story:** 作为用户，我想要 AI 能够记住我的偏好和重要信息，以便提供更个性化的服务。

**参考实现:** [mem0](https://github.com/mem0ai/mem0)

**扩展位置:** `server/aiServer/memory.ts`

#### Acceptance Criteria

1. THE Memory_Service SHALL 实现三层记忆架构（Resource → Item → Category）
2. WHEN 用户与 AI 对话 THEN Memory_Service SHALL 自动提取关键信息作为记忆
3. THE Memory_Service SHALL 支持按类别组织记忆
4. WHEN AI 回复用户 THEN Memory_Service SHALL 检索相关记忆作为上下文

---

### Requirement 11: 日报生成

**User Story:** 作为用户，我想要每天收到 AI 生成的日报，总结当天的活动和笔记。

**扩展位置:** `server/jobs/dailyReportJob.ts`

#### Acceptance Criteria

1. THE Daily_Report_Job SHALL 每天晚上 21:00 自动运行
2. THE Daily_Report_Job SHALL 汇总当天的笔记、任务完成情况、活动统计
3. THE Daily_Report_Job SHALL 使用 AI 生成总结和建议
4. WHEN 日报生成完成 THEN Daily_Report_Job SHALL 创建一条系统笔记
