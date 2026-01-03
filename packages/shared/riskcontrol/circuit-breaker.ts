/**
 * 熔断机制服务 (CircuitBreakerService)
 * 
 * 验证和保护 RiskControl 的熔断机制
 * - 杠杆率熔断：leverage > 1.5x
 * - 回撤熔断：monthly drawdown > 10%
 * - 连续亏损熔断：consecutive losses > 5
 * 
 * **Validates: Requirements 28.1, 28.2, 28.3, 28.4**
 * 
 * @module @echoai/shared/riskcontrol/circuit-breaker
 */

// ============================================
// 类型定义
// ============================================

export type CircuitBreakerType = 
  | 'leverage'           // 杠杆率熔断
  | 'drawdown'           // 回撤熔断
  | 'consecutive_loss'   // 连续亏损熔断
  | 'daily_loss'         // 单日亏损熔断
  | 'position_size'      // 单一持仓过大
  | 'volatility';        // 波动率过高

export type CircuitBreakerStatus = 'open' | 'closed' | 'half_open';

export interface CircuitBreakerConfig {
  type: CircuitBreakerType;
  threshold: number;
  cooldownHours: number;
  enabled: boolean;
}

export interface CircuitBreakerState {
  type: CircuitBreakerType;
  status: CircuitBreakerStatus;
  triggeredAt: Date | null;
  cooldownEndsAt: Date | null;
  currentValue: number;
  threshold: number;
  triggerCount: number;
}

export interface RiskMetrics {
  leverage: number;
  monthlyDrawdown: number;
  dailyDrawdown: number;
  consecutiveLosses: number;
  maxPositionWeight: number;
  portfolioVolatility: number;
}

export interface TradingDecision {
  allowed: boolean;
  blockedBy: CircuitBreakerType[];
  warnings: string[];
}

// ============================================
// 默认配置
// ============================================

