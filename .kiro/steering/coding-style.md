# 开发风格偏好

## 技术栈
- React 19 + TypeScript 5.x + Tailwind CSS 4.x
- Radix UI + shadcn/ui
- Supabase (PostgreSQL) + Drizzle ORM
- Vitest + fast-check (属性测试)

## 代码规范
- 中文注释，英文变量名
- `interface` 定义对象，`type` 定义联合类型
- 组件 PascalCase，Hook use 前缀，测试 .test.ts 后缀
- 优雅降级，单个失败不中断整体流程

## 测试
- 属性测试至少 100 次迭代
- 注释格式: `**Validates: Requirements X.Y**`
