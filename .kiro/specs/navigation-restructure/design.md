# 导航重构设计文档

## 技术方案

### 1. 路由结构调整

```typescript
// baseStore.ts - 新的 routerList
routerList = [
  // 主导航
  { title: 'home', href: '/echoai/home', icon: 'mdi:home', group: 'main' },
  { title: 'notes', href: '/notes', icon: 'hugeicons:note', group: 'main' },
  { title: 'files', href: '/files', icon: 'solar:folder-with-files-bold-duotone', group: 'main' },
  { title: 'echoai', href: '/echoai', icon: 'mdi:robot-outline', group: 'main' },
  { title: 'search', href: '/echoai/search', icon: 'mdi:magnify', group: 'main' },
  
  // 工具箱
  { title: 'analytics', href: '/analytics', icon: 'hugeicons:analytics-01', group: 'tools' },
  { title: 'translation', href: '/translation', icon: 'hugeicons:translate', group: 'tools' },
  { title: 'resources', href: '/resources', icon: 'solar:database-linear', group: 'tools' },
  { title: 'activity', href: '/activity', icon: 'hugeicons:activity-01', group: 'tools' },
  { title: 'automations', href: '/automations', icon: 'solar:clock-circle-bold-duotone', group: 'tools' },
  { title: 'janitor', href: '/settings?tab=janitor', icon: 'mdi:broom', group: 'tools' },
  { title: 'agents', href: '/agents', icon: 'mdi:robot-happy-outline', group: 'tools' },
  { title: 'settings', href: '/settings', icon: 'hugeicons:settings-01', group: 'tools' },
  
  // 隐藏路由
  { title: 'archived', href: '/?path=archived', icon: 'solar:box-broken', hiddenSidebar: true },
  { title: 'trash', href: '/?path=trash', icon: 'hugeicons:delete-02', hiddenSidebar: true },
];
```

### 2. 笔记页面 Tab 设计

```typescript
// /notes 页面
interface NotesPageProps {
  defaultTab?: 'blinko' | 'notes' | 'todo';
}

// URL 结构
// /notes?tab=blinko  → 闪念
// /notes?tab=notes   → 笔记
// /notes?tab=todo    → 待办
```

### 3. Sidebar 组件结构

```tsx
<Sidebar>
  {/* 主导航 */}
  <NavGroup>
    <NavItem to="/echoai/home" icon="home" label="首页" />
    <NavItem to="/notes" icon="note" label="笔记" />
    <NavItem to="/files" icon="folder" label="文件" />
  </NavGroup>
  
  <Divider />
  
  <NavGroup>
    <NavItem to="/echoai" icon="robot" label="Echo AI" />
    <NavItem to="/echoai/search" icon="search" label="搜索" />
  </NavGroup>
  
  <Divider />
  
  {/* 工具箱 - 可折叠 */}
  <ToolsGroup collapsed={toolsCollapsed} onToggle={toggleTools}>
    <NavItem to="/analytics" icon="chart" label="统计" />
    <NavItem to="/translation" icon="translate" label="翻译" />
    <NavItem to="/resources" icon="database" label="资源" />
    <NavItem to="/activity" icon="activity" label="活动监控" />
    <NavItem to="/automations" icon="clock" label="自动化" />
    <NavItem to="/settings?tab=janitor" icon="broom" label="Janitor" />
    <NavItem to="/agents" icon="robot" label="Agent 管理" />
    <NavItem to="/settings" icon="settings" label="系统设置" />
  </ToolsGroup>
</Sidebar>
```

### 4. 工具箱折叠状态

```typescript
// baseStore.ts
toolsExpanded = new StorageState<boolean>({
  key: 'tools-expanded',
  default: false,
});
```

## 组件变更

| 文件 | 变更 |
|------|------|
| `baseStore.ts` | 重构 routerList，添加 toolsExpanded 状态 |
| `Sidebar.tsx` | 重构渲染逻辑，支持工具箱折叠 |
| `pages/notes.tsx` | 新建，整合闪念/笔记/待办 Tab |
| `translation.json` | 添加新的翻译 key |

## 兼容性

- 保留原有路由 `/`, `/?path=notes`, `/?path=todo` 的重定向
- 工具箱默认收起，减少视觉干扰
