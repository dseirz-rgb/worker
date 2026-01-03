
import React, { useState, useEffect } from 'react';
import { useLocation } from "wouter";
import { getClient } from '../services/supabaseData';
import { Button } from '../components/ui/button';
import { ArrowLeft, Save, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';

export default function UserProfile() {
  const [, setLocation] = useLocation();
  const supabase = getClient();
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('content')
        .eq('user_id', 1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
         console.error('Error fetching profile:', error);
      }
      
      if (data) {
        setContent(data.content || '');
      } else {
        // Default template
        setContent('## 投资风格\n稳健增长型\n\n## 风险偏好\n中等，最大回撤控制在 20% 以内。\n\n## 关注领域\n中概股、科技股、美债。');
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!supabase) return;
    setIsSaving(true);
    try {
      // Upsert
      const { error } = await supabase
        .from('user_profiles')
        .upsert({ 
            user_id: 1, 
            content,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('档案已保存');
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setLocation('/chat')} className="text-text-secondary hover:text-text-primary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回对话
          </Button>
          <div className="flex items-center gap-2">
             <User className="w-5 h-5 text-accent-cyan" />
             <h1 className="text-xl font-bold font-display">用户档案 (Profile)</h1>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-6 shadow-lg">
           <div className="flex justify-between items-center mb-6">
              <p className="text-sm text-text-secondary">
                 这里定义了您的投资人格。AI 会在每次回答时参考这些信息，以提供个性化的建议。
              </p>
              {isEditing ? (
                 <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>取消</Button>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-accent-cyan text-bg-primary hover:bg-accent-cyan/90">
                       {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                       保存档案
                    </Button>
                 </div>
              ) : (
                 <Button onClick={() => setIsEditing(true)} variant="outline">
                    编辑档案
                 </Button>
              )}
           </div>

           {isLoading ? (
               <div className="flex justify-center py-12">
                   <Loader2 className="w-8 h-8 animate-spin text-accent-cyan" />
               </div>
           ) : isEditing ? (
               <textarea 
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="w-full h-[500px] bg-bg-tertiary border border-border-primary rounded-lg p-4 text-sm font-mono focus:outline-none focus:border-accent-cyan"
                  placeholder="输入您的投资偏好..."
               />
           ) : (
               <div className="prose prose-invert max-w-none bg-bg-tertiary/30 p-6 rounded-lg border border-border-primary/50">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{content}</pre>
               </div>
           )}
        </div>
      </div>
    </div>
  );
}
