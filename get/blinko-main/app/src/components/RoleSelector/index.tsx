/**
 * RoleSelector 组件 - 角色选择器
 * 
 * 展示所有角色卡片，管理选择逻辑
 * 简化版本 - 移除可能导致问题的依赖
 */

import { RoleCard } from './RoleCard';
import { Role, DEFAULT_ROLES, saveRoleSelection } from '@/lib/role';
import { useNavigate } from 'react-router-dom';

interface RoleSelectorProps {
  roles?: Role[];
  selectedRoleId?: string;
  onRoleSelect?: (roleId: string) => void;
}

export function RoleSelector({ 
  roles = DEFAULT_ROLES, 
  selectedRoleId,
  onRoleSelect 
}: RoleSelectorProps) {
  const navigate = useNavigate();

  const handleRoleClick = (role: Role) => {
    if (role.status === 'planned') {
      // 规划中的角色显示提示
      alert(`${role.name} 功能即将推出，敬请期待！`);
      return;
    }

    // 保存选择
    saveRoleSelection(role.id);
    
    // 触发回调
    onRoleSelect?.(role.id);

    // 导航到角色页面
    navigate(role.route);
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* 响应式网格：桌面 3 列，平板 2 列，手机 1 列 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {roles.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            isSelected={selectedRoleId === role.id}
            onClick={() => handleRoleClick(role)}
          />
        ))}
      </div>
    </div>
  );
}

export { RoleCard } from './RoleCard';
