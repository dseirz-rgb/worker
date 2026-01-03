/**
 * LiveKit Token 生成 API
 *
 * 基于: https://github.com/livekit-examples/agents-chatbot
 *       https://github.com/kaustubhkagrawal/livekit-studio-poc
 * 改动: 1. 适配项目代码风格  2. 添加中文注释  3. 增强错误处理
 */

import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { AccessToken } from 'livekit-server-sdk';

/**
 * Token 请求参数接口
 */
interface TokenRequest {
  /** 房间名称 */
  roomName: string;
  /** 参与者名称 */
  participantName: string;
}

/**
 * Token 响应接口
 */
interface TokenResponse {
  /** 访问令牌 */
  token: string;
  /** LiveKit 服务器 URL */
  url: string;
}

/**
 * 错误响应接口
 */
interface ErrorResponse {
  /** 错误信息 */
  error: string;
}

/**
 * 验证请求参数
 * @param body 请求体
 * @returns 验证结果
 */
function validateRequest(body: unknown): { valid: true; data: TokenRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: '请求体不能为空' };
  }

  const { roomName, participantName } = body as Record<string, unknown>;

  if (!roomName || typeof roomName !== 'string' || roomName.trim() === '') {
    return { valid: false, error: '缺少必要参数: roomName' };
  }

  if (!participantName || typeof participantName !== 'string' || participantName.trim() === '') {
    return { valid: false, error: '缺少必要参数: participantName' };
  }

  return {
    valid: true,
    data: {
      roomName: roomName.trim(),
      participantName: participantName.trim(),
    },
  };
}

/**
 * LiveKit Token 生成 API 处理函数
 *
 * @description 生成用于连接 LiveKit Room 的访问令牌
 *
 * @method POST
 * @path /api/livekit-token
 *
 * @param req.body.roomName - 房间名称
 * @param req.body.participantName - 参与者名称
 *
 * @returns {TokenResponse} 成功时返回 token 和 url
 * @returns {ErrorResponse} 失败时返回错误信息
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只允许 POST 请求' });
  }

  // 获取环境变量
  const LIVEKIT_URL = process.env.LIVEKIT_URL;
  const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
  const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

  // 验证环境变量配置
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    console.error('[LiveKit Token] 环境变量未配置:', {
      hasUrl: !!LIVEKIT_URL,
      hasApiKey: !!LIVEKIT_API_KEY,
      hasApiSecret: !!LIVEKIT_API_SECRET,
    });
    return res.status(500).json({ error: '服务器配置错误: LiveKit 环境变量未配置' });
  }

  // 验证请求参数
  const validation = validateRequest(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const { roomName, participantName } = validation.data;

  try {
    // 创建访问令牌
    const accessToken = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantName,
      name: participantName,
    });

    // 添加房间权限
    accessToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    // 生成 JWT token
    const token = await accessToken.toJwt();

    console.log('[LiveKit Token] Token 生成成功:', {
      roomName,
      participantName,
      tokenLength: token.length,
    });

    return res.status(200).json({
      token,
      url: LIVEKIT_URL,
    });
  } catch (error) {
    console.error('[LiveKit Token] Token 生成失败:', error);
    return res.status(500).json({
      error: '生成 Token 失败: ' + (error instanceof Error ? error.message : String(error)),
    });
  }
}
