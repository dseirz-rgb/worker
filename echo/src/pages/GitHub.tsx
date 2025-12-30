/**
 * GitHub 集成页面
 */

import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { RepoCard } from '../components/github/RepoCard';
import { GitHubConfig } from '../components/github/GitHubConfig';
import {
  getUserRepos,
  getInactiveRepos,
  getGitHubConfig,
  type GitHubRepo,
} from '../services/github';
import { RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';

export default function GitHubPage() {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [inactiveRepos, setInactiveRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // 检查配置
  useEffect(() => {
    const config = getGitHubConfig();
    setIsConfigured(!!config?.token);
    if (config?.token) {
      loadData();
    }
  }, []);

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const [reposResult, inactiveResult] = await Promise.all([
        getUserRepos(),
        getInactiveRepos(30),
      ]);

      if (reposResult.success && reposResult.data) {
        setRepos(reposResult.data);
      }
      if (inactiveResult.success && inactiveResult.data) {
        setInactiveRepos(inactiveResult.data);
      }
    } catch (error) {
      console.error('加载 GitHub 数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 配置完成后刷新
  const handleConfigured = () => {
    setIsConfigured(true);
    setShowConfig(false);
    loadData();
  };

  return (
    <div className="p-4 space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">GitHub</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
          >
            配置
          </Button>
          {isConfigured && (
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      {/* 配置面板 */}
      {showConfig && <GitHubConfig onConfigured={handleConfigured} />}

      {/* 未配置提示 */}
      {!isConfigured && !showConfig && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">
              请先配置 GitHub Token 以使用此功能
            </p>
            <Button onClick={() => setShowConfig(true)}>配置 GitHub</Button>
          </CardContent>
        </Card>
      )}

      {/* 加载中 */}
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* 不活跃仓库提醒 */}
      {isConfigured && !loading && inactiveRepos.length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="h-4 w-4" />
              不活跃仓库 ({inactiveRepos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              以下仓库超过 30 天未更新
            </p>
            <div className="space-y-2">
              {inactiveRepos.slice(0, 5).map((repo) => (
                <RepoCard key={repo.id} repo={repo} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 仓库列表 */}
      {isConfigured && !loading && repos.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            所有仓库 ({repos.length})
          </h2>
          {repos.map((repo) => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      )}
    </div>
  );
}
