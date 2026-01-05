import { z } from 'zod';
import { router, authProcedure } from '../middleware';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// 备份文件信息
interface BackupFile {
  name: string;
  database: 'investment' | 'echo';
  size: string;
  sizeBytes: number;
  date: string;
  timestamp: number;
  location: 'local' | 'gdrive';
}

// 备份状态
interface BackupStatus {
  database: string;
  lastBackup: string | null;
  lastBackupTime: number | null;
  backupCount: number;
  totalSize: string;
  files: BackupFile[];
}

// 获取备份目录
const getBackupDirs = () => {
  const home = os.homedir();
  return {
    local: path.join(home, 'Backups', 'echoai-db'),
    gdrive: path.join(home, 'Google Drive', 'Backups', 'echoai-db'),
  };
};

// 解析备份文件名
const parseBackupFilename = (filename: string): { database: string; timestamp: string } | null => {
  // 格式: investment_20260104_130839.sql.gz 或 echo_20260104_130839.sql.gz
  const match = filename.match(/^(investment|echo)_(\d{8}_\d{6})\.sql\.gz$/);
  if (!match) return null;
  return { database: match[1], timestamp: match[2] };
};

// 格式化文件大小
const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
};

// 解析时间戳
const parseTimestamp = (ts: string): Date => {
  // 格式: 20260104_130839
  const year = parseInt(ts.slice(0, 4));
  const month = parseInt(ts.slice(4, 6)) - 1;
  const day = parseInt(ts.slice(6, 8));
  const hour = parseInt(ts.slice(9, 11));
  const minute = parseInt(ts.slice(11, 13));
  const second = parseInt(ts.slice(13, 15));
  return new Date(year, month, day, hour, minute, second);
};

// 扫描备份文件
const scanBackupFiles = async (dir: string, location: 'local' | 'gdrive'): Promise<BackupFile[]> => {
  const files: BackupFile[] = [];
  
  try {
    if (!fs.existsSync(dir)) return files;
    
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const parsed = parseBackupFilename(entry);
      if (!parsed) continue;
      
      const filePath = path.join(dir, entry);
      const stats = fs.statSync(filePath);
      const date = parseTimestamp(parsed.timestamp);
      
      files.push({
        name: entry,
        database: parsed.database as 'investment' | 'echo',
        size: formatSize(stats.size),
        sizeBytes: stats.size,
        date: date.toISOString(),
        timestamp: date.getTime(),
        location,
      });
    }
  } catch (error) {
    console.error(`扫描备份目录失败: ${dir}`, error);
  }
  
  return files;
};

export const backupRouter = router({
  // 获取备份状态
  getStatus: authProcedure
    .query(async () => {
      const dirs = getBackupDirs();
      
      // 扫描所有备份文件
      const localFiles = await scanBackupFiles(dirs.local, 'local');
      const gdriveFiles = await scanBackupFiles(dirs.gdrive, 'gdrive');
      
      // 合并并去重（优先本地）
      const allFiles = [...localFiles];
      for (const gf of gdriveFiles) {
        if (!allFiles.find(f => f.name === gf.name)) {
          allFiles.push(gf);
        }
      }
      
      // 按数据库分组
      const investmentFiles = allFiles.filter(f => f.database === 'investment').sort((a, b) => b.timestamp - a.timestamp);
      const echoFiles = allFiles.filter(f => f.database === 'echo').sort((a, b) => b.timestamp - a.timestamp);
      
      // 计算统计信息
      const calcStatus = (files: BackupFile[], dbName: string): BackupStatus => {
        const totalBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);
        const latest = files[0];
        
        return {
          database: dbName,
          lastBackup: latest?.date || null,
          lastBackupTime: latest?.timestamp || null,
          backupCount: files.length,
          totalSize: formatSize(totalBytes),
          files: files.slice(0, 10), // 只返回最近 10 个
        };
      };
      
      return {
        investment: calcStatus(investmentFiles, 'Investment DB'),
        echo: calcStatus(echoFiles, 'Echo DB'),
        localDir: dirs.local,
        gdriveDir: dirs.gdrive,
        localExists: fs.existsSync(dirs.local),
        gdriveExists: fs.existsSync(dirs.gdrive),
      };
    }),

  // 手动触发备份
  triggerBackup: authProcedure
    .input(z.object({
      database: z.enum(['investment', 'echo', 'all']).optional().default('all'),
    }))
    .mutation(async ({ input }) => {
      const scriptPath = path.join(process.cwd(), '..', '..', 'scripts', 'backup-databases.sh');
      
      // 检查脚本是否存在
      if (!fs.existsSync(scriptPath)) {
        throw new Error('备份脚本不存在');
      }
      
      try {
        const { stdout, stderr } = await execAsync(`bash "${scriptPath}"`, {
          timeout: 120000, // 2 分钟超时
        });
        
        return {
          success: true,
          message: '备份完成',
          output: stdout,
        };
      } catch (error: any) {
        throw new Error(`备份失败: ${error.message}`);
      }
    }),

  // 获取 launchd 任务状态
  getScheduleStatus: authProcedure
    .query(async () => {
      try {
        const { stdout } = await execAsync('launchctl list | grep echoai.backup || echo "not_loaded"');
        const isLoaded = !stdout.includes('not_loaded');
        
        return {
          isScheduled: isLoaded,
          schedule: isLoaded ? '每天凌晨 3:00' : null,
        };
      } catch {
        return {
          isScheduled: false,
          schedule: null,
        };
      }
    }),
});
