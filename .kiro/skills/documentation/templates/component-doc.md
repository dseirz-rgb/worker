# {ComponentName}

> 简短描述组件的用途和核心功能。

## 使用场景

- 场景 1：描述何时使用此组件
- 场景 2：描述另一个使用场景
- 场景 3：描述特殊使用场景

## 基础用法

```tsx
import { ComponentName } from '@/components/ComponentName';

function Example() {
  return (
    <ComponentName
      requiredProp="value"
      optionalProp={123}
    />
  );
}
```

## Props

| 属性 | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| `requiredProp` | `string` | - | ✅ | 必填属性的说明 |
| `optionalProp` | `number` | `0` | - | 可选属性的说明 |
| `children` | `ReactNode` | - | - | 子元素内容 |
| `className` | `string` | - | - | 自定义样式类名 |
| `onAction` | `() => void` | - | - | 操作回调函数 |

### Props 类型定义

```typescript
interface ComponentNameProps {
  /** 必填属性的说明 */
  requiredProp: string;
  
  /** 可选属性的说明 */
  optionalProp?: number;
  
  /** 子元素内容 */
  children?: React.ReactNode;
  
  /** 自定义样式类名 */
  className?: string;
  
  /** 操作回调函数 */
  onAction?: () => void;
}
```

## 示例

### 示例 1: 基础用法

最简单的使用方式，只传入必填属性。

```tsx
<ComponentName requiredProp="hello" />
```

### 示例 2: 带回调函数

处理用户交互事件。

```tsx
function Example() {
  const handleAction = () => {
    console.log('操作触发');
  };

  return (
    <ComponentName
      requiredProp="hello"
      onAction={handleAction}
    />
  );
}
```

### 示例 3: 自定义样式

通过 className 自定义组件样式。

```tsx
<ComponentName
  requiredProp="hello"
  className="custom-style"
/>
```

### 示例 4: 组合使用

与其他组件组合使用的场景。

```tsx
function Example() {
  return (
    <Card>
      <CardHeader>
        <ComponentName requiredProp="标题" />
      </CardHeader>
      <CardContent>
        内容区域
      </CardContent>
    </Card>
  );
}
```

## 状态说明

### 加载状态

```tsx
<ComponentName
  requiredProp="hello"
  isLoading={true}
/>
```

### 禁用状态

```tsx
<ComponentName
  requiredProp="hello"
  disabled={true}
/>
```

### 错误状态

```tsx
<ComponentName
  requiredProp="hello"
  error="错误信息"
/>
```

## 样式定制

### 使用 Tailwind CSS

```tsx
<ComponentName
  requiredProp="hello"
  className="bg-blue-500 text-white rounded-lg p-4"
/>
```

### 使用 CSS 变量

组件支持以下 CSS 变量进行样式定制：

```css
.component-name {
  --component-bg: #ffffff;
  --component-text: #000000;
  --component-border: #e5e7eb;
}
```

## 无障碍 (Accessibility)

- 支持键盘导航 (Tab, Enter, Escape)
- 包含适当的 ARIA 属性
- 支持屏幕阅读器

```tsx
<ComponentName
  requiredProp="hello"
  aria-label="描述性标签"
  role="button"
/>
```

## 注意事项

### ⚠️ 性能考虑

- 避免在循环中频繁创建新的回调函数，使用 `useCallback`
- 大数据列表建议配合虚拟滚动使用

```tsx
// ✅ 推荐
const handleAction = useCallback(() => {
  // 处理逻辑
}, []);

// ❌ 避免
<ComponentName onAction={() => { /* 每次渲染都创建新函数 */ }} />
```

### ⚠️ 常见问题

1. **问题**: 组件不响应点击事件
   **解决**: 检查是否被父元素的 `pointer-events: none` 影响

2. **问题**: 样式不生效
   **解决**: 确保 Tailwind CSS 配置正确，检查类名优先级

### ⚠️ 已知限制

- 不支持 SSR 环境下的某些功能
- 移动端触摸事件可能有延迟

## 更新日志

### v1.1.0 (2025-01-01)

- 新增 `onAction` 回调属性
- 优化移动端触摸体验

### v1.0.0 (2024-12-01)

- 初始版本发布

## 相关组件

- [RelatedComponent1](./RelatedComponent1.md) - 相关组件说明
- [RelatedComponent2](./RelatedComponent2.md) - 另一个相关组件

## 参考资料

- [设计规范](../design-system.md)
- [Radix UI 文档](https://www.radix-ui.com/)
