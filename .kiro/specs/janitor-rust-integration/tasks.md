# Implementation Plan: Janitor Rust Integration

## Overview

将 Janitor 文件整理功能用 Rust 重写，集成到 Tauri 桌面应用。采用增量开发，先实现核心功能，再添加 AI 和自动化。

## Tasks

- [ ] 1. 项目结构和基础模块
  - [ ] 1.1 创建 Janitor Rust 模块结构
    - 在 `src-tauri/src/` 下创建 `janitor/` 目录
    - 创建 `mod.rs`, `error.rs`, `config.rs` 基础文件
    - 添加 Cargo.toml 依赖和 features 配置
    - _Requirements: 5.1, 5.2_
  
  - [ ] 1.2 实现 JanitorError 错误类型
    - 使用 thiserror 定义错误枚举
    - 实现 Tauri 兼容的错误响应
    - _Requirements: 5.3_
  
  - [ ] 1.3 实现平台可用性检测
    - 条件编译宏 `is_janitor_available()`
    - Tauri 命令 `janitor_check_availability`
    - _Requirements: 5.1_

- [ ] 2. 配置管理模块
  - [ ] 2.1 实现 ConfigManager 和数据结构
    - JanitorConfig, CategoryConfig 结构体
    - YAML 序列化/反序列化
    - 默认配置生成
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ]* 2.2 配置 round-trip 属性测试
    - **Property 4: Category Configuration Round-Trip**
    - **Validates: Requirements 2.1, 2.4**
  
  - [ ] 2.3 实现分类 CRUD 操作
    - add_category, update_category, delete_category
    - 路径验证
    - _Requirements: 2.4, 2.5, 2.6_
  
  - [ ]* 2.4 分类 CRUD 属性测试
    - **Property 5: Category CRUD Consistency**
    - **Validates: Requirements 2.4, 2.6**

- [ ] 3. 路径保护模块
  - [ ] 3.1 实现 PathGuard
    - 默认保护路径列表（macOS/Windows）
    - is_protected() 检查
    - validate_operation() 验证
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [ ]* 3.2 保护路径属性测试
    - **Property 10: Protected Path Enforcement**
    - **Validates: Requirements 9.1, 9.2, 9.3**
  
  - [ ] 3.3 实现大文件夹警告
    - check_file_count() 方法
    - 超过 1000 文件时返回警告
    - _Requirements: 9.5_
  
  - [ ]* 3.4 大文件夹警告属性测试
    - **Property 11: Large Folder Warning**
    - **Validates: Requirements 9.5**

- [ ] 4. Checkpoint - 基础模块完成
  - 确保所有测试通过，如有问题请询问用户

- [ ] 5. 文件扫描模块
  - [ ] 5.1 实现 FileScanner
    - 支持的扩展名过滤
    - 元数据提取（大小、日期）
    - 内容预览（前 1000 字符）
    - _Requirements: 1.1, 1.2_
  
  - [ ]* 5.2 文件扫描属性测试
    - **Property 1: File Scanner Returns Only Supported Types**
    - **Property 2: Metadata Extraction Completeness**
    - **Validates: Requirements 1.1, 1.2**

- [ ] 6. 撤销日志模块
  - [ ] 6.1 实现 UndoLogger
    - CSV 文件读写
    - log_move() 记录操作
    - get_history() 获取历史
    - _Requirements: 3.3, 4.6_
  
  - [ ]* 6.2 撤销日志持久化属性测试
    - **Property 9: Undo History Persistence**
    - **Validates: Requirements 4.6**
  
  - [ ] 6.3 实现撤销操作
    - undo_last(count) 撤销最近 N 条
    - undo_since(timestamp) 按时间撤销
    - 文件存在性验证
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 7. 文件移动模块
  - [ ] 7.1 实现 FileMover
    - commit() 执行移动
    - 目标目录自动创建
    - 冲突检测（不覆盖）
    - 与 UndoLogger 集成
    - _Requirements: 3.1, 3.2, 3.4, 3.5_
  
  - [ ]* 7.2 文件移动属性测试
    - **Property 6: File Move Round-Trip (Undo)**
    - **Property 7: Move Creates Destination Directory**
    - **Property 8: No Overwrite on Conflict**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 4.1**

