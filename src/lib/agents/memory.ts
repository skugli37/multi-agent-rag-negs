// Memory Systems - Simplified for current schema

import { generateEmbedding, cosineSimilarity } from './embeddings'

// ============ WORKING MEMORY ============

interface WorkingMemoryItem {
  id: string
  content: string
  embedding: number[]
  importance: number
  accessCount: number
  createdAt: Date
}

const workingMemory = new Map<string, WorkingMemoryItem>()
const MAX_WORKING_MEMORY = 50

export function addToWorkingMemory(
  conversationId: string,
  content: string,
  importance: number = 0.5
): void {
  const id = `${conversationId}-${Date.now()}`
  const embedding = generateEmbedding(content)
  
  workingMemory.set(id, {
    id,
    content,
    embedding,
    importance,
    accessCount: 1,
    createdAt: new Date()
  })
  
  if (workingMemory.size > MAX_WORKING_MEMORY) {
    const oldest = Array.from(workingMemory.keys()).slice(0, 10)
    for (const key of oldest) {
      workingMemory.delete(key)
    }
  }
}

export function getRelevantFromWorkingMemory(
  query: string,
  topK: number = 5
): string[] {
  const queryEmbedding = generateEmbedding(query)
  
  const scored = Array.from(workingMemory.values()).map(item => {
    const similarity = cosineSimilarity(queryEmbedding, item.embedding)
    return { item, score: similarity * item.importance }
  })
  
  scored.sort((a, b) => b.score - a.score)
  
  return scored.slice(0, topK).map(s => s.item.content)
}

// ============ EPISODIC MEMORY ============

export async function storeEpisodicMemory(
  conversationId: string,
  content: string,
  importance: number = 0.5
): Promise<void> {
  // Simplified - just store in working memory
  addToWorkingMemory(conversationId, `[STORED] ${content}`, importance)
}

export async function retrieveEpisodicMemory(
  conversationId: string,
  query: string,
  topK: number = 5
): Promise<{ content: string; importance: number }[]> {
  const items = getRelevantFromWorkingMemory(query, topK)
  return items.map(content => ({ content, importance: 0.5 }))
}

// ============ KNOWLEDGE GRAPH ============

export async function updateKnowledgeGraph(
  conversationId: string,
  text: string
): Promise<void> {
  // Simplified - store in working memory
  addToWorkingMemory(conversationId, `[KG] ${text.slice(0, 200)}`, 0.3)
}

// ============ CONSOLIDATED MEMORY RETRIEVAL ============

export async function retrieveAllMemory(
  conversationId: string,
  query: string,
  options: {
    workingMemory?: boolean
    episodicMemory?: boolean
    knowledgeGraph?: boolean
    topK?: number
  } = {}
): Promise<{
  working: string[]
  episodic: { content: string; importance: number }[]
  knowledge: { entity: string; type: string; related: string[] }[]
}> {
  const {
    workingMemory: useWorking = true,
    episodicMemory: useEpisodic = true,
    knowledgeGraph: useKG = true,
    topK = 5
  } = options
  
  return {
    working: useWorking ? getRelevantFromWorkingMemory(query, topK) : [],
    episodic: useEpisodic ? await retrieveEpisodicMemory(conversationId, query, topK) : [],
    knowledge: []
  }
}
