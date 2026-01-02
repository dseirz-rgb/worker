import express from 'express';
import { AccessToken } from 'livekit-server-sdk';

const router = express.Router();

// 环境变量
const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

interface TokenRequest {
  identity: string;
  roomName?: string;
}

interface TokenResponse {
  token: string;
  serverUrl: string;
  roomName: string;
  participantName: string;
}

/**
 * @openapi
 * /api/livekit/token:
 *   post:
 *     summary: Generate LiveKit access token
 *     description: Creates a JWT token for connecting to LiveKit rooms
 *     tags:
 *       - LiveKit
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identity
 *             properties:
 *               identity:
 *                 type: string
 *                 description: Unique identifier for the participant
 *               roomName:
 *                 type: string
 *                 description: Optional room name (auto-generated if not provided)
 *     responses:
 *       200:
 *         description: Token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 serverUrl:
 *                   type: string
 *                 roomName:
 *                   type: string
 *                 participantName:
 *                   type: string
 *       400:
 *         description: Invalid request - identity is required
 *       500:
 *         description: Server error - configuration missing or token generation failed
 */
router.post('/token', async (req, res) => {
  try {
    const { identity, roomName } = req.body as TokenRequest;
    
    // 验证参数
    if (!identity) {
      return res.status(400).json({ 
        error: 'invalid_request', 
        message: 'identity is required' 
      });
    }
    
    // 验证环境变量
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(500).json({ 
        error: 'server_error', 
        message: 'LiveKit configuration missing' 
      });
    }
    
    // 生成房间名
    const room = roomName || `voice_assistant_${Date.now()}`;
    
    // 创建 token
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      ttl: 60 * 15, // 15 分钟
    });
    
    token.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    
    const response: TokenResponse = {
      token: await token.toJwt(),
      serverUrl: LIVEKIT_URL,
      roomName: room,
      participantName: identity,
    };
    
    res.json(response);
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ 
      error: 'server_error', 
      message: 'Failed to generate token' 
    });
  }
});

export default router;
