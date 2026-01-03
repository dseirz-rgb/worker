# 项目开发规范

## 代码理解优先

遇到不熟悉的代码时：先用 `deepwiki` 查文档 → 再用 `context7` 查库文档 → 最后动手写代码

## 常用 MCP 工具

- `deepwiki` - GitHub 项目文档
- `context7` - 库/框架文档
- `github` - 代码搜索
- `git` - Git 操作
- `fetch` - HTTP 请求

## 按需加载的 MCP (通过 skill 启用)

以下 MCP 默认禁用，需要时通过 `openskills read <skill-name>` 加载：

| Skill | MCP | 用途 |
|-------|-----|------|
| `web-debugging` | chrome-devtools | 前端调试、console、network |
| `desktop-automation` | ui-tars | 桌面自动化、截图 |
| `docker-services` | MCP_DOCKER | Docker Gateway 服务 |
