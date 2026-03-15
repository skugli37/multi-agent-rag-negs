// Orchestrator & Query Agent - Simplified

import { AgentContext, OrchestrationPlan } from './types'
import { selectTools } from '../tools'

// ============ ORCHESTRATOR AGENT ============

export class OrchestratorAgent {
  async initialize(): Promise<void> {}
  
  async plan(context: AgentContext): Promise<OrchestrationPlan> {
    const complexity = this.analyzeComplexity(context.userQuery)
    const tools = selectTools(context.userQuery)
    
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
        { agent: 'retrieval', action: 'search', dependencies: ['query'], parallel: true },
        { agent: 'reasoning', action: 'chain_of_thought', dependencies: ['retrieval'], parallel: false },
        { agent: 'response', action: 'synthesize', dependencies: ['reasoning'], parallel: false }
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
  
  private analyzeComplexity(query: string): number {
    let score = 0
    
    if (query.length > 100) score += 0.2
    if (query.length > 200) score += 0.1
    
    const questionCount = (query.match(/\?/g) || []).length
    score += Math.min(questionCount * 0.15, 0.3)
    
    if (/and|or|but|however|because|if|then/i.test(query)) {
      score += 0.15
    }
    
    if (/\b(api|algorithm|function|code|implement)\b/i.test(query)) {
      score += 0.1
    }
    
    return Math.min(score, 1)
  }
}

// ============ QUERY AGENT ============

export class QueryAgent {
  async initialize(): Promise<void> {}
  
  async analyze(query: string): Promise<{
    intent: string
    topics: string[]
    complexity: number
    needsRetrieval: boolean
    needsReasoning: boolean
  }> {
    const complexity = this.calculateComplexity(query)
    
    return {
      intent: query.includes('?') ? 'question' : 'statement',
      topics: query.split(/\s+/).filter(w => w.length > 4).slice(0, 5),
      complexity,
      needsRetrieval: complexity > 0.3,
      needsReasoning: complexity > 0.5
    }
  }
  
  private calculateComplexity(query: string): number {
    let score = 0
    
    const words = query.split(/\s+/).length
    score += Math.min(words / 50, 0.3)
    
    const questionCount = (query.match(/\?/g) || []).length
    score += Math.min(questionCount * 0.15, 0.3)
    
    if (/\b(and|or|but|however|because)\b/i.test(query)) {
      score += 0.2
    }
    
    return Math.min(score, 1)
  }
}
