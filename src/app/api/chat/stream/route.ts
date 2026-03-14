import { NextRequest } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { storage } from '@/lib/storage'
import { selectTools, executeTool } from '@/lib/tools'
import { searchDocuments, getAllDocuments } from '@/lib/document-storage'
import { ExpertGenomeManager } from '@/lib/agents/expert-genome'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const { message, conversationId, systemPrompt, useRag = true } = await request.json()

  if (!message) {
    return new Response(JSON.stringify({ error: 'Poruka je obavezna' }), { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // ========== NEGS: SELECT BEST AGENT ==========
        const selection = ExpertGenomeManager.selectBestAgent(message)
        
        send('negs_selection', {
          selectedAgent: selection.agent,
          reason: selection.reason,
          fitness: selection.fitness,
          alternatives: selection.allScores
        })

        // ========== NEGS: AGENT THINKING ==========
        const thinkResult = ExpertGenomeManager.think(selection.agent, message)
        
        send('negs_thinking', {
          agent: selection.agent,
          reasoning: thinkResult.reasoning,
          confidence: thinkResult.confidence,
          strategy: thinkResult.strategy
        })

        // ========== CONVERSATION ==========
        let convId = conversationId
        if (!convId) {
          const newConv = await storage.createConversation()
          convId = newConv.id
        }
        send('conversation', { conversationId: convId })
        await storage.addMessage(convId, 'user', message)

        const historyMessages = await storage.getMessages(convId)
        const history = historyMessages.slice(-10).map(m => ({ role: m.role, content: m.content }))

        // ========== TOOLS ==========
        const tools = selectTools(message)
        let toolResults: Record<string, unknown> = {}
        
        for (const tool of tools) {
          try {
            const result = await executeTool(tool, { expression: message, text: message })
            toolResults[tool] = result
            ExpertGenomeManager.updateMetrics('query', true, 50)
          } catch (e) {
            ExpertGenomeManager.updateMetrics('query', false, 50)
          }
        }

        // ========== RAG ==========
        let citations: { documentId: string; filename: string; content: string; score: number }[] = []
        
        if (useRag) {
          const allDocs = getAllDocuments()
          if (allDocs.length > 0) {
            citations = searchDocuments(message, 3)
            ExpertGenomeManager.updateMetrics('retrieval', citations.length > 0, 30)
          }
        }
        
        // Thinking for retrieval
        if (citations.length > 0) {
          const retrievalThink = ExpertGenomeManager.think('retrieval', message)
          send('negs_thinking', {
            agent: 'retrieval',
            reasoning: retrievalThink.reasoning,
            confidence: retrievalThink.confidence,
            strategy: retrievalThink.strategy
          })
        }
        
        send('retrieval', { 
          citations: citations.map(c => ({ filename: c.filename, score: c.score })),
          count: citations.length
        })

        // ========== LLM ==========
        send('reasoning', { thinking: true })

        const messages: Array<{ role: string; content: string }> = []
        
        let system = systemPrompt || 'Ti si korisni AI asistent. Odgovaraj na jeziku korisnika.'
        
        if (citations.length > 0) {
          system += '\n\n## 📚 Kontekst:\n' + 
            citations.map((c, i) => `[${i + 1}] ${c.filename}:\n${c.content}`).join('\n\n')
        }
        
        if (Object.keys(toolResults).length > 0) {
          system += '\n\n## 🔧 Alati:\n' + JSON.stringify(toolResults, null, 2)
        }
        
        messages.push({ role: 'system', content: system })
        for (const msg of history) messages.push({ role: msg.role, content: msg.content })
        messages.push({ role: 'user', content: message })

        const zai = await ZAI.create()
        const completion = await zai.chat.completions.create({
          messages,
          temperature: 0.7,
          max_tokens: 1500
        })

        const response = completion.choices[0]?.message?.content || 'Nema odgovora'
        const latency = Date.now() - startTime

        // ========== STREAM ==========
        const words = response.split(' ')
        for (let i = 0; i < words.length; i++) {
          send('token', { content: words[i] + (i < words.length - 1 ? ' ' : '') })
          await new Promise(r => setTimeout(r, 20))
        }

        const msg = await storage.addMessage(convId, 'assistant', response, 'multi_agent', 0.85)

        // ========== UPDATE ALL AGENTS ==========
        ExpertGenomeManager.updateMetrics('query', true, latency * 0.2)
        ExpertGenomeManager.updateMetrics('retrieval', citations.length > 0, latency * 0.15)
        ExpertGenomeManager.updateMetrics('reasoning', true, latency * 0.3)
        ExpertGenomeManager.updateMetrics('response', true, latency * 0.25)
        ExpertGenomeManager.updateMetrics('reflection', true, latency * 0.1)
        ExpertGenomeManager.analyzeQueryPattern(message, true, latency)

        // ========== CHECK FOR EVOLUTION ==========
        const evolutionEvents = ExpertGenomeManager.runEvolution()
        if (evolutionEvents.length > 0) {
          send('negs_evolution', {
            events: evolutionEvents.map(e => ({
              agent: e.agentName,
              type: e.type,
              before: e.fitnessBefore,
              after: e.fitnessAfter
            }))
          })
        }

        // ========== DONE ==========
        send('done', {
          messageId: msg.id,
          citations,
          tokens: response.split(' ').length,
          confidence: 0.85,
          negs: ExpertGenomeManager.getStats()
        })

        controller.close()

      } catch (error) {
        console.error('Stream error:', error)
        send('error', { message: error instanceof Error ? error.message : 'Greška' })
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
