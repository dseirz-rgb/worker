# UI-TARS MCP 安装指南

## 快速安装

### 1. 复制文件夹
将整个 `ui-tars-mcp` 文件夹复制到目标电脑的任意位置，例如：
- Windows: `C:\tools\ui-tars-mcp`
- Mac/Linux: `~/tools/ui-tars-mcp`

### 2. 安装依赖
```bash
cd ui-tars-mcp
npm install
```

### 3. 配置 Kiro MCP

编辑 `.kiro/settings/mcp.json`，添加以下配置：

```json
{
  "mcpServers": {
    "ui-tars": {
      "command": "node",
      "args": ["<你的路径>/ui-tars-mcp/dist/index.js"],
      "env": {
        "UITARS_LOG_LEVEL": "info"
      },
      "disabled": false,
      "autoApprove": [
        "screenshot",
        "screen_info",
        "window_list",
        "dev_detect_ide"
      ]
    }
  }
}
```

**注意**: 将 `<你的路径>` 替换为实际路径，Windows 使用正斜杠 `/` 或双反斜杠 `\\`

### 4. 重启 Kiro
配置完成后重启 Kiro 或在命令面板中搜索 "MCP" 重新连接服务器。

## 可选：配置 VLM API（用于 GUI Agent 功能）

如果需要使用 `run_gui_task` 等 AI 驱动的 GUI 自动化功能，需要配置 VLM API：

```json
"env": {
  "UITARS_VLM_BASE_URL": "https://api.openai.com/v1",
  "UITARS_API_KEY": "sk-your-api-key",
  "UITARS_MODEL": "gpt-4-vision-preview",
  "UITARS_LOG_LEVEL": "info"
}
```

## 功能列表

| 类别 | 工具 |
|------|------|
| 基础 GUI | screenshot, screen_info, click, double_click, right_click, drag, hover, type_text, press_key, hotkey, scroll |
| GUI Agent | run_gui_task, cancel_gui_task, gui_task_status |
| 窗口管理 | window_list, window_focus, window_resize |
| UE5 基础 | ue_find_element, ue_click_menu, ue_import_asset, ue_set_material |
| UE5 蓝图/材质 | ue_blueprint_add_node, ue_blueprint_connect_pins, ue_blueprint_find_node, ue_blueprint_set_value, ue_material_create_expression, ue_material_connect, ue_graph_navigate |
| 开发工具 | dev_open_file, dev_run_command, dev_navigate_code, dev_detect_ide, dev_search_files |

## 故障排除

1. **MCP 连接失败**: 检查路径是否正确，确保 `dist/index.js` 存在
2. **权限问题**: Windows 可能需要以管理员身份运行 Kiro
3. **依赖缺失**: 运行 `npm install` 确保所有依赖已安装
