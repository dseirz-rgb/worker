import { ReactNode, Component, ErrorInfo, useState, useEffect } from 'react';
import React from 'react'
import { cn } from '@heroui/react';

class GradientErrorBoundary extends Component<{ children: ReactNode }> {
  state = { hasError: false };
  
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.log('ShaderGradient error caught:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <div className="w-full h-full absolute top-0 left-0 bg-gradient-to-br from-blue-500 to-purple-600" />;
    }
    
    return this.props.children;
  }
}

interface GradientBackgroundProps {
  children: ReactNode;
  className?: string;
}

// 简单的 CSS 渐变背景 - 暂时禁用 WebGL shader 以排除问题
const SimpleFallbackBackground = () => (
  <div className="w-full h-full absolute top-0 left-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 animate-gradient-x" />
);

export const GradientBackground = ({ children, className }: GradientBackgroundProps) => {
  return (
    <div className={cn("relative w-full h-[100vh]", className)}>
      <SimpleFallbackBackground />
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}; 