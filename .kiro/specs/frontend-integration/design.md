# Design Document: Frontend Integration

## Overview

本设计文档描述如何将 Echo 和 RiskControl 两个独立运行的前端深度整合为统一的用户界面。核心原则是：**统一技术栈 + 组件迁移**。

### 设计目标

1. **统一应用**：用户看到的是一个完整的应用，不是两个拼接的系统
2. **统一技术栈**：使用 Echo 的 React 18 + MobX + HeroUI 作为基础
3. **组件迁移**：将 RiskControl 的页面和组件迁移到 Echo 中
4. **渐进式迁移**：分阶段迁移，每阶段可独立验证

### 整合方式选择

| 方式 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| iframe 整合 | 完全隔离、无版本冲突 | 体验割裂、通信复杂 | 临时方案 |
| **组件迁移** | 原生体验、统一风格、共享状态 | 需要适配代码 | **深度整合** |
| 微前端 | 技术栈无关、独立部署 | 复杂度高、性能开销 | 大型团队 |

**选择：组件迁移方案**

理由：
- 用户要求深度整合，看上去是一个应用
- Echo 的 HeroUI 设计系统更成熟
- 可以复用 Echo 的布局、导航、主题系统
- RiskControl 的核心是业务逻辑，UI 可以适配

### 迁移策略

**分 3 个阶段，渐进式迁移**：

```
阶段 1: 框架搭建
  └─ Echo 侧边栏添加"投资"入口
  └─ 创建投资模块路由结构
  └─ 临时使用 iframe 加载 RiskControl（过渡）

阶段 2: 组件迁移
  └─ 迁移 Dashboard 页面
  └─ 迁移持仓管理页面
  └─ 迁移风险监控页面
  └─ 迁移交易记录页面
  └─ 迁移价格警报页面
  └─ 适配 HeroUI 组件库

阶段 3: 清理收尾
  └─ 移除 iframe 过渡方案
  └─ 统一状态管理（Zustand → MobX）
  └─ 删除 RiskControl 独立前端
```

**需要迁移的内容**：
| RiskControl 页面 | Echo 路由 | 优先级 |
|-----------------|----------|--------|
| Dashboard | `/investment` | P0 |
| 持仓管理 | `/investment/positions` | P0 |
| 风险监控 | `/investment/risk` | P1 |
| 交易记录 | `/investment/transactions` | P1 |
| 价格警报 | `/investment/alerts` | P1 |
| 语音助手 | `/investment/voice` | P2 |

**不需要迁移的内容**：
- 后端 API（保持 Vercel Functions）
- 数据库（保持 RiskControl Supabase）
- 业务逻辑（packages/shared 已实现）

### 技术栈适配

| RiskControl 原技术 | Echo 目标技术 | 适配方式 |
|-------------------|--------------|----------|
| React 19 | React 18 | 降级，移除 React 19 特性 |
| Zustand | MobX | 重写状态管理 |
| Radix UI | HeroUI | 替换组件 |
| TanStack Query | tRPC | 使用 Echo 的数据获取方式 |
| Tailwind 4 | Tailwind 3 | 调整配置 |

## Architecture

### 整体架构图

```mermaid
graph TB
    subgraph "Echo 统一应用"
        Header[统一 Header]
        Sidebar[扩展 Sidebar<br/>笔记 | 投资]
        
        subgraph "Echo 模块 (原有)"
            NotesPage[笔记页面]
            TasksPage[任务页面]
            CalendarPage[日历页面]
        end
        
        subgraph "投资模块 (迁移)"
            DashboardPage[投资 Dashboard]
            PositionsPage[持仓管理]
            RiskPage[风险监控]
            AlertsPage[价格警报]
        end
    end
    
    subgraph "共享服务层 (packages/shared)"
        AuthService[统一认证]
        DatabaseService[双数据库]
        RiskService[风控服务]
        WebSocketService[实时通信]
    end
    
    subgraph "后端"
        EchoAPI[Echo API<br/>Express + tRPC]
        RCAPI[RiskControl API<br/>Vercel Functions]
    end
    
    Header --> Sidebar
    Sidebar --> NotesPage
    Sidebar --> DashboardPage
    
    NotesPage --> AuthService
    DashboardPage --> AuthService
    DashboardPage --> RiskService
    DashboardPage --> WebSocketService
    
    AuthService --> EchoAPI
    AuthService --> RCAPI
    RiskService --> RCAPI
```

