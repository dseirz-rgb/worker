import { LucideIcon } from "lucide-react";

// 子菜单项
export interface NavSubItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

// 导航项（支持子菜单）
export interface NavItem {
  id: string;
  path?: string;  // 有子菜单时可以没有 path
  label: string;
  icon: LucideIcon;
  size?: 'normal' | 'large';
  children?: NavSubItem[];  // 二级子菜单
}

// 导航分组
export interface NavGroup {
  id: string;
  label: string;
  color: 'blue' | 'green' | 'purple' | 'gray';
  items: NavItem[];
}

// 快捷操作
export interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut: string;
  action: () => void;
}

// 快捷键配置
export interface ShortcutConfig {
  key: string;
  modifiers: ('ctrl' | 'shift' | 'alt' | 'meta')[];
  action: () => void;
}

// 导航状态
export interface NavigationState {
  isExpanded: boolean;
  toggleExpand: () => void;
}
