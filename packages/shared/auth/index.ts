/**
 * 统一认证服务 (UnifiedAuthService)
 * 
 * 整合 Echo 和 RiskControl 的认证系统
 * - Echo: 自定义 JWT token 认证
 * - RiskControl: Supabase Auth
 * 
 * 策略：使用 Supabase Auth 作为主认证源，Echo 使用独立 token
 * 
 * @module @echoai/shared/auth
 */

import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

// ============================================
// 类型定义
// ============================================

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  user: UnifiedUser | null;
  echoToken: string | null;
  rcToken: string | null;
  expiresAt: Date | null;
  error?: string;
}

export interface UnifiedUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  createdAt: Date;
  modules: {
    echo: boolean;
    riskcontrol: boolean;
  };
  preferences: {
    defaultModule: 'echo' | 'riskcontrol';
    theme: 'light' | 'dark' | 'system';
    language: 'zh' | 'en';
  };
}

export interface AuthConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  echoApiUrl?: string;
}

// ============================================
// 统一认证服务
// ============================================

export class UnifiedAuthService {
  private supabase: SupabaseClient | null = null;
  private echoApiUrl: string;
  private currentUser: UnifiedUser | null = null;
  private echoToken: string | null = null;
  private rcSession: Session | null = null;

  constructor(config: AuthConfig) {
    if (config.supabaseUrl && config.supabaseAnonKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    }
    this.echoApiUrl = config.echoApiUrl || '';
  }

  /**
   * 使用 Supabase Auth 登录
   * RiskControl 模块的主要认证方式
   */
  async loginWithSupabase(credentials: AuthCredentials): Promise<AuthResult> {
    if (!this.supabase) {
      return {
        success: false,
        user: null,
        echoToken: null,
        rcToken: null,
        expiresAt: null,
        error: 'Supabase client not initialized',
      };
    }

    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        return {
          success: false,
          user: null,
          echoToken: null,
          rcToken: null,
          expiresAt: null,
          error: error.message,
        };
      }

      if (!data.user || !data.session) {
        return {
          success: false,
          user: null,
          echoToken: null,
          rcToken: null,
          expiresAt: null,
          error: 'Login failed: no user or session',
        };
      }

      this.rcSession = data.session;
      this.currentUser = this.mapSupabaseUser(data.user);

