/**
 * Paperless 数据迁移脚本
 * 
 * 将 Paperless-ngx 中的文档迁移到原生文档管理系统
 * 
 * 功能:
 * - 从 Paperless 导出文档元数据
 * - 下载原始文件并重新上传到本地存储
 * - 迁移标签、文档类型、通讯者
 * - 支持增量迁移 (跳过已存在的文档)
 * - 生成迁移报告
 * 
 * 使用方法:
 *   npx tsx scripts/migrate-paperless-data.ts --account-id=1
 *   npx tsx scripts/migrate-paperless-data.ts --account-id=1 --dry-run
 *   npx tsx scripts/migrate-paperless-data.ts --account-id=1 --force
 */

import { PrismaClient } from '@prisma/client';
import { PaperlessClient } from '../server/lib/paperlessClient';
import { getStorageService, calculateChecksum } from '../server/lib/storageService';

// OCR 状态常量 (与 Prisma enum 对应)
const OCR_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;

// ============ 类型定义 ============

interface MigrationOptions {
  accountId: number;
  dryRun: boolean;
  force: boolean;
  batchSize: number;
}

interface MigrationStats {
  documentsTotal: number;
  documentsSuccess: number;
  documentsFailed: number;
  documentsSkipped: number;
  tagsTotal: number;
  tagsSuccess: number;
  documentTypesTotal: number;
  documentTypesSuccess: number;
  correspondentsTotal: number;
  correspondentsSuccess: number;
  errors: Array<{ type: string; id: number; error: string }>;
  startTime: Date;
  endTime?: Date;
}

interface IdMapping {
  tags: Map<number, number>;
  documentTypes: Map<number, number>;
  correspondents: Map<number, number>;
}

// ============ 主迁移类 ============

class PaperlessMigrator {
  private prisma: PrismaClient;
  private paperless: PaperlessClient | null = null;
  private storage = getStorageService();
  private options: MigrationOptions;
  private stats: MigrationStats;
  private idMapping: IdMapping;

  constructor(options: MigrationOptions) {
    this.prisma = new PrismaClient();
    this.options = options;
    this.stats = {
      documentsTotal: 0,
      documentsSuccess: 0,
      documentsFailed: 0,
      documentsSkipped: 0,
      tagsTotal: 0,
      tagsSuccess: 0,
      documentTypesTotal: 0,
      documentTypesSuccess: 0,
      correspondentsTotal: 0,
      correspondentsSuccess: 0,
      errors: [],
      startTime: new Date(),
    };
    this.idMapping = {
      tags: new Map(),
      documentTypes: new Map(),
      correspondents: new Map(),
    };
  }

