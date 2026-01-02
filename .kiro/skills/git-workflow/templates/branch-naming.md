# 分支命名约定 (Branch Naming Convention)

> 规范化的分支命名有助于团队协作和自动化流程

## 📋 分支类型总览

| 类型 | 前缀 | 说明 | 生命周期 |
|------|------|------|----------|
| 主分支 | `main` | 生产环境代码 | 永久 |
| 开发分支 | `develop` | 开发集成分支 | 永久 |
| 功能分支 | `feat/` | 新功能开发 | 临时 |
| 修复分支 | `fix/` | Bug 修复 | 临时 |
| 热修复分支 | `hotfix/` | 紧急生产修复 | 临时 |
| 发布分支 | `release/` | 版本发布准备 | 临时 |
| 实验分支 | `experiment/` | 实验性功能 | 临时 |

---

## 🌿 分支命名格式

### 基本格式

```
<type>/<description>
```

### 带 Issue 编号

```
<type>/<issue-number>-<description>
```

### 带日期（可选）

```
<type>/<date>-<description>
```

---

## 详细说明

### 🏠 main - 主分支

**说明:** 生产环境的稳定代码，只接受来自 `release` 或 `hotfix` 分支的合并。

**规则:**
- 永远保持可部署状态
- 禁止直接推送
- 只能通过 PR 合并
- 每次合并都应该打 tag

```bash
# 主分支保护规则
- Require pull request reviews
- Require status checks to pass
- Require branches to be up to date
```

---

### 🔧 develop - 开发分支

**说明:** 开发集成分支，所有功能分支合并到这里。

**规则:**
- 保持相对稳定
- 功能分支合并目标
- 定期同步到 main

```bash
# 从 develop 创建功能分支
git checkout develop
git pull origin develop
git checkout -b feat/new-feature
```

---

### ✨ feat/ - 功能分支

**说明:** 用于开发新功能。

**命名规则:**
```
feat/<feature-name>
feat/<issue-number>-<feature-name>
```

**示例:**
```bash
feat/user-authentication
feat/123-add-oauth-login
feat/dark-theme
feat/file-upload
feat/payment-integration
```

**工作流程:**
```bash
# 1. 创建功能分支
git checkout develop
git checkout -b feat/user-auth

# 2. 开发并提交
git add .
git commit -m "feat(auth): 添加用户登录功能"

# 3. 推送并创建 PR
git push origin feat/user-auth

# 4. 合并后删除
git branch -d feat/user-auth
```

---

### 🐛 fix/ - 修复分支

**说明:** 用于修复非紧急 Bug。

**命名规则:**
```
fix/<bug-description>
fix/<issue-number>-<bug-description>
```

**示例:**
```bash
fix/login-state-lost
fix/456-token-refresh
fix/mobile-layout
fix/api-timeout
```

**工作流程:**
```bash
# 1. 创建修复分支
git checkout develop
git checkout -b fix/789-login-bug

# 2. 修复并提交
git add .
git commit -m "fix(auth): 修复登录状态丢失问题

Fixes #789"

# 3. 推送并创建 PR
git push origin fix/789-login-bug
```

---

### 🚨 hotfix/ - 热修复分支

**说明:** 用于紧急修复生产环境问题。

**命名规则:**
```
hotfix/<issue-description>
hotfix/<version>-<issue-description>
```

**示例:**
```bash
hotfix/security-vulnerability
hotfix/v1.2.1-critical-bug
hotfix/payment-failure
```

**工作流程:**
```bash
# 1. 从 main 创建热修复分支
git checkout main
git checkout -b hotfix/critical-bug

# 2. 修复并提交
git add .
git commit -m "fix: 紧急修复支付失败问题"

# 3. 合并到 main 和 develop
git checkout main
git merge hotfix/critical-bug
git tag v1.2.1

git checkout develop
git merge hotfix/critical-bug

# 4. 删除分支
git branch -d hotfix/critical-bug
```

---

### 📦 release/ - 发布分支

**说明:** 用于版本发布准备。

**命名规则:**
```
release/<version>
release/v<major>.<minor>.<patch>
```

**示例:**
```bash
release/v1.0.0
release/v1.2.0
release/v2.0.0-beta
```

**工作流程:**
```bash
# 1. 从 develop 创建发布分支
git checkout develop
git checkout -b release/v1.2.0

# 2. 版本号更新、最后测试
npm version minor
git commit -m "chore(release): 准备 v1.2.0 发布"

# 3. 合并到 main 并打 tag
git checkout main
git merge release/v1.2.0
git tag v1.2.0

# 4. 合并回 develop
git checkout develop
git merge release/v1.2.0

# 5. 删除分支
git branch -d release/v1.2.0
```

---

### 🧪 experiment/ - 实验分支

**说明:** 用于实验性功能或技术探索。

**命名规则:**
```
experiment/<experiment-name>
experiment/<date>-<experiment-name>
```

**示例:**
```bash
experiment/new-ui-framework
experiment/2024-01-ai-integration
experiment/performance-optimization
```

**注意:**
- 可能不会合并到主分支
- 用于技术验证和原型开发
- 定期清理过期的实验分支

---

## 🎯 命名最佳实践

### 1. 使用小写字母和连字符

```bash
# ✅ 好
feat/user-authentication
fix/login-bug

# ❌ 不好
feat/UserAuthentication
feat/user_authentication
feat/User-Auth
```

### 2. 简洁但有描述性

```bash
# ✅ 好
feat/oauth-login
fix/token-refresh

# ❌ 不好
feat/feature1
fix/bug
feat/add-google-and-github-oauth-login-with-refresh-token-support
```

### 3. 包含 Issue 编号（推荐）

```bash
# ✅ 推荐
feat/123-user-auth
fix/456-login-bug

# 便于追踪和自动关联
```

### 4. 避免特殊字符

```bash
# ✅ 允许
feat/user-auth
feat/user_auth  # 下划线可以但不推荐

# ❌ 禁止
feat/user@auth
feat/user#auth
feat/user auth  # 空格
```

---

## 🔄 分支生命周期

### 临时分支清理

```bash
# 查看已合并的分支
git branch --merged

# 删除本地已合并分支
git branch -d feat/old-feature

# 删除远程已合并分支
git push origin --delete feat/old-feature

# 批量清理已合并的本地分支
git branch --merged | grep -v "main\|develop" | xargs git branch -d
```

### 分支保护规则

| 分支 | 保护规则 |
|------|----------|
| `main` | 禁止直接推送，需要 PR 审查，CI 必须通过 |
| `develop` | 禁止直接推送，需要 PR |
| `release/*` | 禁止直接推送，需要 PR |
| 其他 | 无限制 |

---

## 📊 分支策略对比

### GitHub Flow（推荐小团队）

```
main ─────────────────────────────────
  │                    ↑
  └── feat/xxx ────────┘
```

- 简单直接
- 只有 main 和功能分支
- 适合持续部署

### Git Flow（推荐中大型项目）

```
main ─────────────────────────────────
  │              ↑           ↑
develop ─────────┼───────────┼────────
  │    ↑         │           │
  └────┴─ feat/  └─ release/ └─ hotfix/
```

- 结构清晰
- 适合版本发布
- 适合多环境部署

---

## 🔗 相关资源

- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow)
- [GitLab Flow](https://docs.gitlab.com/ee/topics/gitlab_flow.html)
