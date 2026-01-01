# 导航重构任务清单

## 任务列表

- [x] 1. 更新 baseStore.ts 路由配置
- [x] 2. 重构 Sidebar.tsx 组件
- [x] 3. 创建统一的笔记页面 (notes.tsx)
- [x] 4. 更新翻译文件
- [x] 5. 添加路由配置
- [x] 6. 测试验证

## 详细任务

### Task 1: 更新 baseStore.ts 路由配置
- 重新组织 routerList，分为 main/tools/hidden 三组
- 添加 toolsExpanded 状态管理
- 更新 isSideBarActive 逻辑

### Task 2: 重构 Sidebar.tsx 组件
- 主导航区域：首页、笔记、文件、Echo AI、搜索
- 工具箱区域：可折叠，包含 8 个工具项
- 支持折叠状态下的图标显示

### Task 3: 创建统一的笔记页面
- 新建 /notes 路由
- Tab 切换：闪念 | 笔记 | 待办
- 复用现有的笔记列表组件

### Task 4: 更新翻译文件
- 添加 "home", "tools", "agent-management" 等新 key
- 中英文翻译

### Task 5: 添加路由重定向
- `/` → `/notes?tab=blinko`
- `/?path=notes` → `/notes?tab=notes`
- `/?path=todo` → `/notes?tab=todo`

### Task 6: 测试验证
- 所有导航项可正常访问
- Tab 切换正常
- 工具箱展开/收起正常
- 移动端适配正常
