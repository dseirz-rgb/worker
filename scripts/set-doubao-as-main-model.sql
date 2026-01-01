-- 设置豆包为主 AI 模型
-- 在 config 表中设置 mainModelId

-- 先查看当前的 mainModelId 配置
SELECT * FROM "config" WHERE key = 'mainModelId';

-- 插入或更新 mainModelId 配置
-- 使用 model id = 1 (刚才创建的 Doubao-Seed-1.6)
INSERT INTO "config" ("key", "config", "userId")
VALUES (
  'mainModelId',
  '{"type": "number", "value": 1}'::jsonb,
  NULL
)
ON CONFLICT DO NOTHING;

-- 如果已存在，则更新
UPDATE "config" 
SET "config" = '{"type": "number", "value": 1}'::jsonb
WHERE "key" = 'mainModelId';

-- 验证配置
SELECT * FROM "config" WHERE key = 'mainModelId';

-- 显示完整的 AI 配置信息
SELECT 
  c.key,
  c.config,
  p.title as provider_title,
  m.title as model_title,
  m."modelKey"
FROM "config" c
LEFT JOIN "aiModels" m ON (c.config->>'value')::int = m.id
LEFT JOIN "aiProviders" p ON m."providerId" = p.id
WHERE c.key = 'mainModelId';
