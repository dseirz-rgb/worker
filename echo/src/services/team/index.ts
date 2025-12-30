/**
 * 团队管理服务
 * 管理团队成员、1:1 会议、任务分配和管理技能追踪
 */

import { getGeminiClient } from '../ai/gemini';
import type {
  DbResult,
  TeamMember,
  CreateTeamMemberInput,
  UpdateTeamMemberInput,
  OneOnOneRecord,
  CreateOneOnOneInput,
  TaskAssignment,
  CreateTaskAssignmentInput,
  WorkloadStats,
  ManagementSkillRecord,
  CreateManagementSkillInput,
} from '../../types/database';

// ============== 本地存储 Keys ==============
const TEAM_MEMBERS_KEY = 'echo_team_members';
const ONE_ON_ONE_KEY = 'echo_one_on_one_records';
const TASK_ASSIGNMENTS_KEY = 'echo_task_assignments';
const MANAGEMENT_SKILLS_KEY = 'echo_management_skills';

// ============== 存储辅助函数 ==============

function loadFromStorage<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveToStorage<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// ============== 团队成员管理 ==============

/**
 * 获取所有团队成员
 */
export function getTeamMembers(): TeamMember[] {
  return loadFromStorage<TeamMember>(TEAM_MEMBERS_KEY);
}

/**
 * 获取单个团队成员
 */
export function getTeamMember(id: string): TeamMember | undefined {
  const members = getTeamMembers();
  return members.find(m => m.id === id);
}

/**
 * 创建团队成员
 */
export function createTeamMember(input: CreateTeamMemberInput): DbResult<TeamMember> {
  if (!input.name) {
    return { success: false, error: '成员姓名不能为空' };
  }

  const member: TeamMember = {
    id: Date.now().toString(),
    name: input.name,
    role: input.role,
    email: input.email,
    phone: input.phone,
    skills: input.skills || [],
    preferences: input.preferences || {},
    joinDate: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  };

  const members = getTeamMembers();
  members.push(member);
  saveToStorage(TEAM_MEMBERS_KEY, members);

  return { success: true, data: member };
}

/**
 * 更新团队成员
 */
export function updateTeamMember(
  id: string,
  input: UpdateTeamMemberInput
): DbResult<TeamMember> {
  const members = getTeamMembers();
  const index = members.findIndex(m => m.id === id);

  if (index === -1) {
    return { success: false, error: '成员不存在' };
  }

  const updated: TeamMember = {
    ...members[index],
    ...input,
    skills: input.skills ?? members[index].skills,
    preferences: input.preferences ?? members[index].preferences,
  };

  members[index] = updated;
  saveToStorage(TEAM_MEMBERS_KEY, members);

  return { success: true, data: updated };
}

/**
 * 删除团队成员
 */
export function deleteTeamMember(id: string): DbResult<void> {
  const members = getTeamMembers();
  const filtered = members.filter(m => m.id !== id);

  if (filtered.length === members.length) {
    return { success: false, error: '成员不存在' };
  }

  saveToStorage(TEAM_MEMBERS_KEY, filtered);

  // 同时删除相关的 1:1 记录和任务分配
  const oneOnOnes = getOneOnOneRecords().filter(r => r.memberId !== id);
  saveToStorage(ONE_ON_ONE_KEY, oneOnOnes);

  const assignments = getTaskAssignments().filter(a => a.memberId !== id);
  saveToStorage(TASK_ASSIGNMENTS_KEY, assignments);

  return { success: true };
}

// ============== 1:1 会议管理 ==============

/**
 * 获取所有 1:1 记录
 */
