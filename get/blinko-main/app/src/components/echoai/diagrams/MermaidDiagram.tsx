/**
 * Mermaid 图表组件
 * 从 Khoj 源码移植，适配 HeroUI 组件库
 * 
 * 功能：
 * - 渲染 Mermaid 图表
 * - 支持导出为 PNG
 * - 错误处理和回退显示
 */

import React, { useEffect, useState, useRef } from 'react';
import mermaid from 'mermaid';
import { Button } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';

// ============================================
// 类型定义
// ============================================

interface MermaidDiagramProps {
  chart: string;
}

// ============================================
// 组件
// ============================================

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const [mermaidError, setMermaidError] = useState<string | null>(null);
  const [mermaidId] = useState(`mermaid-chart-${Math.random().toString(12).substring(7)}`);
  const elementRef = useRef<HTMLDivElement>(null);

  // 初始化 Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
    });

    mermaid.parseError = (error) => {
      console.error('Mermaid 解析错误:', error);
      let errorMessage;
      try {
        errorMessage = typeof error === 'string' ? JSON.parse(error) : error;
      } catch (e) {
        errorMessage = error?.toString() || '未知错误';
      }

      if (errorMessage.str !== 'element is null') {
        setMermaidError('图表渲染失败，请稍后重试或反馈此问题。');
      } else {
        setMermaidError(null);
      }
    };

    mermaid.contentLoaded();
  }, []);

  // 渲染图表
  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.removeAttribute('data-processed');

      mermaid
        .run({
          nodes: [elementRef.current],
        })
        .then(() => {
          setMermaidError(null);
        })
        .catch((error) => {
          let errorMessage;
          try {
            errorMessage = typeof error === 'string' ? JSON.parse(error) : error;
          } catch (e) {
            errorMessage = error?.toString() || '未知错误';
          }

          console.log('Mermaid 错误:', errorMessage);

          if (errorMessage.str !== 'element is null') {
            setMermaidError('图表渲染失败，请稍后重试或反馈此问题。');
          } else {
            setMermaidError(null);
          }
        });
    }
  }, [chart]);

  // 导出为 PNG
  const handleExport = async () => {
    if (!elementRef.current) return;

    try {
      const svgElement = elementRef.current.querySelector('svg');
      if (!svgElement) throw new Error('未找到 SVG 元素');

      // 获取 SVG viewBox 尺寸
      const viewBox = svgElement.getAttribute('viewBox')?.split(' ').map(Number) || [0, 0, 0, 0];
      const [, , viewBoxWidth, viewBoxHeight] = viewBox;

      // 创建 canvas
      const canvas = document.createElement('canvas');
      const scale = 2; // 提高分辨率
      canvas.width = viewBoxWidth * scale;
      canvas.height = viewBoxHeight * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法获取 canvas context');

      // 转换 SVG 为 data URL
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      // 创建并加载图片
      const img = new Image();
      img.src = svgUrl;

      await new Promise((resolve, reject) => {
        img.onload = () => {
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, viewBoxWidth, viewBoxHeight);

          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('创建 blob 失败'));
              return;
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mermaid-diagram-${Date.now()}.png`;
            a.click();

            // 清理
            URL.revokeObjectURL(url);
            URL.revokeObjectURL(svgUrl);
            resolve(true);
          }, 'image/png');
        };

        img.onerror = () => reject(new Error('加载 SVG 失败'));
      });
    } catch (error) {
      console.error('导出图表错误:', error);
      setMermaidError('导出图表失败');
    }
  };

  return (
    <div className="my-4">
      {mermaidError ? (
        <>
          <div className="flex items-center gap-2 bg-danger-50 border border-danger-200 rounded-lg p-3 text-danger text-sm">
            <Icon icon="mdi:alert-circle" className="w-5 h-5 flex-shrink-0" />
            <span>{mermaidError}</span>
          </div>
          <code className="block bg-default-100 p-4 mt-3 rounded-lg font-mono text-sm whitespace-pre-wrap overflow-x-auto max-h-[400px]">
            {chart}
          </code>
        </>
      ) : (
        <div
          id={mermaidId}
          ref={elementRef}
          className="mermaid bg-white dark:bg-default-100 rounded-lg p-4 overflow-auto"
          style={{
            width: 'auto',
            height: 'auto',
            boxSizing: 'border-box',
          }}
        >
          {chart}
        </div>
      )}
      {!mermaidError && (
        <Button
          variant="flat"
          size="sm"
          className="mt-3"
          onPress={handleExport}
          startContent={<Icon icon="mdi:download" className="w-4 h-4" />}
        >
          导出为 PNG
        </Button>
      )}
    </div>
  );
};

export default MermaidDiagram;