### 路由结构

```
/                       → Echo 首页
/notes                  → 笔记列表
/notes/:id              → 笔记详情
/tasks                  → 任务列表
/calendar               → 日历视图
/investment             → 投资 Dashboard (新增)
/investment/positions   → 持仓管理 (新增)
/investment/risk        → 风险监控 (新增)
/investment/transactions→ 交易记录 (新增)
/investment/alerts      → 价格警报 (新增)
/settings               → 设置页面
```

### 侧边栏结构

```
┌─────────────────────┐
│  Echo               │
├─────────────────────┤
│  📝 笔记            │
│  ✅ 任务            │
│  📅 日历            │
├─────────────────────┤
│  💰 投资            │  ← 新增模块
│    ├─ Dashboard     │
│    ├─ 持仓          │
│    ├─ 风险          │
│    └─ 警报 (3)      │  ← 警报数量徽章
├─────────────────────┤
│  ⚙️ 设置            │
└─────────────────────┘
```

## Components and Interfaces

### 1. 投资模块入口 (InvestmentSidebarItem)

```typescript
// 在 Echo 侧边栏添加的新菜单项
interface InvestmentSidebarItemProps {
  isExpanded: boolean;
  alertCount: number;  // 风险警报数量
  onNavigate: (path: string) => void;
}

// 子菜单项
const INVESTMENT_MENU_ITEMS = [
  { path: '/investment', label: 'Dashboard', icon: 'LayoutDashboard' },
  { path: '/investment/positions', label: '持仓', icon: 'Briefcase' },
  { path: '/investment/risk', label: '风险', icon: 'AlertTriangle' },
  { path: '/investment/transactions', label: '交易', icon: 'ArrowLeftRight' },
  { path: '/investment/alerts', label: '警报', icon: 'Bell' },
];
```

### 2. 投资 Dashboard 页面 (InvestmentDashboard)

```typescript
// 迁移自 RiskControl，适配 HeroUI
interface InvestmentDashboardProps {
  // 使用 packages/shared 的服务
}

// 页面组件结构
const InvestmentDashboard = () => {
  // 使用 MobX store 替代 Zustand
  const { positions, riskMetrics, alerts } = useInvestmentStore();
  
  return (
    <div className="grid grid-cols-12 gap-4">
      <PortfolioSummaryCard />      {/* 资产概览 */}
      <RiskMetricsCard />           {/* 风险指标 */}
      <RecentAlertsCard />          {/* 最近警报 */}
      <PositionListCard />          {/* 持仓列表 */}
      <MarketOverviewCard />        {/* 市场概览 */}
    </div>
  );
};
```

### 3. 投资模块 MobX Store (InvestmentStore)

```typescript
// 替代 RiskControl 的 Zustand store
class InvestmentStore {
  // 持仓数据
  positions: Position[] = [];
  
  // 风险指标
  riskMetrics: RiskMetrics | null = null;
  
  // 价格警报
  alerts: PriceAlert[] = [];
  
  // 加载状态
  loading = {
    positions: false,
    riskMetrics: false,
    alerts: false,
  };
  
  // 使用 packages/shared 的服务
  constructor(
    private databaseClient: DualDatabaseClient,
    private circuitBreaker: CircuitBreakerService,
    private priceAlertService: PriceAlertService,
  ) {
    makeAutoObservable(this);
  }
  
  // 获取持仓
  async fetchPositions() {
    this.loading.positions = true;
    const client = this.databaseClient.riskcontrol;
    const { data } = await client.from('positions').select('*');
    runInAction(() => {
      this.positions = data || [];
      this.loading.positions = false;
    });
  }
  
  // 获取风险指标
  async fetchRiskMetrics() {
    // 使用 packages/shared/riskcontrol 的服务
  }
  
  // 获取警报数量（用于侧边栏徽章）
  get activeAlertCount(): number {
    return this.alerts.filter(a => a.enabled && !a.triggered).length;
  }
}
```

