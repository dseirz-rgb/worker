# 投资笔记整合 - 任务清单

## 状态说明
- [ ] 未开始
- [~] 进行中
- [x] 已完成

---

## Phase 1: 基础设施

### Task 1.1: 创建类型定义
- [x] 1.1.1 创建 `packages/echo/src/types/investmentNotes.ts`
  - 定义 `InvestmentNote` 接口
  - 定义 `NoteSourceType` 类型
  - 定义 `PortfolioSnapshot` 接口
  - 定义 `NoteFilter` 接口
  - _Requirements: 2.3_

### Task 1.2: 创建 InvestmentNotesStore
- [x] 1.2.1 创建 `packages/echo/src/store/investmentNotesStore.ts`
  - 实现 `noteList` (PromisePageState)
  - 实现 `upsertNote` (PromiseState)
  - 实现 `deleteNote` (PromiseState)
  - 实现 `activeTab`, `searchQuery` 状态
  - 实现 `setActiveTab`, `setSearchQuery` 方法
  - 实现 `openEditor`, `closeEditor` 方法
  - _Requirements: 3.2, 3.3_

### Task 1.3: 验证 Investment DB 连接
- [x] 1.3.1 确认 `investmentSupabase.ts` 可用
- [x] 1.3.2 测试 documents 表查询
- [x] 1.3.3 测试 documents 表写入
  - _Requirements: 3.1_

---

## Phase 2: 列表展示

### Task 2.1: 创建 NoteCard 组件
- [x] 2.1.1 创建 `packages/echo/src/components/InvestmentNotes/NoteCard.tsx`
  - 复用 BlinkoCard 布局模式
  - 显示标题、时间、标签
  - 显示内容预览（截断）
  - 显示关联股票
  - 支持点击选中
  - _Requirements: 2.2_

### Task 2.2: 创建 NoteList 组件
- [x] 2.2.1 创建 `packages/echo/src/components/InvestmentNotes/NoteList.tsx`
  - 使用 ScrollArea 包裹
  - 渲染 NoteCard 列表
  - 支持分页加载
  - 显示空状态
  - _Requirements: 2.2, 4.1_

### Task 2.3: 实现分类切换
- [x] 2.3.1 在页面中添加 Tabs 组件
  - 日记 (journal) - source_type: 'note'
  - 原则 (principles) - source_type: 'principle'
  - 知识库 (knowledge) - source_type: 'uploaded_file', 'wechat_article', 'wechat_group_chat'
- [x] 2.3.2 切换 Tab 时刷新列表
  - _Requirements: 2.2_

---

## Phase 3: 编辑功能

### Task 3.1: 创建 NoteEditor 组件
- [x] 3.1.1 创建 `packages/echo/src/components/InvestmentNotes/NoteEditor.tsx`
  - 标题输入框
  - Markdown 编辑器（复用 Editor 组件或 textarea）
  - 标签输入（逗号分隔）
  - 关联股票选择（下拉）
  - 资产快照开关（仅日记模式）
  - 保存/取消按钮
  - _Requirements: 2.2_

### Task 3.2: 实现创建笔记
- [x] 3.2.1 点击"新建"按钮打开编辑器
- [x] 3.2.2 填写内容后保存到 documents 表
- [x] 3.2.3 保存成功后刷新列表
- [x] 3.2.4 显示成功 Toast
  - _Requirements: 2.2, 4.2_

### Task 3.3: 实现编辑笔记
- [x] 3.3.1 点击卡片打开编辑器（预填数据）
- [x] 3.3.2 修改后更新 documents 表
- [x] 3.3.3 更新成功后刷新列表
  - _Requirements: 2.2_

### Task 3.4: 实现删除笔记
- [x] 3.4.1 添加删除按钮/菜单
- [x] 3.4.2 删除前确认对话框
- [x] 3.4.3 删除后刷新列表
  - _Requirements: 2.2, 4.2_

### Task 3.5: 实现资产快照
- [x] 3.5.1 获取当前 portfolioState
- [x] 3.5.2 构建 portfolio_snapshot 对象
- [x] 3.5.3 保存时包含快照数据
  - _Requirements: 2.2_

---

## Phase 4: 搜索过滤

### Task 4.1: 实现搜索功能
- [x] 4.1.1 添加搜索输入框
- [x] 4.1.2 实现防抖搜索（300ms）
- [x] 4.1.3 搜索标题和内容
  - _Requirements: 2.2, 4.1_

