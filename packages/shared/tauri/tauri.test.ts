/**
 * Tauri 配置服务测试
 * 
 * **Validates: Requirements 42.1, 42.3**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  TauriConfigService,
  getTauriConfigService,
  handleModuleSwipeGesture,
  MODULE_CONFIGS,
  MAIN_WINDOW_CONFIG,
  RISKCONTROL_WINDOW_CONFIGS,
  ECHO_QUICK_WINDOW_CONFIGS,
  BOTTOM_NAV_ITEMS,
  type ModuleId,
} from './index';

describe('TauriConfigService', () => {
  let service: TauriConfigService;

  beforeEach(() => {
    service = new TauriConfigService();
  });

  // ============================================
  // 模块配置测试
  // ============================================

  describe('Module Configuration', () => {
    /**
     * **Validates: Requirements 42.1**
     */
    it('should have Echo module config', () => {
      const config = service.getModuleConfig('echo');
      
      expect(config.id).toBe('echo');
      expect(config.name).toBe('Echo');
      expect(config.routes.length).toBeGreaterThan(0);
      expect(config.permissions.length).toBeGreaterThan(0);
    });

    it('should have RiskControl module config', () => {
      const config = service.getModuleConfig('riskcontrol');
      
      expect(config.id).toBe('riskcontrol');
      expect(config.name).toBe('RiskControl');
      expect(config.routes.length).toBeGreaterThan(0);
      expect(config.permissions.length).toBeGreaterThan(0);
    });

    it('should return all module configs', () => {
      const configs = service.getAllModuleConfigs();
      
      expect(configs.length).toBe(2);
      expect(configs.map(c => c.id)).toContain('echo');
      expect(configs.map(c => c.id)).toContain('riskcontrol');
    });
  });

  describe('Current Module Management', () => {
    it('should default to echo module', () => {
      expect(service.getCurrentModule()).toBe('echo');
    });

    it('should set current module', () => {
      service.setCurrentModule('riskcontrol');
      expect(service.getCurrentModule()).toBe('riskcontrol');
    });
  });

  describe('Path Detection', () => {
    it('should detect echo module for root path', () => {
      expect(service.detectModuleFromPath('/')).toBe('echo');
    });

    it('should detect echo module for notes path', () => {
      expect(service.detectModuleFromPath('/notes')).toBe('echo');
    });

    it('should detect riskcontrol module for /rc path', () => {
      expect(service.detectModuleFromPath('/rc')).toBe('riskcontrol');
    });

    it('should detect riskcontrol module for /rc/portfolio path', () => {
      expect(service.detectModuleFromPath('/rc/portfolio')).toBe('riskcontrol');
    });
  });

  // ============================================
  // 窗口配置测试
  // ============================================

  describe('Window Configuration', () => {
    /**
     * **Validates: Requirements 42.3**
     */
    it('should return RiskControl window configs', () => {
      const configs = service.getWindowConfigs('riskcontrol');
      
      expect(configs.length).toBeGreaterThan(0);
      expect(configs.some(c => c.label === 'riskcontrol-main')).toBe(true);
    });

    it('should return Echo quick window configs', () => {
      const configs = service.getWindowConfigs('echo');
      
      expect(configs.length).toBeGreaterThan(0);
      expect(configs.some(c => c.label === 'quicknote')).toBe(true);
    });

    it('should have valid main window config', () => {
      expect(MAIN_WINDOW_CONFIG.label).toBe('main');
      expect(MAIN_WINDOW_CONFIG.width).toBeGreaterThan(0);
      expect(MAIN_WINDOW_CONFIG.height).toBeGreaterThan(0);
    });
  });

  // ============================================
  // 权限测试
  // ============================================

  describe('Permissions', () => {
    it('should merge permissions from all modules', () => {
      const permissions = service.getMergedPermissions();
      
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.some(p => p.name === 'fs:read')).toBe(true);
      expect(permissions.some(p => p.name === 'notification')).toBe(true);
    });

    it('should not duplicate permissions', () => {
      const permissions = service.getMergedPermissions();
      const names = permissions.map(p => p.name);
      const uniqueNames = [...new Set(names)];
      
      expect(names.length).toBe(uniqueNames.length);
    });
  });

  // ============================================
  // 路由认证测试
  // ============================================

  describe('Route Authentication', () => {
    it('should identify routes requiring auth', () => {
      expect(service.routeRequiresAuth('/rc/portfolio')).toBe(true);
      expect(service.routeRequiresAuth('/rc/risk')).toBe(true);
    });

    it('should identify public routes', () => {
      expect(service.routeRequiresAuth('/')).toBe(false);
      expect(service.routeRequiresAuth('/rc')).toBe(false);
      expect(service.routeRequiresAuth('/rc/market')).toBe(false);
    });
  });

  // ============================================
  // Tauri 配置生成测试
  // ============================================

  describe('Tauri Config Generation', () => {
    it('should generate valid config structure', () => {
      const config = service.generateTauriConfig() as any;
      
      expect(config.productName).toBeDefined();
      expect(config.version).toBeDefined();
      expect(config.identifier).toBeDefined();
      expect(config.build).toBeDefined();
      expect(config.app).toBeDefined();
      expect(config.bundle).toBeDefined();
    });

    it('should include all windows', () => {
      const config = service.generateTauriConfig() as any;
      const windows = config.app.windows;
      
      expect(windows.length).toBeGreaterThan(3);
      expect(windows.some((w: any) => w.label === 'main')).toBe(true);
      expect(windows.some((w: any) => w.label === 'quicknote')).toBe(true);
      expect(windows.some((w: any) => w.label === 'riskcontrol-main')).toBe(true);
    });
  });

  // ============================================
  // 健康检查测试
  // ============================================

  describe('Health Check', () => {
    it('should return healthy status', () => {
      const health = service.healthCheck();
      
      expect(health.available).toBe(true);
      expect(health.message).toContain('ready');
    });
  });

  // ============================================
  // 工厂函数测试
  // ============================================

  describe('Factory Functions', () => {
    it('should return singleton instance', () => {
      const instance1 = getTauriConfigService();
      const instance2 = getTauriConfigService();
      
      expect(instance1).toBe(instance2);
    });
  });
});

