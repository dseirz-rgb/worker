/**
 * Echo v3.2: 建议系统引擎
 * 负责生成、管理和响应用户建议
 */

import { prisma } from '../prisma';
import { AiModelFactory } from './aiModelFactory';
import { subDays, addMinutes, addHours, addDays } from 'date-fns';

// 建议类型
export type SuggestionType = 'task' | 'reminder' | 'habit' | 'insight';
export type SuggestionPriority = 'high' | 'medium' | 'low';
export type SuggestionStatus = 'pending' | 'accepted' | 'postponed' | 'rejected';
export type SuggestionAction = 'accept' | 'postpone' | 'reject';

// 建议接口
export interface Suggestion {
  id: number;
  type: SuggestionType;
  content: string;
  source: string | null;
  priority: SuggestionPriority;
  status: SuggestionStatus;
  postponedUntil: Date | null;
  rejectReason: string | null;
  createdAt: Date;
  respondedAt: Date | null;
}

// 建议统计
export interface SuggestionStats {
  total: number;
  accepted: number;
  rejected: number;
  postponed: number;
  pending: number;
  acceptRate: number;
  rejectRate: number;
}

// 建议响应参数
export interface SuggestionResponse {
  suggestionId: number;
  action: SuggestionAction;
  reason?: string;           // 拒绝原因
  postponeDuration?: number; // 推迟时长 (分钟)
}

/**
 * 建议引擎类
 */
export class SuggestionEngine {
  private accountId: number;

  constructor(accountId: number) {
    this.accountId = accountId;
  }

  /**
   * 生成建议
   * 基于任务历史、笔记内容和活动数据
   */
  async generateSuggestions(): Promise<Suggestion[]> {
    const suggestions: Array<{
      type: SuggestionType;
      content: string;
      source: string;
      priority: SuggestionPriority;
    }> = [];

    // 1. 基于任务历史生成建议
    const taskSuggestions = await this.generateTaskBasedSuggestions();
    suggestions.push(...taskSuggestions);

    // 2. 基于笔记内容生成建议
    const noteSuggestions = await this.generateNoteBasedSuggestions();
    suggestions.push(...noteSuggestions);

    // 3. 基于活动数据生成建议
    const activitySuggestions = await this.generateActivityBasedSuggestions();
    suggestions.push(...activitySuggestions);

    // 保存建议到数据库
    const savedSuggestions = await Promise.all(
      suggestions.map(s => this.saveSuggestion(s))
    );

    return savedSuggestions;
  }

  /**
   * 响应建议
   */
  async respondToSuggestion(response: SuggestionResponse): Promise<Suggestion> {
    const { suggestionId, action, reason, postponeDuration } = response;

    // 获取建议
    const suggestion = await prisma.suggestion.findFirst({
      where: { id: suggestionId, accountId: this.accountId },
    });

    if (!suggestion) {
      throw new Error('建议不存在');
    }

    if (suggestion.status !== 'pending') {
      throw new Error('建议已被处理');
    }

    // 根据操作更新状态
    const updateData: any = {
      respondedAt: new Date(),
    };

    switch (action) {
      case 'accept':
        updateData.status = 'accepted';
        // 如果是任务类型，创建待办事项
        if (suggestion.type === 'task') {
          await this.createTaskFromSuggestion(suggestion);
        }
        break;

      case 'postpone':
        updateData.status = 'postponed';
        // 计算推迟时间
        const duration = postponeDuration || 60; // 默认 1 小时
        updateData.postponedUntil = addMinutes(new Date(), duration);
        break;

      case 'reject':
        updateData.status = 'rejected';
        updateData.rejectReason = reason || null;
        break;
    }

    const updated = await prisma.suggestion.update({
      where: { id: suggestionId },
      data: updateData,
    });

    return updated as Suggestion;
  }

