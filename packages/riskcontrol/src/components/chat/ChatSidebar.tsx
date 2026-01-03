
import React, { useEffect, useState } from 'react';
import { useLocation } from "wouter";
import { Plus, MessageSquare, Trash2, MoreHorizontal, Book, ChevronRight } from 'lucide-react';
import { getClient } from '../../services/supabaseData';
import type { Conversation } from '../../types';
import { Dialog, DialogTrigger, DialogContent } from '../ui/dialog';

interface ChatSidebarProps {
  currentId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
}

export function ChatSidebar({ currentId, onSelect, onNew }: ChatSidebarProps) {
  const [, setLocation] = useLocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const supabase = getClient();

  useEffect(() => {
    fetchConversations();
    // Subscribe to changes? For now just fetch on mount.
    // Ideally we should have a real-time subscription or a refresh trigger.
  }, [currentId]); // Refresh when ID changes (e.g. after new chat)

  async function fetchConversations() {
    if (!supabase) return;
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', 1)
      .order('updated_at', { ascending: false });
    
    if (data) {
        const mapped = data.map(d => ({
            id: d.id,
            userId: d.user_id,
            title: d.title,
            createdAt: d.created_at,
            updatedAt: d.updated_at
        }));
        setConversations(mapped);
    }
  }

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    if (!confirm('确定要删除这个对话吗？')) return;
    
    if (!supabase) return;
    await supabase.from('conversations').delete().eq('id', id);
    if (currentId === id) onNew();
    fetchConversations();
  }

  // Group conversations by date
  const groupedConversations = conversations.reduce((groups, conv) => {
      const date = new Date(conv.updatedAt || conv.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let key = 'Earlier';
      if (date.toDateString() === today.toDateString()) key = 'Today';
      else if (date.toDateString() === yesterday.toDateString()) key = 'Yesterday';
      else if (date > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) key = 'Previous 7 Days';

      if (!groups[key]) groups[key] = [];
      groups[key].push(conv);
      return groups;
  }, {} as Record<string, Conversation[]>);

  const groupOrder = ['Today', 'Yesterday', 'Previous 7 Days', 'Earlier'];
  const groupLabels: Record<string, string> = {
      'Today': '今天',
      'Yesterday': '昨天',
      'Previous 7 Days': '过去 7 天',
      'Earlier': '更早'
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary border-r border-border w-64 flex-shrink-0">
      {/* Header / New Chat */}
      <div className="p-4">
        <button 
          onClick={onNew}
          className="w-full flex items-center gap-3 bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-primary border border-border rounded-xl py-3 px-4 transition-all shadow-sm hover:shadow-md group"
        >
          <div className="p-1 bg-accent-cyan/10 rounded-full text-accent-cyan group-hover:scale-110 transition-transform">
             <Plus size={16} />
          </div>
          <span className="font-medium text-sm">开启新对话</span>
        </button>
      </div>
      
      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6 scrollbar-hide">
        {conversations.length === 0 && (
          <div className="text-center text-text-muted text-xs py-8 opacity-50">
            暂无历史对话<br/>开始一次新的探索吧
          </div>
        )}
        
        {groupOrder.map(key => {
            const groupConvs = groupedConversations[key];
            if (!groupConvs || groupConvs.length === 0) return null;

            return (
                <div key={key}>
                    <div className="px-3 mb-2 text-[10px] font-bold text-text-muted/70 uppercase tracking-wider">
                        {groupLabels[key]}
                    </div>
                    <div className="space-y-1">
                        {groupConvs.map(conv => (
                            <div 
                                key={conv.id}
                                onClick={() => onSelect(conv.id)}
                                className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                                currentId === conv.id 
                                    ? 'bg-accent-cyan/10 text-accent-cyan font-medium' 
                                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                                }`}
                            >
                                <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                    <MessageSquare size={16} className={`flex-shrink-0 ${currentId === conv.id ? 'text-accent-cyan' : 'text-text-muted/70'}`} />
                                    <span className="truncate text-sm">
                                        {conv.title || '新对话'}
                                    </span>
                                </div>
                                
                                {currentId === conv.id ? (
                                     <ChevronRight size={14} className="opacity-50 flex-shrink-0" />
                                ) : (
                                    <button 
                                        onClick={(e) => handleDelete(e, conv.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-primary rounded text-text-muted hover:text-accent-red transition-all flex-shrink-0"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            );
        })}
      </div>

      {/* Footer / Knowledge Base */}
      <div className="p-4 border-t border-border mt-auto">
        <button 
            onClick={() => setLocation('/notes')}
            className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-bg-tertiary text-text-secondary transition-colors text-left group"
        >
            <div className="w-8 h-8 rounded-full bg-accent-purple/10 flex items-center justify-center text-accent-purple group-hover:scale-110 transition-transform">
                <Book size={16} />
            </div>
            <div className="flex-1">
                <div className="text-sm font-medium text-text-primary">投资笔记库</div>
                <div className="text-[10px] text-text-muted">管理 RAG 知识库</div>
            </div>
        </button>
      </div>
    </div>
  );
}
