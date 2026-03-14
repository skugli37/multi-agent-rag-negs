import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { selectTools, executeTool } from '@/lib/tools'
import { storage } from '@/lib/storage'

// Check if database is available
let dbAvailable = false
let db: typeof import('@/lib/db').db | null = null

try {
  // Only try to use database if DATABASE_URL is set and not a file path
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')) {
    db = require('@/lib/db').db
    dbAvailable = true
  }
} catch (e) {
  console.log('Database not available, using in-memory storage')
}

// Simplified multi-agent chat API
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { message, conversationId, systemPrompt, useRag = true } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Poruka je obavezna' }, { status: 400 })
    }

    // Get/create conversation
    let convId = conversationId
    let convTitle = message.slice(0, 50)
    
    if (dbAvailable && db) {
      // Use database
      let conv = conversationId 
        ? await db.conversation.findUnique({ where: { id: conversationId } })
        : null
      
      if (!conv) {
        conv = await db.conversation.create({
          data: { title: convTitle }
        })
      }
      convId = conv.id
    } else {
      // Use in-memory storage
      if (convId) {
        const existingConv = await storage.getConversation(convId)
        if (!existingConv) {
          await storage.createConversation(convId)
        }
      } else {
        const newConv = await storage.createConversation()
        convId = newConv.id
      }
    }

    // Create agent run
    let agentRunId = `run_${Date.now()}`
    
    if (dbAvailable && db) {
      const agentRun = await db.agentRun.create({
        data: {
          conversationId: convId!,
          status: 'running'
        }
      })
      agentRunId = agentRun.id
    } else {
      const agentRun = await storage.createAgentRun(convId!)
      agentRunId = agentRun.id
    }

    // Tool execution
    const tools = selectTools(message)
    let toolResults: Record<string, unknown> = {}
    
    if (tools.length > 0) {
      for (const tool of tools) {
        try {
          const result = await executeTool(tool, { 
            expression: message, 
            text: message 
          })
          toolResults[tool] = result
        } catch (e) {
          console.error(`Tool ${tool} failed:`, e)
        }
      }
    }

    // RAG Retrieval (skip if no database)
    let citations: { documentId: string; filename: string; content: string; score: number }[] = []
    
    if (useRag && dbAvailable && db) {
      try {
        const chunks = await db.documentChunk.findMany({
          include: { document: true },
          take: 100
        })
        
        if (chunks.length > 0) {
          // Simple keyword matching for now
          const keywords = message.toLowerCase().split(/\s+/)
          const scored = chunks.map(chunk => {
            const content = chunk.content.toLowerCase()
            const score = keywords.reduce((acc, kw) => 
              acc + (content.includes(kw) ? 1 : 0), 0
            ) / keywords.length
            return { chunk, score }
          })
          
          scored.sort((a, b) => b.score - a.score)
          citations = scored.slice(0, 3)
            .filter(s => s.score > 0)
            .map(s => ({
              documentId: s.chunk.documentId,
              filename: s.chunk.document.filename,
              content: s.chunk.content.slice(0, 200),
              score: s.score
            }))
        }
      } catch (e) {
        console.log('RAG retrieval skipped:', e)
      }
    }

    // Get history
    let history: { role: string; content: string }[] = []
    
    if (dbAvailable && db) {
      const messages = await db.message.findMany({
        where: { conversationId: convId },
        orderBy: { createdAt: 'asc' },
        take: 10
      })
      history = messages.map(m => ({ role: m.role, content: m.content }))
    } else {
      const messages = await storage.getMessages(convId!)
      history = messages.map(m => ({ role: m.role, content: m.content }))
    }

    // Save user message
    if (dbAvailable && db) {
      await db.message.create({
        data: {
          conversationId: convId!,
          role: 'user',
          content: message
        }
      })
    } else {
      await storage.addMessage(convId!, 'user', message)
    }

    // Build messages for LLM
    const messages: Array<{ role: string; content: string }> = []
    
    let system = systemPrompt || 'Ti si korisni AI asistent. Odgovaraj na jeziku korisnika. Budu koncizan i precizan.'
    
    if (citations.length > 0) {
      system += '\n\n## Kontekst iz baze znanja:\n' + 
        citations.map((c, i) => `[${i + 1}] ${c.filename}: ${c.content}`).join('\n\n')
    }
    
    if (Object.keys(toolResults).length > 0) {
      system += '\n\n## Rezultati alata:\n' + JSON.stringify(toolResults, null, 2)
    }
    
    messages.push({ role: 'system', content: system })
    
    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content })
    }
    
    messages.push({ role: 'user', content: message })

    // Get LLM response
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 1500
    })

    const response = completion.choices[0]?.message?.content || 'Nema odgovora'
    const confidence = 0.85

    // Save response
    let messageId = `msg_${Date.now()}`
    
    if (dbAvailable && db) {
      const assistantMessage = await db.message.create({
        data: {
          conversationId: convId!,
          role: 'assistant',
          content: response,
          tokens: response.split(' ').length,
          confidence,
          agentName: 'multi_agent'
        }
      })
      messageId = assistantMessage.id
    } else {
      const msg = await storage.addMessage(convId!, 'assistant', response, 'multi_agent', confidence)
      messageId = msg.id
    }

    // Update agent run
    const duration = Date.now() - startTime
    
    if (dbAvailable && db) {
      await db.agentRun.update({
        where: { id: agentRunId },
        data: {
          totalTokens: response.split(' ').length + 200,
          totalTime: duration,
          selfScore: confidence,
          status: 'completed'
        }
      })
      
      await db.conversation.update({
        where: { id: convId },
        data: { updatedAt: new Date() }
      })
    } else {
      await storage.updateAgentRun(agentRunId, {
        totalTokens: response.split(' ').length + 200,
        totalTime: duration,
        status: 'completed'
      })
    }

    return NextResponse.json({
      response,
      conversationId: convId,
      messageId,
      confidence,
      citations,
      reasoning: {
        conclusion: response.slice(0, 200),
        confidence
      },
      reflection: {
        accuracy: confidence,
        completeness: confidence,
        relevance: confidence,
        clarity: confidence,
        issues: [],
        suggestions: []
      },
      metadata: {
        tokens: response.split(' ').length + 200,
        duration,
        agentRunId,
        toolsUsed: tools,
        storage: dbAvailable ? 'database' : 'memory'
      }
    })

  } catch (error) {
    console.error('Multi-agent chat error:', error)
    return NextResponse.json({ 
      error: 'Greška pri obradi poruke',
      details: error instanceof Error ? error.message : undefined
    }, { status: 500 })
  }
}
