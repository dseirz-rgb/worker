
import React, { useState, useEffect } from 'react';
import { useLocation } from "wouter";
import { 
  BrainCircuit, 
  BookOpen, 
  MessageSquare, 
  LineChart, 
  LayoutDashboard,
  Shield,
  Menu,
  X
} from 'lucide-react';
import DynamicNotes from './DynamicNotes';
import InvestmentMirror from './InvestmentMirror';
import AIAnalysisDashboard from '../components/decision/AIAnalysisDashboard';
import { cn } from '../lib/utils';

type DecisionTab = 'analysis' | 'knowledge' | 'chat';

export default function DecisionCenter() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<DecisionTab>('chat');

  // Route-based tab activation
  useEffect(() => {
    if (location.includes('/chat')) {
        setActiveTab('chat');
    } else if (location.includes('/notes') || location.includes('/knowledge')) {
        setActiveTab('knowledge');
    } else if (location.includes('/analysis')) {
        setActiveTab('analysis');
    }
  }, [location]);

  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);

  // Handle navigation from Knowledge Base to Chat
  const handleSelectConversation = (id: number) => {
    setSelectedConversationId(id);
    setLocation(`/chat`); // Route change will trigger tab update
  };

  return (
    <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-500">
        {/* Tabs Navigation */}
        <div className="flex items-center gap-2 p-1.5 mx-4 mt-2 bg-white/[0.03] rounded-xl border border-white/[0.06] w-fit">
            <NavTab 
                active={activeTab === 'analysis'} 
                onClick={() => setActiveTab('analysis')}
                icon={<LayoutDashboard size={16} />}
                label="研报分析"
            />
            <NavTab 
                active={activeTab === 'chat'} 
                onClick={() => setActiveTab('chat')}
                icon={<MessageSquare size={16} />}
                label="投资顾问"
            />
            <NavTab 
                active={activeTab === 'knowledge'} 
                onClick={() => setActiveTab('knowledge')}
                icon={<BookOpen size={16} />}
                label="知识库"
            />
        </div>

        {/* Content Container */}
        <div className="relative w-full flex-1 h-full overflow-hidden mt-2">
        
        {/* AI Analysis Tab */}
        <div className={cn(
          "transition-opacity duration-300 ease-in-out h-full",
          activeTab === 'analysis' ? "opacity-100 block" : "opacity-0 hidden"
        )}>
          <AIAnalysisDashboard />
        </div>

        {/* Knowledge Base Tab */}
        <div className={cn(
          "transition-opacity duration-300 ease-in-out h-full",
          activeTab === 'knowledge' ? "opacity-100 block" : "opacity-0 hidden"
        )}>
              <DynamicNotes 
                  embedded={true} 
                  onSelectConversation={handleSelectConversation}
              />
        </div>

        {/* Chat Tab */}
        <div className={cn(
          "transition-opacity duration-300 ease-in-out h-full flex flex-col",
          activeTab === 'chat' ? "opacity-100 block" : "opacity-0 hidden"
        )}>
            <InvestmentMirror 
              embedded={true} 
              conversationId={selectedConversationId}
            />
        </div>

      </div>
    </div>
  );
}

// Helper Components
function NavTab({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                active 
                    ? "bg-gradient-to-r from-cyan-500/20 to-cyan-500/10 text-cyan-400 shadow-lg shadow-cyan-500/10" 
                    : "text-white/50 hover:text-white/80 hover:bg-white/[0.05]"
            )}
        >
            {/* Active indicator glow */}
            {active && (
              <div className="absolute inset-0 rounded-lg bg-cyan-500/10 blur-sm" />
            )}
            <span className="relative">{icon}</span>
            <span className="relative">{label}</span>
        </button>
    );
}

function MobileNavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active 
                    ? "bg-cyan-500/10 text-cyan-400" 
                    : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
            )}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}
