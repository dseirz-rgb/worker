/**
 * Tauri App 整合配置
 * 
 * 提供 Echo + RiskControl 双模块的 Tauri 配置
 * - 模块路由配置
 * - 权限管理
 * - 窗口配置
 * 
 * **Validates: Requirements 42.1, 42.3**
 * 
 * @module @echoai/shared/tauri
 */

// ============================================
// 类型定义
// ============================================

export type ModuleId = 'echo' | 'riskcontrol';

export interface ModuleConfig {
  id: ModuleId;
  name: string;
  description: string;
  icon: string;
  routes: RouteConfig[];
  permissions: Permission[];
  defaultRoute: string;
}

export interface RouteConfig {
  path: string;
  label: string;
  icon?: string;
  requiresAuth?: boolean;
}

export interface Permission {
  name: string;
  description: string;
  dangerous?: boolean;
}

export interface TauriWindowConfig {
  label: string;
  title: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  resizable?: boolean;
  fullscreen?: boolean;
  focus?: boolean;
  center?: boolean;
  visible?: boolean;
  alwaysOnTop?: boolean;
  skipTaskbar?: boolean;
  decorations?: boolean;
  transparent?: boolean;
  url?: string;
}

// ============================================
// 模块配置
// ============================================

/**
 * Echo 模块配置
 */
export const ECHO_MODULE_CONFIG: ModuleConfig = {
  id: 'echo',
  name: 'Echo',
  description: '个人知识管理系统',
  icon: '📝',
  defaultRoute: '/',
  routes: [
    { path: '/', label: '首页', icon: '🏠' },
    { path: '/notes', label: '笔记', icon: '📝' },
    { path: '/tasks', label: '任务', icon: '✅' },
    { path: '/calendar', label: '日历', icon: '📅' },
    { path: '/settings', label: '设置', icon: '⚙️', requiresAuth: true },
  ],
  permissions: [
    { name: 'fs:read', description: '读取文件系统' },
    { name: 'fs:write', description: '写入文件系统' },
    { name: 'notification', description: '发送通知' },
    { name: 'clipboard', description: '访问剪贴板' },
    { name: 'global-shortcut', description: '全局快捷键' },
  ],
};

/**
 * RiskControl 模块配置
 * **Validates: Requirements 42.1**
 */
export const RISKCONTROL_MODULE_CONFIG: ModuleConfig = {
  id: 'riskcontrol',
  name: 'RiskControl',
  description: '投资风控系统',
  icon: '📊',
  defaultRoute: '/rc',
  routes: [
    { path: '/rc', label: '仪表盘', icon: '📊' },
    { path: '/rc/portfolio', label: '持仓', icon: '💼', requiresAuth: true },
    { path: '/rc/risk', label: '风险中心', icon: '⚠️', requiresAuth: true },
    { path: '/rc/market', label: '市场分析', icon: '📈' },
    { path: '/rc/decision', label: '决策中心', icon: '🎯', requiresAuth: true },
    { path: '/rc/voice', label: '语音助手', icon: '🎤', requiresAuth: true },
    { path: '/rc/settings', label: '设置', icon: '⚙️', requiresAuth: true },
  ],
  permissions: [
    { name: 'fs:read', description: '读取文件系统' },
    { name: 'notification', description: '发送通知' },
    { name: 'http:request', description: '网络请求', dangerous: true },
    { name: 'microphone', description: '麦克风访问', dangerous: true },
  ],
};

/**
 * 所有模块配置
 */
export const MODULE_CONFIGS: Record<ModuleId, ModuleConfig> = {
  echo: ECHO_MODULE_CONFIG,
  riskcontrol: RISKCONTROL_MODULE_CONFIG,
};

// ============================================
// 窗口配置
// ============================================

/**
 * 主窗口配置
 */
export const MAIN_WINDOW_CONFIG: TauriWindowConfig = {
  label: 'main',
  title: 'Echo',
  width: 1920,
  height: 1080,
  minWidth: 600,
  minHeight: 300,
  resizable: true,
  fullscreen: false,
  focus: true,
  visible: false,
  decorations: true,
};

/**
 * RiskControl 专用窗口配置
 * **Validates: Requirements 42.3**
 */
export const RISKCONTROL_WINDOW_CONFIGS: TauriWindowConfig[] = [
  {
    label: 'riskcontrol-main',
    title: 'RiskControl Dashboard',
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    resizable: true,
    fullscreen: false,
    focus: true,
    visible: false,
    decorations: true,
    url: '/rc',
  },
  {
    label: 'riskcontrol-voice',
    title: 'Investment Advisor',
    width: 400,
    height: 600,
    minWidth: 350,
    minHeight: 500,
    resizable: true,
    fullscreen: false,
    focus: true,
    center: true,
    visible: false,
    alwaysOnTop: true,
    decorations: true,
    url: '/rc/voice',
  },
  {
    label: 'riskcontrol-alert',
    title: 'Risk Alert',
    width: 400,
    height: 200,
    resizable: false,
    fullscreen: false,
    focus: true,
    center: true,
    visible: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    decorations: false,
    transparent: true,
    url: '/rc/alert',
  },
];

/**
 * Echo 快捷窗口配置
 */
export const ECHO_QUICK_WINDOW_CONFIGS: TauriWindowConfig[] = [
  {
    label: 'quicknote',
    title: 'Quick Note',
    width: 600,
    height: 125,
    maxHeight: 600,
    resizable: false,
    fullscreen: false,
    focus: true,
    center: true,
    visible: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    decorations: false,
    url: '/quicknote',
  },
  {
    label: 'quickai',
    title: 'Quick AI',
    width: 600,
    height: 125,
    maxHeight: 600,
    resizable: false,
    fullscreen: false,
    focus: true,
    center: true,
    visible: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    decorations: false,
    url: '/quickai',
  },
];

