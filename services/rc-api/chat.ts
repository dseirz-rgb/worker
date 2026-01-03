
import { type VercelRequest, type VercelResponse } from '@vercel/node';
import * as https from 'https';

export const config = {
  supportsResponseStreaming: true,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
  }

  // Read model from x-gemini-model header, default to gemini-3-pro-preview
  const requestedModel = req.headers['x-gemini-model'];
  const validModels = ['gemini-3-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  
  // Validate model name for security
  const model = (typeof requestedModel === 'string' && validModels.includes(requestedModel)) 
    ? requestedModel 
    : 'gemini-3-pro-preview';

  const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${API_KEY}`;
  console.log(`[API Chat] Using Model: ${model}`);

  try {
    const proxyReq = https.request(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }, (proxyRes) => {
      res.statusCode = proxyRes.statusCode || 200;
      
      // Forward relevant headers
      const headersToForward = ['content-type', 'cache-control', 'connection'];
      headersToForward.forEach(header => {
        if (proxyRes.headers[header]) {
          res.setHeader(header, proxyRes.headers[header] as string);
        }
      });

      // Pipe the response directly
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[GeminiProxy] Error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });

    // Write the request body to the proxy request
    proxyReq.write(JSON.stringify(req.body));
    proxyReq.end();

  } catch (error) {
    console.error('[GeminiProxy] Unexpected error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: String(error) });
    }
  }
}
