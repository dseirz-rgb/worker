/**
 * 家庭关怀服务
 * 管理家庭成员信息和关怀提醒
 */

import type { DbResult } from '../../types/database';

// 家庭成员类型
export type FamilyMemberType = 'child' | 'parent' | 'spouse' | 'other';

// 家庭成员
export interface FamilyMember {
  id: string;
  name: string;
  type: FamilyMemberType;
  birthday?: string;
  notes?: string;
  createdAt: string;
}

// 成长记录
export interface GrowthRecord {
  id: string;
  memberId: string;
  title: string;
  content: string;
  category: 'milestone' | 'learning' | 'health' | 'memory' | 'other';
  date: string;
  photos?: string[];
  createdAt: string;
}

// 关怀提醒
export interface CareReminder {
  id: string;
  memberId: string;
  type: 'birthday' | 'health' | 'contact' | 'custom';
  title: string;
  dueDate: string;
  recurring?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  completed: boolean;
}

// 存储
const familyMembers: FamilyMember[] = [];
const growthRecords: GrowthRecord[] = [];
const careReminders: CareReminder[] = [];

/**
 * 添加家庭成员
 */
export function addFamilyMember(
  name: string,
  type: FamilyMemberType,
  birthday?: string,
  notes?: string
): FamilyMember {
  const member: FamilyMember = {
    id: Date.now().toString(),
    name,
    type,
    birthday,
    notes,
    createdAt: new Date().toISOString(),
  };
  familyMembers.push(member);
  return member;
}

/**
 * 获取所有家庭成员
 */
export function getFamilyMembers(): FamilyMember[] {
  return [...familyMembers];
}

/**
 * 获取家庭成员
 */
export function getFamilyMember(id: string): FamilyMember | undefined {
  return familyMembers.find(m => m.id === id);
}

/**
 * 添加成长记录
 */
export function addGrowthRecord(
  memberId: string,
  title: string,
  content: string,
  category: GrowthRecord['category'],
  date?: string
): DbResult<GrowthRecord> {
  const member = getFamilyMember(memberId);
  if (!member) {
    return { success: false, error: '家庭成员不存在' };
  }

  const record: GrowthRecord = {
    id: Date.now().toString(),
    memberId,
    title,
    content,
    category,
    date: date || new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  };
  growthRecords.push(record);
  return { success: true, data: record };
}

/**
 * 获取成长记录
 */
export function getGrowthRecords(memberId?: string): GrowthRecord[] {
  if (memberId) {
    return growthRecords.filter(r => r.memberId === memberId);
  }
  return [...growthRecords];
}

/**
 * 添加关怀提醒
 */
export function addCareReminder(
  memberId: string,
  type: CareReminder['type'],
  title: string,
  dueDate: string,
  recurring?: CareReminder['recurring']
): DbResult<CareReminder> {
  const member = getFamilyMember(memberId);
  if (!member) {
    return { success: false, error: '家庭成员不存在' };
  }

  const reminder: CareReminder = {
    id: Date.now().toString(),
    memberId,
    type,
    title,
    dueDate,
    recurring,
    completed: false,
  };
  careReminders.push(reminder);
  return { success: true, data: reminder };
}

/**
 * 获取待办关怀提醒
 */
export function getPendingReminders(): CareReminder[] {
  const today = new Date().toISOString().split('T')[0];
  return careReminders.filter(r => !r.completed && r.dueDate <= today);
}

/**
 * 获取即将到来的提醒
 */
export function getUpcomingReminders(days: number = 7): CareReminder[] {
  const today = new Date();
  const future = new Date();
  future.setDate(future.getDate() + days);

  const todayStr = today.toISOString().split('T')[0];
  const futureStr = future.toISOString().split('T')[0];

  return careReminders.filter(
    r => !r.completed && r.dueDate >= todayStr && r.dueDate <= futureStr
  );
}

/**
 * 完成提醒
 */
export function completeReminder(id: string): DbResult<void> {
  const reminder = careReminders.find(r => r.id === id);
  if (!reminder) {
    return { success: false, error: '提醒不存在' };
  }

  reminder.completed = true;

  // 如果是循环提醒，创建下一个
  if (reminder.recurring) {
    const nextDate = new Date(reminder.dueDate);
    switch (reminder.recurring) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }

    const member = getFamilyMember(reminder.memberId);
    if (member) {
      addCareReminder(
        reminder.memberId,
        reminder.type,
        reminder.title,
        nextDate.toISOString().split('T')[0],
        reminder.recurring
      );
    }
  }

  return { success: true };
}

/**
 * 生成家庭关怀摘要
 */
export function generateFamilySummary(): string {
  const members = getFamilyMembers();
  const pending = getPendingReminders();
  const upcoming = getUpcomingReminders(7);

  let summary = `👨‍👩‍👧 家庭关怀\n`;
  summary += `家庭成员: ${members.length}人\n`;

  if (pending.length > 0) {
    summary += `\n⚠️ 待办提醒:\n`;
    pending.forEach(r => {
      const member = getFamilyMember(r.memberId);
      summary += `- ${member?.name}: ${r.title}\n`;
    });
  }

  if (upcoming.length > 0) {
    summary += `\n📅 即将到来:\n`;
    upcoming.forEach(r => {
      const member = getFamilyMember(r.memberId);
      summary += `- ${r.dueDate} ${member?.name}: ${r.title}\n`;
    });
  }

  return summary;
}