// ============================================
// Tauri 配置服务
// ============================================

export class TauriConfigService {
  private currentModule: ModuleId = 'echo';

  /**
   * 获取模块配置
   */
  getModuleConfig(moduleId: ModuleId): ModuleConfig {
    return MODULE_CONFIGS[moduleId];
  }

  /**
   * 获取所有模块配置
   */
  getAllModuleConfigs(): ModuleConfig[] {
    return Object.values(MODULE_CONFIGS);
  }

  /**
   * 获取当前模块
   */
  getCurrentModule(): ModuleId {
    return this.currentModule;
  }

  /**
   * 设置当前模块
   */
  setCurrentModule(moduleId: ModuleId): void {
    this.currentModule = moduleId;
  }

  /**
   * 根据路径检测模块
   */
  detectModuleFromPath(path: string): ModuleId {
    if (path.startsWith('/rc')) {
      return 'riskcontrol';
    }
    return 'echo';
  }

  /**
   * 获取模块的所有窗口配置
   */
  getWindowConfigs(moduleId: ModuleId): TauriWindowConfig[] {
    if (moduleId === 'riskcontrol') {
      return RISKCONTROL_WINDOW_CONFIGS;
    }
    return ECHO_QUICK_WINDOW_CONFIGS;
  }

  /**
   * 获取合并的权限列表
   */
  getMergedPermissions(): Permission[] {
    const permissionMap = new Map<string, Permission>();
    
    for (const config of Object.values(MODULE_CONFIGS)) {
      for (const permission of config.permissions) {
        if (!permissionMap.has(permission.name)) {
          permissionMap.set(permission.name, permission);
        }
      }
    }
    
    return Array.from(permissionMap.values());
  }

  /**
   * 检查路由是否需要认证
   */
  routeRequiresAuth(path: string): boolean {
    const moduleId = this.detectModuleFromPath(path);
    const config = this.getModuleConfig(moduleId);
    
    // 找到最匹配的路由（最长前缀匹配）
    let matchedRoute = config.routes.find(r => r.path === path);
    
    // 如果没有精确匹配，找前缀匹配
    if (!matchedRoute) {
      const matchingRoutes = config.routes
        .filter(r => path.startsWith(r.path))
        .sort((a, b) => b.path.length - a.path.length);
      matchedRoute = matchingRoutes[0];
    }
    
    return matchedRoute?.requiresAuth ?? false;
  }

  /**
   * 生成 Tauri 配置 JSON
   */
  generateTauriConfig(): object {
    return {
      productName: 'Echo',
      version: '2.0.0',
      identifier: 'com.echo.app',
      build: {
        beforeDevCommand: '',
        devUrl: 'http://localhost:1111',
        beforeBuildCommand: 'bun run build:no-pwa',
        frontendDist: '../../dist/public',
      },
      app: {
        withGlobalTauri: true,
        security: {
          csp: null,
        },
        windows: [
          MAIN_WINDOW_CONFIG,
          ...ECHO_QUICK_WINDOW_CONFIGS,
          ...RISKCONTROL_WINDOW_CONFIGS,
        ],
      },
      bundle: {
        createUpdaterArtifacts: true,
        active: true,
        targets: 'all',
        icon: [
          'icons/32x32.png',
          'icons/128x128.png',
          'icons/128x128@2x.png',
          'icons/icon.icns',
          'icons/icon.ico',
        ],
      },
    };
  }

  /**
   * 健康检查
   */
  healthCheck(): { available: boolean; message: string } {
    return {
      available: true,
      message: 'Tauri config service is ready',
    };
  }
}

// ============================================
// 导航手势配置
// ============================================

export interface GestureConfig {
  swipeThreshold: number;
  swipeVelocity: number;
  enabled: boolean;
}

export const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  swipeThreshold: 50,
  swipeVelocity: 0.3,
  enabled: true,
};

/**
 * 模块切换手势处理
 * **Validates: Requirements 42.3**
 */
export function handleModuleSwipeGesture(
  direction: 'left' | 'right',
  currentModule: ModuleId
): ModuleId | null {
  const modules: ModuleId[] = ['echo', 'riskcontrol'];
  const currentIndex = modules.indexOf(currentModule);
  
  if (direction === 'left' && currentIndex < modules.length - 1) {
    return modules[currentIndex + 1];
  }
  
  if (direction === 'right' && currentIndex > 0) {
    return modules[currentIndex - 1];
  }
  
  return null;
}

// ============================================
// 底部导航栏配置
// ============================================

export interface BottomNavItem {
  moduleId: ModuleId;
  icon: string;
  label: string;
  route: string;
}

/**
 * 底部导航栏配置
 * **Validates: Requirements 42.3**
 */
export const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { moduleId: 'echo', icon: '📝', label: 'Echo', route: '/' },
  { moduleId: 'riskcontrol', icon: '📊', label: 'Risk', route: '/rc' },
];

// ============================================
// 工厂函数
// ============================================

let tauriConfigServiceInstance: TauriConfigService | null = null;

export function getTauriConfigService(): TauriConfigService {
  if (!tauriConfigServiceInstance) {
    tauriConfigServiceInstance = new TauriConfigService();
  }
  return tauriConfigServiceInstance;
}

export default TauriConfigService;
