# Implementation Plan: iOS Client Build

## Overview

本实现计划分为两个阶段：
1. **本地开发测试** - 配置环境，使用免费 Apple ID 部署到设备
2. **AltStore 分发** - 生成 IPA，配置 AltStore source

## Tasks

- [ ] 1. 配置 iOS 开发环境
  - [ ] 1.1 安装 Rust iOS targets
    - 执行 `rustup target add aarch64-apple-ios aarch64-apple-ios-sim`
    - 验证安装成功
    - _Requirements: 1.3_
  - [ ] 1.2 安装 CocoaPods
    - 执行 `brew install cocoapods`
    - 验证 pod 命令可用
    - _Requirements: 1.1_
  - [ ] 1.3 验证 Xcode 配置
    - 确认 Xcode 已安装并完成初始化
    - 确认 iOS SDK 可用
    - _Requirements: 1.2_

- [ ] 2. 初始化 Tauri iOS 项目
  - [ ] 2.1 执行 Tauri iOS 初始化
    - 在 blinko-main/app 目录执行 `npm run tauri ios init`
    - 生成 gen/apple 目录结构
    - _Requirements: 1.4_
  - [ ] 2.2 更新 tauri.ios.conf.json 配置
    - 修改 app 标题为 "Echo"
    - 配置 iOS 特定设置
    - _Requirements: 1.1, 7.2_
  - [ ] 2.3 配置 iOS 图标和启动画面
    - 生成 iOS 所需的各尺寸图标
    - 配置 LaunchScreen
    - _Requirements: 7.1_

- [ ] 3. 配置免费 Apple ID 签名
  - [ ] 3.1 在 Xcode 中登录 Apple ID
    - 打开 Xcode → Preferences → Accounts
    - 添加免费 Apple ID
    - _Requirements: 2.1_
  - [ ] 3.2 配置项目签名
    - 打开 gen/apple/Echo.xcodeproj
    - 选择 Signing & Capabilities
    - 选择 Personal Team
    - _Requirements: 2.2_
  - [ ] 3.3 设置 TAURI_APPLE_DEVELOPMENT_TEAM 环境变量
    - 获取 Team ID
    - 添加到 .env 文件
    - _Requirements: 2.2_

- [ ] 4. 本地设备部署测试
  - [ ] 4.1 连接 iOS 设备并启用开发者模式
    - USB 连接 iPhone
    - 设置 → 隐私与安全 → 开发者模式 → 开启
    - _Requirements: 3.1, 3.2_
  - [ ] 4.2 执行 Tauri iOS 开发构建
    - 执行 `npm run tauri ios dev`
    - 选择目标设备
    - _Requirements: 3.3_
  - [ ] 4.3 验证应用功能
    - 确认应用启动正常
    - 测试基本功能
    - _Requirements: 3.4_

- [ ] 5. Checkpoint - 本地开发测试完成
  - 确认应用可以在设备上运行
  - 如有问题，请告知

- [ ] 6. 创建 iOS 构建脚本
  - [ ] 6.1 创建 build-ios.sh 脚本
    - 支持 debug/release 模式
    - 自动检测依赖
    - _Requirements: 6.1, 6.3_
  - [ ] 6.2 添加错误处理和提示
    - 检测缺失依赖
    - 提供安装指引
    - _Requirements: 6.2, 6.4_
  - [ ]* 6.3 编写构建脚本单元测试
    - 测试参数解析
    - 测试错误处理
    - _Requirements: 6.2_

- [ ] 7. 生成 IPA 文件
  - [ ] 7.1 执行 release 构建
    - 执行 `npm run tauri ios build --release`
    - 生成 .app 文件
    - _Requirements: 4.1_
  - [ ] 7.2 打包为 IPA 格式
    - 创建 Payload 目录
    - 复制 .app 到 Payload
    - 压缩为 .ipa
    - _Requirements: 4.1, 4.4_
  - [ ]* 7.3 编写 IPA 结构验证属性测试
    - **Property 1: IPA File Structure Integrity**
    - **Validates: Requirements 4.2**

- [ ] 8. 配置 AltStore 分发
  - [ ] 8.1 创建 AltStore source JSON 生成脚本
    - 读取 app 版本信息
    - 生成符合 AltStore 规范的 JSON
    - _Requirements: 5.1_
  - [ ] 8.2 配置 GitHub Releases 托管
    - 上传 IPA 到 GitHub Releases
    - 获取下载 URL
    - _Requirements: 5.4_
  - [ ]* 8.3 编写 AltStore JSON 验证属性测试
    - **Property 2: AltStore Source JSON Schema Compliance**
    - **Validates: Requirements 5.2**

- [ ] 9. 创建分发文档
  - [ ] 9.1 更新 IOS_TESTFLIGHT_SETUP.md
    - 添加免费 Apple ID 方案
    - 添加 AltStore 分发说明
    - _Requirements: 5.3_
  - [ ] 9.2 创建用户安装指南
    - AltStore 安装步骤
    - 添加 source URL 步骤
    - _Requirements: 5.3_

- [ ] 10. Final Checkpoint - iOS 构建和分发完成
  - 确认 IPA 文件可生成
  - 确认 AltStore source 配置正确
  - 如有问题，请告知

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 本地开发测试（任务 1-5）是核心功能，必须完成
- AltStore 分发（任务 6-9）可以在本地测试通过后再实现
- 免费 Apple ID 签名的应用每 7 天需要重新签名
- AltStore 用户也需要每 7 天刷新一次应用
