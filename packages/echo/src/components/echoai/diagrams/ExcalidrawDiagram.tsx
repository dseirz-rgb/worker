/**
 * Excalidraw 图表组件
 * 从 Khoj 源码移植，适配 HeroUI 组件库
 * 
 * 功能：
 * - 渲染 Excalidraw 图表
 * - 支持全屏展开
 * - 支持明暗主题
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import { Button, Spinner } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';

// ============================================
// 类型定义
// ============================================

interface ExcalidrawElementSkeleton {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  start?: { id: string };
  end?: { id: string };
  children?: readonly string[];
  [key: string]: unknown;
}

interface ExcalidrawDiagramProps {
  data: ExcalidrawElementSkeleton[];
}

// ============================================
// 动态导入 Excalidraw
// ============================================

const ExcalidrawComponent = lazy(async () => {
  const module = await import('@excalidraw/excalidraw');
  return { default: module.Excalidraw };
});

// ============================================
// 组件
// ============================================

export default function ExcalidrawDiagram(props: ExcalidrawDiagramProps) {
  const [excalidrawElements, setExcalidrawElements] = useState<unknown[]>([]);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  // 验证元素是否有效
  const isValidExcalidrawElement = (element: ExcalidrawElementSkeleton): boolean => {
    return (
      element.x !== undefined &&
      element.y !== undefined &&
      element.id !== undefined &&
      element.type !== undefined
    );
  };

  // ESC 键关闭全屏
  useEffect(() => {
    if (expanded) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setExpanded(false);
          window.dispatchEvent(new Event('resize'));
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [expanded]);

  // 处理和验证元素数据
  useEffect(() => {
    const processElements = async () => {
      setIsLoading(true);
      
      try {
        // 基础验证
        const basicValidSkeletons: ExcalidrawElementSkeleton[] = [];
        for (const element of props.data) {
          if (isValidExcalidrawElement(element)) {
            basicValidSkeletons.push(element);
          }
        }

        // 深度验证（处理箭头和框架）
        const validSkeletons: ExcalidrawElementSkeleton[] = [];
        for (const element of basicValidSkeletons) {
          if (element.type === 'frame') {
            continue; // 稍后处理
          }
          if (element.type === 'arrow') {
            if (element.start) {
              const start = basicValidSkeletons.find((child) => child.id === element.start?.id);
              if (!start) continue;
            }
            if (element.end) {
              const end = basicValidSkeletons.find((child) => child.id === element.end?.id);
              if (!end) continue;
            }
            validSkeletons.push(element);
          } else {
            validSkeletons.push(element);
          }
        }

        // 处理框架元素
        for (const element of basicValidSkeletons) {
          if (element.type === 'frame') {
            const children = element.children?.map((childId) => {
              return validSkeletons.find((child) => child.id === childId);
            });
            const validChildrenIds = children
              ?.map((child) => child?.id)
              .filter((id) => id !== undefined) as string[];

            if (validChildrenIds === undefined || validChildrenIds.length === 0) {
              continue;
            }

            validSkeletons.push({
              ...element,
              children: validChildrenIds,
            });
          }
        }

        // 转换为 Excalidraw 元素
        const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
        const elements = convertToExcalidrawElements(validSkeletons as never[]);
        setExcalidrawElements(elements);
      } catch (error) {
        console.error('处理 Excalidraw 元素失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    processElements();
  }, [props.data]);

  // 获取当前主题
  const isDarkMode = typeof window !== 'undefined' && 
    (localStorage.getItem('theme') === 'dark' || 
     document.documentElement.classList.contains('dark'));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px] bg-default-100 rounded-lg">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="relative my-4">
      <div
        className={`${
          expanded
            ? 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center'
            : ''
        }`}
      >
        {/* 展开/收起按钮 */}
        <Button
          isIconOnly
          variant="flat"
          size="sm"
          onPress={() => {
            setExpanded(!expanded);
            window.dispatchEvent(new Event('resize'));
          }}
          className={`${expanded ? 'absolute top-4 left-4 z-[60]' : 'absolute top-2 left-2 z-10'}`}
        >
          <Icon
            icon={expanded ? 'mdi:arrow-collapse' : 'mdi:arrow-expand'}
            className="w-4 h-4"
          />
        </Button>

        {/* Excalidraw 容器 */}
        <div
          className={`
            ${expanded ? 'w-[80vw] h-[80vh]' : 'w-full h-[400px]'}
            bg-white dark:bg-default-100 overflow-hidden rounded-lg relative
          `}
        >
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <Spinner size="lg" />
              </div>
            }
          >
            <ExcalidrawComponent
              initialData={{
                elements: excalidrawElements as never[],
                appState: { zenModeEnabled: true },
                scrollToContent: true,
              }}
              theme={isDarkMode ? 'dark' : 'light'}
              validateEmbeddable={true}
              renderTopRightUI={() => <></>}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
