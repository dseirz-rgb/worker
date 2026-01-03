/**
 * 模块导航服务属性测试
 * 
 * **Feature: riskcontrol-integration**
 * **Property 9: 导航状态持久化**
 * **Validates: Requirements 2.4**
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { 
  ModuleNavigator, 
  ModuleType, 
  MODULE_CONFIGS,
  NavigationState 
} from './index';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'window', { 
  value: { 
    localStorage: localStorageMock,
    location: { pathname: '/' },
  } 
});

describe('ModuleNavigator', () => {
  let navigator: ModuleNavigator;

  beforeEach(() => {
    localStorageMock.clear();
    navigator = new ModuleNavigator();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Property Tests', () => {
    /**
     * **Property 9: 导航状态持久化**
     * For any module switch followed by session refresh, the last visited module
     * SHALL be preserved and restored.
     * 
     * **Validates: Requirements 2.4**
     */
    it('should persist and restore last visited module', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<ModuleType>('echo', 'riskcontrol'),
          fc.nat({ max: 10 }), // 模拟多次切换
          (targetModule, switchCount) => {
            // 执行多次模块切换
            let currentModule: ModuleType = 'echo';
            for (let i = 0; i < switchCount; i++) {
              currentModule = currentModule === 'echo' ? 'riskcontrol' : 'echo';
              navigator.switchModule(currentModule);
            }
            
            // 最后切换到目标模块
            navigator.switchModule(targetModule);
            
            // 创建新的 navigator 实例（模拟页面刷新）
            const newNavigator = new ModuleNavigator();
            
            // 验证：最后访问的模块应该被保留
            expect(newNavigator.getState().lastVisitedModule).toBe(targetModule);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 验证模块切换后路径记录的正确性
     */
    it('should preserve last visited path for each module', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<ModuleType>('echo', 'riskcontrol'),
          fc.constantFrom(...MODULE_CONFIGS.echo.routes, ...MODULE_CONFIGS.riskcontrol.routes),
          (module, path) => {
            // 重置 navigator 确保干净状态
            navigator.reset();
            
            // 切换到模块
            navigator.switchModule(module);
            
            // 手动更新路径（模拟用户导航）
            navigator.updateCurrentPath(path);
            
            // 验证：路径应该被记录
            const lastPath = navigator.getLastVisitedPath(module);
            expect(lastPath).toBe(path);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 验证模块配置的完整性
     */
    it('should have valid configuration for all modules', () => {
      const modules: ModuleType[] = ['echo', 'riskcontrol'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...modules),
          (module) => {
            const config = navigator.getModuleConfig(module);
            
            // 验证配置完整性
            expect(config.id).toBe(module);
            expect(config.name).toBeTruthy();
            expect(config.icon).toBeTruthy();
            expect(config.defaultPath).toBeTruthy();
            expect(config.routes.length).toBeGreaterThan(0);
            expect(config.routes).toContain(config.defaultPath);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Tests', () => {
    it('should initialize with echo as default module', () => {
      const state = navigator.getState();
      expect(state.currentModule).toBe('echo');
      expect(state.lastVisitedModule).toBe('echo');
    });

    it('should switch modules correctly', () => {
      const targetPath = navigator.switchModule('riskcontrol');
      
      expect(navigator.getCurrentModule()).toBe('riskcontrol');
      expect(targetPath).toBe(MODULE_CONFIGS.riskcontrol.defaultPath);
    });

    it('should return custom path when switching with path parameter', () => {
      const customPath = '/positions';
      const targetPath = navigator.switchModule('riskcontrol', customPath);
      
      expect(targetPath).toBe(customPath);
    });

    it('should detect module for known paths', () => {
      expect(navigator.getModuleForPath('/notes')).toBe('echo');
      expect(navigator.getModuleForPath('/tasks')).toBe('echo');
      expect(navigator.getModuleForPath('/dashboard')).toBe('riskcontrol');
      expect(navigator.getModuleForPath('/positions')).toBe('riskcontrol');
    });

    it('should return null for unknown paths', () => {
      expect(navigator.getModuleForPath('/unknown')).toBeNull();
    });

    it('should support state subscription', () => {
      const listener = vi.fn();
      const unsubscribe = navigator.subscribe(listener);
      
      navigator.switchModule('riskcontrol');
      
      // 应该被调用（过渡开始和结束）
      expect(listener).toHaveBeenCalled();
      
      unsubscribe();
      listener.mockClear();
      
      navigator.switchModule('echo');
      
      // 取消订阅后不应该被调用
      expect(listener).not.toHaveBeenCalled();
    });

    it('should reset to default state', () => {
      navigator.switchModule('riskcontrol');
      navigator.updateCurrentPath('/positions');
      
      navigator.reset();
      
      const state = navigator.getState();
      expect(state.currentModule).toBe('echo');
      expect(state.lastVisitedPath.echo).toBe(MODULE_CONFIGS.echo.defaultPath);
    });
  });
});
