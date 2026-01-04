/**
 * 翻译路由 - Echo on Blinko 扩展
 * 提供翻译、OCR 和翻译历史功能
 */

import { router, authProcedure } from '../middleware';
import { z } from 'zod/v3';
import { TRPCError } from '@trpc/server';
import { TranslationService, SUPPORTED_LANGUAGES } from '@server/aiServer/translation';
import { prisma } from '../prisma';

// 语言代码验证
const languageCodeSchema = z.enum([
  'zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'pt'
] as const);

export const translationRouter = router({
  /**
   * 翻译文本
   */
  translate: authProcedure
    .input(z.object({
      text: z.string().min(1).max(10000),
      targetLanguage: languageCodeSchema.default('zh-CN'),
      sourceLanguage: languageCodeSchema.optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await TranslationService.translate(
          input.text,
          input.targetLanguage,
          input.sourceLanguage
        );

        // 保存翻译历史
        await prisma.translationHistory.create({
          data: {
            sourceText: result.originalText,
            translatedText: result.translatedText,
            sourceLang: result.sourceLanguage,
            targetLang: result.targetLanguage,
            sourceType: 'text',
            accountId: Number(ctx.id),
          },
        });

        return result;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message || '翻译失败',
        });
      }
    }),


  /**
   * OCR + 翻译（截图翻译）
   */
  ocrAndTranslate: authProcedure
    .input(z.object({
      imageBase64: z.string(),
      targetLanguage: languageCodeSchema.default('zh-CN'),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await TranslationService.ocrAndTranslate(
          input.imageBase64,
          input.targetLanguage
        );

        // 保存翻译历史
        await prisma.translationHistory.create({
          data: {
            sourceText: result.originalText,
            translatedText: result.translatedText,
            sourceLang: result.sourceLanguage,
            targetLang: result.targetLanguage,
            sourceType: 'ocr',
            accountId: Number(ctx.id),
          },
        });

        return result;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message || 'OCR 翻译失败',
        });
      }
    }),

  /**
   * 仅 OCR（不翻译）
   */
  ocr: authProcedure
    .input(z.object({
      imageBase64: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        return await TranslationService.ocr(input.imageBase64);
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message || 'OCR 识别失败',
        });
      }
    }),

  /**
   * 检测语言
   */
  detectLanguage: authProcedure
    .input(z.object({
      text: z.string().min(1).max(1000),
    }))
    .mutation(async ({ input }) => {
      try {
        const language = await TranslationService.detectLanguage(input.text);
        return { language, name: SUPPORTED_LANGUAGES[language] || language };
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message || '语言检测失败',
        });
      }
    }),

  /**
   * 获取翻译历史
   */
  getHistory: authProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      type: z.enum(['text', 'ocr', 'selection', 'all']).default('all'),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { accountId: Number(ctx.id) };
      if (input.type !== 'all') {
        where.sourceType = input.type;
      }
      const [items, total] = await Promise.all([
        prisma.translationHistory.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        prisma.translationHistory.count({ where }),
      ]);
      return { items, total };
    }),

  /**
   * 删除翻译历史
   */
  deleteHistory: authProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await prisma.translationHistory.deleteMany({
        where: {
          id: input.id,
          accountId: Number(ctx.id),
        },
      });
      return { success: true };
    }),

  /**
   * 清空翻译历史
   */
  clearHistory: authProcedure
    .mutation(async ({ ctx }) => {
      await prisma.translationHistory.deleteMany({
        where: { accountId: Number(ctx.id) },
      });
      return { success: true };
    }),

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages: authProcedure
    .query(async () => {
      return Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
        code,
        name,
      }));
    }),
});
