# iOS TestFlight 配置指南

## 前置条件

1. Apple Developer Program 会员资格 ($99/年)
2. Xcode 15+ 安装在 macOS 上
3. 有效的 Apple ID

## 步骤 1: 创建 App ID

1. 登录 [Apple Developer Portal](https://developer.apple.com/account)
2. 进入 Certificates, Identifiers & Profiles
3. 选择 Identifiers → App IDs
4. 点击 "+" 创建新 App ID
5. 填写信息:
   - Description: `Echo`
   - Bundle ID: `com.echo.app` (Explicit)
6. 选择需要的 Capabilities:
   - ✅ Push Notifications (如需要)
   - ✅ Associated Domains (如需要)
7. 点击 Continue → Register

## 步骤 2: 创建 App Store Connect 应用

1. 登录 [App Store Connect](https://appstoreconnect.apple.com)
2. 进入 My Apps
3. 点击 "+" → New App
4. 填写信息:
   - Platform: iOS
   - Name: `Echo`
   - Primary Language: 简体中文
   - Bundle ID: 选择刚创建的 `com.echo.app`
   - SKU: `echo-ios-app`
5. 点击 Create

## 步骤 3: 配置 TestFlight

1. 在 App Store Connect 中选择你的应用
2. 进入 TestFlight 标签
3. 创建测试组:
   - Internal Testing: 最多 100 人，无需审核
   - External Testing: 最多 10,000 人，需要审核

### 内部测试配置

1. 点击 "Internal Testing" → "+"
2. 添加测试人员 (必须是 App Store Connect 用户)
3. 上传构建后自动可用

### 外部测试配置

1. 点击 "External Testing" → "+"
2. 创建测试组
3. 添加测试人员邮箱
4. 上传构建后需要 Apple 审核 (通常 24-48 小时)

## 步骤 4: 配置 GitHub Secrets

在 GitHub 仓库设置中添加以下 Secrets:

```
APPLE_ID                    # Apple ID 邮箱
APPLE_PASSWORD              # App-Specific Password (非账户密码)
APPLE_TEAM_ID               # Team ID (在 Developer Portal 查看)
APPLE_CERTIFICATE           # Base64 编码的 .p12 证书
APPLE_CERTIFICATE_PASSWORD  # 证书密码
IOS_PROVISIONING_PROFILE    # Base64 编码的 Provisioning Profile
```

### 生成 App-Specific Password

1. 访问 [appleid.apple.com](https://appleid.apple.com)
2. 登录后进入 Security
3. 点击 "Generate Password" under App-Specific Passwords
4. 输入标签 (如 "GitHub Actions")
5. 保存生成的密码

### 导出证书

1. 打开 Keychain Access
2. 找到 "Apple Distribution" 证书
3. 右键 → Export
4. 保存为 .p12 格式
5. 设置密码
6. Base64 编码: `base64 -i certificate.p12 | pbcopy`

### 创建 Provisioning Profile

1. 在 Developer Portal 创建 App Store Distribution Profile
2. 下载 .mobileprovision 文件
3. Base64 编码: `base64 -i profile.mobileprovision | pbcopy`

## 步骤 5: 触发构建

推送带有版本标签的提交:

```bash
git tag v0.1.0
git push origin v0.1.0
```

或手动触发 GitHub Actions 工作流。

## 常见问题

### Q: 构建失败 "No signing certificate"
A: 确保 APPLE_CERTIFICATE secret 正确设置，且证书未过期

### Q: 上传失败 "Invalid provisioning profile"
A: 确保 Provisioning Profile 包含正确的 App ID 和证书

### Q: TestFlight 审核被拒
A: 检查是否包含测试数据、崩溃或不完整功能

## 参考链接

- [Tauri iOS 文档](https://tauri.app/v2/guides/building/ios)
- [App Store Connect 帮助](https://developer.apple.com/help/app-store-connect/)
- [TestFlight 文档](https://developer.apple.com/testflight/)