// ============================================
// 手势处理测试
// ============================================

describe('Module Swipe Gesture', () => {
  /**
   * **Validates: Requirements 42.3**
   */
  it('should switch from echo to riskcontrol on left swipe', () => {
    const result = handleModuleSwipeGesture('left', 'echo');
    expect(result).toBe('riskcontrol');
  });

  it('should switch from riskcontrol to echo on right swipe', () => {
    const result = handleModuleSwipeGesture('right', 'riskcontrol');
    expect(result).toBe('echo');
  });

  it('should return null when swiping left on last module', () => {
    const result = handleModuleSwipeGesture('left', 'riskcontrol');
    expect(result).toBeNull();
  });

  it('should return null when swiping right on first module', () => {
    const result = handleModuleSwipeGesture('right', 'echo');
    expect(result).toBeNull();
  });
});

// ============================================
// 底部导航栏测试
// ============================================

describe('Bottom Navigation', () => {
  /**
   * **Validates: Requirements 42.3**
   */
  it('should have items for both modules', () => {
    expect(BOTTOM_NAV_ITEMS.length).toBe(2);
    expect(BOTTOM_NAV_ITEMS.some(i => i.moduleId === 'echo')).toBe(true);
    expect(BOTTOM_NAV_ITEMS.some(i => i.moduleId === 'riskcontrol')).toBe(true);
  });

  it('should have valid routes', () => {
    for (const item of BOTTOM_NAV_ITEMS) {
      expect(item.route).toBeDefined();
      expect(item.route.startsWith('/')).toBe(true);
    }
  });
});

// ============================================
// 属性测试
// ============================================

describe('Property Tests', () => {
  /**
   * **Validates: Requirements 42.1**
   * 属性：所有模块都应该有有效的配置
   */
  it('all modules should have valid configs', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('echo', 'riskcontrol') as fc.Arbitrary<ModuleId>,
        (moduleId) => {
          const config = MODULE_CONFIGS[moduleId];
          return (
            config.id === moduleId &&
            config.name.length > 0 &&
            config.routes.length > 0 &&
            config.permissions.length > 0 &&
            config.defaultRoute.length > 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性：路径检测应该是确定性的
   */
  it('path detection should be deterministic', () => {
    const service = new TauriConfigService();
    
    fc.assert(
      fc.property(
        fc.constantFrom('/', '/notes', '/tasks', '/rc', '/rc/portfolio', '/rc/risk'),
        (path) => {
          const result1 = service.detectModuleFromPath(path);
          const result2 = service.detectModuleFromPath(path);
          return result1 === result2;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 42.3**
   * 属性：手势切换应该是可逆的
   */
  it('gesture switching should be reversible', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('echo', 'riskcontrol') as fc.Arbitrary<ModuleId>,
        (startModule) => {
          // 左滑然后右滑应该回到原点（如果可以的话）
          const afterLeft = handleModuleSwipeGesture('left', startModule);
          if (afterLeft === null) return true;
          
          const afterRight = handleModuleSwipeGesture('right', afterLeft);
          return afterRight === startModule;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性：窗口配置应该有有效的尺寸
   */
  it('window configs should have valid dimensions', () => {
    const allWindows = [
      MAIN_WINDOW_CONFIG,
      ...ECHO_QUICK_WINDOW_CONFIGS,
      ...RISKCONTROL_WINDOW_CONFIGS,
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...allWindows),
        (windowConfig) => {
          return (
            windowConfig.width > 0 &&
            windowConfig.height > 0 &&
            windowConfig.label.length > 0 &&
            windowConfig.title.length > 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
