/**
 * 投资模块路由包装器
 * 为所有投资模块页面提供错误边界保护
 * 
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
 */

import { ReactNode } from 'react';
import { InvestmentErrorBoundary } from './InvestmentErrorBoundary';

interface InvestmentRouteWrapperProps {
  children: ReactNode;
}

/**
 * 投资模块路由包装器
 * 包装所有投资模块页面，提供统一的错误处理
 */
export function InvestmentRouteWrapper({ children }: InvestmentRouteWrapperProps) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // 可以在这里添加错误上报逻辑
    console.error('[Investment Module Error]', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <InvestmentErrorBoundary onError={handleError}>
      {children}
    </InvestmentErrorBoundary>
  );
}

export default InvestmentRouteWrapper;
