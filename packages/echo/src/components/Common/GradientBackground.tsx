import { ReactNode } from 'react';
import React from 'react'
import { cn } from '@heroui/react';

interface GradientBackgroundProps {
  children: ReactNode;
  className?: string;
}

/**
 * 简洁背景组件 - 与 CommonLayout 风格一致
 * 使用 secondbackground 作为基础色，配合淡紫色模糊装饰
 */
export const GradientBackground = ({ children, className }: GradientBackgroundProps) => {
  return (
    <div className={cn("relative w-full h-[100vh] bg-secondbackground", className)}>
      {/* 淡紫色模糊装饰 - 与 CommonLayout 一致 */}
      <div className="hidden md:block absolute top-[10%] right-[5%] z-[0] h-[350px] w-[350px] overflow-hidden blur-3xl pointer-events-none">
        <div className="w-full h-[356px] bg-[#9936e6] opacity-20" style={{ clipPath: 'circle(50% at 50% 50%)' }} />
      </div>
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}; 