# UI-TARS MCP Server

基于 UI-TARS 的 MCP (Model Context Protocol) Server，提供 GUI 自动化能力，支持开发辅助和 UE5 编辑器操作。

## 功能特性

### 基础 GUI 操作
- **screenshot** - 截取屏幕截图
- **screen_info** - 获取屏幕信息
- **click/double_click/right_click** - 鼠标点击操作
- **drag** - 拖拽操作
- **hover** - 鼠标悬停
- **type_text** - 文本输入
- **press_key** - 按键操作
- **hotkey** - 快捷键组合
- **scroll** - 滚动操作

### GUI Agent 任务
- **run_gui_task** - 执行自然语言 GUI 任务
- **cancel_gui_task** - 取消正在执行的任务
- **gui_task_status** - 查询任务状态

### 窗口管理
- **window_list** - 列出所有窗口
- **window_focus** - 聚焦窗口
- **window_resize** - 调整窗口大小和位置

### UE5 编辑器操作
- **ue_find_element** - 视觉定位 UI 元素
- **ue_click_menu** - 菜单导航
- **ue_import_asset** - 导入资产
- **ue_set_material** - 设置材质

### UE5 蓝图/材质节点
- **ue_blueprint_add_node** - 添加节点
- **ue_blueprint_connect_pins** - 连接节点引脚
- **ue_blueprint_find_node** - 查找节点
- **ue_blueprint_set_value** - 设置节点参数
- **ue_material_create_expression** - 创建材质表达式
- **ue_material_connect** - 连接到材质输出
- **ue_graph_navigate** - 图形视图导航

### 开发辅助
- **dev_open_file** - 在 IDE 中打开文件
- **dev_run_command** - 执行 Shell 命令
- **dev_navigate_code** - 代码导航
- **dev_detect_ide** - 检测运行中的 IDE
- **dev_search_files** - 文件内容搜索

## 安装

```bash
cd ui-tars-mcp
npm install
npm run build
```

## 配置

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| UITARS_VLM_BASE_URL | VLM API 地址 | - |
| UITARS_API_KEY | API 密钥 | - |
| UITARS_MODEL | 模型名称 | ui-tars-1.5 |
| UITARS_MAX_LOOP_COUNT | 最大循环次数 | 50 |
| UITARS_TIMEOUT | 超时时间 (ms) | 60000 |
| UITARS_LOG_LEVEL | 日志级别 | info |

### MCP 配置示例

在 Kiro 中配置 (`.kiro/settings/mcp.json`):

```json
{
  "mcpServers": {
    "ui-tars": {
      "command": "node",
      "args": ["path/to/ui-tars-mcp/dist/index.js"],
      "env": {
        "UITARS_VLM_BASE_URL": "https://api.example.com/v1",
        "UITARS_API_KEY": "your-api-key",
        "UITARS_MODEL": "ui-tars-1.5",
        "UITARS_LOG_LEVEL": "info"
      }
    }
  }
}
```

## 使用示例

### 截图
```
使用 screenshot 工具截取当前屏幕
```

### GUI 任务
```
使用 run_gui_task 工具，指令: "打开 Chrome 浏览器并访问 google.com"
```

### UE5 材质节点连接
```
1. 使用 ue_material_create_expression 创建 TextureSample 节点
2. 使用 ue_material_connect 将其连接到 BaseColor 输出
```

## 开发

```bash
# 运行测试
npm test

# 构建
npm run build

# 开发模式
npm run dev
```

## 技术栈

- TypeScript
- @modelcontextprotocol/sdk - MCP 协议实现
- @nut-tree-fork/nut-js - 原生 GUI 控制
- fast-check - 属性测试
- vitest - 测试框架

## 许可证

MIT
