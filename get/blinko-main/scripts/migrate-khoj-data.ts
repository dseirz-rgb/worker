/**
 * Khoj 数据迁移脚本
 * 
 * 将 Khoj 的数据迁移到 Mastra 系统
 * 包括：对话历史、Agent 配置、自动化任务
 * 
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**
 * 
 * 使用方法:
 *   npx ts-node scripts/migrate-khoj-data.ts [--dry-run] [--backup-only] [--rollback]
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ============ 类型定义 ============

interface KhojConversation {
  id: string;
  title: string;
  created: string;
}

interface KhojChatMessage {
  role: 'user' | 'assistant' | 'khoj';
  message: string;
  context?: string[];
  created: string;
}

interface KhojAgent {
  slug: string;
  name: string;
  personality: string;
  avatar?: string;
  tools: string[];
  public: boolean;
}

interface KhojAutomation {
  id: string;
  subject: string;
  query_to_run: string;
  scheduling_request: string;
  schedule: string;
  next_run_at: string;
}

interface MigrationBackup {
  timestamp: string;
  conversations: KhojConversation[];
  agents: KhojAgent[];
  automations: KhojAutomation[];
  messages: Record<string, KhojChatMessage[]>;
}

interface MigrationReport {
  startTime: string;
  endTime: string;
  success: boolean;
  conversationsMigrated: number;
  agentsMigrated: number;
  automationsMigrated: number;
  messagesMigrated: number;
  errors: string[];
  warnings: string[];
}

// ============ 配置 ============

const BACKUP_DIR = path.join(process.cwd(), 'backups', 'khoj-migration');
const KHOJ_BASE_URL = process.env.KHOJ_URL || 'http://localhost:42110';

// ============ 工具函数 ============

/**
 * 确保备份目录存在
 */
function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * 生成备份文件名
 */
function getBackupFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(BACKUP_DIR, `khoj-backup-${timestamp}.json`);
}

/**
 * 获取最新的备份文件
 */
function getLatestBackup(): string | null {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('khoj-backup-') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  return files.length > 0 ? path.join(BACKUP_DIR, files[0]) : null;
}

/**
 * 调用 Khoj API
 */
async function khojFetch<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${KHOJ_BASE_URL}${endpoint}`);
  if (!response.ok) {
    throw new Error(`Khoj API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// ============ 备份功能 ============

/**
 * 从 Khoj 备份所有数据
 */
async function backupKhojData(): Promise<MigrationBackup> {
  console.log('📦 开始备份 Khoj 数据...');
  
  // 获取对话列表
  console.log('  - 获取对话列表...');
  const conversations = await khojFetch<KhojConversation[]>('/api/chat/sessions');
  
  // 获取每个对话的消息
  console.log('  - 获取对话消息...');
  const messages: Record<string, KhojChatMessage[]> = {};
  for (const conv of conversations) {
    try {
      messages[conv.id] = await khojFetch<KhojChatMessage[]>(`/api/chat/session/${conv.id}`);
    } catch (error) {
      console.warn(`    ⚠️ 无法获取对话 ${conv.id} 的消息:`, error);
      messages[conv.id] = [];
    }
  }
  
  // 获取 Agent 列表
  console.log('  - 获取 Agent 列表...');
  const agents = await khojFetch<KhojAgent[]>('/api/agents');
  
  // 获取自动化任务
  console.log('  - 获取自动化任务...');
  const automations = await khojFetch<KhojAutomation[]>('/api/automations');
  
  const backup: MigrationBackup = {
    timestamp: new Date().toISOString(),
    conversations,
    agents,
    automations,
    messages,
  };
  
  // 保存备份文件
  ensureBackupDir();
  const backupFile = getBackupFilename();
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`✅ 备份完成: ${backupFile}`);
  
  return backup;
}

// ============ 迁移功能 ============

/**
 * 迁移对话历史
 */
