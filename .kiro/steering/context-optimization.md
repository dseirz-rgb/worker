# 上下文优化规则

## 核心原则

保持上下文精简，只加载与当前任务直接相关的内容。

## 文件加载策略

### 优先使用精确引用
- 使用 `#File` 引用具体文件，而非整个目录
- 使用 `#Folder` 时限制深度，避免加载过多文件
- 避免频繁使用 `#Codebase`，除非真的需要全局搜索

### 按需加载
- 先理解任务需求，再决定需要哪些文件
- 修改代码前，只读取要修改的文件
- 调试时，只加载相关的错误日志和代码

## MCP 按需加载

### 默认启用 (常用)
- `deepwiki`, `context7`, `github`, `git`, `fetch`

### 默认禁用 (通过 skill 启用)
- `chrome-devtools` → `openskills read web-debugging`
- `ui-tars` → `openskills read desktop-automation`
- `MCP_DOCKER` → `openskills read docker-services`
- `memory`, `sequential-thinking`, `janitor` → 手动启用

### 启用流程
1. 加载对应 skill 了解工具用法
2. 编辑 `.kiro/settings/mcp.json` 将 `disabled` 改为 `false`
3. 使用完毕后改回 `true` 节省上下文

## 响应风格

### 简洁优先
- 回答直接切入重点，不要冗长的开场白
- 代码修改只展示关键变更，不重复未修改的部分
- 总结时用 1-2 句话，不要列表式复述

### 避免重复
- 不要重复用户已经说过的内容
- 不要重复解释已经完成的操作
- 如果之前解释过，直接引用而非重述

## 工具使用

### MCP 工具结果
- 大输出（>50行）时，只展示关键部分
- 相同参数的工具调用，复用之前的结果
- 截图和日志只在必要时请求

### 文件操作
- 读取文件时，优先读取需要修改的部分
- 批量读取相关文件，减少来回次数
- 写入时使用增量更新，而非全量替换
