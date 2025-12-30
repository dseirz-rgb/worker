/**
 * GitHub 配置组件
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { setGitHubConfig, getGitHubConfig, clearGitHubConfig } from '../../services/github';
import { Github, Check, X } from 'lucide-react';

interface GitHubConfigProps {
  onConfigured?: () => void;
}

export function GitHubConfig({ onConfigured }: GitHubConfigProps) {
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    const config = getGitHubConfig();
    if (config) {
      setToken(config.token);
      setUsername(config.username);
      setIsConfigured(true);
    }
  }, []);

  const handleSave = () => {
    if (token && username) {
      setGitHubConfig({ token, username });
      setIsConfigured(true);
      onConfigured?.();
    }
  };

  const handleClear = () => {
    clearGitHubConfig();
    setToken('');
    setUsername('');
    setIsConfigured(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Github className="h-4 w-4" />
          GitHub 配置
          {isConfigured && <Check className="h-4 w-4 text-green-500" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">用户名</label>
          <Input
            placeholder="GitHub 用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">
            Personal Access Token
          </label>
          <Input
            type="password"
            placeholder="ghp_xxxx..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            需要 repo 权限
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={!token || !username}>
            保存
          </Button>
          {isConfigured && (
            <Button size="sm" variant="outline" onClick={handleClear}>
              <X className="h-4 w-4 mr-1" />
              清除
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
