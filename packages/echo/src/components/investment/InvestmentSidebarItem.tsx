/**
 * 投资模块侧边栏菜单项
 * 支持展开/收起子菜单，导航到投资相关页面
 */

import { observer } from 'mobx-react-lite';
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@/components/Common/Iconify/icons';
import { RootStore } from '@/store';
import { BaseStore } from '@/store/baseStore';
import { SideBarItem } from '@/components/Layout';
import { StorageState } from '@/store/standard/StorageState';

// 投资子菜单项配置
const investmentSubItems = [
  { title: 'Dashboard', href: '/investment', icon: 'mdi:view-dashboard' },
  { title: '持仓', href: '/investment/portfolio', icon: 'mdi:wallet' },
  { title: '风险', href: '/investment/risk', icon: 'mdi:shield-alert' },
  { title: '市场', href: '/investment/market', icon: 'mdi:chart-line' },
  { title: '决策', href: '/investment/decision', icon: 'mdi:brain' },
  { title: '镜像', href: '/investment/mirror', icon: 'mdi:account-group' },
  { title: '笔记', href: '/investment/notes', icon: 'mdi:note-text' },
  { title: '语音', href: '/investment/voice', icon: 'mdi:microphone' },
  { title: '回顾', href: '/investment/review', icon: 'mdi:calendar-check' },
];

// 持久化展开状态
const investmentExpanded = new StorageState<boolean>({
  key: 'investment-expanded',
  default: false,
});

interface InvestmentSidebarItemProps {
  onItemClick?: () => void;
}

export const InvestmentSidebarItem = observer(({ onItemClick }: InvestmentSidebarItemProps) => {
  const base = RootStore.Get(BaseStore);
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(investmentExpanded.value);

  // 检查当前路由是否在投资模块内
  const isInvestmentActive = location.pathname.startsWith('/investment');

  // 如果当前在投资模块内，自动展开
  useEffect(() => {
    if (isInvestmentActive && !isExpanded) {
      setIsExpanded(true);
      investmentExpanded.save(true);
    }
  }, [isInvestmentActive]);

  const toggleExpanded = () => {
    const newValue = !isExpanded;
    setIsExpanded(newValue);
    investmentExpanded.save(newValue);
  };

  // 检查子菜单项是否激活
  const isSubItemActive = (href: string) => {
    if (href === '/investment') {
      return location.pathname === '/investment';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="flex flex-col">
      {/* 主菜单项 - 投资 */}
      <button
        onClick={toggleExpanded}
        className={`flex items-center gap-2 group ${SideBarItem} ${isInvestmentActive ? '!bg-primary/20 !text-primary' : ''}`}
      >
        <Icon 
          className={`${base.isSidebarCollapsed ? 'mx-auto' : ''}`} 
          icon="mdi:trending-up" 
          width="20" 
          height="20" 
        />
        {!base.isSidebarCollapsed && (
          <>
            <span className="!transition-all flex-1 text-left">投资</span>
            <Icon 
              icon={isExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'} 
              width="16" 
              height="16"
              className="opacity-60"
            />
          </>
        )}
      </button>

      {/* 子菜单项 */}
      {isExpanded && (
        <div className={`flex flex-col gap-0.5 ${base.isSidebarCollapsed ? 'items-center' : 'ml-2 border-l border-foreground/10 pl-2'}`}>
          {investmentSubItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => onItemClick?.()}
              className={`flex items-center gap-2 group ${SideBarItem} ${isSubItemActive(item.href) ? '!bg-primary !text-primary-foreground' : ''} ${!base.isSidebarCollapsed ? 'py-1.5 text-sm' : ''}`}
            >
              <Icon 
                className={`${base.isSidebarCollapsed ? 'mx-auto' : ''}`} 
                icon={item.icon} 
                width={base.isSidebarCollapsed ? '18' : '16'} 
                height={base.isSidebarCollapsed ? '18' : '16'} 
              />
              {!base.isSidebarCollapsed && (
                <span className="!transition-all">{item.title}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
});
