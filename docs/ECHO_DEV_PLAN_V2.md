这份文档是 **Echo 2.0** 的核心需求规格说明书。

它融合了你对 **"多模态检索" (视频/PPT)**、**"自动整理" (Janitor)** 以及 **"本地优先" (SeekDB)** 的最新思考。我们将“重复造轮子”的部分剔除，全面拥抱开源集成。

你可以将此文档直接保存为 `REQUIREMENTS_V2.md`，作为后续开发的“宪法”。

---

# Echo 2.0: AI-Native Digital Brain

> **核心定义**: Echo 是一个本地优先的**数字外脑**。它不仅能记录想法（通过 Supabase），更能自动整理混乱的文件（通过 AI Janitor），并对视频、PPT、文档进行深度索引（通过 SeekDB），最终通过极简的指令界面为用户提供决策支持。

---

## 1. 🗺️ 全局架构图 (The Big Picture)

系统被划分为清晰的三个流水线：**整理 (Organize) -> 消化 (Ingest) -> 回忆 (Recall)**。

```mermaid
graph TD
    subgraph "1. 整理层 (The Janitor)"
        Chaos[📥 混乱的 Downloads 文件夹]
        LlamaFS[🤖 LlamaFS (Docker)]
        Ollama[🧠 本地 LLM (Ollama)]
        
        Chaos --> LlamaFS
        LlamaFS --"询问分类"--> Ollama
        LlamaFS --"语义重命名 & 移动"--> Order[📂 有序文件夹 (/Echo/Invest, /Echo/Dev...)]
    end

    subgraph "2. 消化层 (The Brain)"
        Order --> FileWatcher[👀 文件监听器]
        Supa[☁️ Supabase (云端笔记)]
        
        FileWatcher --"视频"--> Whisper[🎙️ faster-whisper]
        FileWatcher --"PPT"--> PptParser[📊 python-pptx]
        Supa --"同步笔记"--> SyncWorker[🔄 同步脚本]
        
        Whisper & PptParser & SyncWorker --> SeekDB[("🦁 SeekDB (统一向量库)")]
    end

    subgraph "3. 交互层 (The Interface)"
        SeekDB <--> EchoUI[🖥️ Echo 客户端 (指令行 + 仪表盘)]
    end

```

---

## 2. 🧩 核心功能模块 (Modules)

### 模块 A: 智能整理 (Echo Janitor)

> **目标**: 解决“文件乱”的问题，不需要写代码，直接集成开源方案。

* **开源选型**: **LlamaFS** (推荐使用活跃分支 `not-llama-fs`)
* **输入**: 监控 `~/Downloads/Inbox`。
* **处理逻辑**:
1. 读取文件内容（PDF/文本/文件名）。
2. 调用本地 Ollama (Llama 3.2 或 Qwen 2.5)。
3. **决策**: 属于哪个分类？(Investment / Dev / GameArt / Personal)。
4. **执行**: 重命名为 `YYYY-MM-DD_语义描述.ext` 并移动到目标目录。


* **交付物**: 一个配置好的 `docker-compose` 服务。

### 模块 B: 多模态索引 (Echo Brain)

> **目标**: 让系统“看懂”整理好的文件，建立向量索引。

* **核心存储**: **SeekDB** (OceanBase) - 存文本、向量、元数据。
* **处理能力**:
* **视频 (Video)**: 使用 `faster-whisper` 提取字幕。**关键需求**: 必须保留时间戳 (`start_time`, `end_time`)，以便搜索时跳转。
* **幻灯片 (PPT)**: 使用 `python-pptx` 提取文本。**关键需求**: 记录页码 (`page_num`)。
* **笔记 (Notes)**: 实时同步 Supabase 的笔记更新。


* **交付物**: Python 脚本 `ingest_manager.py` (包含 Video/PPT 处理函数)。

### 模块 C: 决策交互界面 (Echo UI)

> **目标**: 极速搜索，辅助决策。

* **交互形态**: **Spotlight 风格** (全局快捷键唤起)。
* **搜索体验**:
* **混合检索**: 输入 "PDD 增长"，同时展示笔记、PDF段落、视频片段。
* **即时预览**: 选中视频结果，右侧小窗**直接从第 N 秒自动播放**。
* **PPT 预览**: 选中 PPT 结果，显示该页缩略图。


* **交付物**: Tauri 桌面应用 (React 前端)。

---

## 3. 🛠️ 技术栈清单 (Tech Stack)

所有服务优先通过 Docker 部署，保证主机环境干净。

| 组件 | 选型 | 作用 | 备注 |
| --- | --- | --- | --- |
| **LLM Server** | **Ollama** | 提供 AI 推理能力 | 运行 Llama 3.2 / Qwen 2.5 |
| **File Organizer** | **LlamaFS** | 自动整理文件 | Docker 部署 |
| **Vector DB** | **SeekDB** | 核心数据库 | 只有 1C1G 占用，极轻 |
| **Cloud Sync** | **Supabase** | 多端笔记同步 | 仅作为笔记的“真理源” |
| **ASR Engine** | **faster-whisper** | 视频转文字 | 运行在 Python 容器中 |
| **App Framework** | **Tauri** | 桌面客户端 | Rust + React |

---

## 4. 📅 执行路线图 (Action Plan)

这是给 AI 编程助手的**任务队列**。

### Phase 1: 整理环境 (The Setup)

1. 编写 `docker-compose.yml`，一次性启动 **Ollama**, **SeekDB**, **LlamaFS**。
2. 配置 LlamaFS，定义你的 5 个核心文件夹分类 (Investment, Dev, GameArt, Management, Personal)。
3. **验证**: 往 Inbox 丢个文件，看它是否自动跑到了对的地方。

### Phase 2: 构建大脑 (The Ingestion)

1. 编写 `ingest.py`。
2. 实现 **Video Processor**: 视频 -> Whisper -> 带时间戳的文本块 -> SeekDB。
3. 实现 **PPT Processor**: PPT -> 文本+页码 -> SeekDB。
4. **验证**: 扔进一个视频，用 SQL 查 SeekDB，确认能查到里面的对话内容和时间。

### Phase 3: 打造界面 (The UI)

1. 搭建 Tauri 基础框架。
2. 实现“全局搜索框”。
3. 实现“视频跳转播放器”和“PPT 预览卡片”。

---

## 5. ⚠️ 关键约束 (Constraints)

1. **单向流动**: 文件必须**先被 Phase 1 整理**，**再被 Phase 2 索引**。不要让 SeekDB 去索引 Download 文件夹里的垃圾。
2. **资源控制**: 视频处理极耗 CPU。Phase 2 的脚本需要加锁，同一时间只能处理一个视频，避免电脑卡死。
3. **隐私红线**: 所有文件内容处理（Whisper, Ollama）必须在本地完成，**严禁**上传到公网 API。

---

*这份文档现在可以作为你项目的“总纲”。下次你让 AI 写代码时，如果它跑偏了，就把这个发给它看。*