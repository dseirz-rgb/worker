/**
 * 文件工具栏组件
 * 
 * 提供搜索、视图切换、排序、上传等功能
 * 从 files.tsx 页面抽取的独立组件
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Tooltip, ButtonGroup } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * FileToolbar 组件 Props 接口
 */
export interface FileToolbarProps {
  /** 当前搜索关键词 */
  searchQuery: string;
  /** 搜索关键词变化回调 */
  onSearchChange: (query: string) => void;
  /** 当前视图模式 */
  viewMode: 'grid' | 'list';
  /** 视图模式变化回调 */
  onViewModeChange: (mode: 'grid' | 'list') => void;
  /** 当前排序方式 */
  sortBy: string;
  /** 排序方式变化回调 */
  onSortChange: (sort: string) => void;
  /** 文档总数 */
  totalCount: number;
  /** 上传按钮点击回调 */
  onUploadClick: () => void;
  /** 刷新按钮点击回调 */
  onRefresh: () => void;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 是否为移动端 */
  isMobile?: boolean;
  /** 移动端侧边栏切换回调 */
  onMobileSidebarToggle?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 排序选项配置
 */
interface SortOption {
  key: string;
  label: string;
  icon: string;
}

/**
 * 文件工具栏组件
 * 
 * 功能：
 * - 搜索输入框 (带防抖 300ms)
 * - 视图切换按钮 (grid/list)
 * - 排序下拉菜单
 * - 上传按钮
 * - 文档计数显示
 * - 刷新按钮
 */
export function FileToolbar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  totalCount,
  onUploadClick,
  onRefresh,
  isLoading = false,
  isMobile = false,
  onMobileSidebarToggle,
  className = '',
}: FileToolbarProps) {
  const { t } = useTranslation();
  
  // 内部搜索状态，用于防抖
  const [internalSearchQuery, setInternalSearchQuery] = useState(searchQuery);
  
  // 同步外部 searchQuery 到内部状态
  useEffect(() => {
    setInternalSearchQuery(searchQuery);
  }, [searchQuery]);
  
  // 防抖处理搜索输入
  useEffect(() => {
    const timer = setTimeout(() => {
      if (internalSearchQuery !== searchQuery) {
        onSearchChange(internalSearchQuery);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [internalSearchQuery, searchQuery, onSearchChange]);
  
  // 处理搜索输入变化
  const handleSearchInputChange = useCallback((value: string) => {
    setInternalSearchQuery(value);
  }, []);
  
  // 处理清除搜索
  const handleClearSearch = useCallback(() => {
    setInternalSearchQuery('');
    onSearchChange('');
  }, [onSearchChange]);
  
  // 排序选项
  const sortOptions: SortOption[] = useMemo(() => [
    { key: '-added', label: t('newest-first') || '最新添加', icon: 'solar:sort-from-top-to-bottom-linear' },
    { key: 'added', label: t('oldest-first') || '最早添加', icon: 'solar:sort-from-bottom-to-top-linear' },
    { key: 'title', label: t('title-asc') || '标题 A-Z', icon: 'solar:sort-by-alphabet-linear' },
    { key: '-title', label: t('title-desc') || '标题 Z-A', icon: 'solar:sort-by-alphabet-linear' },
    { key: '-created', label: t('created-newest') || '创建时间最新', icon: 'solar:calendar-linear' },
  ], [t]);
  
  // 获取当前排序选项的标签
  const currentSortLabel = useMemo(() => {
    const option = sortOptions.find(opt => opt.key === sortBy);
    return option?.label || t('sort') || '排序';
  }, [sortBy, sortOptions, t]);
  
  return (
    <div className={`flex items-center gap-2 p-4 border-b border-divider ${className}`}>
      {/* 移动端侧边栏切换按钮 */}
      {isMobile && onMobileSidebarToggle && (
        <Tooltip content={t('filters') || '过滤'}>
          <Button
            isIconOnly
            variant="light"
            onPress={onMobileSidebarToggle}
            aria-label={t('filters') || '过滤'}
          >
            <Icon icon="solar:filter-bold" className="w-5 h-5" />
          </Button>
        </Tooltip>
      )}

      {/* 搜索框 */}
      <Input
        placeholder={t('search-files') || '搜索文件...'}
        value={internalSearchQuery}
        onValueChange={handleSearchInputChange}
        startContent={
          <Icon 
            icon="solar:magnifer-linear" 
            className={`text-foreground/50 transition-colors ${internalSearchQuery ? 'text-primary' : ''}`} 
          />
        }
        classNames={{
          base: 'flex-1 max-w-md',
          inputWrapper: 'bg-default-100 hover:bg-default-200 transition-colors',
        }}
        isClearable
        onClear={handleClearSearch}
        aria-label={t('search-files') || '搜索文件'}
      />

      {/* 文档计数 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={totalCount}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-default-100 text-sm text-foreground/60"
        >
          <Icon icon="solar:documents-linear" className="w-4 h-4" />
          <span>{totalCount}</span>
          <span className="hidden md:inline">{t('documents') || '文档'}</span>
        </motion.div>
      </AnimatePresence>

      {/* 视图切换 */}
      <ButtonGroup size="sm" variant="flat">
        <Tooltip content={t('grid-view') || '网格视图'}>
          <Button
            isIconOnly
            color={viewMode === 'grid' ? 'primary' : 'default'}
            variant={viewMode === 'grid' ? 'solid' : 'flat'}
            onPress={() => onViewModeChange('grid')}
            aria-label={t('grid-view') || '网格视图'}
          >
            <Icon icon="solar:widget-2-linear" className="w-4 h-4" />
          </Button>
        </Tooltip>
        <Tooltip content={t('list-view') || '列表视图'}>
          <Button
            isIconOnly
            color={viewMode === 'list' ? 'primary' : 'default'}
            variant={viewMode === 'list' ? 'solid' : 'flat'}
            onPress={() => onViewModeChange('list')}
            aria-label={t('list-view') || '列表视图'}
          >
            <Icon icon="solar:list-linear" className="w-4 h-4" />
          </Button>
        </Tooltip>
      </ButtonGroup>

      {/* 排序下拉菜单 */}
      <Dropdown>
        <DropdownTrigger>
          <Button 
            variant="flat" 
            startContent={<Icon icon="solar:sort-vertical-linear" className="w-4 h-4" />}
            className="min-w-0"
          >
            {!isMobile && <span className="hidden lg:inline">{currentSortLabel}</span>}
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          selectedKeys={new Set([sortBy])}
          selectionMode="single"
          onSelectionChange={(keys) => {
            const selectedKey = Array.from(keys)[0] as string;
            if (selectedKey) {
              onSortChange(selectedKey);
            }
          }}
          aria-label={t('sort-options') || '排序选项'}
        >
          {sortOptions.map((option) => (
            <DropdownItem 
              key={option.key}
              startContent={<Icon icon={option.icon} className="w-4 h-4" />}
            >
              {option.label}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>

      {/* 刷新按钮 */}
      <Tooltip content={t('refresh') || '刷新'}>
        <Button
          isIconOnly
          variant="light"
          onPress={onRefresh}
          isLoading={isLoading}
          aria-label={t('refresh') || '刷新'}
        >
          <motion.div
            animate={isLoading ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 1, repeat: isLoading ? Infinity : 0, ease: 'linear' }}
          >
            <Icon icon="solar:refresh-linear" className="w-5 h-5" />
          </motion.div>
        </Button>
      </Tooltip>

      {/* 上传按钮 */}
      <Button
        color="primary"
        startContent={<Icon icon="solar:upload-linear" className="w-4 h-4" />}
        onPress={onUploadClick}
        aria-label={t('upload') || '上传'}
      >
        {!isMobile && (t('upload') || '上传')}
      </Button>
    </div>
  );
}

export default FileToolbar;
