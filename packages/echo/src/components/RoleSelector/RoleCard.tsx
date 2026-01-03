/**
 * RoleCard 组件 - 角色卡片
 * 
 * 展示单个角色的信息，包括图标、名称、描述和状态
 * 简化版本 - 移除可能导致 Tauri WebView 问题的复杂样式
 */

import { Role } from '@/lib/role';

interface RoleCardProps {
  role: Role;
  isSelected: boolean;
  onClick: () => void;
  onSettingsClick?: () => void;
}

export function RoleCard({ role, isSelected, onClick }: RoleCardProps) {
  const isAvailable = role.status === 'completed' || role.status === 'in-progress';

  return (
    <div
      onClick={isAvailable ? onClick : undefined}
      className={`
        p-6 rounded-xl bg-white/90 dark:bg-zinc-900/90 
        border border-white/20 dark:border-zinc-700/50
        transition-all duration-200
        ${isAvailable ? 'cursor-pointer hover:scale-[1.02] hover:shadow-lg' : 'opacity-70 cursor-not-allowed'}
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
      `}
      style={{
        borderLeft: `4px solid ${role.color}`,
      }}
    >
      <div className="flex flex-col gap-3">
        {/* 头部：图标和状态 */}
        <div className="flex items-start justify-between">
          <div 
            className="text-4xl p-3 rounded-xl"
            style={{ backgroundColor: `${role.color}20` }}
          >
            {role.icon}
          </div>
          
          <div className="flex items-center gap-2">
            {/* 状态徽章 - 简化版 */}
            {role.status === 'completed' && (
              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                ✓ 已完成
              </span>
            )}
            {role.status === 'in-progress' && (
              <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                ⏳ 开发中
              </span>
            )}
            {role.status === 'planned' && (
              <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                Coming Soon
              </span>
            )}
          </div>
        </div>

        {/* 名称 */}
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{role.name}</h3>

        {/* 描述 */}
        <p className="text-gray-500 dark:text-gray-400 text-sm">{role.description}</p>

        {/* 底部提示 */}
        {isAvailable && (
          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mt-2">
            <span>→</span>
            <span>点击进入</span>
          </div>
        )}
      </div>
    </div>
  );
}
