# Requirements Document

## Introduction

完全清除项目中所有 Khoj 相关代码和配置。Khoj 原本作为 AI 服务的降级方案保留，但现在 Mastra 已经稳定运行，不再需要 Khoj 作为备选。本次清理将移除所有 Khoj 相关的代码、配置、文档引用，使项目架构更加简洁。

## Glossary

- **Khoj**: 原 Python 实现的 AI 知识库服务，已被 Mastra 替代
- **Mastra**: TypeScript 实现的 AI Agent 框架，现为唯一 AI 服务
- **Echo_System**: 基于 Blinko 的个人知识管理系统
- **Khoj_Reference**: `get/khoj-main/` 目录下的 Khoj 源码参考（保留用于学习）

## Requirements

### Requirement 1: 清理后端 Khoj 代码残留

**User Story:** As a developer, I want to remove all Khoj backend code, so that the codebase is clean and maintainable.

#### Acceptance Criteria

1. THE system SHALL remove all Khoj-related imports from TypeScript files
2. THE system SHALL remove Khoj fallback logic from serviceRouter.ts
3. THE system SHALL remove Khoj-related type definitions
4. THE system SHALL remove Khoj-related environment variables from .env files
5. IF any file contains only Khoj-related code, THEN THE system SHALL delete the entire file

### Requirement 2: 清理前端 Khoj 代码残留

**User Story:** As a developer, I want to remove all Khoj frontend references, so that the UI code is consistent.

#### Acceptance Criteria

1. THE system SHALL remove `isKhoj` references from chat components
2. THE system SHALL rename `KhojAgent` type to `EchoAgent` in all components
3. THE system SHALL rename `KhojAutomation` type to `EchoAutomation` in all components
4. THE system SHALL remove Khoj-related exports from echoaiService.ts
5. THE system SHALL update all component comments that reference Khoj

### Requirement 3: 清理配置文件

**User Story:** As a developer, I want clean configuration files, so that deployment is straightforward.

#### Acceptance Criteria

1. THE system SHALL remove Khoj-related entries from docker-compose files
2. THE system SHALL remove Khoj-related entries from .env.example files
3. THE system SHALL remove `start_khoj` function from dev.sh
4. THE system SHALL remove Khoj-related scripts from echo/scripts/

### Requirement 4: 更新文档

**User Story:** As a developer, I want accurate documentation, so that I understand the current architecture.

#### Acceptance Criteria

1. THE system SHALL update VISION_AND_ARCHITECTURE.md to remove Khoj references
2. THE system SHALL update AI_MIGRATION_ROADMAP.md to mark Khoj as fully removed
3. THE system SHALL update KHOJ_CLEANUP_PLAN.md to mark all tasks as complete
4. THE system SHALL remove or archive Khoj-specific documentation files
5. THE system SHALL update the "已知问题" section to remove Khoj cleanup item

### Requirement 5: 清理 Spec 文件

**User Story:** As a developer, I want clean spec files, so that the project planning is up-to-date.

#### Acceptance Criteria

1. THE system SHALL update echo-ai spec to remove Khoj backend references
2. THE system SHALL archive or update khoj-deep-integration spec
3. THE system SHALL update ai-service-unification spec to reflect Khoj removal

### Requirement 6: 保留 Khoj 源码参考

**User Story:** As a developer, I want to keep Khoj source code for reference, so that I can learn from its implementation.

#### Acceptance Criteria

1. THE system SHALL NOT delete `get/khoj-main/` directory
2. THE system SHALL add a README note explaining this is reference code only
3. THE system SHALL ensure no runtime code imports from `get/khoj-main/`
