# Requirements Document - Echo Janitor

## Introduction

Echo Janitor 基于开源项目 **LlamaFS** 构建，是一个运行在本地的 Python 后台服务。它自动监控"混沌文件夹"（如下载目录），利用 **Groq (免费云端 Llama3)** 理解文件内容，对其进行语义重命名和智能归档。图片理解使用本地 **Ollama moondream** 模型。

核心原则：**先整理，后索引**。Janitor 整理完，SeekDB 再读取。

## AI 方案

| 功能 | 方案 | 说明 |
|------|------|------|
| 文本摘要 | Groq (云端) | 免费、快速、无需本地 GPU |
| 文件分类 | Groq (云端) | llama-3.1-70b-versatile |
| 图片理解 | Ollama (本地) | moondream 模型 |

## 开源方案选型

| 方案 | 推荐指数 | 理由 | 集成方式 |
|------|---------|------|---------|
| **LlamaFS** | 🚀 S级 | Groq 云端 + Ollama 图片，Watch Mode，Content-Aware | Docker 部署 |
| Local-File-Organizer | A级 | 图片识别强，适合美术素材 | 定时任务补充 |
| Organize-tool | B级 | 仅规则驱动，无 AI | 不推荐 |

**选定方案**: LlamaFS (原版 Groq + Ollama 混合) + Echo 扩展

## Glossary

- **Janitor**: Echo Janitor 服务，基于 LlamaFS 的文件整理后台进程
- **LlamaFS**: 开源 AI 文件整理工具，使用 Groq 云端 + Ollama 本地混合方案
- **Groq**: 免费云端 LLM API，提供 Llama3 推理能力
- **Ollama**: 本地 LLM 服务，用于图片理解 (moondream)
- **Inbox**: 混沌文件夹，用户随意丢放文件的源目录
- **Category**: 分类目录，如 Investment、Development、Personal 等
- **Watch_Mode**: LlamaFS 的守护进程模式，实时监控文件夹
- **Undo_Log**: 操作日志，记录所有文件移动操作，支持回滚

## Requirements

### Requirement 1: LlamaFS 部署与配置

**User Story:** 作为用户，我想快速部署 LlamaFS，这样我能开始使用 AI 文件整理功能。

#### Acceptance Criteria

1. THE Deployment SHALL 提供 Docker Compose 配置文件，一键启动 LlamaFS + Ollama
2. WHEN 首次启动, THE Deployment SHALL 自动拉取所需的 Ollama 模型 (qwen2.5 或 llama3)
3. THE Deployment SHALL 支持配置监控目录和输出目录的挂载路径
4. THE Deployment SHALL 与现有 Echo sidecar 服务共享 Docker 网络
5. IF Ollama 服务已存在, THEN THE Deployment SHALL 复用现有 Ollama 实例

### Requirement 2: Watch Mode 实时监控

**User Story:** 作为用户，我想让系统自动监控我的下载文件夹，这样我不需要手动触发整理。

#### Acceptance Criteria

1. WHEN LlamaFS Watch Mode 启动, THE Watcher SHALL 开始监听配置的 Inbox 目录
2. WHEN 新文件出现在 Inbox 目录, THE Watcher SHALL 在文件写入完成后处理该文件
3. WHILE Watcher 运行中, THE Watcher SHALL 跳过隐藏文件和临时文件 (.tmp, .part)
4. THE Watcher SHALL 支持配置多个监控目录
5. THE Watcher SHALL 作为后台守护进程持续运行

### Requirement 3: 内容感知重命名 (LlamaFS 核心能力)

**User Story:** 作为用户，我想让 AI 根据文件内容智能重命名，这样文件名能反映实际内容。

#### Acceptance Criteria

1. WHEN 处理文档文件 (PDF, TXT, MD, DOCX), THE LlamaFS SHALL 读取内容并生成语义化文件名
2. WHEN 处理图片文件, THE LlamaFS SHALL 使用文件名和元数据进行分析
3. THE LlamaFS SHALL 生成格式为 "YYYY-MM-DD_Subject_Description.ext" 的文件名
4. WHEN 目标位置已存在同名文件, THE LlamaFS SHALL 自动追加序号后缀
5. THE LlamaFS SHALL 保留原始文件扩展名

### Requirement 4: 自定义分类体系 (Echo 扩展)

**User Story:** 作为用户，我想自定义分类目录，这样系统能适应我的工作习惯。

#### Acceptance Criteria

1. THE Echo_Extension SHALL 提供 YAML 配置文件定义分类体系
2. THE Echo_Extension SHALL 支持以下预设分类: 01_Investment, 02_Development, 03_GameArt, 04_Management, 05_Personal, 99_Inbox
3. THE Echo_Extension SHALL 为每个分类配置关键词提示，增强 AI Prompt
4. WHEN 配置文件不存在, THE Echo_Extension SHALL 创建默认配置
5. THE Echo_Extension SHALL 将分类规则注入 LlamaFS 的 Prompt

### Requirement 5: 文件归档与移动

**User Story:** 作为用户，我想让文件被移动到对应的分类文件夹，这样我的文件系统保持整洁。

#### Acceptance Criteria

