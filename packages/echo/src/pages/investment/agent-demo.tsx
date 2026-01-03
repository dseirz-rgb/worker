/**
 * 投资模块 - Agent 演示页面
 * AI Agent 演示（开发用）
 */

import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardBody, CardHeader, Button, Textarea, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { GradientBackground } from '@/components/Common/GradientBackground';

const AgentDemoPage = observer(() => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    // 模拟 AI 响应
    await new Promise(resolve => setTimeout(resolve, 1500));
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: `这是对「${userMessage}」的模拟响应。\n\nAI Agent 功能正在开发中，敬请期待！` 
    }]);
    setIsLoading(false);
  };

  return (
    <GradientBackground className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/investment">
            <Button isIconOnly variant="light" size="sm">
              <Icon icon="mdi:arrow-left" className="text-xl" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Icon icon="mdi:robot" className="text-secondary" />
              Agent 演示
            </h1>
            <p className="text-foreground/60 mt-1">AI Agent 交互演示</p>
          </div>
        </div>

        {/* 对话区域 */}
        <Card className="bg-content1/50 backdrop-blur-sm min-h-[400px]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Icon icon="mdi:chat" className="text-xl text-primary" />
              <h2 className="font-semibold">对话</h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-foreground/50">
                <Icon icon="mdi:robot-happy" className="text-5xl mb-3 mx-auto" />
                <p>开始与 AI Agent 对话</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-content2'
                      }`}
                    >
                      <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-content2 p-3 rounded-lg">
                      <Spinner size="sm" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* 输入区域 */}
        <Card className="bg-content1/50 backdrop-blur-sm">
          <CardBody className="p-4">
            <div className="flex gap-3">
              <Textarea
                placeholder="输入您的问题..."
                value={input}
                onValueChange={setInput}
                minRows={1}
                maxRows={4}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                color="primary"
                isIconOnly
                isDisabled={!input.trim() || isLoading}
                onPress={handleSend}
              >
                <Icon icon="mdi:send" />
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </GradientBackground>
  );
});

export default AgentDemoPage;
