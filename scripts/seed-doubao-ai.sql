-- 豆包 (Doubao/Volcengine) AI 配置脚本
-- 用于测试 AI 功能

-- 1. 插入 AI 提供商 (豆包使用 OpenAI 兼容 API)
INSERT INTO "aiProviders" (
  "title",
  "provider",
  "baseURL",
  "apiKey",
  "config",
  "sortOrder",
  "createdAt",
  "updatedAt"
) VALUES (
  '豆包 (Doubao)',
  'custom',
  'https://ark.cn-beijing.volces.com/api/v3',
  '890c5406-4896-4e1f-b8e7-c69491434096',
  '{}',
  1,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING
RETURNING id;

-- 2. 插入 AI 模型 (Doubao-Seed-1.6)
-- 注意: 需要先获取上面插入的 provider id
INSERT INTO "aiModels" (
  "providerId",
  "title",
  "modelKey",
  "capabilities",
  "config",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT 
  p.id,
  'Doubao-Seed-1.6',
  'doubao-seed-1-6-251015',
  '{"chat": true, "vision": true, "reasoning": true}'::jsonb,
  '{"maxTokens": 65535, "reasoningEffort": "medium"}'::jsonb,
  1,
  NOW(),
  NOW()
FROM "aiProviders" p
WHERE p."title" = '豆包 (Doubao)'
ON CONFLICT DO NOTHING;

-- 3. 查看插入结果
SELECT 
  p.id as provider_id,
  p.title as provider_title,
  p.provider,
  p."baseURL",
  m.id as model_id,
  m.title as model_title,
  m."modelKey",
  m.capabilities
FROM "aiProviders" p
LEFT JOIN "aiModels" m ON m."providerId" = p.id
WHERE p.title = '豆包 (Doubao)';
