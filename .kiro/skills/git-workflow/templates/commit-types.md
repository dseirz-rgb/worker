# 提交类型说明 (Commit Types)

> 基于 [Conventional Commits](https://www.conventionalcommits.org/) 规范

## 📋 类型总览

| 类型 | Emoji | 说明 | 触发版本 |
|------|-------|------|----------|
| `feat` | ✨ | 新功能 | MINOR |
| `fix` | 🐛 | Bug 修复 | PATCH |
| `docs` | 📝 | 文档更新 | - |
| `style` | 💄 | 代码格式（不影响逻辑） | - |
| `refactor` | ♻️ | 重构（不新增功能/修复 Bug） | - |
| `test` | ✅ | 测试相关 | - |
| `chore` | 🔧 | 构建/工具/依赖 | - |
| `perf` | ⚡ | 性能优化 | PATCH |
| `ci` | 👷 | CI/CD 配置 | - |
| `revert` | ⏪ | 回滚提交 | - |

---

## 详细说明

### ✨ feat - 新功能

用于添加新功能或特性。

**格式:**
```
feat(<scope>): <description>
```

**示例:**
```bash
feat: 添加用户注册功能
feat(auth): 实现 Google OAuth 登录
feat(ui): 添加暗色主题支持
feat(api): 新增文件上传接口
```

**注意事项:**
- 一个 feat 提交应该是一个完整的功能点
- 如果功能较大，考虑拆分为多个小的 feat 提交
- 会触发 MINOR 版本号更新

---

### 🐛 fix - Bug 修复

用于修复 Bug 或问题。

**格式:**
```
fix(<scope>): <description>
```

**示例:**
```bash
fix: 修复登录状态丢失问题
fix(auth): 修复 token 过期未刷新的问题
fix(ui): 修复移动端布局错乱
fix(api): 修复并发请求导致的数据竞争
```

**注意事项:**
- 应该关联相关的 Issue（如果有）
- 在 footer 中添加 `Fixes #123` 或 `Closes #123`
- 会触发 PATCH 版本号更新

---

### 📝 docs - 文档更新

用于文档相关的修改。

**格式:**
```
docs(<scope>): <description>
```

**示例:**
```bash
docs: 更新 README 安装说明
docs(api): 添加 API 接口文档
docs(contributing): 添加贡献指南
docs: 修复文档中的错别字
```

**适用范围:**
- README.md
- API 文档
- 注释更新
- 配置说明
- 教程/指南

---

### 💄 style - 代码格式

用于不影响代码逻辑的格式修改。

**格式:**
```
style(<scope>): <description>
```

**示例:**
```bash
style: 格式化代码
style: 修复 ESLint 警告
style: 调整代码缩进
style(components): 统一组件命名风格
```

**适用范围:**
- 代码格式化（Prettier）
- 空格/缩进调整
- 分号添加/删除
- 命名风格统一
- 不影响逻辑的代码调整

**注意:** 不包括 CSS 样式修改（那属于 feat 或 fix）

---

### ♻️ refactor - 重构

用于代码重构，既不新增功能也不修复 Bug。

**格式:**
```
refactor(<scope>): <description>
```

**示例:**
```bash
refactor: 重构用户认证模块
refactor(hooks): 提取公共逻辑到 useAuth
refactor(api): 统一错误处理方式
refactor: 将类组件改为函数组件
```

**适用范围:**
- 代码结构优化
- 提取公共逻辑
- 设计模式应用
- 技术债务清理
- 代码可读性改进

---

### ✅ test - 测试

用于测试相关的修改。

**格式:**
```
test(<scope>): <description>
```

**示例:**
```bash
test: 添加用户模块单元测试
test(auth): 添加登录流程集成测试
test: 修复不稳定的测试用例
test(e2e): 添加端到端测试
```

**适用范围:**
- 添加新测试
- 修复测试
- 测试配置修改
- 测试工具更新

---

### 🔧 chore - 构建/工具

用于构建过程、辅助工具、依赖管理等。

**格式:**
```
chore(<scope>): <description>
```

**示例:**
```bash
chore: 更新依赖版本
chore(deps): 升级 React 到 19.0
chore(build): 优化构建配置
chore: 添加 husky pre-commit 钩子
chore(release): 发布 v1.2.0
```

**适用范围:**
- 依赖更新
- 构建配置
- 开发工具配置
- 版本发布
- 其他不影响源码的修改

---

### ⚡ perf - 性能优化

用于性能相关的优化。

**格式:**
```
perf(<scope>): <description>
```

**示例:**
```bash
perf: 优化首屏加载速度
perf(api): 添加请求缓存
perf(render): 减少不必要的重渲染
perf(bundle): 代码分割优化
```

---

### 👷 ci - CI/CD

用于 CI/CD 配置修改。

**格式:**
```
ci(<scope>): <description>
```

**示例:**
```bash
ci: 添加 GitHub Actions 工作流
ci(deploy): 配置自动部署到 Vercel
ci: 添加代码覆盖率检查
ci(test): 优化测试并行执行
```

---

### ⏪ revert - 回滚

用于回滚之前的提交。

**格式:**
```
revert: <original commit message>

This reverts commit <hash>.
```

**示例:**
```bash
revert: feat(auth): 实现 Google OAuth 登录

This reverts commit abc1234.
原因: 第三方服务不稳定，暂时回滚
```

---

## 🎯 Scope 建议

Scope 用于说明提交影响的范围，常见的 scope 包括：

| Scope | 说明 |
|-------|------|
| `auth` | 认证授权 |
| `api` | API 接口 |
| `ui` | 用户界面 |
| `db` | 数据库 |
| `config` | 配置 |
| `deps` | 依赖 |
| `build` | 构建 |
| `test` | 测试 |
| `docs` | 文档 |
| `core` | 核心模块 |
| `utils` | 工具函数 |
| `hooks` | React Hooks |
| `components` | 组件 |
| `pages` | 页面 |
| `services` | 服务层 |

---

## 💡 最佳实践

### 1. 提交信息要清晰
```bash
# ❌ 不好
git commit -m "fix bug"
git commit -m "update"
git commit -m "wip"

# ✅ 好
git commit -m "fix(auth): 修复 token 过期后未自动刷新的问题"
git commit -m "feat(ui): 添加用户头像上传功能"
```

### 2. 使用祈使句
```bash
# ❌ 不好
git commit -m "feat: added user login"
git commit -m "fix: fixed the bug"

# ✅ 好
git commit -m "feat: add user login"
git commit -m "fix: resolve login state issue"
```

### 3. 首字母小写（英文）或直接中文
```bash
# ✅ 英文
git commit -m "feat: add user authentication"

# ✅ 中文
git commit -m "feat: 添加用户认证功能"
```

### 4. 关联 Issue
```bash
git commit -m "fix(auth): 修复登录失败问题

详细说明...

Fixes #123
Closes #456"
```

---

## 🔗 相关资源

- [Conventional Commits 规范](https://www.conventionalcommits.org/)
- [Angular Commit Guidelines](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)
- [Semantic Versioning](https://semver.org/)
