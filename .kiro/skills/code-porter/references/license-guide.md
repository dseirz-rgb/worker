# 开源许可证选择指南

> 搬运代码前必须检查许可证

## 许可证兼容性速查

### ✅ 可以自由使用（商业项目友好）

| 许可证 | 特点 | 注意事项 |
|--------|------|----------|
| **MIT** | 最宽松 | 保留版权声明即可 |
| **Apache 2.0** | 宽松 + 专利保护 | 保留 NOTICE 文件 |
| **BSD 2-Clause** | 宽松 | 保留版权声明 |
| **BSD 3-Clause** | 宽松 | 不能用作者名字做宣传 |
| **ISC** | 类似 MIT | 保留版权声明 |
| **Unlicense** | 公共领域 | 无限制 |
| **CC0** | 公共领域 | 无限制 |

### ⚠️ 需要注意（有传染性）

| 许可证 | 特点 | 风险 |
|--------|------|------|
| **LGPL** | 弱传染 | 动态链接可以，静态链接需开源 |
| **MPL 2.0** | 文件级传染 | 修改的文件需开源 |

### 🚫 商业项目慎用（强传染性）

| 许可证 | 特点 | 风险 |
|--------|------|------|
| **GPL v2/v3** | 强传染 | 整个项目需开源 |
| **AGPL** | 网络传染 | 即使是 SaaS 也需开源 |

## 搬运时的许可证处理

### 1. 直接安装包（npm/pip）
```
✅ 通常安全，包管理器会处理许可证
⚠️ 检查 package.json 中的 license 字段
```

### 2. 复制代码片段
```typescript
/**
 * 来源: https://github.com/xxx/yyy
 * 许可证: MIT
 * 原作者: @author
 * 
 * MIT License
 * Copyright (c) 2024 Author Name
 * Permission is hereby granted...
 */
```

### 3. Fork 仓库
```
1. 保留原始 LICENSE 文件
2. 在 README 中注明来源
3. 如有修改，说明修改内容
```

## 许可证检查工具

```bash
# npm 项目
npx license-checker --summary

# 检查特定包
npm view <package> license

# 批量检查
npx license-checker --production --json > licenses.json
```

## 最佳实践

1. **优先选择 MIT/Apache 2.0 许可的项目**
2. **避免 GPL/AGPL 许可的代码进入商业项目**
3. **保留所有版权声明和许可证文件**
4. **在项目中维护 THIRD_PARTY_LICENSES 文件**
5. **定期审计依赖的许可证**