### 4. HeroUI 适配组件

```typescript
// 将 Radix UI 组件映射到 HeroUI
// 这些是需要适配的核心组件

// 数据表格 - 持仓列表、交易记录
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@heroui/table';

// 卡片 - Dashboard 各模块
import { Card, CardHeader, CardBody, CardFooter } from '@heroui/card';

// 图表 - 使用 Echo 已有的图表组件或 recharts
import { LineChart, BarChart, PieChart } from 'recharts';

// 表单 - 价格警报设置
import { Input, Select, Switch, Button } from '@heroui/react';

// 对话框 - 确认操作
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/modal';
```

### 5. 数据获取 Hook

```typescript
// 使用 Echo 的数据获取模式（tRPC 或直接调用）
// 替代 RiskControl 的 TanStack Query

// 获取持仓
function usePositions() {
  const store = useInvestmentStore();
  
  useEffect(() => {
    store.fetchPositions();
  }, []);
  
  return {
    positions: store.positions,
    loading: store.loading.positions,
    refetch: () => store.fetchPositions(),
  };
}

// 获取风险指标
function useRiskMetrics() {
  const store = useInvestmentStore();
  
  useEffect(() => {
    store.fetchRiskMetrics();
  }, []);
  
  return {
    metrics: store.riskMetrics,
    loading: store.loading.riskMetrics,
  };
}

// 实时价格订阅
function usePriceSubscription(tickers: string[]) {
  const websocket = useWebSocketGateway();
  
  useEffect(() => {
    websocket.subscribe(tickers);
    return () => websocket.unsubscribe(tickers);
  }, [tickers]);
  
  return websocket.prices;
}
```

## Data Models

### 投资模块数据类型

```typescript
// 复用 packages/shared/riskcontrol/types.ts 的类型
import type { 
  Position, 
  Transaction, 
  RiskMetrics, 
  PriceAlert,
  CircuitBreakerState,
  EmotionDetectionResult,
} from '@/packages/shared/riskcontrol/types';

// 投资模块页面状态
interface InvestmentPageState {
  currentPath: string;
  selectedTicker: string | null;
  dateRange: {
    start: Date;
    end: Date;
  };
  filters: {
    assetType: 'all' | 'stock' | 'option' | 'crypto';
    riskLevel: 'all' | 'low' | 'medium' | 'high';
  };
}

// Dashboard 汇总数据
interface DashboardSummary {
  totalValue: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  totalPnL: number;
  totalPnLPercent: number;
  positionCount: number;
  alertCount: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}
```

### 侧边栏警报徽章数据

