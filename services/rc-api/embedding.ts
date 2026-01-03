
import { type VercelRequest, type VercelResponse } from '@vercel/node';
import * as https from 'https';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
  }

  const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${API_KEY}`;

  try {
    const proxyReq = https.request(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }, (proxyRes) => {
      res.statusCode = proxyRes.statusCode || 200;
      
      const headersToForward = ['content-type'];
      headersToForward.forEach(header => {
        if (proxyRes.headers[header]) {
          res.setHeader(header, proxyRes.headers[header] as string);
        }
      });

      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[GeminiEmbedding] Error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });

    proxyReq.write(JSON.stringify(req.body));
    proxyReq.end();

  } catch (error) {
    console.error('[GeminiEmbedding] Unexpected error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: String(error) });
    }
  }
}
