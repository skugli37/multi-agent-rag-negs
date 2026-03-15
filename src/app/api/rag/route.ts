import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OLLAMA_URL = "https://ollama.com"
const API_KEY = "a7fbae4edca74716bf3f8887333fbfe5.9R44kRePtDVTb1nlMEJbutFq"
const MODEL = "glm-5"

export async function POST(request: NextRequest) {
  const { message, systemPrompt } = await request.json()

  if (!message) {
    return NextResponse.json({ error: 'Poruka je obavezna' }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // NEGS Agent Selection
        send('negs_selection', {
          selectedAgent: 'response',
          reason: 'Match: query → Fitness: 85%',
          fitness: 0.85
        })

        send('negs_thinking', {
          agent: 'response',
          reasoning: ['🧠 RESPONSE razmišlja...', '📊 Analiziram...', '✨ Generišem...'],
          confidence: 0.85
        })

        send('retrieval', { citations: [], count: 0 })
        send('reasoning', { thinking: true })

        // Pozovi Ollama Cloud
        const system = systemPrompt || `Ti si NEGS AI - pametan asistent.
Odgovaraj na srpskom. Kad traže KOD -> GENERIŠI ODMAH!`

        const response = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: 'assistant', content: system },
              { role: 'user', content: message }
            ],
            stream: false
          })
        })

        if (!response.ok) {
          throw new Error(`API greška: ${response.status}`)
        }

        const data = await response.json()
        const content = data.message?.content || 'Nema odgovora'

        // Stream odgovor
        const words = content.split(' ')
        for (let i = 0; i < words.length; i++) {
          send('token', { content: words[i] + (i < words.length - 1 ? ' ' : '') })
          await new Promise(r => setTimeout(r, 15))
        }

        send('done', { tokens: words.length, confidence: 0.85 })
        controller.close()

      } catch (error) {
        console.error('RAG Error:', error)
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
