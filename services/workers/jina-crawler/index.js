
import { createClient } from '@supabase/supabase-js'

export default {
  async fetch(request, env, ctx) {
    console.log('Worker Version: Refinement-v3-Debug')
    console.log('Env Check:', { 
        hasSupabaseUrl: !!env.SUPABASE_URL, 
        hasGeminiKey: !!env.GEMINI_API_KEY,
        geminiKeyPrefix: env.GEMINI_API_KEY ? env.GEMINI_API_KEY.substring(0, 5) : 'MISSING'
    })

    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    try {
      const { url, content, title: clientTitle, author: clientAuthor, comment } = await request.json()
      if (!url) return new Response('Missing URL', { status: 400 })

      // Initialize Supabase
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY)

      // Return response immediately to client (Async pattern)
      const task = async () => {
        try {
          let finalContent = content
          let finalTitle = clientTitle
          let finalAuthor = clientAuthor || 'Unknown'

          // 1. Basic Cleaning (Remove WeChat Footer if present)
          if (finalContent) {
            const wechatFooterRegex = /服务号[\s\S]*?企业和组织提供更强大的业务服务[\s\S]*?小程序[\s\S]*?出色的使用体验。/g
            finalContent = finalContent.replace(wechatFooterRegex, '')
            finalContent = finalContent.replace(/扫描二维码/g, '')
          }

          // If content is NOT provided by client, fetch from Jina (Fallback)
          if (!finalContent) {
             console.log(`Crawling via Jina: ${url}`)
             const jinaUrl = `https://r.jina.ai/${url}`
             const jinaHeaders = {
               'Content-Type': 'application/json',
               'X-Retain-Images': 'none'
             }
             if (env.JINA_API_KEY) {
               jinaHeaders['Authorization'] = `Bearer ${env.JINA_API_KEY}`
             }

             const jinaRes = await fetch(jinaUrl, { headers: jinaHeaders })
             
             if (!jinaRes.ok) {
               console.error('Jina Fetch Failed')
             } else {
               finalContent = await jinaRes.text()
               finalTitle = finalContent.match(/^Title:\s*(.+)$/m)?.[1] || 'Jina Crawled Article'
             }
          }

          // Anti-Crawler Validation: Block WeChat Verification Pages
          if (finalContent && (
              finalContent.includes('环境异常') || 
              finalContent.includes('weui-msg__title') ||
              finalContent.includes('secitptpage/verify')
          )) {
              console.warn('Blocked WeChat Verification Page')
              return new Response(JSON.stringify({ 
                  error: 'WeChat Anti-Crawler Blocked: Please open the article in browser first or use a different link.' 
              }), { 
                  status: 403,
                  headers: { 'Content-Type': 'application/json' }
              })
          }

          if (!finalTitle) finalTitle = 'Saved from Shortcut'

          // 2. Insert into Supabase (Initial Raw Save)
          console.log(`Saving raw to DB: ${finalTitle} (Length: ${finalContent?.length})`)
          
          const { data: insertedDoc, error } = await supabase.from('documents').insert({
            title: finalTitle,
            content: finalContent || 'No content provided',
            source_type: 'wechat_article',
            metadata: { 
              url, 
              author: finalAuthor,
              imported_at: new Date().toISOString(), 
              via: content ? 'ios-shortcut-parser' : 'jina-reader',
              comment: comment || null  // 用户点评
            }
          }).select().single()

          if (error) throw error
          console.log(`Success Raw Save: ${finalTitle} (ID: ${insertedDoc.id})`)

          // 3. Background Jina-Native Summarization (Using Reranker)
          const aiTask = async () => {
             // Ensure we have content and Jina Key
             if (!env.JINA_API_KEY || !finalContent) return

             try {
                console.log(`Starting Jina-Native Summarization for ID: ${insertedDoc.id}`)
                
                // A. Split text into chunks (sentences/paragraphs)
                // Remove Markdown syntax for cleaner splitting
                const cleanText = finalContent.replace(/[#*`]/g, '')
                const chunks = cleanText.split(/\n+/).filter(line => line.length > 20 && line.length < 500)
                
                if (chunks.length === 0) return

                // B. Use Jina Reranker to find the "Most Summary-like" sentences
                // Query: "What is the summary of this article?"
                const rerankUrl = 'https://api.jina.ai/v1/rerank'
                
                const rerankRes = await fetch(rerankUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${env.JINA_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'jina-reranker-v2-base-multilingual',
                        query: '这篇关于投资或财经的文章的核心观点和摘要是什么？',
                        documents: chunks,
                        top_n: 5
                    })
                })

                if (!rerankRes.ok) {
                    const err = await rerankRes.text()
                    console.error('Jina Reranker Error:', err)
                    // Fallback to error log
                    await supabase.from('documents').insert({
                        title: `⚠️ Jina Reranker Failed`,
                        content: `Error: ${err}`,
                        source_type: 'error_log',
                        metadata: { url, worker: true }
                    })
                    return
                }

                const rerankData = await rerankRes.json()
                
                // C. Construct the Summary
                // Take top 5 sentences, sort them by their original position to maintain flow
                // Use chunks[item.index] to get the text, as item.document might be structured differently
                const topSentences = rerankData.results
                    .sort((a, b) => a.index - b.index) // Restore original order
                    .map(item => chunks[item.index] || item.document?.text || item.text || '...')
                
                const summaryList = topSentences.map(s => `<li>${s}</li>`).join('')
                
                // Use semantic classes instead of inline styles for better frontend control (Dark Mode support)
                const summaryHtml = `
                   <div class="jina-summary-card">
                     <h3 class="jina-summary-title">💎 Jina 智能摘要</h3>
                     <ul class="jina-summary-list">
                        ${summaryList}
                     </ul>
                   </div>
                `
                
                // D. Update Content
                const refinedContent = summaryHtml + finalContent
                
                await supabase.from('documents').update({
                      content: refinedContent,
                      metadata: { 
                        ...insertedDoc.metadata,
                        ai_refined: true,
                        ai_provider: 'jina-reranker'
                      }
                   }).eq('id', insertedDoc.id)
                   
                console.log(`Jina Summarization Completed for ID: ${insertedDoc.id}`)

             } catch (err) {
                console.error('Background Jina Task Error:', err)
             }
          }

          // Trigger background task
           ctx.waitUntil(aiTask())
 
           return new Response(JSON.stringify({ success: true, message: 'Saved. AI processing in background.' }), {
              headers: { 'Content-Type': 'application/json' }
           })
 
         } catch (err) {
          console.error('Worker Error:', err)
          // Log error to DB if possible
          await supabase.from('documents').insert({
             title: `❌ Worker Error: ${new Date().toISOString()}`,
             content: err.message || String(err),
             source_type: 'error_log',
             metadata: { url, worker: true }
          }).catch(e => console.error('Failed to log error:', e))
        }
      }

      // Execute in background
      ctx.waitUntil(task())

      return new Response(JSON.stringify({ success: true, message: 'Processing in background' }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  }
}
