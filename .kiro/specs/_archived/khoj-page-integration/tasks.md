# Implementation Plan: Khoj 页面集成

> ⚠️ **此 Spec 已整合到新的 `khoj-deep-integration` spec**
> 
> 新 spec 位置: `.kiro/specs/khoj-deep-integration/`
> 
> 本 spec 的 iframe 方案已完成，但将被原生组件方案替代。
> 新 spec 使用原生 React 组件 + 统一 API 网关，提供更好的用户体验。

---

## Overview (历史记录 - iframe 方案)

在 Blinko 应用中添加 Khoj 页面，使用 iframe 嵌入 Khoj Web UI，实现快速集成。

### 开发原则

⚠️ **用户不懂代码开发**，开发过程遵循以下原则：

1. **全自动执行** - 所有命令我直接运行，不给用户命令
2. **自动化测试** - 测试自动运行，不需要用户手动测试
3. **问题自行解决** - 遇到 bug 先自己修复
4. **Checkpoint 确认** - 只在关键节点让用户确认
5. **简洁汇报** - 告诉用户"做完了，可以试用了"

---

## Tasks

### Phase 1: 基础服务层

- [x] 1. 创建 Khoj 服务模块
  - [x] 1.1 创建 khojService.ts
    - 创建 `get/blinko-main/app/src/lib/khojService.ts`
    - 实现 `getKhojConfig()` - 获取配置
    - 实现 `saveKhojConfig()` - 保存配置
    - 实现 `checkKhojHealth()` - 健康检查
    - 实现 `getKhojChatUrl()` - 获取 Chat URL
    - _Requirements: 2.1, 2.5, 4.4_

  - [ ]* 1.2 编写 khojService 单元测试
    - 测试配置读写
    - 测试健康检查（mock fetch）
    - _Requirements: 2.1, 2.5_

- [x] 2. Checkpoint - 服务层验证
  - 确保 khojService 函数正常工作
  - 如有问题请询问用户

---

### Phase 2: Khoj 页面

- [x] 3. 创建 Khoj 页面组件
  - [x] 3.1 创建 khoj.tsx 页面
    - 创建 `get/blinko-main/app/src/pages/khoj.tsx`
    - 实现连接状态检测
    - 实现 Loading 状态
    - 实现 Error 状态（含启动指引）
    - 实现 iframe 嵌入
    - _Requirements: 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 实现连接状态指示器
    - 显示绿色/红色状态点
    - 显示"已连接"/"未连接"文字
    - 实现重试按钮
    - _Requirements: 4.1, 4.2, 4.3, 2.4_

  - [x] 3.3 实现定期健康检查
    - 每 30 秒检查一次连接状态
    - 状态变化时更新 UI
    - _Requirements: 4.4_

  - [ ]* 3.4 编写 Khoj 页面组件测试
    - **Property 1: Connection State Display**
    - **Validates: Requirements 2.2, 2.3, 4.2, 4.3**

- [x] 4. Checkpoint - 页面基础功能验证
  - 确保页面正常渲染
  - 确保连接状态正确显示
  - 如有问题请询问用户

---

### Phase 3: 路由和导航

- [x] 5. 配置路由
  - [x] 5.1 添加 /khoj 路由
    - 在路由配置中添加 Khoj 页面
    - 确保路由正常工作
    - _Requirements: 1.3_

  - [x] 5.2 添加导航入口
    - 在侧边栏添加 "Khoj AI" 导航项
    - 使用 `mdi:robot-outline` 图标
    - 放在 AI 相关功能组
    - _Requirements: 1.1, 1.2, 1.4_

- [x] 6. Checkpoint - 导航验证
  - 确保导航项显示正确
  - 确保点击导航能跳转到 Khoj 页面
  - 如有问题请询问用户

---

### Phase 4: 设置页面

