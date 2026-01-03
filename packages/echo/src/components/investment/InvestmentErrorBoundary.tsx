/**
 * 投资模块 - 错误边界组件
 * 捕获投资模块错误，显示友好错误 UI，提供重试按钮
 * 
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
 */

import React, { Component, type ReactNode } from 'react';
import { Card, CardBody, Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * 投资模块错误边界
 * 捕获子组件树中的 JavaScript 错误，防止整个应用崩溃
 */
export class InvestmentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // 更新 state 使下一次渲染显示降级 UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // 记录错误信息
    console.error('[InvestmentErrorBoundary] 捕获到错误:', error);
    console.error('[InvestmentErrorBoundary] 组件堆栈:', errorInfo.componentStack);
    
    this.setState({ errorInfo });
    
    // 调用外部错误处理回调
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    // 重置错误状态，尝试重新渲染
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoBack = (): void => {
    // 返回投资首页
    window.location.href = '/investment';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误 UI
      return (
        <GradientBackground className="h-full overflow-auto">
          <div className="max-w-2xl mx-auto p-4 md:p-6 flex items-center justify-center min-h-[60vh]">
            <Card className="bg-content1/50 backdrop-blur-sm w-full">
              <CardBody className="p-8 text-center">
                {/* 错误图标 */}
                <div className="w-20 h-20 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-6">
                  <Icon icon="mdi:alert-circle" className="text-5xl text-danger" />
                </div>

                {/* 错误标题 */}
                <h2 className="text-2xl font-bold text-danger mb-2">
                  页面出现问题
                </h2>

                {/* 错误描述 */}
                <p className="text-foreground/60 mb-6">
                  投资模块遇到了一个错误，但不用担心，您的数据是安全的。
                </p>

                {/* 错误详情（开发环境显示） */}
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <div className="mb-6 p-4 rounded-lg bg-danger/5 border border-danger/20 text-left">
                    <p className="text-sm font-mono text-danger mb-2">
                      {this.state.error.name}: {this.state.error.message}
                    </p>
                    {this.state.errorInfo && (
                      <details className="text-xs text-foreground/50">
                        <summary className="cursor-pointer hover:text-foreground/70">
                          查看组件堆栈
                        </summary>
                        <pre className="mt-2 overflow-auto max-h-40 whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    color="primary"
                    size="lg"
                    startContent={<Icon icon="mdi:refresh" />}
                    onPress={this.handleRetry}
                  >
                    重试
                  </Button>
                  <Button
                    variant="flat"
                    size="lg"
                    startContent={<Icon icon="mdi:home" />}
                    onPress={this.handleGoBack}
                  >
                    返回首页
                  </Button>
                </div>

                {/* 帮助提示 */}
                <p className="text-xs text-foreground/40 mt-6">
                  如果问题持续存在，请尝试刷新页面或联系技术支持
                </p>
              </CardBody>
            </Card>
          </div>
        </GradientBackground>
      );
    }

    return this.props.children;
  }
}

export default InvestmentErrorBoundary;
