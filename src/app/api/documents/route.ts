import { NextRequest, NextResponse } from 'next/server'
import { 
  saveDocument, 
  getAllDocuments, 
  Document,
  generateEmbedding
} from '@/lib/document-storage'

// Check if database is available
let dbAvailable = false
let db: typeof import('@/lib/db').db | null = null

try {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')) {
    db = require('@/lib/db').db
    dbAvailable = true
  }
} catch (e) {
  console.log('Database not available, using in-memory storage')
}

// GET - List documents
export async function GET() {
  try {
    if (dbAvailable && db) {
      const docs = await db.document.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { chunks: true } } }
      })
      return NextResponse.json({ documents: docs })
    }
    
    // Memory storage
    const docs = getAllDocuments()
      .map(d => ({
        id: d.id,
        filename: d.filename,
        fileType: d.fileType,
        fileSize: d.fileSize,
        chunkCount: d.chunkCount,
        createdAt: d.createdAt
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    
    return NextResponse.json({ documents: docs })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ documents: [] })
  }
}

// POST - Upload document
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    
    let content = ''
    let filename = 'text-input'
    let fileType = 'txt'
    let fileSize = 0

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const text = formData.get('content') as string | null
      
      if (file) {
        filename = file.name
        fileType = file.name.split('.').pop() || 'txt'
        fileSize = file.size
        content = await file.text()
      } else if (text) {
        content = text
        fileSize = Buffer.byteLength(text, 'utf-8')
      }
    } else if (contentType.includes('application/json')) {
      const body = await request.json()
      if (body.content) {
        content = body.content
        fileSize = Buffer.byteLength(content, 'utf-8')
        if (body.filename) filename = body.filename
      }
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Dokument je prazan' }, { status: 400 })
    }

    // Chunking
    const chunkSize = 500
    const chunks: { id: string; content: string; chunkIndex: number; embedding: number[] }[] = []
    const paragraphs = content.split(/\n\n+/)
    let current = ''
    let idx = 0
    
    for (const para of paragraphs) {
      if (current.length + para.length > chunkSize && current.length > 0) {
        chunks.push({ 
          id: `chunk_${idx}`,
          content: current.trim(), 
          chunkIndex: idx++,
          embedding: generateEmbedding(current.trim())
        })
        current = current.slice(-50) + '\n\n' + para
      } else {
        current += (current ? '\n\n' : '') + para
      }
    }
    if (current.trim()) {
      chunks.push({ 
        id: `chunk_${idx}`,
        content: current.trim(), 
        chunkIndex: idx,
        embedding: generateEmbedding(current.trim())
      })
    }

    // Generate ID
    const id = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)

    if (dbAvailable && db) {
      // Use database
      const document = await db.document.create({
        data: {
          filename,
          content,
          fileType,
          fileSize,
          chunkCount: chunks.length,
          chunks: {
            create: chunks.map(c => ({
              content: c.content,
              chunkIndex: c.chunkIndex,
              embedding: JSON.stringify(c.embedding)
            }))
          }
        }
      })
      return NextResponse.json({ document })
    }
    
    // Memory storage
    const document: Document = {
      id,
      filename,
      content,
      fileType,
      fileSize,
      chunkCount: chunks.length,
      chunks: chunks.map(c => ({
        id: c.id,
        documentId: id,
        content: c.content,
        chunkIndex: c.chunkIndex,
        embedding: c.embedding
      })),
      createdAt: new Date()
    }
    
    saveDocument(document)
    
    console.log(`📄 Document saved: ${filename} (${chunks.length} chunks)`)
    
    return NextResponse.json({ 
      document: {
        id: document.id,
        filename: document.filename,
        fileType: document.fileType,
        fileSize: document.fileSize,
        chunkCount: document.chunkCount,
        createdAt: document.createdAt
      }
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Greška pri uploadu' }, { status: 500 })
  }
}
