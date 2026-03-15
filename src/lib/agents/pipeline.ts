// Main Agent Pipeline - Coordinates all agents

import { db } from '@/lib/db'
import { AgentContext, QueryAnalysis, RetrievalResult, ReasoningChain, SelfReflection } from './types'
import { QueryAgent, OrchestratorAgent } from './orchestrator'
import { RetrievalAgent, ReasoningAgent, ResponseAgent, ReflectionAgent } from './retrieval'
import { 
  addToWorkingMemory,
  getRelevantFromWorkingMemory,
  storeEpisodicMemory,
  retrieveAllMemory,
  updateKnowledgeGraph 
} from './memory'
import { executeTool, selectTools } from '../tools'

// Ollama Cloud config
const OLLAMA_URL = "https://ollama.com"
const API_KEY = "a7fbae4edca74716bf3f8887333fbfe5.9R44kRePtDVTb1nlMEJbutFq"
const MODEL = "glm-5"

// ============ MAIN AGENT PIPELINE ============

export class AgentPipeline {
  private queryAgent: QueryAgent
  private orchestrator: OrchestratorAgent
  private retrievalAgent: RetrievalAgent
  private reasoningAgent: ReasoningAgent
  private responseAgent: ResponseAgent
  private reflectionAgent: ReflectionAgent
  private startTime: number = 0
  
  constructor() {
    this.queryAgent = new QueryAgent()
    this.orchestrator = new OrchestratorAgent()
    this.retrievalAgent = new RetrievalAgent()
    this.reasoningAgent = new ReasoningAgent()
    this.responseAgent = new ResponseAgent()
    this.reflectionAgent = new ReflectionAgent()
  }
  
  async initialize(): Promise<void> {
    await this.queryAgent.initialize()
    await this.orchestrator.initialize()
    await this.reasoningAgent.initialize()
    await this.responseAgent.initialize()
    await this.reflectionAgent.initialize()
  }
  
  // Streaming execution with SSE - uses Ollama Cloud
  async *executeStream(context: AgentContext): AsyncGenerator<{
    type: 'query' | 'retrieval' | 'reasoning' | 'response' | 'reflection' | 'done'
    data: unknown
  }> {
    this.startTime = Date.now()
    let totalTokens = 0
    
    // Yield: Query Analysis
    const queryAnalysis = await this.analyzeQuery(context.userQuery)
    yield { type: 'query', data: queryAnalysis }
    totalTokens += 200
    
    // Yield: Retrieval
    let retrievalResult: RetrievalResult = { chunks: [], strategy: 'none', totalFound: 0, reranked: false, scores: [] }
    
    if (context.useRag) {
      try {
        retrievalResult = await this.retrievalAgent.retrieve(context.userQuery, {
          strategy: 'hybrid',
          topK: 5,
          rerank: true
        })
        
        yield { 
          type: 'retrieval', 
          data: {
            chunksFound: retrievalResult.totalFound,
            citations: retrievalResult.chunks.map(c => ({
              filename: c.filename,
              score: c.score
            }))
          }
        }
      } catch (e) {
        yield { type: 'retrieval', data: { chunksFound: 0, citations: [] } }
      }
    }
    
    // Yield: Reasoning
    const allContext = retrievalResult.chunks.map(c => c.content)
    
    try {
      const reasoning = await this.reasoningAgent.chainOfThought(context.userQuery, allContext)
      yield {
        type: 'reasoning',
        data: {
          steps: reasoning.thoughts?.map(t => ({
            step: t.step,
            reasoning: t.reasoning?.slice(0, 100),
            confidence: t.confidence
          })) || [],
          conclusion: reasoning.conclusion
        }
      }
    } catch {
      yield { type: 'reasoning', data: { steps: [], conclusion: '' } }
    }
    
    // Yield: Response (streaming from Ollama Cloud)
    const contextText = allContext.join('\n\n')
    const systemPrompt = context.systemPrompt || 'Ti si korisni AI asistent na srpskom jeziku.'
    
    let fullResponse = ''
    
    try {
      const response = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'assistant', content: systemPrompt + (contextText ? `\n\nKontekst:\n${contextText.slice(0, 2000)}` : '') },
            { role: 'user', content: context.userQuery }
          ],
          stream: false
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        fullResponse = data.message?.content || ''
        
        // Stream as tokens
        const words = fullResponse.split(' ')
        for (let i = 0; i < words.length; i++) {
          yield { type: 'response', data: { content: words[i] + ' ', done: false } }
        }
      } else {
        fullResponse = 'Greška pri generisanju odgovora.'
        yield { type: 'response', data: { content: fullResponse, done: false } }
      }
    } catch (e) {
      fullResponse = 'Greška: ' + (e as Error).message
      yield { type: 'response', data: { content: fullResponse, done: false } }
    }
    
    yield { type: 'response', data: { content: '', done: true } }
    
    // Yield: Done
    const duration = Date.now() - this.startTime
    
    yield { 
      type: 'done', 
      data: { 
        tokens: totalTokens + fullResponse.split(' ').length,
        duration,
        citations: retrievalResult.chunks.map(c => ({
          documentId: c.documentId,
          filename: c.filename,
          content: c.content?.slice(0, 150),
          score: c.score
        }))
      } 
    }
  }
  
  private async analyzeQuery(query: string): Promise<QueryAnalysis> {
    try {
      return await this.queryAgent.analyze(query)
    } catch {
      return {
        intent: 'question',
        topics: [],
        complexity: 0.5,
        needsRetrieval: true,
        needsReasoning: true
      }
    }
  }
}

// Singleton instance
let pipelineInstance: AgentPipeline | null = null

export async function getPipeline(): Promise<AgentPipeline> {
  if (!pipelineInstance) {
    pipelineInstance = new AgentPipeline()
    await pipelineInstance.initialize()
  }
  return pipelineInstance
}
