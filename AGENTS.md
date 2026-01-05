# AGENTS

## 🔴 关键架构规则

### 双数据库架构
项目使用两个独立的 Supabase 数据库，**禁止混用**：

| 数据库 | 用途 | 数据内容 |
|--------|------|----------|
| **Investment DB** | 投资/风控 | 持仓、交易、NAV、资产快照、投资笔记 |
| **Echo DB** | 笔记/AI | 笔记、标签、用户、AI 对话、文件管理 |

详见 `.kiro/steering/database-architecture.md`

### 前端整合状态
- RiskControl 已整合到 Echo，访问路径 `/investment/*`
- 投资模块使用 MobX (InvestmentStore)
- 所有投资页面使用 HeroUI 组件

<skills_system priority="1">

## Available Skills

<!-- SKILLS_TABLE_START -->
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Invoke: Bash("openskills read <skill-name>")
- The skill content will load with detailed instructions on how to complete the task
- Base directory provided in output for resolving bundled resources (references/, scripts/, assets/)

Usage notes:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already loaded in your context
- Each skill invocation is stateless
</usage>

<available_skills>

<!-- Global Skills -->
<skill>
<name>mcp-builder</name>
<description>Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Use when building MCP servers to integrate external APIs or services, whether in Python (FastMCP) or Node/TypeScript (MCP SDK).</description>
<location>global</location>
</skill>

<skill>
<name>skill-creator</name>
<description>Guide for creating effective skills. Use when users want to create a new skill (or update an existing skill) that extends Claude's capabilities with specialized knowledge, workflows, or tool integrations.</description>
<location>global</location>
</skill>

<skill>
<name>frontend-design</name>
<description>Create distinctive, production-grade frontend interfaces with high design quality. Use when building web components, pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI. Generates creative, polished code and UI design.</description>
<location>global</location>
</skill>

<skill>
<name>web-artifacts-builder</name>
<description>Suite of tools for creating elaborate, multi-component HTML artifacts using modern frontend web technologies (React, Tailwind CSS, shadcn/ui). Use for complex artifacts requiring state management, routing, or shadcn/ui components.</description>
<location>global</location>
</skill>

<skill>
<name>docx</name>
<description>Comprehensive document creation, editing, and analysis with support for tracked changes, comments, formatting preservation, and text extraction. Use when working with professional documents (.docx files).</description>
<location>global</location>
</skill>

<skill>
<name>pdf</name>
<description>Comprehensive PDF manipulation toolkit for extracting text and tables, creating new PDFs, merging/splitting documents, and handling forms. Use when processing, generating, or analyzing PDF documents.</description>
<location>global</location>
</skill>

<skill>
<name>xlsx</name>
<description>Comprehensive spreadsheet creation, editing, and analysis with support for formulas, formatting, data analysis, and visualization. Use when working with spreadsheets (.xlsx, .xlsm, .csv, .tsv, etc).</description>
<location>global</location>
</skill>

<!-- Workspace Skills - MCP 封装 -->
<skill>
<name>web-debugging</name>
<description>前端调试工具集，封装 chrome-devtools MCP。包含 DOM 检查、console 日志、网络请求分析、截图等 20+ 工具。使用前需启用 MCP。</description>
<location>workspace</location>
</skill>

<skill>
<name>desktop-automation</name>
<description>桌面自动化工具，封装 ui-tars MCP。包含屏幕截图、窗口管理等功能。使用前需启用 MCP。</description>
<location>workspace</location>
</skill>

<skill>
<name>docker-services</name>
<description>Docker MCP Gateway 服务管理。动态管理多个 MCP 服务器，支持服务发现、配置管理、组合工具。使用前需启用 MCP。</description>
<location>workspace</location>
</skill>

<!-- Workspace Skills - 开发指南 -->
<skill>
<name>api-integration</name>
<description>API 集成开发指南，包含 REST/GraphQL 模板、错误处理、重试策略。</description>
<location>workspace</location>
</skill>

<skill>
<name>gemini-integration</name>
<description>Google Gemini API 集成指南，包含提示词工程、流式响应、多模态处理。</description>
<location>workspace</location>
</skill>

<skill>
<name>tauri-v2-dev</name>
<description>Tauri v2 开发指南，包含移动端适配、IPC 通信、插件开发。</description>
<location>workspace</location>
</skill>

<skill>
<name>financial-data</name>
<description>金融数据处理指南，包含 IBKR 数据导入、验证、清洗。</description>
<location>workspace</location>
</skill>

<skill>
<name>database-migration</name>
<description>数据库迁移指南，包含 Drizzle/Prisma 迁移、回滚策略、生产环境安全工作流。</description>
<location>workspace</location>
</skill>

<skill>
<name>deployment-verification</name>
<description>部署验证工作流，包含 Vercel/GCP 检查、环境变量同步。</description>
<location>workspace</location>
</skill>

<skill>
<name>error-handling</name>
<description>错误处理最佳实践，包含错误分类、优雅降级、重试逻辑。</description>
<location>workspace</location>
</skill>

<skill>
<name>multi-service-debug</name>
<description>多服务调试指南，包含日志聚合、服务间通信调试。</description>
<location>workspace</location>
</skill>

<skill>
<name>code-porter</name>
<description>代码搬运师，优先搬运开源项目，禁止重复造轮子。</description>
<location>workspace</location>
</skill>

</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>
