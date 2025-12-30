/**
 * GitHub 集成服务
 * 监控 GitHub 仓库活动
 */

import type { DbResult } from '../../types/database';

// GitHub 配置
interface GitHubConfig {
  token: string;
  username: string;
}

// 仓库信息
export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  updatedAt: string;
  pushedAt: string;
}

// 活动事件
export interface GitHubEvent {
  id: string;
  type: string;
  repo: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

// 仓库统计
export interface RepoStats {
  commits: number;
  pullRequests: number;
  issues: number;
  lastActivity: string;
}

// 存储配置
let config: GitHubConfig | null = null;

/**
 * 设置 GitHub 配置
 */
export function setGitHubConfig(newConfig: GitHubConfig): void {
  config = newConfig;
  localStorage.setItem('github_config', JSON.stringify(newConfig));
}

/**
 * 获取 GitHub 配置
 */
export function getGitHubConfig(): GitHubConfig | null {
  if (config) return config;
  const stored = localStorage.getItem('github_config');
  if (stored) {
    config = JSON.parse(stored);
    return config;
  }
  return null;
}

/**
 * 清除 GitHub 配置
 */
export function clearGitHubConfig(): void {
  config = null;
  localStorage.removeItem('github_config');
}

/**
 * GitHub API 请求
 */
async function githubFetch<T>(endpoint: string): Promise<DbResult<T>> {
  const cfg = getGitHubConfig();
  if (!cfg?.token) {
    return { success: false, error: '未配置 GitHub Token' };
  }

  try {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return { success: false, error: `GitHub API 错误: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('GitHub API 请求失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'GitHub API 请求失败',
    };
  }
}

/**
 * 获取用户仓库列表
 */
export async function getUserRepos(): Promise<DbResult<GitHubRepo[]>> {
  const result = await githubFetch<Record<string, unknown>[]>('/user/repos?sort=updated&per_page=50');
  if (!result.success || !result.data) return { success: false, error: result.error };

  const repos = result.data.map((repo) => ({
    id: repo.id as number,
    name: repo.name as string,
    fullName: repo.full_name as string,
    description: repo.description as string | null,
    url: repo.html_url as string,
    language: repo.language as string | null,
    stars: repo.stargazers_count as number,
    forks: repo.forks_count as number,
    openIssues: repo.open_issues_count as number,
    updatedAt: repo.updated_at as string,
    pushedAt: repo.pushed_at as string,
  }));

  return { success: true, data: repos };
}

/**
 * 获取用户活动事件
 */
export async function getUserEvents(): Promise<DbResult<GitHubEvent[]>> {
  const cfg = getGitHubConfig();
  if (!cfg?.username) {
    return { success: false, error: '未配置 GitHub 用户名' };
  }

  const result = await githubFetch<Record<string, unknown>[]>(`/users/${cfg.username}/events?per_page=30`);
  if (!result.success || !result.data) return { success: false, error: result.error };

  const events = result.data.map((event) => ({
    id: event.id as string,
    type: event.type as string,
    repo: (event.repo as Record<string, string>).name,
    createdAt: event.created_at as string,
    payload: event.payload as Record<string, unknown>,
  }));

  return { success: true, data: events };
}

/**
 * 获取仓库统计
 */
export async function getRepoStats(owner: string, repo: string): Promise<DbResult<RepoStats>> {
  try {
    // 获取提交数
    const commitsResult = await githubFetch<unknown[]>(`/repos/${owner}/${repo}/commits?per_page=1`);
    
    // 获取 PR 数
    const prsResult = await githubFetch<unknown[]>(`/repos/${owner}/${repo}/pulls?state=all&per_page=1`);
    
    // 获取 Issue 数
    const issuesResult = await githubFetch<unknown[]>(`/repos/${owner}/${repo}/issues?state=all&per_page=1`);
    
    // 获取仓库信息
    const repoResult = await githubFetch<Record<string, unknown>>(`/repos/${owner}/${repo}`);

    return {
      success: true,
      data: {
        commits: commitsResult.success ? (commitsResult.data?.length || 0) : 0,
        pullRequests: prsResult.success ? (prsResult.data?.length || 0) : 0,
        issues: issuesResult.success ? (issuesResult.data?.length || 0) : 0,
        lastActivity: repoResult.success ? (repoResult.data?.pushed_at as string) : '',
      },
    };
  } catch (error) {
    console.error('获取仓库统计失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取仓库统计失败',
    };
  }
}

/**
 * 检查不活跃仓库
 * 返回超过指定天数未更新的仓库
 */
export async function getInactiveRepos(days: number = 30): Promise<DbResult<GitHubRepo[]>> {
  const result = await getUserRepos();
  if (!result.success || !result.data) return result;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const inactiveRepos = result.data.filter((repo) => {
    const pushedAt = new Date(repo.pushedAt);
    return pushedAt < cutoffDate;
  });

  return { success: true, data: inactiveRepos };
}