async function migrateConversations(
  backup: MigrationBackup,
  accountId: number,
  dryRun: boolean
): Promise<{ migrated: number; errors: string[] }> {
  console.log('💬 迁移对话历史...');
  
  let migrated = 0;
  const errors: string[] = [];
  
  for (const conv of backup.conversations) {
    try {
      const messages = backup.messages[conv.id] || [];
      
      if (dryRun) {
        console.log(`  [DRY-RUN] 将迁移对话: ${conv.title} (${messages.length} 条消息)`);
        migrated++;
        continue;
      }
      
      // 创建对话
      const conversation = await prisma.conversation.create({
        data: {
          title: conv.title || '未命名对话',
          accountId,
          createdAt: new Date(conv.created),
        },
      });
      
      // 迁移消息
      for (const msg of messages) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: msg.role === 'khoj' ? 'assistant' : msg.role,
            content: msg.message,
            metadata: msg.context ? { context: msg.context } : undefined,
            createdAt: new Date(msg.created),
          },
        });
      }
      
      migrated++;
      console.log(`  ✓ 迁移对话: ${conv.title} (${messages.length} 条消息)`);
    } catch (error) {
      const errMsg = `迁移对话 ${conv.id} 失败: ${error}`;
      errors.push(errMsg);
      console.error(`  ✗ ${errMsg}`);
    }
  }
  
  return { migrated, errors };
}

/**
 * 迁移 Agent 配置
 */
async function migrateAgents(
  backup: MigrationBackup,
  accountId: number,
  dryRun: boolean
): Promise<{ migrated: number; errors: string[] }> {
  console.log('🤖 迁移 Agent 配置...');
  
  let migrated = 0;
  const errors: string[] = [];
  
  // 工具映射: Khoj 工具名 -> Mastra 工具名
  const toolMapping: Record<string, string> = {
    'online': 'webSearch',
    'notes': 'searchNotes',
    'webpage': 'readWebpage',
    'general': 'searchNotes',
  };
  
  for (const agent of backup.agents) {
    try {
      // 检查是否已存在
      const existing = await prisma.agent.findUnique({
        where: { slug: agent.slug },
      });
      
      if (existing) {
        console.log(`  ⏭️ Agent 已存在，跳过: ${agent.name}`);
        continue;
      }
      
      // 映射工具
      const mappedTools = agent.tools
        .map(t => toolMapping[t] || t)
        .filter((v, i, a) => a.indexOf(v) === i); // 去重
      
      if (dryRun) {
        console.log(`  [DRY-RUN] 将迁移 Agent: ${agent.name} (工具: ${mappedTools.join(', ')})`);
        migrated++;
        continue;
      }
      
      await prisma.agent.create({
        data: {
          slug: agent.slug,
          name: agent.name,
          persona: agent.personality,
          systemPrompt: `你是 ${agent.name}。${agent.personality}`,
          tools: mappedTools,
          privacy: agent.public ? 'public' : 'private',
          accountId,
        },
      });
      
      migrated++;
      console.log(`  ✓ 迁移 Agent: ${agent.name}`);
    } catch (error) {
      const errMsg = `迁移 Agent ${agent.slug} 失败: ${error}`;
      errors.push(errMsg);
      console.error(`  ✗ ${errMsg}`);
    }
  }
  
  return { migrated, errors };
}

/**
 * 迁移自动化任务
 */
async function migrateAutomations(
  backup: MigrationBackup,
  accountId: number,
  dryRun: boolean
): Promise<{ migrated: number; errors: string[] }> {
  console.log('⚙️ 迁移自动化任务...');
  
  let migrated = 0;
  const errors: string[] = [];
  
  for (const automation of backup.automations) {
    try {
      if (dryRun) {
        console.log(`  [DRY-RUN] 将迁移自动化: ${automation.subject}`);
        migrated++;
        continue;
      }
      
      await prisma.aiScheduledTask.create({
        data: {
          name: automation.subject,
          prompt: automation.query_to_run,
          schedule: automation.schedule,
          isEnabled: true,
          accountId,
        },
      });
      
      migrated++;
      console.log(`  ✓ 迁移自动化: ${automation.subject}`);
    } catch (error) {
      const errMsg = `迁移自动化 ${automation.id} 失败: ${error}`;
      errors.push(errMsg);
      console.error(`  ✗ ${errMsg}`);
    }
  }
  
  return { migrated, errors };
}

