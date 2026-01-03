# Desktop Automation Skill

> 桌面自动化工具集，封装 ui-tars MCP

## 触发词
桌面, 自动化, 窗口, 屏幕, 截图, 点击, 输入

## 使用场景
- 桌面应用自动化测试
- 跨应用操作
- 屏幕截图和分析
- 窗口管理

## 启用 MCP

在使用此 skill 前，需要启用 ui-tars MCP：

```bash
# 编辑 .kiro/settings/mcp.json
# 将 ui-tars.disabled 改为 false
```

## 配置说明

ui-tars 使用豆包视觉模型进行屏幕理解：

```json
{
  "UITARS_VLM_BASE_URL": "https://ark.cn-beijing.volces.com/api/v3",
  "UITARS_MODEL": "doubao-seed-1-6-vision-250115",
  "UITARS_MAX_LOOP_COUNT": "50",
  "UITARS_TIMEOUT": "60000"
}
```

## 可用工具

### 屏幕操作
- `screenshot` - 截取屏幕
- `screen_info` - 获取屏幕信息

### 窗口管理
- `window_list` - 列出所有窗口
- `window_focus` - 聚焦指定窗口

## 常用工作流

### 1. 获取屏幕状态
```
1. screen_info - 获取屏幕分辨率等信息
2. screenshot - 截取当前屏幕
```

### 2. 窗口操作
```
1. window_list - 列出所有窗口
2. window_focus(window_id: xxx) - 聚焦目标窗口
3. screenshot - 截图验证
```

## 注意事项

- 此工具需要屏幕访问权限
- 截图会消耗较多 token
- 使用完毕后建议禁用 MCP
- 适合自动化测试场景，日常开发不需要
