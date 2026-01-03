这正是我们 "Echo 2.0" 拼图中的最后一块关键碎片。

我将这个模块命名为 **"Echo Janitor" (Echo 清洁工)**。

它的定位非常明确：**它是 SeekDB 的前置流水线**。只有它把文件整理干净了，SeekDB 的索引才会清晰，你的“外脑”才不会变成垃圾场。

以下是针对这个需求的完整整理，你可以直接拿去开发。

---

# 🧹 Echo Janitor - AI 文件整理模块需求文档

> **核心目标**: 这是一个运行在本地的 Python 服务，它自动监控“混沌文件夹”（如下载目录），利用 **本地 LLM (Ollama)** 理解文件内容，对其进行 **语义重命名** 和 **智能归档**。
> **原则**: 先整理，后索引。Janitor 整理完，SeekDB 再读取。

## 1. 🏗️ 架构与数据流

不要把它做进复杂的 UI 里，它最好是一个**安静的后台服务**。

```mermaid
graph LR
    subgraph "混沌区 (Input)"
        Inbox[📂 ~/Downloads/Inbox]
    end

    subgraph "🧠 决策层 (AI Janitor)"
        Watcher[👀 监听脚本]
        Extractor[📄 内容提取器]
        LocalLLM[🤖 Ollama (Llama3/Qwen)]
    end

    subgraph "秩序区 (Output)"
        Inv[📂 /Echo/Investment]
        Dev[📂 /Echo/Dev]
        Per[📂 /Echo/Personal]
        Log[📝 Undo.csv (后悔药)]
    end

    Inbox --"1. 发现文件"--> Watcher
    Watcher --"2. 提取文件名+前1k字符"--> Extractor
    Extractor --"3. 询问归档建议"--> LocalLLM
    LocalLLM --"4. 返回 JSON {类别, 新文件名}"--> Watcher
    Watcher --"5. 移动 & 重命名"--> Inv & Dev & Per
    Watcher --"6. 记录操作日志"--> Log

```

---

## 2. 🧠 智能分类体系 (Schema)

这是 AI 进行分类的依据（System Prompt 的核心部分）。基于你的用户画像，建议预设以下目录结构：

| 文件夹 (Category) | 包含内容示例 | AI 决策逻辑 |
| --- | --- | --- |
| **01_Investment** | 财报、K线图截图、券商账单、行业分析 PDF | 关键词: PDD, 财报, 增长, 股价, 盈透, 风险控制 |
| **02_Development** | Python 脚本、架构图、API 文档、日志 | 关键词: .py, .json, Docker, 架构, Bug, 需求文档 |
| **03_GameArt** | 游戏参考图、材质纹理、Substance 文件 | 关键词: Cyberpunk, 贴图, 渲染, 角色设计, 资产 |
| **04_Management** | 周报、汇报 PPT、团队考评、招聘简历 | 关键词: 汇报, 计划, HC, 绩效, 总结 |
| **05_Personal** | 身份证、发票、家庭照片、体检单 | 关键词: 发票, 账单, 证件, 个人 |
| **99_Inbox** | (无法识别的文件保留在此) | AI 无法确定或置信度低的文件 |

---

## 3. 🤖 AI 交互逻辑 (The Prompt Logic)

Janitor 并不是简单地问 AI "这是什么"，而是要求 AI **严格执行**以下动作：

**输入给 AI 的数据**:

* `filename`: "wx_screenshot_20251230.jpg"
* `content_snippet`: "Pinduoduo Q3 Revenue growth 40%..." (如果是文档)

**Prompt (提示词) 设计**:

```text
You are a file organization assistant.
Current Date: 2025-12-30

Rules:
1. Analyze the filename and content snippet.
2. Categorize into ONE of: [Investment, Development, GameArt, Management, Personal].
3. Generate a new, descriptive filename in English or Chinese (keep original extension).
   - Format: "YYYY-MM-DD_Subject_Tag.ext"
   - Example: "2025-12-30_PDD_Q3_Report.pdf"

Return STRICT JSON:
{
  "category": "Investment",
  "new_name": "2025-12-30_PDD_Q3财报.pdf",
  "confidence": 0.95
}

```

---

## 4. 🛡️ 安全与风控机制 (必做)

自动整理文件最怕的是“文件丢了”或者“改名改错了找不到了”。

1. **Undo Log (后悔药)**:
* 在根目录生成 `janitor_history.csv`。
* 记录: `时间戳 | 原路径 | 新路径 | 原始文件名`。
* **脚本功能**: 提供 `undo_last_run.py`，一键把文件全部移回去。


2. **重名处理**:
* 如果目标文件夹里已经有了 `2025_PDD.pdf`，新文件自动命名为 `2025_PDD_v2.pdf`，绝不覆盖。


3. **置信度阈值**:
* 如果 LLM 返回的 `confidence` 低于 0.6，**不移动**，只重命名并在前面加 `[Review]` 标记，留在原地等你确认。



---

## 5. 🚀 给 AI 的开发指令 (Actionable Prompt)

你可以直接把下面这段话发给你的 AI 编程助手，让它开始写代码：

> **指令：开发 Echo Janitor 文件整理脚本**
> 请编写一个 Python 脚本 `janitor.py`，用于自动整理我的杂乱文件。
> **环境依赖**:
> * `shutil`, `os`, `pathlib` (文件操作)
> * `requests` (调用本地 Ollama 接口 http://localhost:11434)
> * `pandas` (记录 CSV 日志)
> 
> 
> **核心功能**:
> 1. **配置区**: 定义源目录 `SOURCE_DIR` 和目标目录结构 `TARGET_MAP` (Investment, Dev, GameArt, Management, Personal)。
> 2. **AI 决策**: 编写函数 `ask_ai(filename, snippet)`，构造 Prompt 发送给本地 Ollama (模型使用 qwen2.5-coder 或 llama3)，要求返回 JSON 格式的分类和新文件名。
> 3. **主循环**: 遍历源目录下的文件（跳过隐藏文件和文件夹）。
> * 如果是文本/PDF，尝试读取前 500 个字符作为 snippet。
> * 调用 AI 获取决策。
> * **执行移动**: 将文件移动到对应分类文件夹，并重命名。
> 
> 
> 4. **安全机制**:
> * 每次移动前，将操作记录追加写入 `janitor_log.csv`。
> * 如果目标文件已存在，自动在文件名后追加 `_copy`，防止覆盖。
> * 遇到错误（如 AI 服务未响应）跳过该文件并打印日志。
> 
> 
> 
> 
> 请先写出代码框架和 AI 交互部分。

---

### ✅ 最终的 Echo 工作流

做完这一步，你的整个 Echo 2.0 系统闭环就完成了：

1. **乱丢**: 你把下载的财报、截图、代码全扔进 `~/Downloads/Inbox`。
2. **Janitor (整理)**: 后台脚本每小时醒一次，把它们分门别类整理进 `/Echo/Investment` 等文件夹，并改好名字。
3. **Ingest (进食)**: SeekDB 监控 `/Echo/` 文件夹，发现新文件，生成向量索引。
4. **Recall (调用)**: 你按快捷键唤起 Echo，搜 "PDD"，直接搜到这个整理好的文件。