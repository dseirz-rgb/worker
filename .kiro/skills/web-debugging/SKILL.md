# Web Debugging Skill

> 前端调试工具集，封装 chrome-devtools MCP

## 触发词
调试, debug, 前端, 浏览器, console, network, 截图, DOM

## 使用场景
- 调试前端页面渲染问题
- 检查 console 日志和错误
- 分析网络请求
- 截图验证 UI
- 执行页面 JavaScript

## 启用 MCP

在使用此 skill 前，需要启用 chrome-devtools MCP：

```bash
# 编辑 .kiro/settings/mcp.json
# 将 chrome-devtools.disabled 改为 false
```

## 可用工具

### 页面操作
- `list_pages` - 列出所有打开的页面
- `select_page` - 选择要操作的页面
- `new_page` - 打开新页面
- `navigate_page` - 导航到 URL
- `close_page` - 关闭页面

### 元素交互
- `take_snapshot` - 获取页面 DOM 快照
- `click` - 点击元素
- `fill` - 填充表单
- `fill_form` - 批量填充表单
- `hover` - 悬停元素
- `press_key` - 按键操作

### 调试工具
- `list_console_messages` - 列出 console 日志
- `get_console_message` - 获取特定日志详情
- `list_network_requests` - 列出网络请求
- `get_network_request` - 获取请求详情
- `evaluate_script` - 执行 JavaScript

### 截图
- `take_screenshot` - 页面截图

### 性能分析
- `performance_start_trace` - 开始性能追踪
- `performance_stop_trace` - 停止追踪
- `performance_analyze_insight` - 分析性能洞察

## 常用工作流

### 1. 检查页面错误
```
1. list_pages - 查看打开的页面
2. select_page - 选择目标页面
3. list_console_messages(types: ["error", "warn"]) - 查看错误
```

### 2. 验证 UI 渲染
```
1. navigate_page(url: "http://localhost:3000")
2. take_snapshot - 获取 DOM 结构
3. take_screenshot - 截图验证
```

### 3. 调试网络请求
```
1. list_network_requests(resourceTypes: ["fetch", "xhr"])
2. get_network_request(reqid: xxx) - 查看请求详情
```

## 注意事项

- 使用完毕后建议禁用 MCP 以节省上下文
- 截图会占用较多 token，按需使用
- 优先使用 `take_snapshot` 而非截图
