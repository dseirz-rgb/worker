/**
 * 模块导航服务 (ModuleNavigator)
 * 
 * 管理 Echo 和 RiskControl 模块之间的导航状态
 * - 记录最后访问的模块
 * - 记录每个模块的最后访问路径
 * - 支持模块切换动画状态
 * 
 * @module @echoai/shared/navigation
 */

// ============================================
// 类型定义
// ============================================

export type ModuleType = 'echo' | 'riskcontrol';

export interface NavigationState {
  currentModule: ModuleType;
  lastVisitedModule: ModuleType;
  lastVisitedPath: Record<ModuleType, string>;
  isTransitioning: boolean;
}

export interface ModuleConfig {
  id: ModuleType;
  name: string;
  icon: string;
  defaultPath: string;
  routes: string[];
}

// ============================================
// 模块配置
// ============================================

export const MODULE_CONFIGS: Record<ModuleType, ModuleConfig> = {
  echo: {
    id: 'echo',
    name: 'Echo',
    icon: '📝',
    defaultPath: '/notes',
    routes: ['/notes', '/tasks', '/calendar', '/ai-chat', '/settings'],
  },
  riskcontrol: {
    id: 'riskcontrol',
    name: 'RiskControl',
    icon: '📊',
    defaultPath: '/dashboard',
    routes: ['/dashboard', '/positions', '/transactions', '/risk', '/watchlist', '/documents'],
  },
};

// ============================================
// 存储键
// ============================================

const STORAGE_KEY = 'echoai_navigation_state';

// ============================================
// 模块导航服务
// ============================================

export class ModuleNavigator {
  private state: NavigationState;
  private listeners: Set<(state: NavigationState) => void> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  /**
   * 获取当前导航状态
   */
  getState(): NavigationState {
    return { ...this.state };
  }

  /**
   * 获取当前模块
   */
  getCurrentModule(): ModuleType {
    return this.state.currentModule;
  }

  /**
   * 获取模块配置
   */
  getModuleConfig(module: ModuleType): ModuleConfig {
    return MODULE_CONFIGS[module];
  }

  /**
   * 切换模块
   * 
   * @param module 目标模块
   * @param path 可选的目标路径，默认使用上次访问路径或默认路径
   * @returns 目标路径
   */
  switchModule(module: ModuleType, path?: string): string {
    const previousModule = this.state.currentModule;
    
    // 保存当前模块的路径（如果在浏览器环境）
    if (typeof window !== 'undefined') {
      this.state.lastVisitedPath[previousModule] = window.location.pathname;
    }

    // 设置过渡状态
    this.state.isTransitioning = true;
    this.notifyListeners();

    // 更新状态
    this.state.currentModule = module;
    this.state.lastVisitedModule = module;

    // 确定目标路径
    const targetPath = path || 
      this.state.lastVisitedPath[module] || 
      MODULE_CONFIGS[module].defaultPath;

    // 保存状态
    this.saveState();

    // 延迟清除过渡状态
    setTimeout(() => {
      this.state.isTransitioning = false;
      this.notifyListeners();
    }, 300);

    return targetPath;
  }

  /**
   * 更新当前路径
   * 
   * @param path 当前路径
   */
  updateCurrentPath(path: string): void {
    this.state.lastVisitedPath[this.state.currentModule] = path;
    this.saveState();
  }

  /**
   * 根据路径判断所属模块
   * 
   * @param path URL 路径
   * @returns 模块类型，如果无法判断返回 null
   */
  getModuleForPath(path: string): ModuleType | null {
    for (const [moduleId, config] of Object.entries(MODULE_CONFIGS)) {
      if (config.routes.some(route => path.startsWith(route))) {
        return moduleId as ModuleType;
      }
    }
    return null;
  }

  /**
   * 获取模块的最后访问路径
   */
  getLastVisitedPath(module: ModuleType): string {
    return this.state.lastVisitedPath[module] || MODULE_CONFIGS[module].defaultPath;
  }

  /**
   * 订阅状态变化
   */
  subscribe(listener: (state: NavigationState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 重置导航状态
   */
  reset(): void {
    this.state = this.getDefaultState();
    this.saveState();
    this.notifyListeners();
  }

  // ============================================
  // 私有方法
  // ============================================

  private getDefaultState(): NavigationState {
    return {
      currentModule: 'echo',
      lastVisitedModule: 'echo',
      lastVisitedPath: {
        echo: MODULE_CONFIGS.echo.defaultPath,
        riskcontrol: MODULE_CONFIGS.riskcontrol.defaultPath,
      },
      isTransitioning: false,
    };
  }

  private loadState(): NavigationState {
    if (typeof window === 'undefined') {
      return this.getDefaultState();
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...this.getDefaultState(),
          ...parsed,
          isTransitioning: false, // 始终重置过渡状态
        };
      }
    } catch (error) {
      console.warn('Failed to load navigation state:', error);
    }

    return this.getDefaultState();
  }

  private saveState(): void {
    if (typeof window === 'undefined') return;

    try {
      const { isTransitioning, ...stateToSave } = this.state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('Failed to save navigation state:', error);
    }
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }
}

// ============================================
// React Hook (可选)
// ============================================

/**
 * 创建 React hook 的工厂函数
 * 需要在 React 环境中使用
 */
export function createNavigationHook(navigator: ModuleNavigator) {
  // 这个函数返回一个可以在 React 组件中使用的 hook
  // 实际实现需要 React 依赖，这里只提供接口
  return {
    useNavigation: () => ({
      state: navigator.getState(),
      switchModule: navigator.switchModule.bind(navigator),
      updateCurrentPath: navigator.updateCurrentPath.bind(navigator),
    }),
  };
}

// ============================================
// 单例导出
// ============================================

let navigatorInstance: ModuleNavigator | null = null;

export function initNavigator(): ModuleNavigator {
  if (!navigatorInstance) {
    navigatorInstance = new ModuleNavigator();
  }
  return navigatorInstance;
}

export function getNavigator(): ModuleNavigator | null {
  return navigatorInstance;
}

export default ModuleNavigator;
