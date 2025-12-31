/**
 * RoleSelectPage - 角色选择主页
 * 
 * Echo 应用的入口页面，用户选择要使用的角色
 * 极简版本 - 用于调试 Tauri WebView 问题
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// 角色数据 - 内联定义避免导入问题
const ROLES = [
  { id: 'assistant', name: '通用助手', icon: '🎯', description: '日常笔记、翻译、活动监控', route: '/', available: true },
  { id: 'developer', name: 'AI 开发者', icon: '🧑‍💻', description: 'GitHub 监控、项目追踪', route: '/developer', available: false },
  { id: 'manager', name: '美术经理', icon: '👨‍💼', description: '团队管理、周报、会议记录', route: '/manager', available: false },
  { id: 'investor', name: '投资者', icon: '📈', description: '投资数据、情绪管理、风控', route: '/investor', available: false },
  { id: 'family', name: '家庭成员', icon: '👨‍👩‍👧', description: '家庭关怀、健康追踪', route: '/family', available: false },
];

export default function RoleSelectPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    console.log('[RoleSelectPage] 页面已挂载');
  }, []);

  const handleRoleClick = (role: typeof ROLES[0]) => {
    if (!role.available) {
      alert(`${role.name} 功能即将推出，敬请期待！`);
      return;
    }
    // 保存选择到 localStorage
    try {
      localStorage.setItem('echo_selected_role', JSON.stringify({ roleId: role.id, selectedAt: new Date().toISOString() }));
    } catch (e) {
      console.warn('保存角色选择失败:', e);
    }
    navigate(role.route);
  };

  if (!mounted) {
    return (
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ color: 'white', fontSize: '18px' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      {/* 标题 */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '10px' }}>🌟</div>
        <h1 style={{ color: 'white', fontSize: '32px', fontWeight: 'bold', margin: '0 0 10px 0' }}>Echo</h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0 }}>选择你的角色，开始今天的工作</p>
      </div>

      {/* 角色卡片网格 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        maxWidth: '900px',
        width: '100%'
      }}>
        {ROLES.map((role) => (
          <div
            key={role.id}
            onClick={() => handleRoleClick(role)}
            style={{
              background: 'rgba(255,255,255,0.95)',
              borderRadius: '16px',
              padding: '24px',
              cursor: role.available ? 'pointer' : 'not-allowed',
              opacity: role.available ? 1 : 0.7,
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              if (role.available) {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.15)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <span style={{ fontSize: '40px' }}>{role.icon}</span>
              <span style={{ 
                fontSize: '12px', 
                padding: '4px 8px', 
                borderRadius: '12px',
                background: role.available ? '#dcfce7' : '#f3f4f6',
                color: role.available ? '#166534' : '#6b7280'
              }}>
                {role.available ? '✓ 可用' : 'Coming Soon'}
              </span>
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{role.name}</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>{role.description}</p>
            {role.available && (
              <div style={{ marginTop: '12px', fontSize: '12px', color: '#9ca3af' }}>
                → 点击进入
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 底部提示 */}
      <div style={{ marginTop: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
        <p style={{ margin: 0 }}>点击角色卡片进入对应功能区</p>
      </div>
    </div>
  );
}
