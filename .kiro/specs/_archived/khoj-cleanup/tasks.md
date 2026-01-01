# Implementation Plan: Khoj 完全清理

## Overview

完全移除项目中所有 Khoj 相关代码和配置，使项目架构更加简洁。按照依赖关系分阶段执行：先重命名类型，再清理代码，最后更新文档。

## Tasks

- [ ] 1. 重命名前端类型
  - [ ] 1.1 重命名 AgentCard 中的 KhojAgent 类型
    - 修改 `get/blinko-main/app/src/components/echoai/agentCard/AgentCard.tsx`
    - 将 `KhojAgent` 重命名为 `EchoAgent`
    - 更新注释
    - _Requirements: 2.2_
  - [ ] 1.2 更新 AgentCard 相关文件
    - 修改 `agentCard/AgentForm.tsx` 中的类型引用
    - 修改 `agentCard/index.ts` 中的导出
    - _Requirements: 2.2_
  - [ ] 1.3 重命名 AutomationCard 中的 KhojAutomation 类型
    - 修改 `get/blinko-main/app/src/components/echoai/automationCard/AutomationCard.tsx`
    - 将 `KhojAutomation` 重命名为 `EchoAutomation`
    - 更新注释
    - _Requirements: 2.3_
  - [ ] 1.4 更新 AutomationCard 相关文件
    - 修改 `automationCard/AutomationForm.tsx` 中的类型引用
    - 修改 `automationCard/index.ts` 中的导出
    - _Requirements: 2.3_
  - [ ] 1.5 更新 echoai/index.ts 导出
    - 移除别名导出 `KhojAgent as EchoAgent`
    - 移除别名导出 `KhojAutomation as EchoAutomation`
    - 直接导出 `EchoAgent` 和 `EchoAutomation`
    - _Requirements: 2.2, 2.3_

- [ ] 2. Checkpoint - 验证类型重命名
  - 运行 TypeScript 编译，确保无错误
  - 搜索确认 KhojAgent/KhojAutomation 已移除

- [ ] 3. 清理前端服务代码
  - [ ] 3.1 清理 echoaiService.ts
    - 移除 Khoj 相关注释
    - 移除 `resetEchoAIConfig` 中的 Khoj 清理代码
    - _Requirements: 2.4_

- [ ] 4. 清理后端代码
  - [ ] 4.1 清理 serviceRouter.ts 注释
    - 移除 Khoj 相关注释
    - _Requirements: 1.2_

- [ ] 5. 清理配置文件
  - [ ] 5.1 清理 dev.sh
    - 移除 `start_khoj` 函数
    - 移除 `stop_khoj` 函数
    - 移除 `show_urls` 中的 Khoj URL
    - 移除 `check_status` 中的 Khoj 状态检查
    - 移除 `start_all` 中的 Khoj 启动调用
    - _Requirements: 3.3_

- [ ] 6. Checkpoint - 验证代码清理
  - 运行 TypeScript 编译，确保无错误
  - 搜索确认 Khoj 相关代码已移除

- [ ] 7. 更新文档
  - [ ] 7.1 更新 VISION_AND_ARCHITECTURE.md
    - 移除 AI 服务表格中的 Khoj 降级方案
    - 移除已知问题中的 Khoj 清理项
    - _Requirements: 4.1, 4.5_
  - [ ] 7.2 更新 AI_MIGRATION_ROADMAP.md
    - 标记 Khoj 已完全移除
    - 更新迁移状态
    - _Requirements: 4.2_
  - [ ] 7.3 更新 KHOJ_CLEANUP_PLAN.md
    - 标记所有任务完成
    - 添加完成日期
    - _Requirements: 4.3_

- [ ] 8. 归档 Spec 文件
  - [ ] 8.1 归档 khoj-deep-integration spec
    - 移动 `.kiro/specs/khoj-deep-integration/` 到 `.kiro/specs/_archived/`
    - _Requirements: 5.2_

- [ ] 9. 添加 khoj-main 说明
  - [ ] 9.1 更新 get/khoj-main 说明
    - 在 `get/khoj-main/` 目录添加说明文件或更新 README
    - 说明这是源码参考，不是项目依赖
    - _Requirements: 6.2_

- [ ] 10. Final Checkpoint - 验证清理完成
  - 运行完整编译验证
  - 使用 grep 搜索确认 Khoj 相关代码已移除（排除 khoj-main 和 _archived）
  - 确认 EchoAI 功能正常工作

## Notes

- 类型重命名需要先完成，因为其他文件可能依赖这些类型
- `get/khoj-main/` 目录保留作为源码参考
- 归档的 spec 文件移动到 `_archived/` 目录
- 迁移脚本 `migrate-khoj-data.ts` 保留作为历史记录
