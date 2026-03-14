import { NextResponse } from 'next/server'
import { storage } from '@/lib/storage'

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

export async function GET() {
  try {
    let conversations
    
    if (dbAvailable && db) {
      conversations = await db.conversation.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 50
      })
    } else {
      conversations = await storage.getConversations()
    }
    
    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json({ conversations: [] })
  }
}
