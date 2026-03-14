// Orchestrator Agent - Coordinates all agents with NEGS evolution

import ZAI from 'z-ai-web-dev-sdk'
import { 
  AgentName, OrchestrationPlan, AgentContext, AgentResponse 
} from './types'
import { selectTools } from '../tools'
import { ExpertGenomeManager } from './expert-genome'
import { storage } from '../storage'

// ============ ORCHESTRATOR WITH GENOME ============

export class OrchestratorAgent {
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null
  private startTime: number = 0
  
  async initialize(): Promise<void> {
    this.zai = await ZAI.create()
  }
  
  // Plan based on query complexity AND agent fitness
  async plan(context: AgentContext): Promise<OrchestrationPlan> {
    const complexity = await this.analyzeComplexity(context.userQuery)
    const tools = selectTools(context.userQuery)
    
    // NEGS: Analyze query patterns
    const detectedDomains = ExpertGenomeManager.analyzeQueryPattern(context.userQuery, true, 0)
    
    // Get agent fitness scores
    const genomeStats = ExpertGenomeManager.getStats()
    
    let strategy: OrchestrationPlan['strategy']
    let steps: OrchestrationPlan['steps']
    
    if (complexity < 0.3) {
      strategy = 'quick'
      steps = [
        { agent: 'query', action: 'analyze', dependencies: [], parallel: false },
        { agent: 'response', action: 'synthesize', dependencies: ['query'], parallel: false }
      ]
    } else if (complexity > 0.7) {
      strategy = 'comprehensive'
      steps = [
        { agent: 'query', action: 'analyze', dependencies: [], parallel: false },
        { agent: 'query', action: 'decompose', dependencies: ['query'], parallel: false },
        { agent: 'retrieval', action: 'search', dependencies: ['query'], parallel: true },
        { agent: 'reasoning', action: 'chain_of_thought', dependencies: ['retrieval'], parallel: false },
        { agent: 'reasoning', action: 'verify', dependencies: ['reasoning'], parallel: false },
        { agent: 'response', action: 'synthesize', dependencies: ['reasoning'], parallel: false },
        { agent: 'reflection', action: 'evaluate', dependencies: ['response'], parallel: false }
      ]
    } else {
      strategy = 'standard'
      steps = [
        { agent: 'query', action: 'analyze', dependencies: [], parallel: false },
        { agent: 'retrieval', action: 'search', dependencies: ['query'], parallel: false },
        { agent: 'reasoning', action: 'reason', dependencies: ['retrieval'], parallel: false },
        { agent: 'response', action: 'synthesize', dependencies: ['reasoning'], parallel: false }
      ]
    }
    
    // Add tools if needed
    for (const tool of tools) {
      steps.splice(1, 0, {
        agent: 'query',
        action: `tool:${tool}`,
        dependencies: [],
        parallel: true
      })
    }
    
    return {
      steps,
      currentStep: 0,
      totalSteps: steps.length,
      estimatedTokens: steps.length * 500,
      strategy
    }
  }
  
  private async analyzeComplexity(query: string): Promise<number> {
    let score = 0
    
    if (query.length > 100) score += 0.2
    if (query.length > 200) score += 0.1
    
    const questionCount = (query.match(/\?/g) || []).length
    score += Math.min(questionCount * 0.15, 0.3)
    
    if (/and|or|but|however|although|because|therefore|thus|if|then/i.test(query)) {
      score += 0.15
    }
    
    const conceptIndicators = ['compare', 'contrast', 'analyze', 'evaluate', 'explain', 'describe']
    for (const indicator of conceptIndicators) {
      if (query.toLowerCase().includes(indicator)) score += 0.1
    }
    
    if (/\b(api|algorithm|function|method|class|database|query|code|implement)\b/i.test(query)) {
      score += 0.1
    }
    
    return Math.min(score, 1)
  }
  
