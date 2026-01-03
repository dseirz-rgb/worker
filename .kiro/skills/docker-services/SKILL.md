# Docker Services Skill

> Docker MCP Gateway 服务管理

## 触发词
docker, 容器, 服务, gateway, mcp

## 使用场景
- 管理 MCP Docker Gateway 中的服务
- 动态启用/禁用 MCP 服务器
- 创建组合工具 (code-mode)

## 启用 MCP

MCP_DOCKER 是一个 gateway，可以动态管理多个 MCP 服务：

```bash
# 编辑 .kiro/settings/mcp.json
# 将 MCP_DOCKER.disabled 改为 false
```

## 可用工具

### 服务发现
- `mcp_find` - 搜索可用的 MCP 服务器
- `mcp_add` - 添加 MCP 服务器到会话
- `mcp_remove` - 移除 MCP 服务器

### 配置管理
- `mcp_config_set` - 设置服务器配置
- `mcp_create_profile` - 创建配置档案

### 工具执行
- `mcp_exec` - 执行 MCP 工具

### 组合工具
- `code_mode` - 创建 JavaScript 组合工具

## 常用工作流

### 1. 查找并添加服务
```
1. mcp_find(query: "github") - 搜索 GitHub 相关服务
2. mcp_add(name: "github", activate: true) - 添加并激活
```

### 2. 配置服务
```
1. mcp_config_set(server: "postgres", config: {...})
2. mcp_exec(name: "query", arguments: {...})
```

### 3. 创建组合工具
```javascript
// 使用 code_mode 组合多个 MCP 工具
mcp_MCP_DOCKER_code_mode({
  name: "my-tool",
  servers: ["github", "fetch"]
})
```

## Gateway 包含的服务

通过 `docker mcp gateway run` 启动，包含：
- git - Git 操作
- fetch - HTTP 请求
- memory - 知识图谱
- sequential-thinking - 思维链
- 更多可通过 mcp_find 发现

## 注意事项

- Gateway 启动较慢，按需使用
- 每个服务都会占用上下文
- 建议只激活需要的服务
- 使用完毕后可以 mcp_remove 移除
