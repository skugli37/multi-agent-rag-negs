// In-memory storage for Vercel serverless environment
// Falls back when database is not available

interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'agent'
  content: string
  createdAt: Date
  agentName?: string
  confidence?: number
}

interface Conversation {
  id: string
  title: string | null
  createdAt: Date
  updatedAt: Date
  messages: Message[]
}

interface AgentRun {
  id: string
  conversationId: string
  orchestratorPlan: string | null
  queryAnalysis: string | null
  retrievalResults: string | null
  reasoningChain: string | null
  finalResponse: string | null
  totalTokens: number
  status: string
  createdAt: Date
}

// Global in-memory storage
declare global {
  // eslint-disable-next-line no-var
  var memoryConversations: Map<string, Conversation> | undefined
  // eslint-disable-next-line no-var
  var memoryAgentRuns: Map<string, AgentRun> | undefined
}

// Initialize global storage if not exists
if (!globalThis.memoryConversations) {
  globalThis.memoryConversations = new Map()
}
if (!globalThis.memoryAgentRuns) {
  globalThis.memoryAgentRuns = new Map()
}

const conversations = globalThis.memoryConversations!
const agentRuns = globalThis.memoryAgentRuns!

// Helper to generate IDs
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Storage API
export const storage = {
  // Conversations
  async createConversation(id?: string): Promise<Conversation> {
    const conversationId = id || generateId()
    const conversation: Conversation = {
      id: conversationId,
      title: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: []
    }
    conversations.set(conversationId, conversation)
    return conversation
  },

  async getConversation(id: string): Promise<Conversation | null> {
    return conversations.get(id) || null
  },

  async getConversations(): Promise<Conversation[]> {
    return Array.from(conversations.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  },

  async updateConversationTitle(id: string, title: string): Promise<void> {
    const conv = conversations.get(id)
    if (conv) {
      conv.title = title
      conv.updatedAt = new Date()
    }
  },

  // Messages
  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system' | 'agent',
    content: string,
    agentName?: string,
    confidence?: number
  ): Promise<Message> {
    const conv = conversations.get(conversationId)
    if (!conv) {
      throw new Error('Conversation not found')
    }
    
    const message: Message = {
      id: generateId(),
      conversationId,
      role,
      content,
      createdAt: new Date(),
      agentName,
      confidence
    }
    
    conv.messages.push(message)
    conv.updatedAt = new Date()
    
    // Auto-title from first user message
    if (!conv.title && role === 'user') {
      conv.title = content.substring(0, 50) + (content.length > 50 ? '...' : '')
    }
    
    return message
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    const conv = conversations.get(conversationId)
    return conv?.messages || []
  },

  // Agent Runs
  async createAgentRun(conversationId: string): Promise<AgentRun> {
    const agentRun: AgentRun = {
      id: generateId(),
      conversationId,
      orchestratorPlan: null,
      queryAnalysis: null,
      retrievalResults: null,
      reasoningChain: null,
      finalResponse: null,
      totalTokens: 0,
      status: 'pending',
      createdAt: new Date()
    }
    agentRuns.set(agentRun.id, agentRun)
    return agentRun
  },

  async getAgentRun(id: string): Promise<AgentRun | null> {
    return agentRuns.get(id) || null
  },

  async updateAgentRun(id: string, data: Partial<AgentRun>): Promise<void> {
    const run = agentRuns.get(id)
    if (run) {
      Object.assign(run, data)
    }
  },

  async getAgentRunsByConversation(conversationId: string): Promise<AgentRun[]> {
    return Array.from(agentRuns.values())
      .filter(run => run.conversationId === conversationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  },

  // Utility
  async clear(): Promise<void> {
    conversations.clear()
    agentRuns.clear()
  }
}

export default storage
