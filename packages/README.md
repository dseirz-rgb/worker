# Packages - Monorepo 前端模块

## 目录结构

```
packages/
├── echo/           -> ../vendor/blinko-main (软链接)
│   └── 知识管理系统 (Bun)
│
├── riskcontrol/    -> ../riskcontrol (软链接)
│   └── 投资风控系统 (npm)
│
└── shared/         # 共享代码
    └── context/    # 上下文管理库
```

## 开发命令

```bash
# Echo 模块 (Bun)
npm run dev:echo

# RiskControl 模块 (npm)
npm run dev:riskcontrol

# 同时运行
npm run dev
```

## 注意事项

1. `echo/` 和 `riskcontrol/` 是软链接
2. Echo 使用 Bun，RiskControl 使用 npm
3. 共享代码放在 `shared/` 目录
