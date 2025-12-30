/**
 * 文件卡片组件
 */

import { Card, CardContent } from '../ui/card';
import { FileText, FileImage, FileCode, File, Folder } from 'lucide-react';
import type { FileIndex } from '../../services/files';

interface FileCardProps {
  file: FileIndex;
  highlights?: string[];
  score?: number;
  onClick?: () => void;
  onClassify?: () => void;
}

// 根据扩展名获取图标
function getFileIcon(extension: string) {
  const ext = extension.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return FileImage;
  }
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'rs', 'go', 'java'].includes(ext)) {
    return FileCode;
  }
  if (['txt', 'md', 'doc', 'docx', 'pdf'].includes(ext)) {
    return FileText;
  }
  return File;
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileCard({ file, highlights, score, onClick, onClassify }: FileCardProps) {
  const Icon = getFileIcon(file.extension);

  return (
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-secondary rounded-lg">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm truncate">{file.name}</p>
              {score !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {Math.round(score * 100)}% 匹配
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{file.path}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {formatSize(file.size)}
              </span>
              {file.domain && (
                <span className="text-xs px-1.5 py-0.5 bg-primary/10 rounded">
                  {file.domain}
                </span>
              )}
              {onClassify && (
                <button
                  onClick={(e) => { e.stopPropagation(); onClassify(); }}
                  className="text-xs text-primary hover:underline"
                >
                  AI 分类
                </button>
              )}
            </div>
            {/* 高亮匹配内容 */}
            {highlights && highlights.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                {highlights.slice(0, 2).map((h, i) => (
                  <p key={i} className="truncate">
                    ...{h}...
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 文件夹卡片
interface FolderCardProps {
  path: string;
  onRemove?: () => void;
}

export function FolderCard({ path, onRemove }: FolderCardProps) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-yellow-500" />
          <span className="text-sm truncate max-w-[200px]">{path}</span>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            移除
          </button>
        )}
      </CardContent>
    </Card>
  );
}
