/**
 * Cron 表达式工具函数
 * 
 * 提供 Cron 表达式的解析和转换功能
 */

// ============================================
// 常用 Cron 预设
// ============================================

export const CRON_PRESETS = {
  // 每天
  daily_9am: '0 9 * * *',      // 每天 9:00
  daily_12pm: '0 12 * * *',    // 每天 12:00
  daily_6pm: '0 18 * * *',     // 每天 18:00
  daily_9pm: '0 21 * * *',     // 每天 21:00
  
  // 每周
  weekly_mon: '0 9 * * 1',     // 每周一 9:00
  weekly_fri: '0 9 * * 5',     // 每周五 9:00
  weekly_sun: '0 9 * * 0',     // 每周日 9:00
  
  // 每月
  monthly_1st: '0 9 1 * *',    // 每月 1 日 9:00
  monthly_15th: '0 9 15 * *',  // 每月 15 日 9:00
  monthly_last: '0 9 L * *',   // 每月最后一天 9:00
  
  // 工作日
  weekdays: '0 9 * * 1-5',     // 工作日 9:00
  
  // 每小时
  hourly: '0 * * * *',         // 每小时整点
} as const;

// ============================================
// 预设选项（用于表单）
// ============================================

export interface CronPresetOption {
  label: string;
  value: string;
  description: string;
}

export const CRON_PRESET_OPTIONS: CronPresetOption[] = [
  { label: '每天 9:00', value: CRON_PRESETS.daily_9am, description: '每天早上 9 点执行' },
  { label: '每天 12:00', value: CRON_PRESETS.daily_12pm, description: '每天中午 12 点执行' },
  { label: '每天 18:00', value: CRON_PRESETS.daily_6pm, description: '每天下午 6 点执行' },
  { label: '每天 21:00', value: CRON_PRESETS.daily_9pm, description: '每天晚上 9 点执行' },
  { label: '每周一 9:00', value: CRON_PRESETS.weekly_mon, description: '每周一早上 9 点执行' },
  { label: '每周五 9:00', value: CRON_PRESETS.weekly_fri, description: '每周五早上 9 点执行' },
  { label: '每周日 9:00', value: CRON_PRESETS.weekly_sun, description: '每周日早上 9 点执行' },
  { label: '每月 1 日 9:00', value: CRON_PRESETS.monthly_1st, description: '每月 1 日早上 9 点执行' },
  { label: '每月 15 日 9:00', value: CRON_PRESETS.monthly_15th, description: '每月 15 日早上 9 点执行' },
  { label: '工作日 9:00', value: CRON_PRESETS.weekdays, description: '周一至周五早上 9 点执行' },
  { label: '每小时', value: CRON_PRESETS.hourly, description: '每小时整点执行' },
];

// ============================================
// Cron 表达式解析
// ============================================

/**
 * 将 Cron 表达式转换为人类可读格式
 * 
 * @param cron Cron 表达式 (分 时 日 月 周)
 * @returns 人类可读的描述
 */
export function cronToHuman(cron: string): string {
  if (!cron) return '未设置';
  
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  // 检查是否匹配预设
  const preset = CRON_PRESET_OPTIONS.find(p => p.value === cron);
  if (preset) return preset.label;
  
  // 解析各部分
  const hourNum = parseInt(hour);
  const minuteNum = parseInt(minute);
  
  // 格式化时间
  const timeStr = !isNaN(hourNum) && !isNaN(minuteNum)
    ? `${hourNum.toString().padStart(2, '0')}:${minuteNum.toString().padStart(2, '0')}`
    : '';
  
  // 每小时
  if (hour === '*' && minute !== '*') {
    return `每小时 ${minuteNum} 分`;
  }
  
  // 每天
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return timeStr ? `每天 ${timeStr}` : '每天';
  }
  
  // 工作日
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '1-5') {
    return timeStr ? `工作日 ${timeStr}` : '工作日';
  }
  
  // 周末
  if (dayOfMonth === '*' && month === '*' && (dayOfWeek === '0,6' || dayOfWeek === '6,0')) {
    return timeStr ? `周末 ${timeStr}` : '周末';
  }
  
  // 特定星期几
  if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    const weekDays = parseWeekDays(dayOfWeek);
    return timeStr ? `每${weekDays} ${timeStr}` : `每${weekDays}`;
  }
  
  // 特定日期
  if (dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
    const dayNum = parseInt(dayOfMonth);
    if (!isNaN(dayNum)) {
      return timeStr ? `每月 ${dayNum} 日 ${timeStr}` : `每月 ${dayNum} 日`;
    }
    if (dayOfMonth === 'L') {
      return timeStr ? `每月最后一天 ${timeStr}` : '每月最后一天';
    }
  }
  
  // 默认返回原始表达式
  return cron;
}

/**
 * 解析星期几
 */
function parseWeekDays(dayOfWeek: string): string {
  const weekDayNames: Record<string, string> = {
    '0': '周日',
    '1': '周一',
    '2': '周二',
    '3': '周三',
    '4': '周四',
    '5': '周五',
    '6': '周六',
    '7': '周日',
  };
  
  // 单个数字
  if (/^\d$/.test(dayOfWeek)) {
    return weekDayNames[dayOfWeek] || dayOfWeek;
  }
  
  // 范围 (如 1-5)
  if (/^\d-\d$/.test(dayOfWeek)) {
    const [start, end] = dayOfWeek.split('-');
    return `${weekDayNames[start]}至${weekDayNames[end]}`;
  }
  
  // 列表 (如 1,3,5)
  if (/^[\d,]+$/.test(dayOfWeek)) {
    return dayOfWeek.split(',').map(d => weekDayNames[d] || d).join('、');
  }
  
  return dayOfWeek;
}

// ============================================
// 时间格式化
// ============================================

/**
 * 格式化下次执行时间
 * 
 * @param nextRunAt ISO 时间字符串
 * @returns 人类可读的相对时间
 */
export function formatNextRunTime(nextRunAt: string): string {
  if (!nextRunAt) return '未知';
  
  const nextRun = new Date(nextRunAt);
  const now = new Date();
  
  if (isNaN(nextRun.getTime())) return '无效时间';
  
  const diff = nextRun.getTime() - now.getTime();
  
  // 已过期
  if (diff < 0) {
    return '已过期';
  }
  
  // 1 分钟内
  if (diff < 60 * 1000) {
    return '即将执行';
  }
  
  // 1 小时内
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes} 分钟后`;
  }
  
  // 24 小时内
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours} 小时后`;
  }
  
  // 7 天内
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days} 天后`;
  }
  
  // 超过 7 天，显示具体日期
  return nextRun.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 验证 Cron 表达式是否有效
 * 
 * @param cron Cron 表达式
 * @returns 是否有效
 */
export function isValidCron(cron: string): boolean {
  if (!cron) return false;
  
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) return false;
  
  // 简单验证每个部分
  const patterns = [
    /^(\*|[0-5]?\d)$/,                    // 分钟 0-59
    /^(\*|[01]?\d|2[0-3])$/,              // 小时 0-23
    /^(\*|[1-9]|[12]\d|3[01]|L)$/,        // 日 1-31 或 L
    /^(\*|[1-9]|1[0-2])$/,                // 月 1-12
    /^(\*|[0-7]|[0-7]-[0-7]|[0-7](,[0-7])*)$/, // 周 0-7
  ];
  
  for (let i = 0; i < 5; i++) {
    if (!patterns[i].test(parts[i])) {
      return false;
    }
  }
  
  return true;
}
