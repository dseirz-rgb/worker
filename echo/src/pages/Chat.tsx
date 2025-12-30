/**
 * AI 对话页面
 * 支持 Echo/Khoj/混合 三种对话模式
 */

import * as React from "react";
import { ChatMessage, ChatInput } from "@/components/chat";
import { ChatModeSelector, AgentSelector } from "@/components/khoj";
import { Button } from "@/components/ui/button";
import { streamChat, clearHistory, extractActionItems } from "@/services/ai/assistant";
import { unifiedChatService } from "@/services/chat/unifiedChat";
import { createNote } from "@/services/notes";
import { createTask } from "@/services/database/taskService";
import { loadKhojSettings } from "@/services/khoj/khojConfig";
import { initKhojClient, isKhojClientInitialized } from "@/services/khoj/khojClient";
import { Trash2, Sparkles, Settings2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

export function ChatPage() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [streamingContent, setStreamingContent] = React.useState("");
  const [showSettings, setShowSettings] = React.useState(false);
  const [khojEnabled, setKhojEnabled] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // 初始化 Khoj 客户端
  React.useEffect(() => {
    const settings = loadKhojSettings();
    if (settings.connection.enabled) {
      if (!isKhojClientInitialized()) {
        initKhojClient({
          baseUrl: settings.connection.baseUrl,
          apiKey: settings.connection.apiKey,
        });
      }
      setKhojEnabled(true);
    }
  }, []);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // 发送消息
  const handleSend = async (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setStreamingContent("");

    try {
      const mode = unifiedChatService.getMode();
      
      // 根据模式选择对话方式
      if (mode === 'echo' || !khojEnabled) {
        // 使用 Echo 原生流式对话
        let fullResponse = "";
        for await (const chunk of streamChat(content)) {
          fullResponse += chunk;
          setStreamingContent(fullResponse);
        }

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fullResponse,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setStreamingContent("");

        // 异步提取行动项
        extractAndSaveActionItems(fullResponse);
      } else {
        // 使用统一对话服务 (Khoj/混合模式)
        const response = await unifiedChatService.sendMessage(content, {
          includeMemory: true,
        });

        const assistantMessage: Message = {
          id: response.message.id,
          role: "assistant",
          content: response.message.content,
          sources: response.message.sources,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // 异步提取行动项
        extractAndSaveActionItems(response.message.content);
      }
    } catch (error) {
      console.error("发送消息失败:", error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "抱歉，发生了错误。请稍后再试。",
      };
      setMessages((prev) => [...prev, errorMessage]);
      setStreamingContent("");
    } finally {
      setIsLoading(false);
    }
  };

  // 提取并保存行动项
  const extractAndSaveActionItems = async (text: string) => {
    try {
      const items = await extractActionItems(text);
      
      // 保存任务
      for (const task of items.tasks) {
        await createTask({
          title: task.title,
          deadline: task.deadline,
          domain: "general",
        });
      }

      // 保存笔记
      for (const note of items.notes) {
        await createNote({
          content: note.content,
          domain: "general",
        });
      }

      if (items.tasks.length > 0 || items.notes.length > 0) {
        console.log(`已提取 ${items.tasks.length} 个任务，${items.notes.length} 条笔记`);
      }
    } catch (error) {
      console.warn("提取行动项失败:", error);
    }
  };

  // 清除对话
  const handleClear = () => {
    setMessages([]);
    clearHistory();
  };

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Echo AI</h1>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <Trash2 className="h-4 w-4 mr-1" />
              清除
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 对话设置面板 */}
      {showSettings && (
        <div className="p-3 border-b bg-muted/30 space-y-3">
          {/* 模式选择 */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">对话模式:</span>
            <ChatModeSelector className="flex-1 max-w-xs" />
          </div>
          
          {/* Agent 选择 (仅 Khoj 启用时显示) */}
          {khojEnabled && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">AI 助手:</span>
              <AgentSelector />
            </div>
          )}
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !streamingContent && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-medium mb-2">你好，我是 Echo</h2>
            <p className="text-muted-foreground max-w-md">
              我是你的 AI 个人助手，可以帮你记录想法、管理任务、提供建议。
              有什么我可以帮你的吗？
            </p>
            {khojEnabled && (
              <p className="text-xs text-muted-foreground mt-4">
                💡 已连接 Khoj 知识库，可使用混合模式获得更智能的回答
              </p>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            <ChatMessage role={msg.role} content={msg.content} />
            {/* 显示来源引用 */}
            {msg.sources && msg.sources.length > 0 && (
              <div className="px-4 pb-2 -mt-2">
                <details className="text-xs">
                  <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                    📚 {msg.sources.length} 个引用来源
                  </summary>
                  <div className="mt-2 space-y-1 pl-4 border-l-2 border-muted">
                    {msg.sources.map((source, idx) => (
                      <p key={idx} className="text-muted-foreground line-clamp-2">
                        {source}
                      </p>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        ))}

        {streamingContent && (
          <ChatMessage role="assistant" content={streamingContent} isStreaming />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  );
}

export default ChatPage;
