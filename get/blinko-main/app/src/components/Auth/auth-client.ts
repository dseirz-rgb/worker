// import { Session } from './auth-context';
import { getBlinkoEndpoint } from '@/lib/blinkoEndpoint';
import { eventBus } from '@/lib/event';
import { RootStore } from '@/store';
import { UserStore } from '@/store/user';

let navigateFunction: ((path: string) => void) | null = null;

export function setNavigate(navigate: (path: string) => void) {
  navigateFunction = navigate;
}

export function navigate(path: string) {
  if (navigateFunction) {
    navigateFunction(path);
  } else {
    window.location.href = path;
  }
}

export interface TokenData {
  user?: {
    name?: string;
    email?: string;
    image?: string;
    id?: string;
    role?: string;
    nickname?: string;
  };
  token?: string;
  expires?: string;
  requiresTwoFactor?: boolean;
  [key: string]: any;
}

type SignInOptions = {
  redirect?: boolean;
  callbackUrl?: string;
  [key: string]: any;
};

type SignInResponse = {
  ok: boolean;
  error?: string;
  status: number;
  url?: string;
  requiresTwoFactor?: boolean;
  userId?: number;
  token?: string;
};

/**
 * Get current token data
 */
export async function getTokenData(): Promise<TokenData | null> {
  try {
    const userStore = RootStore.Get(UserStore);
    const token = userStore.token;
    
    if (!token) {
      return null;
    }
    
    // 在 Tauri 环境中，如果 endpoint 未设置，直接返回本地存储的 token 数据
    const isTauri = !!(window as any).__TAURI__;
    const blinkoEndpoint = window.localStorage.getItem('blinkoEndpoint');
    if (isTauri && !blinkoEndpoint) {
      // 返回本地存储的 token 数据，不验证
      return userStore.tokenData.value;
    }
    
    const response = await fetch(getBlinkoEndpoint('/api/auth/profile'), {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      data.token = token;
      eventBus.emit('user:token', data);
      return data;
    }
    
    // 如果验证失败但有本地 token，在 Tauri 环境中仍然返回本地数据
    // 这样用户可以继续使用，直到下次需要真正验证时
    if (isTauri && userStore.tokenData.value) {
      console.warn('Token validation failed, using cached token data');
      return userStore.tokenData.value;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get token data:', error);
    
    // 在 Tauri 环境中，如果网络请求失败，返回本地存储的 token 数据
    const isTauri = !!(window as any).__TAURI__;
    if (isTauri) {
      const userStore = RootStore.Get(UserStore);
      if (userStore.tokenData.value) {
        console.warn('Network error, using cached token data');
        return userStore.tokenData.value;
      }
    }
    
    return null;
  }
}

/**
 * Sign in function
 */
export async function signIn(
  provider: string,
  options: SignInOptions = {}
): Promise<SignInResponse | undefined> {
  try {
    if (provider === 'credentials') {
      console.log('signIn Endpoint', getBlinkoEndpoint('/api/auth/login'));
      const response = await fetch(getBlinkoEndpoint('/api/auth/login'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: options.username,
          password: options.password,
        }),
      });

      const data = await response.json();

      if (data.requiresTwoFactor) {
        const tokenData = {
          requiresTwoFactor: true,
          user: {
            id: String(data.userId)
          }
        };
        
        eventBus.emit('user:token', tokenData);
        eventBus.emit('user:showTwoFactor', { userId: data.userId });
        
        return {
          ok: true,
          requiresTwoFactor: true,
          userId: data.userId,
          status: response.status,
        };
      }

      if (response.ok) {
        eventBus.emit('user:token', data);
        
        if (options.redirect) {
          navigate(options.callbackUrl || '/');
          return undefined;
        }
        
        return { 
          ok: true, 
          status: response.status,
          token: data.token,
        };
      }

      return {
        ok: false,
        error: data.error,
        status: response.status,
      };
    }

    if (provider === 'oauth-2fa') {
      const response = await fetch(getBlinkoEndpoint('/api/auth/verify-2fa'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: options.userId,
          code: options.twoFactorCode,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        eventBus.emit('user:token', data);
        
        if (options.redirect) {
          navigate(options.callbackUrl || '/');
          return undefined;
        }
        
        return { 
          ok: true, 
          status: response.status,
          token: data.token,
        };
      }

      return {
        ok: false,
        error: data.error,
        status: response.status,
      };
    }

    return {
      ok: false,
      error: 'Unsupported provider',
      status: 400,
    };
  } catch (error) {
    console.error('SignIn error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 500,
    };
  }
}

/**
 * Sign out function
 */
export async function signOut(options: { redirect?: boolean; callbackUrl?: string } = {}): Promise<{ url: string }> {
  try {
    const userStore = RootStore.Get(UserStore);
    
    await fetch(getBlinkoEndpoint('/api/auth/logout'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userStore.token || ''}`
      },
    });

    eventBus.emit('user:token', null);
    
    if (options.redirect) {
      navigate(options.callbackUrl || '/');
    }

    return { url: options.callbackUrl || '/' };
  } catch (error) {
    console.error('SignOut error:', error);
    return { url: options.callbackUrl || '/' };
  }
}