/**
 * 角色类型定义 - Echo 角色选择系统
 * 
 * 定义了 Echo 的 5 个角色及其配置
 */

// 角色状态类型
export type RoleStatus = 'completed' | 'in-progress' | 'planned';

// 角色接口
export interface Role {
  id: string;
  name: string;
  icon: string;
  description: string;
  status: RoleStatus;
  route: string;
  color: string;
}

// 默认角色列表
export const DEFAULT_ROLES: Role[] = [
  {
    id: 'assistant',
    name: '通用助手',
    icon: '🎯',
    description: '日常笔记、翻译、活动监控',
    status: 'completed',
    route: '/',
    color: '#3B82F6',
  },
  {
    id: 'developer',
    name: 'AI 开发者',
    icon: '🧑‍💻',
    description: 'GitHub 监控、项目追踪、知识学习',
    status: 'planned',
    route: '/developer',
    color: '#10B981',
  },
  {
    id: 'manager',
    name: '美术经理',
    icon: '👨‍💼',
    description: '团队管理、周报、会议记录',
    status: 'planned',
    route: '/manager',
    color: '#F59E0B',
  },
  {
    id: 'investor',
    name: '投资者',
    icon: '📈',
    description: '投资数据、情绪管理、风控',
    status: 'planned',
    route: '/investor',
    color: '#EF4444',
  },
  {
    id: 'family',
    name: '家庭成员',
    icon: '👨‍👩‍👧',
    description: '家庭关怀、健康追踪',
    status: 'planned',
    route: '/family',
    color: '#8B5CF6',
  },
];

// localStorage key
export const SELECTED_ROLE_KEY = 'echo_selected_role';

// 存储格式
export interface StoredRoleSelection {
  roleId: string;
  selectedAt: string; // ISO date string
}

// 获取保存的角色选择
export function getSavedRoleSelection(): StoredRoleSelection | null {
  try {
    const saved = localStorage.getItem(SELECTED_ROLE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('[Role] 读取角色选择失败:', e);
  }
  return null;
}

// 保存角色选择
export function saveRoleSelection(roleId: string): void {
  try {
    const selection: StoredRoleSelection = {
      roleId,
      selectedAt: new Date().toISOString(),
    };
    localStorage.setItem(SELECTED_ROLE_KEY, JSON.stringify(selection));
  } catch (e) {
    console.warn('[Role] 保存角色选择失败:', e);
  }
}

// 根据 ID 获取角色
export function getRoleById(roleId: string): Role | undefined {
  return DEFAULT_ROLES.find(r => r.id === roleId);
}