```typescript
// 用于侧边栏显示的警报摘要
interface AlertBadgeData {
  count: number;           // 活跃警报数量
  hasHighPriority: boolean; // 是否有高优先级警报
  lastUpdated: Date;
}

// 从 InvestmentStore 计算
const getAlertBadgeData = (store: InvestmentStore): AlertBadgeData => ({
  count: store.activeAlertCount,
  hasHighPriority: store.alerts.some(a => a.priority === 'high' && !a.triggered),
  lastUpdated: new Date(),
});
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 路由导航正确性

*For any* click on investment sidebar menu item, the application SHALL navigate to the corresponding route and render the correct page component.

**Validates: Requirements 2.2, 3.2**

### Property 2: 侧边栏警报徽章准确性

*For any* set of price alerts, the sidebar badge SHALL display the count of active (enabled and not triggered) alerts.

**Validates: Requirements 3.4**

### Property 3: 数据获取一致性

*For any* investment page load, the data displayed SHALL match the data returned from the RiskControl database via packages/shared services.

**Validates: Requirements 1.4**

### Property 4: MobX Store 状态同步

*For any* data mutation (fetch, update, delete), the MobX store state SHALL reflect the change and trigger UI re-render.

**Validates: Requirements 2.3**

### Property 5: HeroUI 组件渲染

*For any* migrated page, all UI components SHALL render using HeroUI components without Radix UI dependencies.

**Validates: Requirements 4.1, 4.2**

### Property 6: 响应式布局

*For any* screen width >= 768px, the investment pages SHALL render correctly with appropriate layout adjustments.

**Validates: Requirements 6.1, 6.4**

### Property 7: 错误边界隔离

*For any* error in investment module components, the error SHALL be caught by error boundary and not crash the entire Echo application.

**Validates: Requirements 8.1, 8.2**

## Error Handling

### 数据获取错误

```typescript
class InvestmentDataError extends Error {
  constructor(
    public source: 'positions' | 'risk' | 'alerts' | 'transactions',
    public code: 'NETWORK' | 'AUTH' | 'NOT_FOUND' | 'SERVER',
    message: string
  ) {
    super(message);
  }
}

// 处理策略：显示错误 UI，不影响其他模块
async function handleDataError(error: InvestmentDataError): Promise<void> {
  // 记录错误
  console.error(`Investment data error [${error.source}]:`, error);
  
  // 显示 toast 通知
  toast.error(`加载${error.source}数据失败，请稍后重试`);
  
  // 如果是认证错误，触发重新登录
  if (error.code === 'AUTH') {
    await authService.refreshSession();
  }
}
```

### 组件错误边界

```typescript
// 投资模块专用错误边界
class InvestmentErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 记录错误但不影响 Echo 其他模块
    console.error('Investment module error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <Card className="m-4">
          <CardBody className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">投资模块加载失败</h3>
            <p className="text-gray-500 mb-4">{this.state.error?.message}</p>
            <Button 
              color="primary"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              重试
            </Button>
          </CardBody>
        </Card>
      );
    }
    return this.props.children;
  }
}
```

### WebSocket 断连处理

```typescript
// 复用 packages/shared/websocket 的重连逻辑
// 在 UI 层显示连接状态
function useWebSocketStatus() {
  const ws = useWebSocketGateway();
  
  return {
    isConnected: ws.isConnected,
    isReconnecting: ws.isReconnecting,
    reconnectAttempt: ws.reconnectAttempt,
  };
}