- [ ] 8. Checkpoint - 核心功能完成
  - 确保所有测试通过，如有问题请询问用户

- [ ] 9. 本地分类器
  - [ ] 9.1 实现 LocalClassifier
    - 基于关键词匹配
    - 基于文件扩展名
    - 置信度计算
    - _Requirements: 6.1.7_
  
  - [ ]* 9.2 本地分类器属性测试
    - **Property 14: Local Classifier Fallback**
    - **Validates: Requirements 6.1.7**

- [ ] 10. AI 客户端模块
  - [ ] 10.1 实现 AIClient
    - Groq API 调用
    - 上下文窗口限制（最多 3 条）
    - Token 统计
    - 错误处理和重试
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 10.2 AI 上下文限制属性测试
    - **Property 12: AI Context Window Limit**
    - **Validates: Requirements 6.1.8**
  
  - [ ] 10.3 实现文件摘要缓存
    - 基于文件哈希的缓存
    - 缓存过期策略
    - _Requirements: 6.1.3_
  
  - [ ]* 10.4 缓存属性测试
    - **Property 13: File Summary Caching**
    - **Validates: Requirements 6.1.3**

- [ ] 11. 分类器整合
  - [ ] 11.1 实现 Classifier
    - 整合 LocalClassifier 和 AIClient
    - 批量分类优化
    - 本地优先策略
    - _Requirements: 1.3, 1.4, 1.5, 6.1.2_
  
  - [ ]* 11.2 分类结果属性测试
    - **Property 3: Classification Result Structure**
    - **Validates: Requirements 1.5**

- [ ] 12. Checkpoint - AI 功能完成
  - 确保所有测试通过，如有问题请询问用户

- [ ] 13. 意图解析模块
  - [ ] 13.1 实现 IntentParser
    - 本地模式匹配（正则）
    - 支持中英文指令
    - AI fallback
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 6.1.6_
  
  - [ ]* 13.2 意图解析属性测试
    - **Property 15: Intent Parsing for Known Patterns**
    - **Validates: Requirements 8.2, 6.1.6**

- [ ] 14. Tauri 命令集成
  - [ ] 14.1 实现所有 Tauri 命令
    - janitor_analyze - 分析目录
    - janitor_commit - 执行移动
    - janitor_undo - 撤销操作
    - janitor_history - 获取历史
    - janitor_get_config - 获取配置
    - janitor_update_config - 更新配置
    - janitor_get_categories - 获取分类
    - janitor_health - 健康检查
    - janitor_execute_instruction - 执行自然语言指令
    - _Requirements: 5.1, 7.1, 7.2, 7.3_
  
  - [ ] 14.2 注册命令到 Tauri
    - 在 main.rs 中注册
    - 条件编译处理
    - _Requirements: 5.2_

- [ ] 15. 桌面自动化模块（可选）
  - [ ] 15.1 实现 DesktopAutomation
    - 使用 rdev 进行鼠标键盘控制
    - 使用 autopilot 进行截图
    - 功能开关控制
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  
  - [ ]* 15.2 自动化开关属性测试
    - **Property 16: Automation Toggle Enforcement**
    - **Validates: Requirements 8.1**

- [ ] 16. 前端集成
  - [ ] 16.1 创建 Janitor 前端组件
    - 功能可用性检测
    - 文件列表视图
    - 分类配置界面
    - 自然语言输入框
    - _Requirements: 5.1_
  
  - [ ] 16.2 不可用提示组件
    - 非桌面端显示提示
    - "此功能仅在电脑客户端可用"
    - _Requirements: 5.1_

- [ ] 17. Final Checkpoint
  - 确保所有测试通过，如有问题请询问用户

## Notes

- Tasks marked with `*` are optional property-based tests
- 使用 `proptest` crate 进行属性测试
- 每个属性测试至少 100 次迭代
- 条件编译确保 iOS/Web 不包含此模块