  /**
   * 执行迁移
   */
  async migrate(): Promise<MigrationStats> {
    console.log('🚀 开始 Paperless 数据迁移...\n');

    try {
      // 1. 初始化 Paperless 客户端
      await this.initPaperlessClient();

      // 2. 迁移元数据 (标签、类型、通讯者)
      await this.migrateMetadata();

      // 3. 迁移文档
      await this.migrateDocuments();

      this.stats.endTime = new Date();
      this.printReport();

      return this.stats;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * 初始化 Paperless 客户端
   */
  private async initPaperlessClient(): Promise<void> {
    console.log('📡 连接 Paperless-ngx...');

    // 从数据库获取配置
    const config = await this.prisma.config.findFirst({
      where: {
        userId: this.options.accountId,
        key: 'paperless',
      },
    });

    if (!config?.config) {
      throw new Error('未找到 Paperless 配置，请先在设置中配置 Paperless-ngx');
    }

    const { baseUrl, apiToken } = config.config as { baseUrl: string; apiToken: string };

    if (!baseUrl || !apiToken) {
      throw new Error('Paperless 配置不完整');
    }

    this.paperless = new PaperlessClient({ baseUrl, apiToken });

    // 测试连接
    const connected = await this.paperless.testConnection();
    if (!connected) {
      throw new Error('无法连接到 Paperless-ngx');
    }

    console.log('✅ Paperless-ngx 连接成功\n');
  }

  /**
   * 迁移元数据
   */
  private async migrateMetadata(): Promise<void> {
    console.log('📋 迁移元数据...\n');

    // 迁移标签
    await this.migrateTags();

    // 迁移文档类型
    await this.migrateDocumentTypes();

    // 迁移通讯者
    await this.migrateCorrespondents();

    console.log('');
  }

  /**
   * 迁移标签
   */
  private async migrateTags(): Promise<void> {
    if (!this.paperless) return;

    const tags = await this.paperless.listTags();
    this.stats.tagsTotal = tags.length;

    console.log(`  标签: ${tags.length} 个`);

    for (const tag of tags) {
      try {
        // 检查是否已存在
        const existing = await this.prisma.documentTag.findFirst({
          where: {
            accountId: this.options.accountId,
            name: tag.name,
          },
        });

        if (existing) {
          this.idMapping.tags.set(tag.id, existing.id);
          continue;
        }

        if (this.options.dryRun) {
          console.log(`    [DRY-RUN] 将创建标签: ${tag.name}`);
          this.stats.tagsSuccess++;
          continue;
        }

        // 创建标签
        const newTag = await this.prisma.documentTag.create({
          data: {
            name: tag.name,
            color: tag.color || '#3B82F6',
            accountId: this.options.accountId,
          },
        });

        this.idMapping.tags.set(tag.id, newTag.id);
        this.stats.tagsSuccess++;
      } catch (error) {
        this.stats.errors.push({
          type: 'tag',
          id: tag.id,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    }
  }

  /**
   * 迁移文档类型
   */
  private async migrateDocumentTypes(): Promise<void> {
    if (!this.paperless) return;

    const types = await this.paperless.listDocumentTypes();
    this.stats.documentTypesTotal = types.length;

    console.log(`  文档类型: ${types.length} 个`);

    for (const type of types) {
      try {
        const existing = await this.prisma.documentType.findFirst({
          where: {
            accountId: this.options.accountId,
            name: type.name,
          },
        });

        if (existing) {
          this.idMapping.documentTypes.set(type.id, existing.id);
          continue;
        }

        if (this.options.dryRun) {
          console.log(`    [DRY-RUN] 将创建文档类型: ${type.name}`);
          this.stats.documentTypesSuccess++;
          continue;
        }

        const newType = await this.prisma.documentType.create({
          data: {
            name: type.name,
            accountId: this.options.accountId,
          },
        });

        this.idMapping.documentTypes.set(type.id, newType.id);
        this.stats.documentTypesSuccess++;
      } catch (error) {
        this.stats.errors.push({
          type: 'documentType',
          id: type.id,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    }
  }

  /**
   * 迁移通讯者
   */
  private async migrateCorrespondents(): Promise<void> {
    if (!this.paperless) return;

    const correspondents = await this.paperless.listCorrespondents();
    this.stats.correspondentsTotal = correspondents.length;

    console.log(`  通讯者: ${correspondents.length} 个`);

    for (const corr of correspondents) {
      try {
        const existing = await this.prisma.correspondent.findFirst({
          where: {
            accountId: this.options.accountId,
            name: corr.name,
          },
        });

        if (existing) {
          this.idMapping.correspondents.set(corr.id, existing.id);
          continue;
        }

        if (this.options.dryRun) {
          console.log(`    [DRY-RUN] 将创建通讯者: ${corr.name}`);
          this.stats.correspondentsSuccess++;
          continue;
        }

        const newCorr = await this.prisma.correspondent.create({
          data: {
            name: corr.name,
            accountId: this.options.accountId,
          },
        });

        this.idMapping.correspondents.set(corr.id, newCorr.id);
        this.stats.correspondentsSuccess++;
      } catch (error) {
        this.stats.errors.push({
          type: 'correspondent',
          id: corr.id,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    }
  }

  /**
   * 迁移文档
   */
  private async migrateDocuments(): Promise<void> {
    if (!this.paperless) return;

    console.log('📄 迁移文档...\n');

    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.paperless.listDocuments({
        page,
        page_size: this.options.batchSize,
      });

      this.stats.documentsTotal = response.count;

      for (const doc of response.results) {
        await this.migrateDocument(doc);
      }

      hasMore = response.next !== null;
      page++;

      // 显示进度
      const processed = this.stats.documentsSuccess + this.stats.documentsFailed + this.stats.documentsSkipped;
      console.log(`  进度: ${processed}/${response.count} (${Math.round(processed / response.count * 100)}%)`);
    }

    console.log('');
  }

  /**
   * 迁移单个文档
   */
  private async migrateDocument(doc: any): Promise<void> {
    try {
      // 检查是否已存在 (通过原始文件名)
      if (!this.options.force) {
        const existing = await this.prisma.document.findFirst({
          where: {
            accountId: this.options.accountId,
            originalFilename: doc.original_file_name,
          },
        });

        if (existing) {
          this.stats.documentsSkipped++;
          return;
        }
      }

      if (this.options.dryRun) {
        console.log(`    [DRY-RUN] 将迁移文档: ${doc.title}`);
        this.stats.documentsSuccess++;
        return;
      }

      // 下载原始文件
      const fileBuffer = await this.paperless!.downloadDocument(doc.id);
      const checksum = calculateChecksum(fileBuffer);

      // 检查是否已存在相同文件 (通过 checksum)
      if (!this.options.force) {
        const existingByChecksum = await this.prisma.document.findFirst({
          where: {
            accountId: this.options.accountId,
            checksum,
          },
        });

        if (existingByChecksum) {
          this.stats.documentsSkipped++;
          return;
        }
      }

      // 上传到本地存储
      const mimeType = this.getMimeType(doc.original_file_name);
      const uploadResult = await this.storage.upload(
        this.options.accountId,
        doc.original_file_name,
        fileBuffer,
        mimeType
      );

      // 映射标签 ID
      const tagIds = (doc.tags || [])
        .map((oldId: number) => this.idMapping.tags.get(oldId))
        .filter((id: number | undefined): id is number => id !== undefined);

      // 创建文档记录
      await this.prisma.document.create({
        data: {
          title: doc.title,
          content: doc.content || '',
          originalFilename: doc.original_file_name,
          storagePath: uploadResult.path,
          mimeType,
          fileSize: BigInt(uploadResult.size),
          checksum: uploadResult.checksum,
          ocrStatus: doc.content ? OCR_STATUS.COMPLETED : OCR_STATUS.PENDING,
          documentTypeId: doc.document_type
            ? this.idMapping.documentTypes.get(doc.document_type) || null
            : null,
          correspondentId: doc.correspondent
            ? this.idMapping.correspondents.get(doc.correspondent) || null
            : null,
          accountId: this.options.accountId,
          documentDate: doc.created ? new Date(doc.created) : null,
          tags: tagIds.length > 0 ? {
            create: tagIds.map((tagId: number) => ({ tagId })),
          } : undefined,
        },
      });

      this.stats.documentsSuccess++;
    } catch (error) {
      this.stats.documentsFailed++;
      this.stats.errors.push({
        type: 'document',
        id: doc.id,
        error: error instanceof Error ? error.message : '未知错误',
      });
    }
  }

  /**
   * 获取 MIME 类型
   */
  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      tiff: 'image/tiff',
      tif: 'image/tiff',
      txt: 'text/plain',
      md: 'text/markdown',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * 打印迁移报告
   */
  private printReport(): void {
    const duration = this.stats.endTime
      ? (this.stats.endTime.getTime() - this.stats.startTime.getTime()) / 1000
      : 0;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('                    📊 迁移报告');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (this.options.dryRun) {
      console.log('⚠️  这是一次模拟运行 (dry-run)，没有实际修改数据\n');
    }

    console.log('📄 文档:');
    console.log(`   总数: ${this.stats.documentsTotal}`);
    console.log(`   成功: ${this.stats.documentsSuccess}`);
    console.log(`   跳过: ${this.stats.documentsSkipped}`);
    console.log(`   失败: ${this.stats.documentsFailed}`);
    console.log('');

    console.log('🏷️  标签:');
    console.log(`   总数: ${this.stats.tagsTotal}`);
    console.log(`   成功: ${this.stats.tagsSuccess}`);
    console.log('');

    console.log('📁 文档类型:');
    console.log(`   总数: ${this.stats.documentTypesTotal}`);
    console.log(`   成功: ${this.stats.documentTypesSuccess}`);
    console.log('');

    console.log('👤 通讯者:');
    console.log(`   总数: ${this.stats.correspondentsTotal}`);
    console.log(`   成功: ${this.stats.correspondentsSuccess}`);
    console.log('');

    console.log(`⏱️  耗时: ${duration.toFixed(2)} 秒`);
    console.log('');

    if (this.stats.errors.length > 0) {
      console.log('❌ 错误列表:');
      for (const err of this.stats.errors.slice(0, 10)) {
        console.log(`   [${err.type}#${err.id}] ${err.error}`);
      }
      if (this.stats.errors.length > 10) {
        console.log(`   ... 还有 ${this.stats.errors.length - 10} 个错误`);
      }
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════\n');
  }
}

// ============ CLI 入口 ============

async function main(): Promise<void> {
  // 解析命令行参数
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    accountId: 1,
    dryRun: false,
    force: false,
    batchSize: 20,
  };

  for (const arg of args) {
    if (arg.startsWith('--account-id=')) {
      options.accountId = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  // 验证参数
  if (isNaN(options.accountId) || options.accountId <= 0) {
    console.error('错误: 无效的 account-id');
    process.exit(1);
  }

  // 执行迁移
  const migrator = new PaperlessMigrator(options);
  const stats = await migrator.migrate();

  // 根据结果设置退出码
  if (stats.documentsFailed > 0) {
    process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
Paperless 数据迁移脚本

用法:
  npx tsx scripts/migrate-paperless-data.ts [选项]

选项:
  --account-id=<id>    用户 ID (必需)
  --dry-run            模拟运行，不实际修改数据
  --force              强制迁移，覆盖已存在的文档
  --batch-size=<n>     每批处理的文档数量 (默认: 20)
  --help, -h           显示帮助信息

示例:
  # 迁移用户 1 的数据
  npx tsx scripts/migrate-paperless-data.ts --account-id=1

  # 模拟运行，查看将要迁移的内容
  npx tsx scripts/migrate-paperless-data.ts --account-id=1 --dry-run

  # 强制迁移，覆盖已存在的文档
  npx tsx scripts/migrate-paperless-data.ts --account-id=1 --force
`);
}

// 运行
main().catch((error) => {
  console.error('迁移失败:', error);
  process.exit(1);
});