export function getOneOnOneRecords(memberId?: string): OneOnOneRecord[] {
  const records = loadFromStorage<OneOnOneRecord>(ONE_ON_ONE_KEY);
  if (memberId) {
    return records.filter(r => r.memberId === memberId);
  }
  return records.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * 获取单个 1:1 记录
 */
export function getOneOnOneRecord(id: string): OneOnOneRecord | undefined {
  const records = getOneOnOneRecords();
  return records.find(r => r.id === id);
}

/**
 * 创建 1:1 记录
 */
export function createOneOnOneRecord(input: CreateOneOnOneInput): DbResult<OneOnOneRecord> {
  const member = getTeamMember(input.memberId);
  if (!member) {
    return { success: false, error: '成员不存在' };
  }

  const record: OneOnOneRecord = {
    id: Date.now().toString(),
    memberId: input.memberId,
    date: input.date || new Date().toISOString().split('T')[0],
    topics: input.topics || [],
    notes: input.notes,
    actionItems: input.actionItems || [],
    mood: input.mood,
    createdAt: new Date().toISOString(),
  };

  const records = getOneOnOneRecords();
  records.push(record);
  saveToStorage(ONE_ON_ONE_KEY, records);

  // 更新成员的最后 1:1 日期
  updateTeamMember(input.memberId, { lastOneOnOne: record.date });

  return { success: true, data: record };
}

/**
 * 删除 1:1 记录
 */
export function deleteOneOnOneRecord(id: string): DbResult<void> {
  const records = getOneOnOneRecords();
  const filtered = records.filter(r => r.id !== id);

  if (filtered.length === records.length) {
    return { success: false, error: '记录不存在' };
  }

  saveToStorage(ONE_ON_ONE_KEY, filtered);
  return { success: true };
}

/**
 * 获取需要安排 1:1 的成员
 * 超过指定天数未进行 1:1 的成员
 */
export function getMembersNeedingOneOnOne(daysSinceLastMeeting: number = 14): TeamMember[] {
  const members = getTeamMembers();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastMeeting);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  return members.filter(m => {
    if (!m.lastOneOnOne) return true;
    return m.lastOneOnOne < cutoffStr;
  });
}

// ============== 任务分配管理 ==============

/**
 * 获取所有任务分配
 */
export function getTaskAssignments(memberId?: string): TaskAssignment[] {
  const assignments = loadFromStorage<TaskAssignment>(TASK_ASSIGNMENTS_KEY);
  if (memberId) {
    return assignments.filter(a => a.memberId === memberId);
  }
  return assignments;
}

/**
 * 获取单个任务分配
 */
export function getTaskAssignment(id: string): TaskAssignment | undefined {
  const assignments = getTaskAssignments();
  return assignments.find(a => a.id === id);
}

/**
 * 获取任务的分配信息
 */
export function getAssignmentByTaskId(taskId: string): TaskAssignment | undefined {
  const assignments = getTaskAssignments();
  return assignments.find(a => a.taskId === taskId);
}

/**
 * 创建任务分配
 */
export function createTaskAssignment(input: CreateTaskAssignmentInput): DbResult<TaskAssignment> {
  const member = getTeamMember(input.memberId);
  if (!member) {
    return { success: false, error: '成员不存在' };
  }

  // 检查任务是否已分配
  const existing = getAssignmentByTaskId(input.taskId);
  if (existing) {
    return { success: false, error: '任务已分配给其他成员' };
  }

  const assignment: TaskAssignment = {
    id: Date.now().toString(),
    taskId: input.taskId,
    memberId: input.memberId,
    assignedAt: new Date().toISOString(),
    dueDate: input.dueDate,
    status: 'assigned',
    progress: 0,
    notes: input.notes,
  };

  const assignments = getTaskAssignments();
  assignments.push(assignment);
  saveToStorage(TASK_ASSIGNMENTS_KEY, assignments);

  return { success: true, data: assignment };
}

/**
 * 更新任务分配状态
 */
export function updateTaskAssignment(
  id: string,
  updates: Partial<Pick<TaskAssignment, 'status' | 'progress' | 'notes'>>
): DbResult<TaskAssignment> {
  const assignments = getTaskAssignments();
  const index = assignments.findIndex(a => a.id === id);

  if (index === -1) {
    return { success: false, error: '分配记录不存在' };
  }

  const updated: TaskAssignment = {
    ...assignments[index],
    ...updates,
  };

  // 如果进度为 100，自动设置为完成
  if (updated.progress >= 100) {
    updated.status = 'completed';
    updated.progress = 100;
  }

  assignments[index] = updated;
  saveToStorage(TASK_ASSIGNMENTS_KEY, assignments);

  return { success: true, data: updated };
}

/**
 * 删除任务分配
 */
export function deleteTaskAssignment(id: string): DbResult<void> {
  const assignments = getTaskAssignments();
  const filtered = assignments.filter(a => a.id !== id);

  if (filtered.length === assignments.length) {
    return { success: false, error: '分配记录不存在' };
  }

  saveToStorage(TASK_ASSIGNMENTS_KEY, filtered);
  return { success: true };
}

// ============== 工作量统计 ==============

/**
 * 获取成员工作量统计
 */
