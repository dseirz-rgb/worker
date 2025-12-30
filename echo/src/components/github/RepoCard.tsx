/**
 * GitHub 仓库卡片
 */

import { Card, CardContent } from '../ui/card';
import { Star, GitFork, AlertCircle, ExternalLink } from 'lucide-react';
import type { GitHubRepo } from '../../services/github';

interface RepoCardProps {
  repo: GitHubRepo;
}

export function RepoCard({ repo }: RepoCardProps) {
  // 计算距离上次更新的天数
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(repo.pushedAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  // 判断是否不活跃
  const isInactive = daysSinceUpdate > 30;

  return (
    <Card className={isInactive ? 'border-yellow-500/50' : ''}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <a
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-sm hover:underline truncate"
              >
                {repo.name}
              </a>
              <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            </div>
            {repo.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {repo.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2">
              {repo.language && (
                <span className="text-xs px-1.5 py-0.5 bg-primary/10 rounded">
                  {repo.language}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3 w-3" />
                {repo.stars}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <GitFork className="h-3 w-3" />
                {repo.forks}
              </span>
              {repo.openIssues > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <AlertCircle className="h-3 w-3" />
                  {repo.openIssues}
                </span>
              )}
            </div>
          </div>
          {isInactive && (
            <span className="text-xs text-yellow-500 flex-shrink-0">
              {daysSinceUpdate}天未更新
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