// 在 Dashboard 显示连接状态指示器
const ConnectionIndicator = () => {
  const { isConnected, isReconnecting } = useWebSocketStatus();
  
  if (isConnected) return <Badge color="success">实时</Badge>;
  if (isReconnecting) return <Badge color="warning">重连中...</Badge>;
  return <Badge color="danger">离线</Badge>;
};
```

## Testing Strategy

### 单元测试

使用 Vitest + React Testing Library：

```typescript
// 侧边栏菜单测试
describe('InvestmentSidebarItem', () => {
  it('should render investment menu with correct items', () => {
    render(<InvestmentSidebarItem isExpanded={true} alertCount={0} />);
    
    expect(screen.getByText('投资')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('持仓')).toBeInTheDocument();
  });
  
  it('should show badge when alertCount > 0', () => {
    render(<InvestmentSidebarItem isExpanded={true} alertCount={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });
  
  it('should navigate to correct route on click', async () => {
    const onNavigate = vi.fn();
    render(<InvestmentSidebarItem onNavigate={onNavigate} />);
    
    await userEvent.click(screen.getByText('持仓'));
    expect(onNavigate).toHaveBeenCalledWith('/investment/positions');
  });
});

// MobX Store 测试
describe('InvestmentStore', () => {
  it('should fetch positions from RiskControl database', async () => {
    const store = new InvestmentStore(mockDatabaseClient);
    await store.fetchPositions();
    
    expect(store.positions.length).toBeGreaterThan(0);
    expect(store.loading.positions).toBe(false);
  });
  
  it('should calculate active alert count correctly', () => {
    const store = new InvestmentStore(mockDatabaseClient);
    store.alerts = [
      { id: '1', enabled: true, triggered: false },
      { id: '2', enabled: true, triggered: true },
      { id: '3', enabled: false, triggered: false },
    ];
    
    expect(store.activeAlertCount).toBe(1);
  });
});
```

### 属性测试 (Property-Based Testing)

使用 fast-check，每个属性测试至少 100 次迭代：

```typescript
import * as fc from 'fast-check';

// Property 2: 侧边栏警报徽章准确性
describe('Property Tests: Alert Badge Accuracy', () => {
  /**
   * **Feature: frontend-integration, Property 2: 侧边栏警报徽章准确性**
   * **Validates: Requirements 3.4**
   */
  it('badge should show count of active alerts', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            enabled: fc.boolean(),
            triggered: fc.boolean(),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (alerts) => {
          const store = new InvestmentStore(mockDatabaseClient);
          store.alerts = alerts as PriceAlert[];
          
          const expectedCount = alerts.filter(a => a.enabled && !a.triggered).length;
          expect(store.activeAlertCount).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 4: MobX Store 状态同步
describe('Property Tests: MobX State Sync', () => {
  /**
   * **Feature: frontend-integration, Property 4: MobX Store 状态同步**
   * **Validates: Requirements 2.3**
   */
  it('store state should reflect data mutations', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            ticker: fc.string({ minLength: 1, maxLength: 10 }),
            quantity: fc.float({ min: 0, max: 10000 }),
            marketValue: fc.float({ min: 0, max: 1000000 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (positions) => {
          const store = new InvestmentStore(mockDatabaseClient);
          
          // 模拟数据获取
          runInAction(() => {
            store.positions = positions as Position[];
          });
          
          // 验证状态同步
          expect(store.positions).toEqual(positions);
          expect(store.positions.length).toBe(positions.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 7: 错误边界隔离
describe('Property Tests: Error Boundary Isolation', () => {
  /**
   * **Feature: frontend-integration, Property 7: 错误边界隔离**
   * **Validates: Requirements 8.1, 8.2**
   */
  it('investment error should not crash Echo app', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (errorMessage) => {
          const ThrowingComponent = () => {
            throw new Error(errorMessage);
          };
          
          // 投资模块错误应被边界捕获
          const { container } = render(
            <InvestmentErrorBoundary>
              <ThrowingComponent />
            </InvestmentErrorBoundary>
          );
          
          // 应显示错误 UI 而不是崩溃
          expect(screen.getByText('投资模块加载失败')).toBeInTheDocument();
          expect(screen.getByText('重试')).toBeInTheDocument();
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 集成测试

```typescript
// 页面导航测试
describe('Investment Module Navigation', () => {
  it('should navigate between investment pages', async () => {
    render(<App />);
    
    // 点击投资菜单
    await userEvent.click(screen.getByText('投资'));
    expect(window.location.pathname).toBe('/investment');
    
    // 点击持仓
    await userEvent.click(screen.getByText('持仓'));
    expect(window.location.pathname).toBe('/investment/positions');
    
    // 验证页面渲染
    expect(screen.getByTestId('positions-table')).toBeInTheDocument();
  });
});

// 数据加载测试
describe('Investment Data Loading', () => {
  it('should load and display positions', async () => {
    render(<PositionsPage />);
    
    // 等待数据加载
    await waitFor(() => {
      expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
    });
    
    // 验证数据显示
    expect(screen.getByTestId('positions-table')).toBeInTheDocument();
  });
});
```

### 测试配置

```typescript
// 在 Echo 的 vitest.config.ts 中添加投资模块测试
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/investment/**/*.test.ts',  // 新增
      'src/investment/**/*.test.tsx', // 新增
    ],
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 30000,
  },
});
```
