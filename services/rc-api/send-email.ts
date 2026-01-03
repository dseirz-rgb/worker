
import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

// Initialize Resend with the API Key
// Vercel Environment Variable: RESEND_API_KEY
const resend = new Resend(process.env.RESEND_API_KEY || 're_MozNqFzL_MtL3ZsJaK67RsLD5PzYD57yN');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, content } = req.body;

    if (!to || !subject || !content) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, content' });
    }

    const { data, error } = await resend.emails.send({
      from: 'RiskControl <onboarding@resend.dev>', // Use default testing domain
      to: [to], // In testing mode, this must be your verified email or yourself
      subject: subject,
      html: content,
    });

    if (error) {
      console.error('[Resend] Error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[Resend] Email sent to ${to}, ID: ${data?.id}`);
    return res.status(200).json({ success: true, message: 'Email sent successfully', id: data?.id });

  } catch (error) {
    console.error('[Resend] Unexpected Error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