export function getMemberWorkload(memberId: string): WorkloadStats | null {
  const member = getTeamMember(memberId);
  if (!member) return null;

  const assignments = getTaskAssignments(memberId);

  const stats: WorkloadStats = {
    memberId,
    memberName: member.name,
    totalTasks: assignments.length,
    completedTasks: assignments.filter(a => a.status === 'completed').length,
    inProgressTasks: assignments.filter(a => a.status === 'in_progress').length,
    blockedTasks: assignments.filter(a => a.status === 'blocked').length,
    completionRate: 0,
  };

  if (stats.totalTasks > 0) {
    stats.completionRate = Math.round((stats.completedTasks / stats.totalTasks) * 100);
  }

  return stats;
}

/**
 * 获取团队工作量统计
 */
export function getTeamWorkload(): WorkloadStats[] {
  const members = getTeamMembers();
  return members
    .map(m => getMemberWorkload(m.id))
    .filter((s): s is WorkloadStats => s !== null);
}

/**
 * 生成进度报告
 */
export function generateProgressReport(): string {
  const workloads = getTeamWorkload();
  const members = getTeamMembers();

  if (members.length === 0) {
    return '📊 团队进度报告\n\n暂无团队成员数据';
  }

  let report = '📊 团队进度报告\n\n';
  report += `👥 团队规模: ${members.length} 人\n\n`;

  // 总体统计
  const totalTasks = workloads.reduce((sum, w) => sum + w.totalTasks, 0);
  const completedTasks = workloads.reduce((sum, w) => sum + w.completedTasks, 0);
  const blockedTasks = workloads.reduce((sum, w) => sum + w.blockedTasks, 0);

  report += `📈 总体进度:\n`;
  report += `- 总任务数: ${totalTasks}\n`;
  report += `- 已完成: ${completedTasks}\n`;
  report += `- 阻塞中: ${blockedTasks}\n`;
  if (totalTasks > 0) {
    report += `- 完成率: ${Math.round((completedTasks / totalTasks) * 100)}%\n`;
  }

  // 个人统计
  report += `\n👤 个人进度:\n`;
  workloads.forEach(w => {
    report += `- ${w.memberName}: ${w.completedTasks}/${w.totalTasks} (${w.completionRate}%)\n`;
  });

  // 需要关注的成员
  const needAttention = workloads.filter(w => w.blockedTasks > 0 || w.completionRate < 30);
  if (needAttention.length > 0) {
    report += `\n⚠️ 需要关注:\n`;
    needAttention.forEach(w => {
      if (w.blockedTasks > 0) {
        report += `- ${w.memberName}: ${w.blockedTasks} 个任务阻塞\n`;
      } else {
        report += `- ${w.memberName}: 完成率较低 (${w.completionRate}%)\n`;
      }
    });
  }

  return report;
}

// ============== 管理技能追踪 ==============

/**
 * 获取所有管理技能记录
 */
export function getManagementSkillRecords(
  category?: ManagementSkillRecord['category']
): ManagementSkillRecord[] {
  const records = loadFromStorage<ManagementSkillRecord>(MANAGEMENT_SKILLS_KEY);
  if (category) {
    return records.filter(r => r.category === category);
  }
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * 创建管理技能记录
 */
export function createManagementSkillRecord(
  input: CreateManagementSkillInput
): DbResult<ManagementSkillRecord> {
  const record: ManagementSkillRecord = {
    id: Date.now().toString(),
    category: input.category,
    title: input.title,
    content: input.content,
    source: input.source,
    keyLearnings: input.keyLearnings || [],
    practiceDate: input.practiceDate,
    createdAt: new Date().toISOString(),
  };

  const records = getManagementSkillRecords();
  records.push(record);
  saveToStorage(MANAGEMENT_SKILLS_KEY, records);

  return { success: true, data: record };
}

/**
 * 删除管理技能记录
 */
export function deleteManagementSkillRecord(id: string): DbResult<void> {
  const records = getManagementSkillRecords();
  const filtered = records.filter(r => r.id !== id);

  if (filtered.length === records.length) {
    return { success: false, error: '记录不存在' };
  }

  saveToStorage(MANAGEMENT_SKILLS_KEY, filtered);
  return { success: true };
}

// ============== AI 辅助功能 ==============

/**
 * 生成 1:1 会议议题建议
 */
export async function generateOneOnOneTopics(memberId: string): Promise<DbResult<string[]>> {
  const member = getTeamMember(memberId);
  if (!member) {
    return { success: false, error: '成员不存在' };
  }

  const recentRecords = getOneOnOneRecords(memberId).slice(0, 3);
  const assignments = getTaskAssignments(memberId);
  const blockedTasks = assignments.filter(a => a.status === 'blocked');

  try {
    const client = getGeminiClient();
    const prompt = `作为一名管理者，我需要与团队成员 ${member.name}（${member.role || '团队成员'}）进行 1:1 会议。

成员信息：
- 技能: ${member.skills.join(', ') || '未记录'}
- 当前任务: ${assignments.length} 个
- 阻塞任务: ${blockedTasks.length} 个

最近 1:1 讨论的话题：
${recentRecords.map(r => `- ${r.topics.join(', ')}`).join('\n') || '暂无记录'}

请生成 5 个适合本次 1:1 会议讨论的话题，以 JSON 数组格式返回：
["话题1", "话题2", "话题3", "话题4", "话题5"]

只返回 JSON 数组，不要其他内容。`;

    const response = await client.generateContent(prompt, {
      generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
    });

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const topics = JSON.parse(jsonMatch[0]) as string[];
      return { success: true, data: topics };
    }

    return { success: true, data: ['工作进展', '遇到的困难', '职业发展', '团队协作', '反馈建议'] };
  } catch (error) {
    console.error('生成话题失败:', error);
    return { success: false, error: '生成失败' };
  }
}

