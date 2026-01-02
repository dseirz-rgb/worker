# Performance Optimization References

本目录包含性能优化的详细参考文档。

## 文档索引

| 文档 | 描述 | 适用场景 |
|------|------|----------|
| [react-patterns.md](./react-patterns.md) | React 性能优化模式 | 组件渲染慢、重渲染过多 |
| [api-optimization.md](./api-optimization.md) | API 响应优化策略 | API 响应时间长、数据传输大 |
| [query-optimization.md](./query-optimization.md) | Drizzle ORM 查询优化 | 数据库查询慢、N+1 问题 |

## 快速导航

### 按问题类型

- **页面加载慢** → `react-patterns.md` (代码分割、懒加载)
- **组件卡顿** → `react-patterns.md` (memo, useMemo, useCallback)
- **列表滚动卡** → `react-patterns.md` (虚拟列表)
- **API 响应慢** → `api-optimization.md` (缓存、压缩、分页)
- **数据库查询慢** → `query-optimization.md` (索引、JOIN 优化)

### 按优化技术

- **React.memo** → `react-patterns.md#memo`
- **useMemo/useCallback** → `react-patterns.md#hooks-优化`
- **代码分割** → `react-patterns.md#代码分割`
- **响应缓存** → `api-optimization.md#缓存策略`
- **数据库索引** → `query-optimization.md#索引优化`
