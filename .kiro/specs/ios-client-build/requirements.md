# Requirements Document

## Introduction

本文档定义了 Echo iOS 客户端构建和分发的需求。目标是在没有付费 Apple Developer 账号的情况下，实现 iOS 应用的本地开发测试和通过 AltStore 进行长期分发。

## Glossary

- **Echo_App**: 基于 Tauri 框架构建的 iOS 客户端应用
- **Free_Apple_ID**: 免费的 Apple ID，可用于本地开发签名
- **AltStore**: 第三方 iOS 应用侧载工具，允许用户安装非 App Store 应用
- **IPA_File**: iOS 应用安装包格式
- **Xcode**: Apple 官方 iOS 开发工具
- **Sideloading**: 绕过 App Store 安装应用的方式
- **Development_Certificate**: 用于签名应用的开发者证书

## Requirements

### Requirement 1: 本地开发环境配置

**User Story:** As a developer, I want to set up the iOS development environment, so that I can build and test the app locally.

#### Acceptance Criteria

1. THE Echo_App SHALL be buildable using Tauri iOS build commands
2. WHEN Xcode is installed, THE Build_System SHALL detect and use the iOS SDK automatically
3. WHEN Rust iOS targets are configured, THE Build_System SHALL compile native code for arm64 architecture
4. THE Build_System SHALL generate valid iOS project files in the gen/apple directory

### Requirement 2: 免费 Apple ID 签名

**User Story:** As a developer, I want to sign the app with a free Apple ID, so that I can deploy to my device without a paid developer account.

#### Acceptance Criteria

1. WHEN a free Apple ID is configured in Xcode, THE Signing_System SHALL create a personal development certificate
2. THE Signing_System SHALL sign the Echo_App with the personal development certificate
3. WHEN the app is signed, THE Echo_App SHALL be deployable to the developer's physical iOS device
4. IF the signing certificate expires (7 days), THEN THE Signing_System SHALL allow re-signing with the same Apple ID

### Requirement 3: 本地设备部署

**User Story:** As a developer, I want to deploy the app to my iPhone, so that I can test the app on a real device.

#### Acceptance Criteria

1. WHEN an iOS device is connected via USB, THE Deployment_System SHALL detect the device
2. WHEN Developer Mode is enabled on the device, THE Deployment_System SHALL allow app installation
3. THE Deployment_System SHALL install the signed Echo_App to the connected device
4. WHEN the app is installed, THE Echo_App SHALL launch and function correctly on the device

### Requirement 4: IPA 文件生成

**User Story:** As a developer, I want to generate an IPA file, so that I can distribute the app via AltStore.

#### Acceptance Criteria

1. THE Build_System SHALL generate a valid .ipa file from the Tauri iOS build
2. THE IPA_File SHALL contain all required app resources and assets
3. THE IPA_File SHALL be unsigned or use ad-hoc signing for AltStore distribution
4. WHEN the IPA_File is generated, THE Build_System SHALL output the file path for easy access

### Requirement 5: AltStore 分发配置

**User Story:** As a developer, I want to configure AltStore distribution, so that users can install the app without a paid developer account.

#### Acceptance Criteria

1. THE Distribution_System SHALL generate an AltStore source JSON file
2. THE Source_JSON SHALL contain app metadata (name, version, description, download URL)
3. WHEN users add the source URL to AltStore, THE AltStore SHALL display the Echo_App for installation
4. THE IPA_File SHALL be hosted at a publicly accessible URL for AltStore to download

### Requirement 6: 构建自动化

**User Story:** As a developer, I want to automate the iOS build process, so that I can quickly iterate on development.

#### Acceptance Criteria

1. THE Build_Script SHALL execute all iOS build steps with a single command
2. WHEN the build completes, THE Build_Script SHALL report success or failure with clear error messages
3. THE Build_Script SHALL support both debug and release build configurations
4. IF build dependencies are missing, THEN THE Build_Script SHALL provide installation instructions

### Requirement 7: iOS 特定 UI 适配

**User Story:** As a user, I want the app to look native on iOS, so that I have a good user experience.

#### Acceptance Criteria

1. THE Echo_App SHALL display correctly on various iOS screen sizes (iPhone SE to iPhone Pro Max)
2. THE Echo_App SHALL support iOS safe area insets (notch, home indicator)
3. THE Echo_App SHALL support iOS dark mode and light mode
4. WHEN the device orientation changes, THE Echo_App SHALL adapt the layout appropriately
