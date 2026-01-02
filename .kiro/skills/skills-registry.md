# Skills 注册表

> 本文件是所有可用 skills 的中央注册表，用于快速查找和了解各 skill 的用途。

## 按分类索引

### 🛠️ Development (开发)

| Skill | 描述 | 触发词 |
|-------|------|--------|
| [api-integration](./api-integration/SKILL.md) | API 集成开发指南，包含 REST/GraphQL 模板、错误处理、重试策略 | API, 接口, 集成, REST, GraphQL |
| [error-handling](./error-handling/SKILL.md) | 错误处理最佳实践，包含错误分类、优雅降级、重试逻辑 | 错误, 异常, 降级, 重试, error |
| [gemini-integration](./gemini-integration/SKILL.md) | Google Gemini API 集成指南，包含提示词工程、流式响应、多模态处理 | Gemini, AI, 提示词, prompt, 流式 |
| [code-porter](./code-porter/SKILL.md) | 代码搬运师，优先搬运开源项目，禁止重复造轮子 | 开源, 搬运, 复用, 轮子 |

### 🚀 Deployment (部署)

| Skill | 描述 | 触发词 |
|-------|------|--------|
| [deployment-verification](./deployment-verification/SKILL.md) | 部署验证工作流，包含 Vercel/GCP 检查脚本、环境变量同步 | 部署, 验证, Vercel, GCP, 环境变量 |
| [database-migration](./database-migration/SKILL.md) | 数据库迁移指南，包含 Drizzle ORM 模板、回滚策略 | 迁移, migration, 数据库, Drizzle, 回滚 |

### 📊 Optimization (优化)

| Skill | 描述 | 触发词 |
|-------|------|--------|
| [performance-optimization](./performance-optimization/SKILL.md) | 性能优化指南，包含 React/API/数据库查询优化 | 性能, 优化, 慢, 卡顿, 加载, performance |

### 📝 Documentation (文档)

| Skill | 描述 | 触发词 |
|-------|------|--------|
| [documentation](./documentation/SKILL.md) | 文档生成指南，包含组件/API/README 模板 | 文档, 注释, README, doc |
| [git-workflow](./git-workflow/SKILL.md) | Git 工作流规范，包含 Conventional Commit、分支命名、PR 模板 | git, commit, 提交, 分支, PR |

### 🔧 Debugging (调试)

| Skill | 描述 | 触发词 |
|-------|------|--------|
| [multi-service-debug](./multi-service-debug/SKILL.md) | 多服务调试指南，包含日志聚合、服务间通信调试 | 调试, debug, 日志, 服务, 通信 |

### 💰 Domain-Specific (领域特定)

| Skill | 描述 | 触发词 |
|-------|------|--------|
| [financial-data](./financial-data/SKILL.md) | 金融数据处理指南，包含数据导入、验证、清洗 | 金融, 交易, 持仓, 数据, IBKR |

### 🎨 Design (设计)

| Skill | 描述 | 触发词 |
|-------|------|--------|
| [frontend-design](./frontend-design/SKILL.md) | 前端设计指南 | 设计, UI, 前端 |
| [tauri-v2-dev](./tauri-v2-dev/SKILL.md) | Tauri v2 开发指南 | Tauri, 桌面应用 |

---

## 使用方法

```bash
# 在对话中调用 skill
openskills read <skill-name>

# 示例
openskills read api-integration
openskills read deployment-verification
```

## 新增 Skill 指南

1. 在 `.kiro/skills/` 下创建新目录
2. 创建 `SKILL.md` 文件，包含标准 YAML frontmatter
3. 添加 `references/` 或 `templates/` 目录存放资源
4. 更新本注册表文件
5. 更新 `AGENTS.md` 中的 `available_skills` 列表