- [x] 7. 创建 Khoj 设置组件
  - [x] 7.1 创建 KhojSetting.tsx
    - 创建 `get/blinko-main/app/src/components/BlinkoSettings/KhojSetting.tsx`
    - 实现 URL 输入框
    - 实现"测试连接"按钮
    - 实现"保存配置"按钮
    - 显示测试结果反馈
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 7.2 集成到设置页面
    - 在设置页面添加 Khoj 配置区域
    - _Requirements: 5.1_

  - [ ]* 7.3 编写设置组件测试
    - **Property 2: Configuration Persistence**
    - **Validates: Requirements 2.5, 5.2**

- [x] 8. Checkpoint - 设置功能验证
  - 确保设置页面显示 Khoj 配置
  - 确保配置保存和测试连接正常
  - 如有问题请询问用户

---

### Phase 5: 错误处理优化

- [x] 9. 完善错误处理
  - [x] 9.1 优化错误消息
    - 服务未启动：显示 Docker 启动命令
    - 网络错误：显示重试按钮
    - iframe 加载失败：显示"在新窗口打开"链接
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 9.2 添加"在新窗口打开"功能
    - 当 iframe 无法加载时提供备选方案
    - _Requirements: 7.3_

- [x] 10. Checkpoint - 错误处理验证
  - 确保各种错误场景有友好提示
  - 如有问题请询问用户

---

### Phase 6: Docker 配置

- [x] 11. 创建 Khoj Docker 配置
  - [x] 11.1 创建 docker-compose.khoj.yml
    - 在项目根目录创建 `docker-compose.khoj.yml`
    - 配置 Khoj 服务
    - 配置数据持久化
    - _Requirements: 2.1_

  - [x] 11.2 创建启动脚本
    - 创建 `scripts/start-khoj.sh`
    - 实现 Docker 检查
    - 实现启动等待
    - _Requirements: 2.1_

  - [x] 11.3 更新 dev.sh
    - 在 dev.sh 中添加 Khoj 启动选项
    - _Requirements: 2.1_

- [x] 12. Checkpoint - Docker 配置验证
  - 确保 Khoj 可以通过 Docker 启动
  - 确保 Blinko 可以连接到 Khoj
  - 如有问题请询问用户

---

### Phase 7: 最终集成测试

- [ ] 13. 端到端测试
  - [ ] 13.1 完整流程测试
    - 启动 Khoj Docker
    - 打开 Blinko
    - 导航到 Khoj 页面
    - 验证 iframe 正常加载
    - 验证对话功能正常
    - _Requirements: All_

  - [ ] 13.2 离线场景测试
    - 停止 Khoj Docker
    - 验证错误提示正确显示
    - 验证重试按钮正常工作
    - _Requirements: 2.3, 7.1_

- [ ] 14. 最终验收
  - 确保所有功能正常工作
  - 确保用户体验流畅
  - 如有问题请询问用户

---

## Notes

- Tasks marked with `*` are optional property-based tests
- 优先完成 Phase 1-3，形成可用版本
- Phase 4-5 可以后续优化
- Khoj 需要 Docker 环境

## 依赖关系

```
Phase 1 (服务层)
    ↓
Phase 2 (页面组件)
    ↓
Phase 3 (路由导航)
    ↓
Phase 4 (设置页面) ← 可并行
    ↓
Phase 5 (错误处理) ← 可并行
    ↓
Phase 6 (Docker 配置)
    ↓
Phase 7 (集成测试)
```

## 文件清单

```
get/blinko-main/
├── app/src/
│   ├── lib/
│   │   └── khojService.ts          # 新增：Khoj 服务
│   ├── pages/
│   │   └── khoj.tsx                # 新增：Khoj 页面
│   └── components/BlinkoSettings/
│       └── KhojSetting.tsx         # 新增：Khoj 设置
├── docker-compose.khoj.yml         # 新增：Khoj Docker 配置
└── scripts/
    └── start-khoj.sh               # 新增：Khoj 启动脚本
```
