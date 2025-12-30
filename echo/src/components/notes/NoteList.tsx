/**
 * 笔记列表组件
 * 支持搜索、筛选和分页
 */

import * as React from "react";
import { NoteCard } from "./NoteCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note, LifeDomain } from "@/types/database";

// 领域选项
const DOMAIN_OPTIONS: { value: LifeDomain | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "work", label: "工作" },
  { value: "investment", label: "投资" },
  { value: "development", label: "开发" },
  { value: "learning", label: "学习" },
  { value: "family", label: "家庭" },
  { value: "health", label: "健康" },
  { value: "entertainment", label: "娱乐" },
  { value: "general", label: "通用" },
];

interface NoteListProps {
  notes: Note[];
  isLoading?: boolean;
  onSearch?: (keyword: string) => void;
  onFilterDomain?: (domain: LifeDomain | undefined) => void;
  onEdit?: (note: Note) => void;
  onDelete?: (id: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  className?: string;
}

export function NoteList({
  notes,
  isLoading = false,
  onSearch,
  onFilterDomain,
  onEdit,
  onDelete,
  onLoadMore,
  hasMore = false,
  className,
}: NoteListProps) {
  const [searchKeyword, setSearchKeyword] = React.useState("");
  const [selectedDomain, setSelectedDomain] = React.useState<LifeDomain | "all">("all");
  const [showFilters, setShowFilters] = React.useState(false);

  // 处理搜索
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchKeyword);
  };

  // 处理领域筛选
  const handleDomainFilter = (domain: LifeDomain | "all") => {
    setSelectedDomain(domain);
    onFilterDomain?.(domain === "all" ? undefined : domain);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* 搜索和筛选栏 */}
      <div className="flex gap-2">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索笔记..."
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            搜索
          </Button>
        </form>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(showFilters && "bg-accent")}
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* 领域筛选 */}
      {showFilters && (
        <div className="flex flex-wrap gap-2">
          {DOMAIN_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={selectedDomain === option.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleDomainFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}

      {/* 加载状态 */}
      {isLoading && notes.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && notes.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>还没有笔记</p>
          <p className="text-sm mt-1">记录你的第一个想法吧</p>
        </div>
      )}

      {/* 笔记列表 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* 加载更多 */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                加载中...
              </>
            ) : (
              "加载更多"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