  // Process query with genome tracking
  async process(context: AgentContext): Promise<{
    response: string
    confidence: number
    agentSteps: { agent: AgentName; action: string; success: boolean; duration: number }[]
  }> {
    this.startTime = Date.now()
    const agentSteps: { agent: AgentName; action: string; success: boolean; duration: number }[] = []
    
    // Create plan
    const plan = await this.plan(context)
    
    // Build messages
    const messages: Array<{ role: string; content: string }> = []
    
    let system = context.systemPrompt || 'Ti si korisni AI asistent. Odgovaraj na jeziku korisnika.'
    
    // Add genome context
    const genomeStats = ExpertGenomeManager.getStats()
    if (genomeStats.topAgents.length > 0) {
      system += `\n\n[System: Agent fitness - ${genomeStats.topAgents.map(a => `${a.name}:${(a.fitness*100).toFixed(0)}%`).join(', ')}]`
    }
    
    messages.push({ role: 'system', content: system })
    
    // Add history
    for (const msg of context.messageHistory.slice(-10)) {
      messages.push({ role: msg.role, content: msg.content })
    }
    
    messages.push({ role: 'user', content: context.userQuery })
    
    // Execute with timing
    const queryStart = Date.now()
    
    try {
      const completion = await this.zai!.chat.completions.create({
        messages,
        temperature: 0.7,
        max_tokens: 1500
      })
      
      const response = completion.choices[0]?.message?.content || 'Nema odgovora'
      const latency = Date.now() - queryStart
      
      // NEGS: Update all agent metrics based on success
      for (const step of plan.steps) {
        ExpertGenomeManager.updateMetrics(step.agent, true, latency / plan.steps.length)
        agentSteps.push({
          agent: step.agent,
          action: step.action,
          success: true,
          duration: latency / plan.steps.length
        })
      }
      
      // Analyze pattern with success
      ExpertGenomeManager.analyzeQueryPattern(context.userQuery, true, latency)
      
      return {
        response,
        confidence: 0.85,
        agentSteps
      }
      
    } catch (error) {
      const latency = Date.now() - queryStart
      
      // Update metrics with failure
      for (const step of plan.steps) {
        ExpertGenomeManager.updateMetrics(step.agent, false, latency / plan.steps.length)
        agentSteps.push({
          agent: step.agent,
          action: step.action,
          success: false,
          duration: latency / plan.steps.length
        })
      }
      
      ExpertGenomeManager.analyzeQueryPattern(context.userQuery, false, latency)
      
      throw error
    }
  }
}

// ============ QUERY AGENT ============

export class QueryAgent {
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null
  
  async initialize(): Promise<void> {
    this.zai = await ZAI.create()
  }
  
  async analyze(query: string): Promise<{
    intent: string
    entities: { text: string; type: string; confidence: number }[]
    rewritten: string[]
    expanded: string[]
    complexity: number
  }> {
    const genome = ExpertGenomeManager.getGenome('query')
    const creativity = genome?.behavior.creativityLevel || 0.5
    
    const prompt = `Analyze this user query:
1. Intent (question/command/request/statement)
2. Key entities (names, places, concepts)
3. Query rewrites (2-3 alternatives)
4. Related terms

Query: "${query}"

JSON: {"intent":"...", "entities":[...], "rewritten":[...], "expanded":[...]}`

    try {
      const completion = await this.zai!.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3 + creativity * 0.2,
        max_tokens: 500
      })

      const response = completion.choices[0]?.message?.content || '{}'
      const parsed = JSON.parse(response)
      
      return {
        intent: parsed.intent || 'question',
        entities: parsed.entities || [],
        rewritten: parsed.rewritten || [query],
        expanded: parsed.expanded || [],
        complexity: this.calculateComplexity(query, parsed.entities?.length || 0)
      }
    } catch {
      return {
        intent: 'question',
        entities: [],
        rewritten: [query],
        expanded: [],
        complexity: 0.5
      }
    }
  }
  
  private calculateComplexity(query: string, entityCount: number): number {
    let score = 0
    const words = query.split(/\s+/).length
    score += Math.min(words / 50, 0.3)
    score += Math.min(entityCount / 5, 0.2)
    score += Math.min((query.match(/\?/g) || []).length * 0.1, 0.2)
    if (/\b(and|or|but|however|although|because)\b/i.test(query)) score += 0.15
    return Math.min(score, 1)
  }
}

// Export singleton
export const orchestrator = new OrchestratorAgent()
export const queryAgent = new QueryAgent()
