// Agent Types and Interfaces - Extended with NEGS (Neural Expert Genesis System)

export type AgentName = 'orchestrator' | 'query' | 'retrieval' | 'reasoning' | 'response' | 'reflection'
export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed'
export type MemoryType = 'working' | 'episodic' | 'semantic'

// ============ EXPERT GENOME (NEGS) ============

export interface ExpertGenome {
  // Identity
  name: AgentName
  generation: number
  createdAt: Date
  
  // Domains & Competence
  domains: DomainCompetence[]
  primaryDomain: string
  
  // Behavioral DNA
  behavior: {
    verbosity: number        // 0.0 - 1.0
    certaintyThreshold: number // 0.0 - 1.0
    creativityLevel: number   // 0.0 - 1.0
    collaborationScore: number // 0.0 - 1.0
  }
  
  // Learning DNA
  learning: {
    learningRate: number      // 0.0 - 1.0
    adaptationSpeed: number   // 0.0 - 1.0
    memoryRetention: number   // 0.0 - 1.0
  }
  
  // Performance Metrics
  metrics: {
    totalInvocations: number
    successRate: number
    averageLatency: number
    userSatisfactionScore: number
  }
  
  // Evolution
  fitness: number
  mutations: number
  lastEvolved: Date
}

export interface DomainCompetence {
  domain: string
  competence: number  // 0.0 - 1.0
  confidence: number  // 0.0 - 1.0
  experience: number  // broj query-a
}

// ============ ORIGINAL TYPES ============

export interface AgentState {
  name: AgentName
  status: AgentStatus
  confidence: number
  lastAction: string
  tokens: number
  duration: number
  genome?: ExpertGenome  // NEGS: svaki agent ima genome
}

export interface AgentStep {
  agentName: AgentName
  action: string
  input: unknown
  output: unknown
  tokens: number
  duration: number
  confidence?: number
  success: boolean
  error?: string
}

export interface OrchestrationPlan {
  steps: PlannedStep[]
  currentStep: number
  totalSteps: number
  estimatedTokens: number
  strategy: 'standard' | 'deep' | 'quick' | 'comprehensive'
}

export interface PlannedStep {
  agent: AgentName
  action: string
  dependencies: string[]
  parallel: boolean
}

export interface QueryAnalysis {
  original: string
  rewritten: string[]
  expanded: string[]
  decomposed: string[]
  intent: string
  entities: ExtractedEntity[]
  complexity: number // 0-1
  requiresTools: string[]
}

export interface ExtractedEntity {
  text: string
  type: string
  confidence: number
}

export interface RetrievalResult {
  chunks: RetrievedChunk[]
  strategy: string
  totalFound: number
  reranked: boolean
  scores: number[]
}

export interface RetrievedChunk {
  id: string
  content: string
  documentId: string
  filename: string
  score: number
  semanticScore: number
  keywordScore: number
}

export interface ReasoningChain {
  thoughts: Thought[]
  conclusion: string
  confidence: number
  requiresMore: boolean
}

export interface Thought {
  step: number
  reasoning: string
  evidence: string[]
  confidence: number
}

export interface ResponseSynthesis {
  content: string
  citations: Citation[]
  confidence: number
  sources: string[]
  needsRefinement: boolean
}

export interface Citation {
  documentId: string
  filename: string
  content: string
  score: number
}

export interface SelfReflection {
  accuracy: number
  completeness: number
  relevance: number
  clarity: number
  issues: string[]
  suggestions: string[]
  refinedContent?: string
}

export interface ToolCall {
  tool: string
  input: unknown
  output?: unknown
  success: boolean
  error?: string
}

export interface AgentContext {
  conversationId: string
  messageHistory: Message[]
  workingMemory: Memory[]
  userQuery: string
  systemPrompt?: string
  useRag: boolean
  maxTokens: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'agent'
  content: string
  createdAt: Date
}

export interface Memory {
  id: string
  type: MemoryType
  content: string
  importance: number
  createdAt: Date
}

// Agent Response Types
export interface AgentResponse<T> {
  success: boolean
  data?: T
  error?: string
  tokens: number
  duration: number
  confidence: number
}

// Tool Definition
export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (input: unknown) => Promise<unknown>
}

// ============ NEGS: Evolution Event ============

export interface EvolutionEvent {
  timestamp: Date
  type: 'mutation' | 'crossover' | 'selection' | 'fitness_update'
  agentName: AgentName
  changes: {
    field: string
    oldValue: unknown
    newValue: unknown
  }[]
  reason: string
  fitnessBefore: number
  fitnessAfter: number
}

// ============ NEGS: Query Pattern ============

export interface QueryPattern {
  domain: string
  keywords: string[]
  count: number
  lastSeen: Date
  avgSuccess: number
  avgLatency: number
}
