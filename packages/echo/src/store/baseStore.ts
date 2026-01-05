import dayjs from 'dayjs';
import { Store } from './standard/base';
import { StorageState } from './standard/StorageState';
import { makeAutoObservable } from 'mobx';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from 'usehooks-ts';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
export class BaseStore implements Store {
  sid = 'BaseStore';
  constructor() {
    makeAutoObservable(this);
  }
  routerList = [
    // ========== 核心功能 (每天使用) ==========
    {
      title: 'home',
      href: '/echoai/home',
      icon: 'mdi:home',
      group: 'core',
    },
    {
      title: 'notes',
      href: '/notes',
      icon: 'hugeicons:note',
      group: 'core',
    },
    {
      title: 'files',
      href: '/files',
      icon: 'solar:folder-with-files-bold-duotone',
      group: 'core',
    },
    // ========== AI 助手 (可展开) ==========
    {
      title: 'ai-chat',
      href: '/echoai',
      icon: 'mdi:chat-outline',
      group: 'ai',
    },
    {
      title: 'ai-search',
      href: '/echoai/search',
      icon: 'mdi:magnify',
      group: 'ai',
    },
    {
      title: 'daily-report',
      href: '/echoai/report',
      icon: 'mdi:file-document-outline',
      group: 'ai',
    },
    {
      title: 'voice-assistant',
      href: '/voice-assistant',
      icon: 'mdi:microphone',
      group: 'ai',
    },
    // ========== 更多工具 (可折叠) ==========
    {
      title: 'analytics',
      href: '/analytics',
      icon: 'hugeicons:analytics-01',
      group: 'tools',
    },
    {
      title: 'translation',
      href: '/translation',
      icon: 'hugeicons:translate',
      group: 'tools',
    },
    {
      title: 'agent-management',
      href: '/agents',
      icon: 'mdi:robot-happy-outline',
      group: 'tools',
    },
    {
      title: 'janitor',
      href: '/janitor',
      icon: 'mdi:broom',
      group: 'tools',
    },
    {
      title: 'automations',
      href: '/automations',
      icon: 'solar:clock-circle-bold-duotone',
      group: 'tools',
    },
    {
      title: 'settings',
      href: '/settings',
      icon: 'hugeicons:settings-01',
      group: 'tools',
    },
    // ========== 隐藏路由 ==========
    {
      title: 'blinko',
      href: '/',
      shallow: true,
      icon: 'basil:lightning-outline',
      hiddenSidebar: true,
    },
    {
      title: 'archived',
      href: '/?path=archived',
      icon: 'solar:box-broken',
      hiddenSidebar: true,
    },
    {
      title: 'trash',
      href: '/?path=trash',
      icon: 'hugeicons:delete-02',
      hiddenSidebar: true,
    },
    {
      title: 'plugin',
      href: '/plugin',
      icon: 'hugeicons:plug-socket',
      hiddenSidebar: true,
    },
    {
      title: 'resources',
      href: '/resources',
      icon: 'solar:database-linear',
      hiddenSidebar: true,
    },
    {
      title: 'activity',
      href: '/activity',
      icon: 'hugeicons:activity-01',
      hiddenSidebar: true,
    },
    {
      title: 'research',
      href: '/research',
      icon: 'solar:magnifer-zoom-in-bold-duotone',
      hiddenSidebar: true,
    },
  ];

  // 工具箱展开状态
  toolsExpanded = new StorageState<boolean>({
    key: 'tools-expanded',
    default: false,
  });

  // AI 助手展开状态
  aiExpanded = new StorageState<boolean>({
    key: 'ai-expanded',
    default: true,
  });

  get isToolsExpanded() {
    return this.toolsExpanded.value;
  }

  get isAiExpanded() {
    return this.aiExpanded.value;
  }

  toggleTools = () => {
    this.toolsExpanded.save(!this.isToolsExpanded);
  };

  toggleAi = () => {
    this.aiExpanded.save(!this.isAiExpanded);
  };
  currentRouter = this.routerList[0];
  currentQuery = {};
  currentTitle = '';
  documentHeight = 0;
  isSideBarActive(routerInfo: any, currentRouter: any) {
    const pathname = routerInfo.pathname;
    const path = routerInfo.searchParams?.get ? routerInfo.searchParams.get('path') : routerInfo.query?.path;

    if (pathname == currentRouter.href && !path) {
      return true;
    }
    if (path == currentRouter.title) {
      return true;
    }
    return false;
  }

  locale = new StorageState({ key: 'language', default: 'en' });
  locales = [
    { value: 'en', label: 'English' },
    { value: 'zh', label: '简体中文' },
    { value: 'zh-tw', label: '繁體中文' },
    { value: 'vi', label: 'Tiếng Việt' },
    { value: 'tr', label: 'Türkçe' },
    { value: 'ka', label: 'ქართული' },
    { value: 'de', label: 'Deutsch' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'pt', label: 'Português' },
    { value: 'pl', label: 'Polish' },
    { value: 'ru', label: 'Русский' },
    { value: 'ko', label: '한국어' },
    { value: 'ja', label: '日本語' },
    { value: 'nl', label: 'Nederlands' },
  ];

