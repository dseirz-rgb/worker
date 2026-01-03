import type { VercelRequest, VercelResponse } from '@vercel/node'; 
import { createClient } from '@supabase/supabase-js'; 
import { GoogleGenerativeAI } from '@google/generative-ai'; 

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!); 
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!); 

export default async function handler(req: VercelRequest, res: VercelResponse) { 
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); 
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); 

  if (req.method === 'OPTIONS') return res.status(200).end(); 

  try { 
    const { rawChat } = req.body; 
    
    // 1. AI 清洗 
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
    const result = await model.generateContent(` 
      请将以下微信群聊记录清洗为结构化笔记，去除闲聊，提炼核心投资观点： 
      --- 
      ${rawChat} 
      --- 
    `); 
    const cleanedContent = result.response.text(); 
    const title = `群聊精华-${new Date().toISOString().split('T')[0]}`; 

    // 2. 存入数据库 
    await supabase.from('documents').insert({ 
      title, 
      content: cleanedContent, 
      source_type: 'wechat_group_chat', 
      metadata: { raw_content: rawChat } 
    }); 

    return res.json({ success: true }); 
  } catch (e: any) { 
    return res.status(500).json({ error: e.message }); 
  } 
} 