/**
 * 生成激励建议
 */
export async function generateMotivationTips(memberId: string): Promise<DbResult<string[]>> {
  const member = getTeamMember(memberId);
  if (!member) {
    return { success: false, error: '成员不存在' };
  }

  const workload = getMemberWorkload(memberId);
  const recentRecords = getOneOnOneRecords(memberId).slice(0, 3);

  try {
    const client = getGeminiClient();
    const prompt = `作为一名管理者，我需要激励团队成员 ${member.name}。

成员情况：
- 职位: ${member.role || '团队成员'}
- 完成率: ${workload?.completionRate || 0}%
- 最近 1:1 情绪: ${recentRecords.map(r => r.mood || '未记录').join(', ')}

请根据以上信息，生成 3 条个性化的激励建议，以 JSON 数组格式返回：
["建议1", "建议2", "建议3"]

只返回 JSON 数组，不要其他内容。`;

    const response = await client.generateContent(prompt, {
      generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
    });

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const tips = JSON.parse(jsonMatch[0]) as string[];
      return { success: true, data: tips };
    }

    return { success: true, data: ['认可他的努力', '提供成长机会', '倾听他的想法'] };
  } catch (error) {
    console.error('生成激励建议失败:', error);
    return { success: false, error: '生成失败' };
  }
}

/**
 * 生成管理反思提示
 */
export async function generateReflectionPrompts(): Promise<DbResult<string[]>> {
  const members = getTeamMembers();
  const workloads = getTeamWorkload();
  const skillRecords = getManagementSkillRecords().slice(0, 5);

  try {
    const client = getGeminiClient();
    const prompt = `作为一名管理者，我需要进行管理反思。

团队情况：
- 团队规模: ${members.length} 人
- 平均完成率: ${workloads.length > 0 ? Math.round(workloads.reduce((sum, w) => sum + w.completionRate, 0) / workloads.length) : 0}%

最近学习的管理技能：
${skillRecords.map(r => `- ${r.category}: ${r.title}`).join('\n') || '暂无记录'}

请生成 5 个管理反思问题，帮助我提升管理能力，以 JSON 数组格式返回：
["问题1", "问题2", "问题3", "问题4", "问题5"]

只返回 JSON 数组，不要其他内容。`;

    const response = await client.generateContent(prompt, {
      generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
    });

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const prompts = JSON.parse(jsonMatch[0]) as string[];
      return { success: true, data: prompts };
    }

    return {
      success: true,
      data: [
        '本周我给团队成员提供了哪些有价值的反馈？',
        '有哪些决策我可以授权给团队成员？',
        '团队中谁需要更多的关注和支持？',
        '我如何更好地平衡任务分配？',
        '下周我要重点改进哪个管理技能？',
      ],
    };
  } catch (error) {
    console.error('生成反思提示失败:', error);
    return { success: false, error: '生成失败' };
  }
}

// ============== 管理技能类别映射 ==============

export const SKILL_CATEGORY_LABELS: Record<ManagementSkillRecord['category'], string> = {
  communication: '沟通技巧',
  delegation: '授权委派',
  feedback: '反馈技巧',
  motivation: '激励方法',
  conflict: '冲突处理',
  coaching: '辅导教练',
  other: '其他',
};