  changeLanugage(i18n, locale) {
    i18n.changeLanguage(locale);
    dayjs.locale(i18n.resolvedLanguage);
    this.locale.save(locale);
  }

  isOnline: boolean = typeof window !== 'undefined' ? window.navigator.onLine : true;

  setOnlineStatus = (status: boolean) => {
    this.isOnline = status;
  };

  useInitApp() {
    const isPc = useMediaQuery('(min-width: 768px)');
    const { t, i18n } = useTranslation();
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams] = useSearchParams()

    const documentHeight = () => {
      const doc = document.documentElement;
      this.documentHeight = window.innerHeight;
      doc.style.setProperty('--doc-height', `${window.innerHeight}px`);
    };

    useEffect(() => {
      const handleOnline = () => this.setOnlineStatus(true);
      const handleOffline = () => this.setOnlineStatus(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      documentHeight();
      window.addEventListener('resize', documentHeight);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('resize', documentHeight);
      };
    }, [navigate]);

    useEffect(() => {
      if (location.pathname == '/review') {
        this.currentTitle = 'daily-review';
      } else if (location.pathname == '/detail') {
        this.currentTitle = 'detail';
      } else if (location.pathname == '/translation') {
        this.currentTitle = 'translation';
      } else if (location.pathname == '/activity') {
        this.currentTitle = 'activity';
      } else if (searchParams.get('path') == 'all') {
        this.currentTitle = t('total');
      } else if (searchParams.get('path') == 'notes') {
        this.currentTitle = 'notes';
      } else if (searchParams.get('path') == 'todo') {
        this.currentTitle = 'todo';
      } else if (searchParams.get('path') == 'archived') {
        this.currentTitle = 'archived';
      } else if (location.pathname == '/resources') {
        this.currentTitle = 'resources';
      } else if (location.pathname == '/files') {
        this.currentTitle = 'files';
      } else if (location.pathname == '/echoai') {
        this.currentTitle = 'echoai';
      } else if (location.pathname == '/echoai/home') {
        this.currentTitle = 'echoai-home';
      } else if (location.pathname == '/echoai/search') {
        this.currentTitle = 'echoai-search';
      } else if (location.pathname == '/echoai/report') {
        this.currentTitle = 'daily-report';
      } else if (location.pathname == '/agents') {
        this.currentTitle = 'agents';
      } else if (location.pathname == '/automations') {
        this.currentTitle = 'automations';
      } else if (location.pathname == '/research') {
        this.currentTitle = 'research';
      } else if (location.pathname == '/janitor') {
        this.currentTitle = 'janitor';
      } else if (location.pathname == '/voice-assistant') {
        this.currentTitle = 'voice-assistant';
      } else if (searchParams.get('path') == 'trash') {
        this.currentTitle = 'trash';
      } else if (location.pathname == '/plugin') {
        this.currentTitle = 'plugin';
      } else if (location.pathname == '/') {
        this.currentTitle = 'blinko';
      } else {
        this.currentTitle = this.currentRouter?.title ?? '';
      }

      if (this.currentRouter?.href != location.pathname) {
        this.currentRouter = this.routerList.find((item) => item.href == location.pathname) as any;
      }
    }, [this.currentRouter, location.pathname, searchParams]);

    useEffect(() => {
      this.currentQuery = searchParams;
    }, [searchParams]);
  }

  sidebarWidth = new StorageState<number>({
    key: 'sidebar-width',
    default: 220,
    validate: (value: number) => {
      if (value < 220) return 220;
      if (value > 400) return 400;
      return value;
    },
  });

  sidebarCollapsed = new StorageState<boolean>({
    key: 'sidebar-collapsed',
    default: false,
  });

  isResizing = false;
  isDragging = false;

  get isSidebarCollapsed() {
    return this.sidebarCollapsed.value;
  }

  get sideBarWidth() {
    return this.isSidebarCollapsed ? 80 : this.sidebarWidth.value;
  }

  set sideBarWidth(value: number) {
    if (!this.isSidebarCollapsed) {
      this.sidebarWidth.save(value);
    }
  }

  startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.isResizing = true;
    this.isDragging = true;
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.stopResizing);
  };

  handleMouseMove = (e: MouseEvent) => {
    if (!this.isResizing || this.isSidebarCollapsed) return;

    e.preventDefault();
    const newWidth = Math.max(80, Math.min(400, e.clientX));
    this.sidebarWidth.save(newWidth);
  };

  stopResizing = () => {
    this.isResizing = false;
    setTimeout(() => {
      this.isDragging = false;
    }, 50);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.stopResizing);
  };

  toggleSidebar = () => {
    const newCollapsed = !this.isSidebarCollapsed;
    this.sidebarCollapsed.save(newCollapsed);
  };

  collapseSidebar = () => {
    this.sidebarCollapsed.save(false);
  };
}