### Task 4.2: 实现标签过滤（可选）
- [ ] 4.2.1 显示常用标签
- [ ] 4.2.2 点击标签过滤列表
  - _Requirements: 2.2_

### Task 4.3: 实现股票过滤（可选）
- [ ] 4.3.1 显示关联股票列表
- [ ] 4.3.2 点击股票过滤列表
  - _Requirements: 2.2_

---

## Phase 5: 优化

### Task 5.1: 草稿自动保存
- [ ] 5.1.1 编辑时保存到 localStorage
- [ ] 5.1.2 打开编辑器时恢复草稿
- [ ] 5.1.3 保存成功后清除草稿
  - _Requirements: 4.2_

### Task 5.2: 加载状态优化
- [ ] 5.2.1 列表加载骨架屏
- [ ] 5.2.2 保存按钮 loading 状态
- [ ] 5.2.3 删除按钮 loading 状态
  - _Requirements: 4.2_

### Task 5.3: 错误处理
- [ ] 5.3.1 网络错误提示
- [ ] 5.3.2 保存失败重试
- [ ] 5.3.3 优雅降级
  - _Requirements: 4.2_

---

## Phase 6: 页面整合

### Task 6.1: 重写 notes.tsx 页面
- [x] 6.1.1 替换 `packages/echo/src/pages/investment/notes.tsx`
  - 移除占位符内容
  - 整合所有组件
  - 连接 InvestmentNotesStore
  - _Requirements: 3.2_

### Task 6.2: 测试验证
- [ ] 6.2.1 创建笔记测试
- [ ] 6.2.2 编辑笔记测试
- [ ] 6.2.3 删除笔记测试
- [ ] 6.2.4 搜索功能测试
- [ ] 6.2.5 与 RiskControl 数据兼容性测试
  - _Requirements: 6_

---

## Phase 7: 高级功能（新增）

### Task 7.1: 向量嵌入
- [x] 7.1.1 创建 embedding 服务函数
  - 调用 `/api/embedding` 接口
  - 处理错误和降级
- [x] 7.1.2 保存笔记时生成嵌入
  - 在 upsertNote 中集成
  - 嵌入失败不阻塞保存
  - _Requirements: 5.1_

### Task 7.2: 历史对话 Tab
- [x] 7.2.1 添加 'history' Tab
- [x] 7.2.2 创建 fetchHistory 方法
  - 从 conversations 表获取数据
- [x] 7.2.3 渲染历史对话列表
  - 显示标题、时间
  - 点击跳转或回调
  - _Requirements: 5.3_

### Task 7.3: 知识库上传
- [x] 7.3.1 创建 KnowledgeUploadDialog 组件
  - 适配 HeroUI 组件库
- [x] 7.3.2 集成到知识库 Tab
  - 添加上传按钮
  - 上传成功后刷新列表
  - _Requirements: 5.2_

### Task 7.4: 知识库分组显示
- [x] 7.4.1 实现书籍分组逻辑
  - 按标题聚合 Part 1/2/3...
- [x] 7.4.2 实现 BookCard 组件
  - 显示书籍名称、片段数
  - 支持展开/折叠
  - _Requirements: 5.2_

---

## 依赖关系

```
Phase 1 (基础设施)
    │
    ▼
Phase 2 (列表展示) ──► Phase 4 (搜索过滤)
    │
    ▼
Phase 3 (编辑功能) ──► Phase 5 (优化)
    │
    ▼
Phase 6 (页面整合)
```

---

## 文件清单

### 新建文件
- `packages/echo/src/types/investmentNotes.ts`
- `packages/echo/src/store/investmentNotesStore.ts`
- `packages/echo/src/components/InvestmentNotes/NoteCard.tsx`
- `packages/echo/src/components/InvestmentNotes/NoteList.tsx`
- `packages/echo/src/components/InvestmentNotes/NoteEditor.tsx`
- `packages/echo/src/components/InvestmentNotes/index.ts`

### 修改文件
- `packages/echo/src/pages/investment/notes.tsx` (重写)
- `packages/echo/src/store/index.ts` (注册 Store)

### 参考文件
- `packages/echo/src/store/blinkoStore.tsx`
- `packages/echo/src/components/BlinkoCard/index.tsx`
- `packages/echo/src/components/BlinkoEditor/index.tsx`
- `packages/riskcontrol/src/pages/DynamicNotes.tsx`
- `packages/riskcontrol/src/types/index.ts`
