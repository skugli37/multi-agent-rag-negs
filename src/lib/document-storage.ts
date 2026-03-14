/**
 * Shared In-Memory Storage for Documents
 * 
 * Ovo se koristi za RAG kada baza nije dostupna
 */

export interface DocumentChunk {
  id: string
  documentId: string
  content: string
  chunkIndex: number
  embedding: number[]
}

export interface Document {
  id: string
  filename: string
  content: string
  fileType: string
  fileSize: number
  chunkCount: number
  chunks: DocumentChunk[]
  createdAt: Date
}

// Global storage
declare global {
  // eslint-disable-next-line no-var
  var memoryDocuments: Map<string, Document> | undefined
}

// Initialize if not exists
if (!globalThis.memoryDocuments) {
  globalThis.memoryDocuments = new Map()
}

export const documents = globalThis.memoryDocuments

// Helper functions
export function getDocument(id: string): Document | undefined {
  return documents.get(id)
}

export function getAllDocuments(): Document[] {
  return Array.from(documents.values())
}

export function saveDocument(doc: Document): void {
  documents.set(doc.id, doc)
}

export function deleteDocument(id: string): boolean {
  return documents.delete(id)
}

// RAG Search function
export function searchDocuments(query: string, topK: number = 3): {
  documentId: string
  filename: string
  content: string
  score: number
}[] {
  const allDocs = getAllDocuments()
  if (allDocs.length === 0) return []

  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)

  const results: { documentId: string; filename: string; content: string; score: number }[] = []

  for (const doc of allDocs) {
    // Search in full content
    const contentLower = doc.content.toLowerCase()
    
    // Calculate simple keyword match score
    let matchScore = 0
    for (const word of queryWords) {
      const regex = new RegExp(word, 'gi')
      const matches = contentLower.match(regex)
      if (matches) {
        matchScore += matches.length
      }
    }

    // Also search in chunks for more precise results
    for (const chunk of doc.chunks) {
      const chunkLower = chunk.content.toLowerCase()
      let chunkScore = 0
      
      for (const word of queryWords) {
        const regex = new RegExp(word, 'gi')
        const matches = chunkLower.match(regex)
        if (matches) {
          chunkScore += matches.length
        }
      }

      if (chunkScore > 0) {
        results.push({
          documentId: doc.id,
          filename: doc.filename,
          content: chunk.content.slice(0, 300),
          score: chunkScore / queryWords.length
        })
      }
    }

    // If no chunk matches, use full document
    if (matchScore > 0 && !results.some(r => r.documentId === doc.id)) {
      results.push({
        documentId: doc.id,
        filename: doc.filename,
        content: doc.content.slice(0, 300),
        score: matchScore / queryWords.length
      })
    }
  }

  // Sort by score and return top K
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter(r => r.score > 0)
}

// Generate embedding (simple hash-based)
export function generateEmbedding(text: string): number[] {
  const dim = 384
  const embedding = new Array(dim).fill(0)
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  
  for (const word of words) {
    let h = 0
    for (let i = 0; i < word.length; i++) {
      h = ((h << 5) - h) + word.charCodeAt(i)
      h = h & h
    }
    for (let i = 0; i < 5; i++) {
      const idx = Math.abs((h + i * 77) % dim)
      embedding[idx] += 1 / (1 + i)
    }
  }
  
  const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0))
  if (norm > 0) for (let i = 0; i < dim; i++) embedding[i] /= norm
  return embedding
}
