import { Icon } from '@/components/Common/Iconify/icons';
import { observer } from 'mobx-react-lite';
import { Button, ScrollShadow, Divider } from '@heroui/react';
import { RootStore } from '@/store';
import { BaseStore } from '@/store/baseStore';
import { SideBarItem } from './index';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from 'usehooks-ts';
import { UserAvatarDropdown } from '../Common/UserAvatarDropdown';
import { TagListPanel } from '../Common/TagListPanel';
import { useEffect, useState, useMemo } from 'react';
import { BlinkoStore } from '@/store/blinkoStore';
import { useLocation, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { eventBus } from '@/lib/event';
import { NotificationCenter } from './NotificationCenter';
import { InvestmentSidebarItem } from '@/components/investment';

interface SidebarProps {
  onItemClick?: () => void;
}

export const Sidebar = observer(({ onItemClick }: SidebarProps) => {
  const isPc = useMediaQuery('(min-width: 768px)');
  const { t } = useTranslation();
  const base = RootStore.Get(BaseStore);
  const navigate = useNavigate();
  const blinkoStore = RootStore.Get(BlinkoStore);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isHovering, setIsHovering] = useState(false);

  // 获取当前选择的角色
  const selectedRole = useMemo(() => {
    try {
      const stored = localStorage.getItem('echo_selected_role');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.roleId;
      }
    } catch (e) {
      console.warn('读取角色选择失败:', e);
    }
    return 'assistant';
  }, [location.pathname]); // 路由变化时重新检查

  // 是否显示投资模块（仅投资者角色或在投资页面时显示）
  const showInvestment = selectedRole === 'investor' || location.pathname.startsWith('/investment');

  const routerInfo = {
    pathname: location.pathname,
    searchParams
  };

  useEffect(() => {
    if (!isPc) {
      base.collapseSidebar();
    }
  }, [isPc]);

  // 核心功能项
  const coreItems = base.routerList.filter((i) => !i.hiddenSidebar && i.group === 'core');
  // AI 助手项
  const aiItems = base.routerList.filter((i) => !i.hiddenSidebar && i.group === 'ai');
  // 更多工具项
  const toolsItems = base.routerList.filter((i) => !i.hiddenSidebar && i.group === 'tools');

  return (
    <div
      style={{ width: isPc ? `${base.sideBarWidth}px` : '100%' }}
      className={`flex h-full flex-1 flex-col p-4 relative bg-background 
        ${!base.isDragging ? '!transition-all duration-300' : 'transition-none'} 
        group/sidebar`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {!base.isSidebarCollapsed && (
        <div
          className={`absolute right-0 top-0 h-full w-2 cursor-col-resize z-49
            ${base.isResizing ? 'bg-primary/40' : ''}`}
          onMouseDown={base.startResizing}
          onClick={(e) => e.stopPropagation()}
          style={{ touchAction: 'none' }}
        />
      )}

      <div className={`flex items-center ${base.isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
        <div className={`flex w-full ${base.isSidebarCollapsed ? 'flex-col-reverse gap-2 justify-center items-center mr-2 mb-2' : 'items-center '}`}>
          <div className={`${base.isSidebarCollapsed ? 'w-full flex justify-center' : ''}`}>
            <UserAvatarDropdown onItemClick={onItemClick} collapsed={base.isSidebarCollapsed} showOverlay={isHovering} />
          </div>

          {/* 通知中心 - v3.2 新增 */}
          <div className={`${base.isSidebarCollapsed ? 'w-full flex justify-center' : 'ml-1'}`}>
            <NotificationCenter />
          </div>

          {isPc ? (
            <Button
              isIconOnly
              variant="light"
              className={`opacity-0 group-hover/sidebar:opacity-100 ml-auto ${!base.isSidebarCollapsed ? 'group-hover/sidebar:-translate-x-1 ' : 'opacity-100 translate-x-0'}`}
              onPress={base.toggleSidebar}
            >
              <Icon icon={base.isSidebarCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'} width="20" height="20" />
            </Button>
          ) : (
            <Button
              isIconOnly
              variant="light"
              className="ml-auto"
              onPress={() => {
                navigate('/settings')
                eventBus.emit('close-sidebar')
              }}
            >
              <Icon icon="hugeicons:settings-01" width="20" height="20" />
            </Button>
          )}
        </div>
      </div>

      <ScrollShadow className="-mr-[16px] mt-[-5px] h-full max-h-full pr-6 hide-scrollbar">
        <div className={`flex flex-col gap-1 mt-4 font-semibold ${base.isSidebarCollapsed ? 'items-center gap-4' : ''}`}>
          
          {/* ========== 核心功能 ========== */}
          {coreItems.map((i) => (
            <Link
              key={i.title}
              to={i.href}
              onClick={() => {
                base.currentRouter = i;
                onItemClick?.();
              }}
              className={`flex items-center gap-2 group ${SideBarItem} ${base.isSideBarActive(routerInfo, i) ? '!bg-primary !text-primary-foreground' : ''}`}
            >
              <Icon className={`${base.isSidebarCollapsed ? 'mx-auto' : ''}`} icon={i.icon} width="20" height="20" />
              {!base.isSidebarCollapsed && <span className="!transition-all">{t(i.title)}</span>}
            </Link>
          ))}

          {/* ========== AI 助手分组 ========== */}
          {!base.isSidebarCollapsed && <Divider className="my-2" />}
          {base.isSidebarCollapsed && <Divider className="my-2 w-6" />}

          {/* AI 助手标题 - 使用原来的 SideBarItem 样式 */}
          <div
            onClick={base.toggleAi}
            className={`flex items-center gap-2 group ${SideBarItem} cursor-pointer`}
          >
            <Icon className={`${base.isSidebarCollapsed ? 'mx-auto' : ''}`} icon="mdi:robot-outline" width="20" height="20" />
            {!base.isSidebarCollapsed && (
              <>
                <span className="!transition-all flex-1">{t('ai-assistant')}</span>
                <Icon 
                  icon={base.isAiExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'} 
                  width="16" 
                  height="16" 
                  className="opacity-50"
                />
              </>
            )}
          </div>

          {/* AI 助手内容 */}
          {base.isAiExpanded && aiItems.map((i) => (
            <Link
              key={i.title}
              to={i.href}
              onClick={() => {
                base.currentRouter = i;
                onItemClick?.();
              }}
              className={`flex items-center gap-2 group ${SideBarItem} ${base.isSideBarActive(routerInfo, i) ? '!bg-primary !text-primary-foreground' : ''}`}
            >
              <Icon className={`${base.isSidebarCollapsed ? 'mx-auto' : ''}`} icon={i.icon} width="20" height="20" />
              {!base.isSidebarCollapsed && <span className="!transition-all">{t(i.title)}</span>}
            </Link>
          ))}

          {/* ========== 投资模块 - 仅投资者角色显示 ========== */}
          {showInvestment && (
            <>
              {!base.isSidebarCollapsed && <Divider className="my-2" />}
              {base.isSidebarCollapsed && <Divider className="my-2 w-6" />}
              <InvestmentSidebarItem onItemClick={onItemClick} />
            </>
          )}

          {/* ========== 更多工具分组 ========== */}
          {!base.isSidebarCollapsed && <Divider className="my-2" />}
          {base.isSidebarCollapsed && <Divider className="my-2 w-6" />}

          {/* 更多工具标题 - 使用原来的 SideBarItem 样式 */}
          <div
            onClick={base.toggleTools}
            className={`flex items-center gap-2 group ${SideBarItem} cursor-pointer`}
          >
            <Icon className={`${base.isSidebarCollapsed ? 'mx-auto' : ''}`} icon="mdi:dots-horizontal" width="20" height="20" />
            {!base.isSidebarCollapsed && (
              <>
                <span className="!transition-all flex-1">{t('more')}</span>
                <Icon 
                  icon={base.isToolsExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'} 
                  width="16" 
                  height="16" 
                  className="opacity-50"
                />
              </>
            )}
          </div>

          {/* 更多工具内容 */}
          {base.isToolsExpanded && toolsItems.map((i) => (
            <Link
              key={i.title}
              to={i.href}
              onClick={() => {
                base.currentRouter = i;
                onItemClick?.();
              }}
              className={`flex items-center gap-2 group ${SideBarItem} ${base.isSideBarActive(routerInfo, i) ? '!bg-primary !text-primary-foreground' : ''}`}
            >
              <Icon className={`${base.isSidebarCollapsed ? 'mx-auto' : ''}`} icon={i.icon} width="20" height="20" />
              {!base.isSidebarCollapsed && <span className="!transition-all">{t(i.title)}</span>}
            </Link>
          ))}

          {/* 标签列表 */}
          {!base.isSidebarCollapsed && blinkoStore.tagList.value?.listTags.length != 0 && blinkoStore.tagList.value?.listTags && <TagListPanel />}
        </div>
      </ScrollShadow>

      {/* 切换角色按钮 */}
      <div className={`mt-auto pt-4 ${base.isSidebarCollapsed ? 'flex justify-center' : ''}`}>
        <Link
          to="/role-select"
          onClick={() => onItemClick?.()}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all
            hover:bg-primary/10 text-foreground/70 hover:text-primary
            ${base.isSidebarCollapsed ? 'justify-center' : ''}`}
        >
          <Icon icon="mdi:account-switch" width="20" height="20" />
          {!base.isSidebarCollapsed && <span className="text-sm font-medium">{t('switch-role')}</span>}
        </Link>
      </div>

      {/* 背景装饰 */}
      <div className="halation absolute inset-0 h-[250px] w-[250px] overflow-hidden blur-3xl z-[0] pointer-events-none">
        <div className="w-full h-[100%] bg-[#ffc65c] opacity-20" style={{ clipPath: 'circle(35% at 50% 50%)' }} />
      </div>
    </div>
  );
});