  /**
   * 获取待处理建议
   */
  async getPendingSuggestions(limit: number = 5): Promise<Suggestion[]> {
    // 获取 pending 状态的建议，以及推迟时间已过的建议
    const suggestions = await prisma.suggestion.findMany({
      where: {
        accountId: this.accountId,
        OR: [
          { status: 'pending' },
          {
            status: 'postponed',
            postponedUntil: { lte: new Date() },
          },
        ],
      },
      orderBy: [
        { priority: 'asc' }, // high < medium < low
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    // 将推迟后到期的建议状态改回 pending
    const postponedIds = suggestions
      .filter(s => s.status === 'postponed')
      .map(s => s.id);

    if (postponedIds.length > 0) {
      await prisma.suggestion.updateMany({
        where: { id: { in: postponedIds } },
        data: { status: 'pending' },
      });
    }

    return suggestions as Suggestion[];
  }

  /**
   * 获取建议统计
   */
  async getStats(): Promise<SuggestionStats> {
    const [total, accepted, rejected, postponed, pending] = await Promise.all([
      prisma.suggestion.count({ where: { accountId: this.accountId } }),
      prisma.suggestion.count({ where: { accountId: this.accountId, status: 'accepted' } }),
      prisma.suggestion.count({ where: { accountId: this.accountId, status: 'rejected' } }),
      prisma.suggestion.count({ where: { accountId: this.accountId, status: 'postponed' } }),
      prisma.suggestion.count({ where: { accountId: this.accountId, status: 'pending' } }),
    ]);

    const responded = accepted + rejected;
    const acceptRate = responded > 0 ? accepted / responded : 0;
    const rejectRate = responded > 0 ? rejected / responded : 0;

    return {
      total,
      accepted,
      rejected,
      postponed,
      pending,
      acceptRate: Math.round(acceptRate * 100) / 100,
      rejectRate: Math.round(rejectRate * 100) / 100,
    };
  }

  // ============ 私有方法 ============

  private async generateTaskBasedSuggestions() {
    const suggestions: Array<{
      type: SuggestionType;
      content: string;
      source: string;
      priority: SuggestionPriority;
    }> = [];

    // 获取最近 7 天的任务
    const recentTasks = await prisma.notes.findMany({
      where: {
        accountId: this.accountId,
        type: 1,
        createdAt: { gte: subDays(new Date(), 7) },
      },
    });

    // 分析未完成任务
    const pendingTasks = recentTasks.filter(t => !t.isArchived && !t.isRecycle);
    const completedTasks = recentTasks.filter(t => t.isArchived);

    // 如果有长期未完成的任务
    const oldPendingTasks = pendingTasks.filter(
      t => t.createdAt < subDays(new Date(), 3)
    );

    if (oldPendingTasks.length > 0) {
      suggestions.push({
        type: 'task',
        content: `你有 ${oldPendingTasks.length} 个任务已创建超过 3 天未完成，建议重新评估优先级或拆分任务`,
        source: '任务分析',
        priority: 'high',
      });
    }

    // 如果完成率较低
    const completionRate = recentTasks.length > 0
      ? completedTasks.length / recentTasks.length
      : 0;

    if (completionRate < 0.5 && recentTasks.length >= 5) {
      suggestions.push({
        type: 'habit',
        content: '最近一周任务完成率较低，建议减少每日任务数量，提高专注度',
        source: '任务分析',
        priority: 'medium',
      });
    }

    return suggestions;
  }

  private async generateNoteBasedSuggestions() {
    const suggestions: Array<{
      type: SuggestionType;
      content: string;
      source: string;
      priority: SuggestionPriority;
    }> = [];

    // 获取最近笔记
    const recentNotes = await prisma.notes.findMany({
      where: {
        accountId: this.accountId,
        type: 0,
        createdAt: { gte: subDays(new Date(), 7) },
        isRecycle: false,
      },
      include: { tags: { include: { tag: true } } },
    });

    // 如果最近没有记录笔记
    if (recentNotes.length === 0) {
      suggestions.push({
        type: 'reminder',
        content: '最近一周没有记录笔记，建议养成每日记录的习惯',
        source: '笔记分析',
        priority: 'low',
      });
    }

    // 分析标签使用情况
    const tagCounts = new Map<string, number>();
    recentNotes.forEach(note => {
      note.tags?.forEach((t: any) => {
        tagCounts.set(t.tag.name, (tagCounts.get(t.tag.name) || 0) + 1);
      });
    });

    // 如果有高频标签，生成洞察
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (topTags.length > 0 && topTags[0][1] >= 3) {
      suggestions.push({
        type: 'insight',
        content: `最近你关注较多的主题是「${topTags[0][0]}」，可以考虑深入整理相关笔记`,
        source: '笔记分析',
        priority: 'low',
      });
    }

    return suggestions;
  }

  private async generateActivityBasedSuggestions() {
    const suggestions: Array<{
      type: SuggestionType;
      content: string;
      source: string;
      priority: SuggestionPriority;
    }> = [];

    // 获取最近活动记录
    const activities = await prisma.activityRecord.findMany({
      where: {
        accountId: this.accountId,
        startTime: { gte: subDays(new Date(), 7) },
      },
      include: { domain: true },
    });

    if (activities.length === 0) return suggestions;

    // 计算总时长
    const totalDuration = activities.reduce((sum, a) => sum + a.duration, 0) / 3600; // 小时

    // 如果每日平均使用时间过长
    if (totalDuration / 7 > 8) {
      suggestions.push({
        type: 'habit',
        content: '最近每日平均屏幕时间超过 8 小时，建议适当休息',
        source: '活动分析',
        priority: 'medium',
      });
    }

    return suggestions;
  }

  private async saveSuggestion(suggestion: {
    type: SuggestionType;
    content: string;
    source: string;
    priority: SuggestionPriority;
  }): Promise<Suggestion> {
    // 检查是否已存在相同内容的建议
    const existing = await prisma.suggestion.findFirst({
      where: {
        accountId: this.accountId,
        content: suggestion.content,
        status: 'pending',
      },
    });

    if (existing) {
      return existing as Suggestion;
    }

    return prisma.suggestion.create({
      data: {
        ...suggestion,
        accountId: this.accountId,
      },
    }) as Promise<Suggestion>;
  }

  private async createTaskFromSuggestion(suggestion: any) {
    // 从建议内容创建待办事项
    await prisma.notes.create({
      data: {
        type: 1, // 待办类型
        content: `[来自建议] ${suggestion.content}`,
        accountId: this.accountId,
      },
    });
  }
}

/**
 * 创建建议引擎实例
 */
export function createSuggestionEngine(accountId: number): SuggestionEngine {
  return new SuggestionEngine(accountId);
}