/**
 * 默认熔断配置
 * **重要**: 这些阈值必须与原 RiskControl 实现保持一致
 * **Validates: Requirements 28.1, 28.2**
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIGS: CircuitBreakerConfig[] = [
  {
    type: 'leverage',
    threshold: 1.5,        // 杠杆率 > 1.5x 触发
    cooldownHours: 24,     // 24 小时冷却期
    enabled: true,
  },
  {
    type: 'drawdown',
    threshold: 0.10,       // 月度回撤 > 10% 触发
    cooldownHours: 72,     // 72 小时冷却期
    enabled: true,
  },
  {
    type: 'consecutive_loss',
    threshold: 5,          // 连续亏损 > 5 次触发
    cooldownHours: 48,     // 48 小时冷却期
    enabled: true,
  },
  {
    type: 'daily_loss',
    threshold: 0.05,       // 单日亏损 > 5% 触发
    cooldownHours: 24,     // 24 小时冷却期
    enabled: true,
  },
  {
    type: 'position_size',
    threshold: 0.25,       // 单一持仓 > 25% 触发
    cooldownHours: 12,     // 12 小时冷却期
    enabled: true,
  },
  {
    type: 'volatility',
    threshold: 0.30,       // 组合波动率 > 30% 触发
    cooldownHours: 24,     // 24 小时冷却期
    enabled: false,        // 默认禁用
  },
];

// ============================================
// 熔断机制服务
// ============================================

export class CircuitBreakerService {
  private configs: Map<CircuitBreakerType, CircuitBreakerConfig>;
  private states: Map<CircuitBreakerType, CircuitBreakerState>;

  constructor(configs: CircuitBreakerConfig[] = DEFAULT_CIRCUIT_BREAKER_CONFIGS) {
    this.configs = new Map();
    this.states = new Map();

    // 初始化配置和状态
    for (const config of configs) {
      this.configs.set(config.type, config);
      this.states.set(config.type, {
        type: config.type,
        status: 'closed',
        triggeredAt: null,
        cooldownEndsAt: null,
        currentValue: 0,
        threshold: config.threshold,
        triggerCount: 0,
      });
    }
  }

  /**
   * 检查风险指标并更新熔断状态
   * 
   * **Property 6: 熔断机制触发正确性**
   * **Validates: Requirements 28.3, 28.4**
   */
  checkRiskMetrics(metrics: RiskMetrics): TradingDecision {
    const blockedBy: CircuitBreakerType[] = [];
    const warnings: string[] = [];

    // 检查杠杆率
    this.checkAndUpdateBreaker('leverage', metrics.leverage, blockedBy, warnings);

    // 检查月度回撤
    this.checkAndUpdateBreaker('drawdown', metrics.monthlyDrawdown, blockedBy, warnings);

    // 检查连续亏损
    this.checkAndUpdateBreaker('consecutive_loss', metrics.consecutiveLosses, blockedBy, warnings);

    // 检查单日亏损
    this.checkAndUpdateBreaker('daily_loss', metrics.dailyDrawdown, blockedBy, warnings);

    // 检查单一持仓权重
    this.checkAndUpdateBreaker('position_size', metrics.maxPositionWeight, blockedBy, warnings);

    // 检查波动率
    this.checkAndUpdateBreaker('volatility', metrics.portfolioVolatility, blockedBy, warnings);

    return {
      allowed: blockedBy.length === 0,
      blockedBy,
      warnings,
    };
  }

  /**
   * 获取熔断器状态
   */
  getBreakerState(type: CircuitBreakerType): CircuitBreakerState | undefined {
    return this.states.get(type);
  }

  /**
   * 获取所有熔断器状态
   */
  getAllBreakerStates(): CircuitBreakerState[] {
    return Array.from(this.states.values());
  }

  /**
   * 获取所有触发的熔断器
   */
  getTriggeredBreakers(): CircuitBreakerState[] {
    return this.getAllBreakerStates().filter(state => state.status === 'open');
  }

  /**
   * 手动重置熔断器（需要管理员权限）
   */
  resetBreaker(type: CircuitBreakerType): boolean {
    const state = this.states.get(type);
    if (!state) return false;

    state.status = 'closed';
    state.triggeredAt = null;
    state.cooldownEndsAt = null;
    return true;
  }

  /**
   * 更新熔断器配置
   */
  updateConfig(type: CircuitBreakerType, updates: Partial<CircuitBreakerConfig>): boolean {
    const config = this.configs.get(type);
    if (!config) return false;

    Object.assign(config, updates);
    
    // 同步更新状态中的阈值
    const state = this.states.get(type);
    if (state && updates.threshold !== undefined) {
      state.threshold = updates.threshold;
    }

    return true;
  }

  /**
   * 检查冷却期是否结束
   */
  checkCooldowns(): void {
    const now = new Date();

    for (const state of this.states.values()) {
      if (state.status === 'open' && state.cooldownEndsAt) {
        if (now >= state.cooldownEndsAt) {
          state.status = 'half_open';
        }
      }
    }
  }

  /**
   * 验证配置完整性
   * 确保所有必需的熔断类型都已配置
   */
  validateConfigIntegrity(): { valid: boolean; missing: CircuitBreakerType[] } {
    const requiredTypes: CircuitBreakerType[] = [
      'leverage',
      'drawdown',
      'consecutive_loss',
      'daily_loss',
      'position_size',
    ];

    const missing = requiredTypes.filter(type => !this.configs.has(type));

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  // ============================================
  // 私有方法
  // ============================================

  private checkAndUpdateBreaker(
    type: CircuitBreakerType,
    currentValue: number,
    blockedBy: CircuitBreakerType[],
    warnings: string[]
  ): void {
    const config = this.configs.get(type);
    const state = this.states.get(type);

    if (!config || !state || !config.enabled) return;

    // 更新当前值
    state.currentValue = currentValue;

    // 检查冷却期
    if (state.status === 'open') {
      if (state.cooldownEndsAt && new Date() < state.cooldownEndsAt) {
        blockedBy.push(type);
        return;
      } else {
        state.status = 'half_open';
      }
    }

    // 检查是否触发
    const triggered = this.isThresholdExceeded(type, currentValue, config.threshold);

    if (triggered) {
      if (state.status !== 'open') {
        // 触发熔断
        state.status = 'open';
        state.triggeredAt = new Date();
        state.cooldownEndsAt = new Date(Date.now() + config.cooldownHours * 60 * 60 * 1000);
        state.triggerCount++;
      }
      blockedBy.push(type);
    } else if (state.status === 'half_open') {
      // 半开状态下指标正常，关闭熔断器
      state.status = 'closed';
      state.triggeredAt = null;
      state.cooldownEndsAt = null;
    }

    // 添加警告（接近阈值）
    const warningThreshold = config.threshold * 0.8;
    if (currentValue >= warningThreshold && !triggered) {
      warnings.push(`${type} 接近阈值: ${currentValue.toFixed(2)} / ${config.threshold}`);
    }
  }

  private isThresholdExceeded(
    type: CircuitBreakerType,
    value: number,
    threshold: number
  ): boolean {
    // 所有类型都是值超过阈值时触发
    return value > threshold;
  }
}

// ============================================
// 单例导出
// ============================================

let circuitBreakerInstance: CircuitBreakerService | null = null;

export function initCircuitBreaker(
  configs?: CircuitBreakerConfig[]
): CircuitBreakerService {
  circuitBreakerInstance = new CircuitBreakerService(configs);
  return circuitBreakerInstance;
}

export function getCircuitBreaker(): CircuitBreakerService | null {
  return circuitBreakerInstance;
}

export default CircuitBreakerService;