// ============ 回滚功能 ============

/**
 * 回滚迁移
 */
async function rollbackMigration(): Promise<void> {
  console.log('🔄 开始回滚迁移...');
  
  const backupFile = getLatestBackup();
  if (!backupFile) {
    throw new Error('未找到备份文件，无法回滚');
  }
  
  console.log(`  使用备份文件: ${backupFile}`);
  const backup: MigrationBackup = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));
  
  // 删除迁移的 Agent
  console.log('  - 删除迁移的 Agent...');
  for (const agent of backup.agents) {
    try {
      await prisma.agent.delete({ where: { slug: agent.slug } });
      console.log(`    ✓ 删除 Agent: ${agent.name}`);
    } catch {
      // 可能不存在，忽略
    }
  }
  
  // 注意：对话和消息的回滚比较复杂，因为我们没有记录迁移后的 ID
  // 这里只是示例，实际使用时需要更完善的追踪机制
  console.log('  ⚠️ 对话和消息需要手动清理（基于时间戳）');
  
  console.log('✅ 回滚完成');
}

// ============ 主函数 ============

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const backupOnly = args.includes('--backup-only');
  const rollback = args.includes('--rollback');
  
  console.log('═══════════════════════════════════════════');
  console.log('  Khoj → Mastra 数据迁移工具');
  console.log('═══════════════════════════════════════════');
  console.log(`  模式: ${dryRun ? '试运行' : backupOnly ? '仅备份' : rollback ? '回滚' : '正式迁移'}`);
  console.log('');
  
  try {
    if (rollback) {
      await rollbackMigration();
      return;
    }
    
    // 1. 备份数据
    const backup = await backupKhojData();
    
    if (backupOnly) {
      console.log('✅ 备份完成，退出');
      return;
    }
    
    // 2. 获取默认账户 ID（实际使用时应该从参数获取）
    const account = await prisma.accounts.findFirst();
    if (!account) {
      throw new Error('未找到账户，请先创建账户');
    }
    const accountId = account.id;
    console.log(`\n使用账户 ID: ${accountId}`);
    
    // 3. 执行迁移
    const report: MigrationReport = {
      startTime: new Date().toISOString(),
      endTime: '',
      success: true,
      conversationsMigrated: 0,
      agentsMigrated: 0,
      automationsMigrated: 0,
      messagesMigrated: 0,
      errors: [],
      warnings: [],
    };
    
    // 迁移对话
    const convResult = await migrateConversations(backup, accountId, dryRun);
    report.conversationsMigrated = convResult.migrated;
    report.messagesMigrated = Object.values(backup.messages).reduce((sum, msgs) => sum + msgs.length, 0);
    report.errors.push(...convResult.errors);
    
    // 迁移 Agent
    const agentResult = await migrateAgents(backup, accountId, dryRun);
    report.agentsMigrated = agentResult.migrated;
    report.errors.push(...agentResult.errors);
    
    // 迁移自动化
    const autoResult = await migrateAutomations(backup, accountId, dryRun);
    report.automationsMigrated = autoResult.migrated;
    report.errors.push(...autoResult.errors);
    
    report.endTime = new Date().toISOString();
    report.success = report.errors.length === 0;
    
    // 4. 输出报告
    console.log('\n═══════════════════════════════════════════');
    console.log('  迁移报告');
    console.log('═══════════════════════════════════════════');
    console.log(`  状态: ${report.success ? '✅ 成功' : '⚠️ 部分失败'}`);
    console.log(`  对话迁移: ${report.conversationsMigrated}`);
    console.log(`  消息迁移: ${report.messagesMigrated}`);
    console.log(`  Agent 迁移: ${report.agentsMigrated}`);
    console.log(`  自动化迁移: ${report.automationsMigrated}`);
    
    if (report.errors.length > 0) {
      console.log(`\n  错误 (${report.errors.length}):`);
      report.errors.forEach(e => console.log(`    - ${e}`));
    }
    
    // 保存报告
    const reportFile = path.join(BACKUP_DIR, `migration-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n  报告已保存: ${reportFile}`);
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
