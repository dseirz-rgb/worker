/**
 * 笔记卡片组件
 * 深度参考 Blinko 的设计
 * 
 * 特点：
 * - 支持 Markdown 渲染
 * - 领域颜色标识
 * - 标签展示
 * - 快速操作（编辑、删除、归档、分享）
 * - 时间线视图支持
 * - AI 摘要展示
 */

import * as React from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Trash2, 
  Edit2, 
  Clock, 
  Archive, 
  Share2, 
  MoreHorizontal,
  Sparkles,
  Pin,
  Copy,
  ExternalLink,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note, LifeDomain } from "@/types/database";

// 领域配置
const DOMAIN_CONFIG: Record<LifeDomain, { color: string; bgColor: string; label: string; emoji: string }> = {
  work: { color: "text-blue-600", bgColor: "bg-blue-500", label: "工作", emoji: "💼" },
  investment: { color: "text-green-600", bgColor: "bg-green-500", label: "投资", emoji: "📈" },
  development: { color: "text-purple-600", bgColor: "bg-purple-500", label: "开发", emoji: "💻" },
  learning: { color: "text-yellow-600", bgColor: "bg-yellow-500", label: "学习", emoji: "📚" },
  family: { color: "text-pink-600", bgColor: "bg-pink-500", label: "家庭", emoji: "👨‍👩‍👧" },
  health: { color: "text-red-600", bgColor: "bg-red-500", label: "健康", emoji: "🏃" },
  entertainment: { color: "text-orange-600", bgColor: "bg-orange-500", label: "娱乐", emoji: "🎮" },
  general: { color: "text-gray-600", bgColor: "bg-gray-500", label: "通用", emoji: "📝" },
};

interface NoteCardProps {
  note: Note;
  onEdit?: (note: Note) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  onPin?: (id: string) => void;
  onShare?: (note: Note) => void;
  className?: string;
  variant?: "default" | "compact" | "timeline";
  showAiSummary?: boolean;
}

export function NoteCard({ 
  note, 
  onEdit, 
  onDelete, 
  onArchive,
  onPin,
  onShare,
  className,
  variant = "default",
  showAiSummary = false,
}: NoteCardProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const domainConfig = DOMAIN_CONFIG[note.domain];

  // 点击外部关闭菜单
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  // 格式化完整时间
  const formatFullTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 处理删除
  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(note.id);
    } finally {
      setIsDeleting(false);
      setShowMenu(false);
    }
  };

  // 复制内容
  const handleCopy = async () => {
    await navigator.clipboard.writeText(note.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowMenu(false);
  };

  // 简单的 Markdown 渲染（仅处理基本格式）
  const renderContent = (content: string) => {
    // 处理代码块
    let rendered = content.replace(/```([\s\S]*?)```/g, '<pre class="bg-muted p-2 rounded text-xs overflow-x-auto my-2"><code>$1</code></pre>');
    // 处理行内代码
    rendered = rendered.replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>');
    // 处理粗体
    rendered = rendered.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // 处理斜体
    rendered = rendered.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // 处理链接
    rendered = rendered.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline" target="_blank">$1</a>');
    // 处理换行
    rendered = rendered.replace(/\n/g, '<br/>');
    
    return rendered;
  };

  // 紧凑模式
  if (variant === "compact") {
    return (
      <div 
        className={cn(
          "flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group",
          className
        )}
        onClick={() => onEdit?.(note)}
      >
        <span className={cn("w-2 h-2 rounded-full mt-2 flex-shrink-0", domainConfig.bgColor)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm line-clamp-2">{note.content}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{formatTime(note.createdAt)}</span>
            {note.tags.length > 0 && (
              <span className="text-xs text-muted-foreground">
                #{note.tags[0]}{note.tags.length > 1 && ` +${note.tags.length - 1}`}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 时间线模式
  if (variant === "timeline") {
    return (
      <div className={cn("flex gap-4", className)}>
        {/* 时间线 */}
        <div className="flex flex-col items-center">
          <div className={cn("w-3 h-3 rounded-full", domainConfig.bgColor)} />
          <div className="w-0.5 flex-1 bg-border" />
        </div>
        
        {/* 内容 */}
        <div className="flex-1 pb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium">{domainConfig.emoji} {domainConfig.label}</span>
            <span className="text-xs text-muted-foreground">{formatTime(note.createdAt)}</span>
          </div>
          <Card className="group">
            <CardContent className="pt-3 pb-2">
              <div 
                className="text-sm prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: renderContent(note.content) }}
              />
              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {note.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs h-5">
                      <Hash className="h-2.5 w-2.5 mr-0.5" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 默认模式
  return (
    <Card className={cn("group hover:shadow-md transition-all", className)}>
      <CardContent className="pt-4">
        {/* 头部：领域 + 时间 + 菜单 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={cn("w-2 h-2 rounded-full", domainConfig.bgColor)} />
            <span className={cn("text-xs font-medium", domainConfig.color)}>
              {domainConfig.emoji} {domainConfig.label}
            </span>
            {note.isPinned && (
              <Pin className="h-3 w-3 text-amber-500 fill-amber-500" />
            )}
          </div>
          
          {/* 更多菜单 */}
          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-popover border rounded-md shadow-lg z-10 py-1">
                {onEdit && (
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                    onClick={() => { onEdit(note); setShowMenu(false); }}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    编辑
                  </button>
                )}
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                  onClick={handleCopy}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "已复制" : "复制"}
                </button>
                {onPin && (
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                    onClick={() => { onPin(note.id); setShowMenu(false); }}
                  >
                    <Pin className="h-3.5 w-3.5" />
                    {note.isPinned ? "取消置顶" : "置顶"}
                  </button>
                )}
                {onArchive && (
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                    onClick={() => { onArchive(note.id); setShowMenu(false); }}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    归档
                  </button>
                )}
                {onShare && (
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                    onClick={() => { onShare(note); setShowMenu(false); }}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    分享
                  </button>
                )}
                <div className="border-t my-1" />
                {onDelete && (
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* AI 摘要 */}
        {showAiSummary && note.aiSummary && (
          <div className="mb-2 p-2 bg-primary/5 rounded-md border border-primary/10">
            <div className="flex items-center gap-1 text-xs text-primary mb-1">
              <Sparkles className="h-3 w-3" />
              AI 摘要
            </div>
            <p className="text-xs text-muted-foreground">{note.aiSummary}</p>
          </div>
        )}

        {/* 笔记内容 */}
        <div 
          className="text-sm prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: renderContent(note.content) }}
        />

        {/* 标签 */}
        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {note.tags.map((tag) => (
              <Badge 
                key={tag} 
                variant="secondary" 
                className="text-xs cursor-pointer hover:bg-secondary/80"
              >
                <Hash className="h-2.5 w-2.5 mr-0.5" />
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* 链接预览 */}
        {note.links && note.links.length > 0 && (
          <div className="mt-3 space-y-2">
            {note.links.map((link, index) => (
              <a
                key={index}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-muted/50 rounded-md hover:bg-muted transition-colors text-xs"
              >
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{link}</span>
              </a>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 flex items-center justify-between text-xs text-muted-foreground">
        {/* 时间 */}
        <div className="flex items-center gap-1" title={formatFullTime(note.createdAt)}>
          <Clock className="h-3 w-3" />
          {formatTime(note.createdAt)}
        </div>

        {/* 快速操作按钮 */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onEdit(note)}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

export default NoteCard;
