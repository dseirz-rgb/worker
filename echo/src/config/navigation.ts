import {
  Home,
  StickyNote,
  CheckSquare,
  MessageCircle,
  Activity,
  Languages,
  FolderSearch,
  Code,
  DollarSign,
  Heart,
  Smile,
  Users,
  BookOpen,
  Settings,
  Briefcase,
  HeartPulse,
  UsersRound,
  Brain,
} from "lucide-react";
import { NavItem } from "../types/navigation";

// 导航配置 - 扁平结构，不再分组
export const NAV_ITEMS: NavItem[] = [
  { id: 'home', path: '/', label: '首页', icon: Home, size: 'large' },
  { id: 'chat', path: '/chat', label: '对话', icon: MessageCircle, size: 'large' },
  { id: 'knowledge', path: '/knowledge', label: '知识库', icon: Brain },
  { 
    id: 'workspace',
    label: '工作区', 
    icon: Briefcase,
    children: [
      { path: '/notes', label: '笔记', icon: StickyNote },
      { path: '/tasks', label: '任务', icon: CheckSquare },
      { path: '/files', label: '文件', icon: FolderSearch },
      { path: '/activity', label: '活动', icon: Activity },
    ]
  },
  { id: 'dev', path: '/github', label: '开发', icon: Code },
  { id: 'translate', path: '/translate', label: '翻译', icon: Languages },
  { id: 'investment', path: '/investment', label: '投资', icon: DollarSign },
  {
    id: 'wellness',
    label: '身心',
    icon: HeartPulse,
    children: [
      { path: '/health', label: '健康', icon: Heart },
      { path: '/emotion', label: '情绪', icon: Smile },
    ]
  },
  { id: 'family', path: '/family', label: '家庭', icon: Users },
  { id: 'team', path: '/team', label: '团队', icon: UsersRound },
  {
    id: 'learning',
    label: '学习',
    icon: BookOpen,
    children: [
      { path: '/learning', label: '学习记录', icon: BookOpen },
      { path: '/learning/manage', label: '管理分类', icon: Settings },
    ]
  },
  { id: 'settings', path: '/settings', label: '设置', icon: Settings },
];

// 移动端显示的主要功能路径
export const MOBILE_NAV_PATHS = ['/', '/chat', '/notes', '/tasks', '/settings'];

// 获取所有导航路径
export function getAllNavPaths(): string[] {
  const paths: string[] = [];
  for (const item of NAV_ITEMS) {
    if (item.path) paths.push(item.path);
    if (item.children) {
      paths.push(...item.children.map(c => c.path));
    }
  }
  return paths;
}