      return {
        success: true,
        user: this.currentUser,
        echoToken: this.echoToken,
        rcToken: data.session.access_token,
        expiresAt: new Date(data.session.expires_at! * 1000),
      };
    } catch (error) {
      return {
        success: false,
        user: null,
        echoToken: null,
        rcToken: null,
        expiresAt: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 使用 Echo 认证登录
   * Echo 模块的主要认证方式
   */
  async loginWithEcho(username: string, password: string): Promise<AuthResult> {
    if (!this.echoApiUrl) {
      return {
        success: false,
        user: null,
        echoToken: null,
        rcToken: null,
        expiresAt: null,
        error: 'Echo API URL not configured',
      };
    }

    try {
      const response = await fetch(`${this.echoApiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          user: null,
          echoToken: null,
          rcToken: null,
          expiresAt: null,
          error: data.error || 'Login failed',
        };
      }

      this.echoToken = data.token;
      
      // 如果有 Supabase session，合并用户信息
      if (this.currentUser) {
        return {
          success: true,
          user: this.currentUser,
          echoToken: this.echoToken,
          rcToken: this.rcSession?.access_token || null,
          expiresAt: this.rcSession ? new Date(this.rcSession.expires_at! * 1000) : null,
        };
      }

      // 创建 Echo-only 用户
      this.currentUser = {
        id: data.user?.id || 'echo-user',
        email: data.user?.email || username,
        name: data.user?.name || data.user?.nickname || null,
        avatar: data.user?.image || null,
        createdAt: new Date(),
        modules: {
          echo: true,
          riskcontrol: false,
        },
        preferences: {
          defaultModule: 'echo',
          theme: 'system',
          language: 'zh',
        },
      };

      return {
        success: true,
        user: this.currentUser,
        echoToken: this.echoToken,
        rcToken: null,
        expiresAt: data.expires ? new Date(data.expires) : null,
      };
    } catch (error) {
      return {
        success: false,
        user: null,
        echoToken: null,
        rcToken: null,
        expiresAt: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 登出 - 同时清除两个模块的会话
   */
  async logout(): Promise<void> {
    // 清除 Supabase session
    if (this.supabase) {
      await this.supabase.auth.signOut();
    }

    // 清除 Echo token
    if (this.echoApiUrl && this.echoToken) {
      try {
        await fetch(`${this.echoApiUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.echoToken}`,
          },
        });
      } catch (error) {
        console.warn('Echo logout failed:', error);
      }
    }

    // 清除本地状态
    this.currentUser = null;
    this.echoToken = null;
    this.rcSession = null;
  }

  /**
   * 获取当前用户
   */
  async getCurrentUser(): Promise<UnifiedUser | null> {
    if (this.currentUser) {
      return this.currentUser;
    }

    // 尝试从 Supabase 恢复会话
    if (this.supabase) {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (session?.user) {
        this.rcSession = session;
        this.currentUser = this.mapSupabaseUser(session.user);
        return this.currentUser;
      }
    }

    return null;
  }

  /**
   * 检查模块访问权限
   */
  hasModuleAccess(module: 'echo' | 'riskcontrol'): boolean {
    if (!this.currentUser) return false;
    return this.currentUser.modules[module];
  }

  /**
   * 刷新会话
   */
  async refreshSession(): Promise<AuthResult> {
    if (!this.supabase) {
      return {
        success: false,
        user: null,
        echoToken: null,
        rcToken: null,
        expiresAt: null,
        error: 'Supabase client not initialized',
      };
    }

    try {
      const { data, error } = await this.supabase.auth.refreshSession();

      if (error) {
        return {
          success: false,
          user: null,
          echoToken: null,
          rcToken: null,
          expiresAt: null,
          error: error.message,
        };
      }

      if (data.session) {
        this.rcSession = data.session;
        if (data.user) {
          this.currentUser = this.mapSupabaseUser(data.user);
        }

        return {
          success: true,
          user: this.currentUser,
          echoToken: this.echoToken,
          rcToken: data.session.access_token,
          expiresAt: new Date(data.session.expires_at! * 1000),
        };
      }

      return {
        success: false,
        user: null,
        echoToken: null,
        rcToken: null,
        expiresAt: null,
        error: 'No session to refresh',
      };
    } catch (error) {
      return {
        success: false,
        user: null,
        echoToken: null,
        rcToken: null,
        expiresAt: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 获取 Supabase 客户端（用于直接访问）
   */
  getSupabaseClient(): SupabaseClient | null {
    return this.supabase;
  }

  /**
   * 获取 Echo token
   */
  getEchoToken(): string | null {
    return this.echoToken;
  }

  /**
   * 获取 RiskControl token
   */
  getRCToken(): string | null {
    return this.rcSession?.access_token || null;
  }

  // ============================================
  // 私有方法
  // ============================================

  private mapSupabaseUser(user: User): UnifiedUser {
    return {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.user_metadata?.full_name || null,
      avatar: user.user_metadata?.avatar_url || null,
      createdAt: new Date(user.created_at),
      modules: {
        echo: true,
        riskcontrol: true,
      },
      preferences: {
        defaultModule: user.user_metadata?.default_module || 'riskcontrol',
        theme: user.user_metadata?.theme || 'system',
        language: user.user_metadata?.language || 'zh',
      },
    };
  }
}

// ============================================
// 单例导出
// ============================================

let authServiceInstance: UnifiedAuthService | null = null;

export function initAuthService(config: AuthConfig): UnifiedAuthService {
  authServiceInstance = new UnifiedAuthService(config);
  return authServiceInstance;
}

export function getAuthService(): UnifiedAuthService | null {
  return authServiceInstance;
}

export default UnifiedAuthService;
