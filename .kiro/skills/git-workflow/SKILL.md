---
name: git-workflow
description: |
  Git 工作流与提交规范技能：标准化的 Git 操作流程和 Conventional Commit 规范。
  Use when: 需要提交代码、创建分支、发起 PR、管理版本。
  Triggers: "commit", "提交", "push", "推送", "branch", "分支", "PR", "pull request", "merge", "合并"
---

# Git Workflow (Git 工作流)

> 🔄 **核心理念**: 规范化的 Git 工作流是团队协作的基础，清晰的提交历史是项目可维护性的保障。

## 🔴 第一原则：先验证，再提交

**任何代码修改都必须经过验证才能提交！**

```
❌ 错误流程: 修改代码 → 直接 commit → push
✅ 正确流程: 修改代码 → 本地测试 → build 验证 → commit → push → 验证部署
```

## When to Use This Skill

使用此技能当你需要：
- 提交代码变更
- 创建新分支
- 发起 Pull Request
- 合并代码
- 管理版本发布
- 编写规范的提交信息

## Not For / Boundaries

此技能不适用于：
- Git 基础命令学习（请参考 Git 官方文档）
- 复杂的 Git 操作（如 rebase 冲突解决）

---

## Quick Reference

### 🎯 标准工作流程

```
1. 创建功能分支
   git checkout -b feat/feature-name

2. 开发并提交
   git add .
   git commit -m "feat: 添加新功能"

3. 本地验证
   npm run build && npm test

4. 推送并创建 PR
   git push origin feat/feature-name

5. 代码审查 → 合并 → 删除分支
```

### 📋 提交前检查清单

| 检查项 | 命令 | 说明 |
|--------|------|------|
| 代码格式 | `npm run lint` | 确保代码风格一致 |
| 类型检查 | `npm run typecheck` | TypeScript 类型正确 |
| 单元测试 | `npm test` | 所有测试通过 |
| 构建验证 | `npm run build` | 构建成功无错误 |
| 提交信息 | - | 符合 Conventional Commit |

### 🏷️ Conventional Commit 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

**示例:**
```
feat(auth): 添加 Google OAuth 登录

- 集成 next-auth Google provider
- 添加登录按钮组件
- 配置回调 URL

Closes #123
```

### 📝 提交类型速查

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: 添加用户注册功能` |
| `fix` | Bug 修复 | `fix: 修复登录状态丢失问题` |
| `docs` | 文档更新 | `docs: 更新 API 文档` |
| `style` | 代码格式 | `style: 格式化代码` |
| `refactor` | 重构 | `refactor: 重构用户模块` |
| `test` | 测试 | `test: 添加单元测试` |
| `chore` | 构建/工具 | `chore: 更新依赖版本` |

### 🌿 分支命名规范

| 类型 | 格式 | 示例 |
|------|------|------|
| 功能 | `feat/<name>` | `feat/user-auth` |
| 修复 | `fix/<name>` | `fix/login-bug` |
| 热修复 | `hotfix/<name>` | `hotfix/security-patch` |
| 发布 | `release/<version>` | `release/v1.2.0` |

---

## 详细指南

### Phase 1: 分支管理

**创建分支**
```bash
# 从 main 创建功能分支
git checkout main
git pull origin main
git checkout -b feat/new-feature
```

**分支同步**
```bash
# 保持分支与 main 同步
git fetch origin
git rebase origin/main
# 或使用 merge
git merge origin/main
```

### Phase 2: 提交规范

**原子提交原则**
- 每个提交只做一件事
- 提交信息清晰描述变更内容
- 相关修改合并为一次提交

**提交信息规范**
```bash
# 简单提交
git commit -m "feat: 添加用户头像上传功能"

# 带详细说明的提交
git commit -m "fix(api): 修复并发请求导致的数据竞争

- 添加请求锁机制
- 优化错误重试逻辑
- 增加超时处理

Fixes #456"
```

### Phase 3: Pull Request

**PR 创建流程**
```bash
# 1. 推送分支
git push origin feat/new-feature

# 2. 创建 PR（通过 GitHub CLI 或网页）
gh pr create --title "feat: 添加新功能" --body "描述..."

# 3. 等待 CI 通过
# 4. 请求代码审查
# 5. 合并后删除分支
```

**PR 最佳实践**
- 保持 PR 小而专注
- 提供清晰的描述和截图
- 关联相关 Issue
- 响应审查意见

### Phase 4: 版本发布

**语义化版本**
```
MAJOR.MINOR.PATCH
  │     │     └── 向后兼容的 Bug 修复
  │     └──────── 向后兼容的新功能
  └────────────── 不兼容的 API 变更
```

**发布流程**
```bash
# 1. 创建发布分支
git checkout -b release/v1.2.0

# 2. 更新版本号
npm version minor

# 3. 合并到 main 并打 tag
git checkout main
git merge release/v1.2.0
git tag v1.2.0
git push origin main --tags
```

---

## 常见问题

### Q: 提交后发现信息写错了？
```bash
# 修改最近一次提交信息
git commit --amend -m "新的提交信息"
```

### Q: 需要撤销最近的提交？
```bash
# 保留修改，撤销提交
git reset --soft HEAD~1

# 完全撤销（慎用）
git reset --hard HEAD~1
```

### Q: 如何合并多个提交？
```bash
# 交互式 rebase，合并最近 3 个提交
git rebase -i HEAD~3
# 将 pick 改为 squash 或 s
```

---

## References

- `templates/commit-types.md`: 提交类型详细说明
- `templates/branch-naming.md`: 分支命名约定
- `templates/pr-template.md`: PR 描述模板

---

## Maintenance

- **Sources**: Conventional Commits, Git Flow, GitHub Flow
- **Last Updated**: 2025-01-01
- **Known Limits**: 
  - 适用于中小型团队
  - 大型项目可能需要更复杂的分支策略
