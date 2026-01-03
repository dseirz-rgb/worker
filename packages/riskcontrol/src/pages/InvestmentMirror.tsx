
import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ChatWindow } from '../components/chat/ChatWindow';
import { Shield, ArrowLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface InvestmentMirrorProps {
  embedded?: boolean;
  conversationId?: number | null;
}

export default function InvestmentMirror({ embedded = false, conversationId: externalConvId }: InvestmentMirrorProps) {
  const [match, params] = useRoute('/chat/:id');
  const [location, setLocation] = useLocation();
  const [currentConvId, setCurrentConvId] = useState<number | null>(match && params?.id ? parseInt(params.id) : null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sync with external prop if provided (for embedded mode)
  useEffect(() => {
    if (embedded && externalConvId !== undefined) {
      setCurrentConvId(externalConvId);
    }
  }, [embedded, externalConvId]);

  useEffect(() => {
    if (!embedded) {
        if (match && params?.id) {
            setCurrentConvId(parseInt(params.id));
        } else {
            setCurrentConvId(null);
        }
    }
  }, [match, params, embedded]);

  const handleSelectConversation = (convId: number) => {
    setCurrentConvId(convId);
    if (!embedded) {
      setLocation(`/chat/${convId}`);
    }
    // On mobile, close sidebar after selection
    if (window.innerWidth < 768) {
        setSidebarOpen(false);
    }
  };

  const handleNewConversation = () => {
    setCurrentConvId(null);
    if (!embedded) {
      setLocation('/chat');
    }
    // On mobile, close sidebar after new conversation
    if (window.innerWidth < 768) {
        setSidebarOpen(false);
    }
  };

  const handleConversationCreated = (convId: number) => {
    setCurrentConvId(convId);
    if (!embedded) {
      setLocation(`/chat/${convId}`, { replace: true });
    }
  };

  return (
    <div className="flex flex-col bg-bg-primary overflow-hidden h-full relative">
        {/* Header for Chat Page (Hide if embedded) - Mobile Only Navigation */}
        {!embedded && (
            <header className="border-b border-border bg-card/95 backdrop-blur flex items-center justify-between px-4 flex-shrink-0 z-40 md:hidden pt-safe transition-[padding] duration-200">
                <div className="flex items-center gap-3 h-14">
                    <button onClick={() => setLocation('/')} className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors" title="返回仪表板">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-blue flex items-center justify-center shadow-lg shadow-accent-cyan/20">
                            <Shield size={18} className="text-primary-foreground" />
                        </div>
                        <span className="font-bold text-foreground tracking-wide font-display">投资镜子</span>
                    </div>
                </div>
            </header>
        )}

        <div className="flex flex-1 overflow-hidden relative">
            {/* Mobile Sidebar Overlay */}
            <div 
                className={`fixed inset-0 z-20 bg-black/50 md:hidden ${sidebarOpen ? 'block' : 'hidden'}`} 
                onClick={() => setSidebarOpen(false)} 
            />
            
            {/* Sidebar Container */}
            <div 
                className={`
                    bg-bg-secondary border-r border-border h-full flex-shrink-0
                    /* Transitions */
                    transition-all duration-300 ease-in-out
                    
                    /* Mobile: Absolute Drawer */
                    absolute inset-y-0 left-0 z-30 md:relative md:z-auto
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                    
                    /* Desktop: Width Transition */
                    md:transform-none md:overflow-hidden
                    ${sidebarOpen ? 'md:w-64 md:opacity-100' : 'md:w-0 md:opacity-0 md:border-r-0'}
                `}
            >
                <div className="w-64 h-full"> {/* Inner wrapper to fix width during transition */}
                    <ChatSidebar 
                        currentId={currentConvId} 
                        onSelect={handleSelectConversation} 
                        onNew={handleNewConversation}
                    />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full w-full relative">
                
                {/* Unified Sidebar Toggle Button */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className={`
                        absolute top-3 left-3 z-20 p-2 rounded-lg
                        text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/80
                        transition-all duration-300 backdrop-blur-sm
                        ${!embedded ? 'top-16 md:top-3' : ''}
                        ${sidebarOpen ? 'md:opacity-50 md:hover:opacity-100 opacity-0 pointer-events-none md:pointer-events-auto' : 'opacity-100'}
                    `}
                    title={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
                >
                    {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                </button>

                <ChatWindow 
                    conversationId={currentConvId}
                    onConversationCreated={handleConversationCreated}
                />
            </div>
        </div>
    </div>
  );
}
