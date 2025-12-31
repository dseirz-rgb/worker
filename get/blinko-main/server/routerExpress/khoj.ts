import express from 'express';
import { getKhojClient } from '../lib/khojClient';
import { Readable } from 'stream';

const router = express.Router();

/**
 * 解析 Khoj 流式响应中的 JSON 数据
 * Khoj 返回的数据可能是：
 * 1. SSE 格式: data: {...}\n\n
 * 2. 纯 JSON 格式: {...}
 * 3. 混合格式
 */
function parseKhojStreamData(data: string): string {
  // 移除 SSE 前缀
  let content = data;
  if (content.startsWith('data: ')) {
    content = content.slice(6);
  }
  
  // 跳过 [DONE] 标记
  if (content.trim() === '[DONE]') {
    return '';
  }
  
  // 尝试解析 JSON
  try {
    const json = JSON.parse(content);
    
    // 如果有 response 字段，提取它
    if (json.response !== undefined) {
      // 构造 SSE 格式的消息事件
      return `data: ${JSON.stringify({ type: 'message', data: json.response })}\n\n`;
    }
    
    // 如果已经是正确的格式，直接返回
    if (json.type) {
      return `data: ${content}\n\n`;
    }
    
    // 其他 JSON 数据，包装为消息
    return `data: ${JSON.stringify({ type: 'message', data: content })}\n\n`;
  } catch {
    // 不是 JSON，作为纯文本消息处理
    if (content.trim()) {
      return `data: ${JSON.stringify({ type: 'message', data: content })}\n\n`;
    }
    return '';
  }
}

/**
 * Khoj 聊天 API - 支持流式响应
 * POST /api/khoj/chat
 * 
 * 请求体:
 * - q: 用户消息
 * - conversation_id: 对话 ID
 * - stream: 是否流式响应 (query param)
 * - agent: Agent slug (可选)
 */
router.post('/chat', async (req, res) => {
  const { q, conversation_id, agent } = req.body;
  const stream = req.query.stream === 'true';

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Missing required field: q' });
  }

  if (!conversation_id || typeof conversation_id !== 'string') {
    return res.status(400).json({ error: 'Missing required field: conversation_id' });
  }

  const agentSlug = typeof agent === 'string' ? agent : undefined;

  console.log('[Khoj Chat API] Request:', {
    query: q.substring(0, 50) + (q.length > 50 ? '...' : ''),
    conversationId: conversation_id,
    stream,
    agent: agentSlug,
  });

  try {
    const khojClient = getKhojClient();

    if (stream) {
      // 设置 SSE 响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Content-Encoding', 'identity');

      // 获取流式响应
      const streamResponse = await khojClient.chatStream(q, conversation_id, agentSlug);
      
      let buffer = '';
      
      // 将流数据转发给客户端，处理 Khoj 的响应格式
      streamResponse.on('data', (chunk: Buffer) => {
        const data = chunk.toString('utf-8');
        buffer += data;
        
        // 按行处理数据
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一个不完整的行
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          const parsed = parseKhojStreamData(trimmedLine);
          if (parsed) {
            res.write(parsed);
          }
        }
      });

      streamResponse.on('end', () => {
        // 处理剩余的 buffer
        if (buffer.trim()) {
          const parsed = parseKhojStreamData(buffer.trim());
          if (parsed) {
            res.write(parsed);
          }
        }
        
        // 发送结束事件
        res.write(`data: ${JSON.stringify({ type: 'end_response' })}\n\n`);
        res.end();
      });

      streamResponse.on('error', (error: Error) => {
        console.error('[Khoj Chat API] Stream error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`);
        res.end();
      });

      // 处理客户端断开连接
      req.on('close', () => {
        if (streamResponse && typeof (streamResponse as Readable).destroy === 'function') {
          (streamResponse as Readable).destroy();
        }
      });
    } else {
      // 非流式响应
      const response = await khojClient.chat(q, conversation_id, agentSlug);
      res.json(response);
    }
  } catch (error) {
    console.error('[Khoj Chat API] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * 健康检查
 * GET /api/khoj/health
 */
router.get('/health', async (req, res) => {
  try {
    const khojClient = getKhojClient();
    const health = await khojClient.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(503).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
