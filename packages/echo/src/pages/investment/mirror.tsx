/**
 * 投资模块 - 投资镜像页面
 * 
 * AI 投资对话助手，支持上下文引用（研报、简报、持仓）
 * 复用 Echo AI 的 UI 组件，调用 Investment Agent API
 * 
 * @module @echoai/pages/investment/mirror
 */

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InvestmentChatPage } from '@/components/InvestmentChat/InvestmentChatPage';
import { useInvestmentStore } from '@/store';

const InvestmentMirrorPage = () => {
  const [searchParams] = useSearchParams();
  const conversationId = searchParams.get('conversation');
  const investmentStore = useInvestmentStore();

  // 初始化时加载投资数据（用于上下文）
  useEffect(() => {
    investmentStore.fetchPositions();
    investmentStore.fetchRiskMetrics();
  }, [investmentStore]);

  return (
    <div className="h-full overflow-hidden">
      <InvestmentChatPage 
        initialConversationId={conversationId || undefined}
        showSidebar={true}
      />
    </div>
  );
};

export default InvestmentMirrorPage;
