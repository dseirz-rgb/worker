/**
 * 快速笔记输入组件
 * 支持快速捕捉闪念，200ms 内响应
 */

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, X, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LifeDomain, CreateNoteInput } from "@/types/database";

// 领域选项
const DOMAIN_OPTIONS: { value: LifeDomain; label: string; color: string }[] = [
  { value: "work", label: "工作", color: "bg-blue-500" },
  { value: "investment", label: "投资", color: "bg-green-500" },
  { value: "development", label: "开发", color: "bg-purple-500" },
  { value: "learning", label: "学习", color: "bg-yellow-500" },
  { value: "family", label: "家庭", color: "bg-pink-500" },
  { value: "health", label: "健康", color: "bg-red-500" },
  { value: "entertainment", label: "娱乐", color: "bg-orange-500" },
  { value: "general", label: "通用", color: "bg-gray-500" },
];

interface NoteInputProps {
  onSubmit: (input: CreateNoteInput) => Promise<void>;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function NoteInput({
  onSubmit,
  placeholder = "记录一个想法...",
  className,
  autoFocus = false,
}: NoteInputProps) {
  const [content, setContent] = React.useState("");
  const [domain, setDomain] = React.useState<LifeDomain>("general");
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showDomainPicker, setShowDomainPicker] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // 提交笔记
  const handleSubmit = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        content: trimmedContent,
        domain,
        tags,
        type: "text",
      });
      // 清空输入
      setContent("");
      setTags([]);
      setTagInput("");
      // 聚焦输入框
      textareaRef.current?.focus();
    } catch (error) {
      console.error("提交笔记失败:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter 提交
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  // 添加标签
  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  };

  // 移除标签
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // 处理标签输入键盘事件
  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  };

  const selectedDomain = DOMAIN_OPTIONS.find((d) => d.value === domain);

  return (
    <div className={cn("space-y-3", className)}>
      {/* 输入区域 */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="min-h-[100px] pr-12 resize-none"
          disabled={isSubmitting}
        />
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-2 bottom-2"
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 领域选择 */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDomainPicker(!showDomainPicker)}
            className="gap-1"
          >
            <span
              className={cn("w-2 h-2 rounded-full", selectedDomain?.color)}
            />
            {selectedDomain?.label}
          </Button>
          {showDomainPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-popover border rounded-md shadow-md z-10 grid grid-cols-2 gap-1">
              {DOMAIN_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={domain === option.value ? "secondary" : "ghost"}
                  size="sm"
                  className="justify-start gap-2"
                  onClick={() => {
                    setDomain(option.value);
                    setShowDomainPicker(false);
                  }}
                >
                  <span className={cn("w-2 h-2 rounded-full", option.color)} />
                  {option.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* 标签输入 */}
        <div className="flex items-center gap-1">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={addTag}
            placeholder="添加标签"
            className="w-20 h-8 px-2 text-sm bg-transparent border-none outline-none"
          />
        </div>

        {/* 已添加的标签 */}
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            <X
              className="h-3 w-3 cursor-pointer"
              onClick={() => removeTag(tag)}
            />
          </Badge>
        ))}
      </div>

      {/* 快捷键提示 */}
      <p className="text-xs text-muted-foreground">
        按 <kbd className="px-1 py-0.5 bg-muted rounded text-xs">⌘</kbd> +{" "}
        <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> 快速保存
      </p>
    </div>
  );
}
