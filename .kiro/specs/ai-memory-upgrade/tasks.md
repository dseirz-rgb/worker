# Implementation Plan: AI 记忆系统升级

## Overview

将 Echo 应用的 AI 记忆系统升级为 mem0 框架，实现更智能的记忆提取、组织和检索能力。
采用渐进式升级策略，保持与现有 API 兼容，支持优雅降级。

### 开发原则

⚠️ **用户不懂代码开发**，开发过程遵循以下原则：

1. **全自动执行** - 所有命令我直接运行，不给用户命令
2. **自动化测试** - 测试自动运行，不需要用户手动测试
3. **问题自行解决** - 遇到 bug 先自己修复
4. **Checkpoint 确认** - 只在关键节点让用户确认
5. **简洁汇报** - 告诉用户"做完了，可以试用了"

---

## Tasks

### Phase 1: mem0 框架集成

- [ ] 1. 安装和配置 mem0
  - [ ] 1.1 安装 mem0 Python 依赖
    - 在 sidecar 中添加 mem0ai 依赖
    - 配置 Gemini 作为 LLM provider
    - _Requirements: 1.1, 1.4_

  - [ ] 1.2 创建 mem0 服务端点
    - 在 FastAPI sidecar 中添加 mem0 路由
    - 实现 /mem0/add, /mem0/search, /mem0/get 端点
    - 实现 /mem0/update, /mem0/delete 端点
    - _Requirements: 1.2, 1.3, 1.6_

  - [ ]* 1.3 编写 mem0 集成属性测试
    - **Property 2: Fallback Behavior**
    - **Validates: Requirements 1.5**

- [ ] 2. 创建 TypeScript mem0 客户端
  - [ ] 2.1 实现 Mem0Service 类
    - 创建 `echo/src/services/memory/mem0Service.ts`
    - 封装所有 mem0 HTTP 调用
    - 实现错误处理和重试
    - _Requirements: 1.6_

  - [ ] 2.2 实现统一 Memory API
    - 创建 `echo/src/services/memory/unifiedMemoryService.ts`
    - 实现 mem0 和 fallback 切换逻辑
    - 保持与现有 API 兼容
    - _Requirements: 1.5, 1.6_

- [ ] 3. Checkpoint - mem0 基础验证
  - 确保 mem0 服务可以启动
  - 确保 TypeScript 客户端可以调用
  - 确保降级逻辑正常工作
  - 如有问题请询问用户

---

### Phase 2: 记忆添加与提取

- [ ] 4. 实现智能记忆提取
  - [ ] 4.1 升级聊天记忆提取
    - 在对话中自动提取关键信息
    - 识别实体、偏好和事实
    - _Requirements: 2.1, 2.4_

  - [ ] 4.2 升级笔记记忆提取
    - 从笔记中提取关键信息
    - 关联用户 ID
    - _Requirements: 2.2, 2.5_

  - [ ] 4.3 升级任务记忆提取
    - 记录任务完成情况
    - 提取任务相关信息
    - _Requirements: 2.3_

  - [ ]* 4.4 编写记忆提取属性测试
    - **Property 3: Memory Extraction**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [ ] 5. 实现记忆去重
  - [ ] 5.1 添加去重逻辑
    - 检测重复信息
    - 更新现有记忆而非创建新记忆
    - _Requirements: 2.6_

  - [ ]* 5.2 编写去重属性测试
    - **Property 4: Deduplication**
    - **Validates: Requirements 2.6**

- [ ] 6. Checkpoint - 记忆提取验证
  - 确保聊天记忆正常提取
  - 确保笔记记忆正常提取
  - 确保去重逻辑正常工作
  - 如有问题请询问用户

---

### Phase 3: 记忆检索与搜索

- [ ] 7. 实现语义搜索
  - [ ] 7.1 升级搜索服务
    - 使用 mem0 的语义搜索
    - 实现相关度排序
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 7.2 实现搜索过滤
    - 支持按类别过滤
    - 支持按时间范围过滤
    - _Requirements: 3.4_

  - [ ]* 7.3 编写搜索属性测试
    - **Property 5: Memory Search and Ranking**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [ ] 8. 升级 AI 上下文获取
  - [ ] 8.1 优化 getContext 方法
    - 使用 mem0 检索相关记忆
    - 格式化为 AI 可用的上下文
    - _Requirements: 3.5, 3.6_

- [ ] 9. Checkpoint - 搜索功能验证
  - 确保语义搜索返回相关结果
  - 确保过滤功能正常工作
  - 确保 AI 上下文正确生成
  - 如有问题请询问用户