1. WHEN AI 返回分类结果, THE Archiver SHALL 将文件移动到对应的 Category 目录
2. WHEN Category 目录不存在, THE Archiver SHALL 自动创建该目录
3. THE Archiver SHALL 绝不覆盖已存在的文件
4. WHEN 文件移动成功, THE Archiver SHALL 记录操作到 Undo_Log
5. IF AI 置信度低于阈值 (0.6), THEN THE Archiver SHALL 将文件移动到 99_Inbox 待人工确认

### Requirement 6: 操作日志与回滚 (Echo 扩展)

**User Story:** 作为用户，我想能撤销错误的整理操作，这样我不会丢失重要文件。

#### Acceptance Criteria

1. WHEN 文件被移动或重命名, THE Undo_Logger SHALL 记录: 时间戳、原路径、新路径、原文件名、AI 决策
2. THE Undo_Logger SHALL 将日志追加写入 CSV 文件 (janitor_history.csv)
3. THE Echo_Extension SHALL 提供 undo 命令行工具，支持回滚最近操作
4. THE Undo_System SHALL 支持按时间范围回滚操作
5. IF 回滚时目标位置已有文件, THEN THE Undo_System SHALL 提示用户确认

### Requirement 7: 错误处理与容错

**User Story:** 作为用户，我想让系统在遇到问题时不会丢失我的文件。

#### Acceptance Criteria

1. IF 文件移动失败, THEN THE Janitor SHALL 保留原文件不变并记录错误
2. IF Ollama 服务不可用, THEN THE Janitor SHALL 将文件移动到 99_Inbox 并记录
3. THE Janitor SHALL 维护失败队列，服务恢复后自动重试
4. WHEN 发生错误, THE Janitor SHALL 记录到日志文件而非中断服务
5. THE Janitor SHALL 提供健康检查接口 (HTTP /health)

### Requirement 8: 与 SeekDB 集成

**User Story:** 作为用户，我想让整理好的文件自动被 SeekDB 索引，这样我能搜索到它们。

#### Acceptance Criteria

1. WHEN 文件归档完成, THE Janitor SHALL 可选地调用 SeekDB API 触发索引
2. THE Janitor SHALL 支持配置 SeekDB 的 API 地址
3. IF SeekDB 不可用, THEN THE Janitor SHALL 继续归档操作，索引稍后补充
4. THE Janitor SHALL 在文件元数据中记录原始路径和 AI 分类结果

### Requirement 9: 图片素材增强 (可选)

**User Story:** 作为美术经理，我想让系统能识别游戏美术素材，这样我的参考图能被正确分类。

#### Acceptance Criteria

1. WHERE 启用图片增强功能, THE Image_Processor SHALL 使用 Llava 模型分析图片内容
2. WHEN 处理游戏美术相关图片, THE Image_Processor SHALL 识别: 角色设计、场景、UI、材质纹理
3. THE Image_Processor SHALL 为图片生成描述性文件名
4. IF Llava 模型不可用, THEN THE Image_Processor SHALL 回退到仅使用文件名分类


### Requirement 10: PDF 文档增强

**User Story:** 作为投资者/开发者，我想让系统能深度理解 PDF 内容，这样财报、技术文档能被准确分类。

#### Acceptance Criteria

1. WHEN 处理 PDF 文件, THE PDF_Processor SHALL 提取前 3 页的文本内容
2. THE PDF_Processor SHALL 识别 PDF 类型: 财报、技术文档、合同、发票、论文
3. WHEN PDF 包含表格数据, THE PDF_Processor SHALL 提取关键数字信息 (如营收、增长率)
4. THE PDF_Processor SHALL 为财报类 PDF 生成格式: "YYYY-MM-DD_公司名_Q季度_财报.pdf"
5. IF PDF 是扫描件 (图片型), THEN THE PDF_Processor SHALL 使用 OCR 提取文本

### Requirement 11: PPT 演示文稿增强

**User Story:** 作为美术经理，我想让系统能理解 PPT 内容，这样周报、汇报材料能被正确归档。

#### Acceptance Criteria

1. WHEN 处理 PPT/PPTX 文件, THE PPT_Processor SHALL 提取所有幻灯片的文本内容
2. THE PPT_Processor SHALL 识别 PPT 类型: 周报、项目汇报、培训材料、设计评审
3. WHEN PPT 包含大量图片, THE PPT_Processor SHALL 分析图片内容辅助分类
4. THE PPT_Processor SHALL 为周报类 PPT 生成格式: "YYYY-MM-DD_部门_周报.pptx"
5. THE PPT_Processor SHALL 提取 PPT 的标题页作为主要分类依据

### Requirement 12: 多模态内容理解

**User Story:** 作为用户，我想让系统能综合理解文件的文本和视觉内容，这样分类更准确。

#### Acceptance Criteria

1. WHERE 启用多模态理解, THE Multimodal_Processor SHALL 同时分析文本和图像内容
2. WHEN 处理包含图表的文档, THE Multimodal_Processor SHALL 识别图表类型 (K线图、架构图、流程图)
3. THE Multimodal_Processor SHALL 使用 Llava 或类似视觉模型处理图像内容
4. WHEN 文本和图像分类结果冲突, THE Multimodal_Processor SHALL 以文本分类为主
5. IF 多模态模型不可用, THEN THE Multimodal_Processor SHALL 回退到纯文本分析
