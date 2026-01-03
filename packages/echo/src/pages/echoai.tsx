/**
 * EchoAI 助手页面
 * 原生 React 组件实现，基于 Mastra AI 服务
 */

import { observer } from 'mobx-react-lite';
import { ChatPage } from '@/components/echoai/ChatPage';

/**
 * EchoAI 页面 - Mastra AI 服务始终可用，无需状态检查
 */
const EchoAIPage = observer(() => {
  return <ChatPage showSidebar={true} />;
});

export default EchoAIPage;