---

### Phase 4: 记忆管理

- [ ] 10. 实现记忆 CRUD
  - [ ] 10.1 实现记忆查看
    - 显示所有存储的记忆
    - 显示记忆元数据
    - _Requirements: 4.1_

  - [ ] 10.2 实现记忆编辑和删除
    - 支持编辑记忆内容
    - 支持删除记忆
    - _Requirements: 4.2, 4.3_

  - [ ]* 10.3 编写 CRUD 属性测试
    - **Property 6: Memory CRUD Consistency**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [ ] 11. 实现导入导出
  - [ ] 11.1 实现记忆导出
    - 导出为 JSON 格式
    - 包含所有元数据
    - _Requirements: 4.4_

  - [ ] 11.2 实现记忆导入
    - 从 JSON 导入
    - 合并现有记忆
    - _Requirements: 4.5_

  - [ ]* 11.3 编写导入导出属性测试
    - **Property 7: Export/Import Round-Trip**
    - **Validates: Requirements 4.4, 4.5**

- [ ] 12. Checkpoint - 记忆管理验证
  - 确保 CRUD 操作正常
  - 确保导入导出正常
  - 如有问题请询问用户

---

### Phase 5: 与现有功能集成

- [ ] 13. 集成到 Chat 服务
  - [ ] 13.1 更新 AI 助手服务
    - 在对话中使用 mem0 记忆
    - 自动提取对话记忆
    - _Requirements: 6.2_

- [ ] 14. 集成到日报服务
  - [ ] 14.1 更新日报生成
    - 使用记忆上下文生成日报
    - _Requirements: 6.1_

- [ ] 15. 集成到提醒服务
  - [ ] 15.1 更新提醒引擎
    - 使用用户偏好记忆
    - _Requirements: 6.3_

- [ ] 16. Checkpoint - 集成验证
  - 确保 Chat 使用记忆正常
  - 确保日报生成正常
  - 确保提醒使用偏好正常
  - 如有问题请询问用户

---

### Phase 6: 性能与可靠性

- [ ] 17. 实现性能优化
  - [ ] 17.1 添加缓存层
    - 缓存常用记忆
    - 减少 API 调用
    - _Requirements: 7.1, 7.2_

  - [ ] 17.2 实现离线队列
    - 网络不可用时队列操作
    - 恢复后自动同步
    - _Requirements: 7.4_

  - [ ]* 17.3 编写错误恢复属性测试
    - **Property 9: Error Resilience**
    - **Validates: Requirements 7.5**

- [ ] 18. 实现记忆衰减
  - [ ] 18.1 添加衰减机制
    - 根据时间和使用频率调整权重
    - 超出限制时移除旧记忆
    - _Requirements: 7.6_

  - [ ]* 18.2 编写衰减属性测试
    - **Property 10: Memory Decay**
    - **Validates: Requirements 7.6**

- [ ] 19. Checkpoint - 性能验证
  - 确保响应时间符合要求
  - 确保离线队列正常工作
  - 确保衰减机制正常
  - 如有问题请询问用户

---

### Phase 7: 隐私与安全

- [ ] 20. 实现数据保护
  - [ ] 20.1 添加敏感数据处理
    - 识别 PII 数据
    - 根据隐私设置处理
    - _Requirements: 8.5_

  - [ ] 20.2 实现用户数据删除
    - 支持删除用户所有记忆
    - _Requirements: 8.4_

  - [ ]* 20.3 编写数据删除属性测试
    - **Property 11: User Data Deletion**
    - **Validates: Requirements 8.4**

- [ ] 21. 最终验收
  - 确保所有功能正常工作
  - 确保所有测试通过
  - 确保与现有功能兼容
  - 如有问题请询问用户

---

## Notes

- Tasks marked with `*` are optional property-based tests
- Each checkpoint ensures incremental validation
- Property tests validate universal correctness properties
- 建议先完成 Phase 1-3 形成可用版本，再进行功能完善
- mem0 需要 Python 环境，与现有 Sidecar 共用

## 依赖关系

```
Phase 1 (mem0 集成) 
    ↓
Phase 2 (记忆提取) ←→ Phase 3 (记忆搜索)
    ↓                    ↓
Phase 4 (记忆管理)
    ↓
Phase 5 (功能集成)
    ↓
Phase 6 (性能优化) ←→ Phase 7 (隐私安全)
    ↓
最终验收
```
