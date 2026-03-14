import { NextResponse } from 'next/server'
import { getStatus, getTunnelUrl, ensureStarted } from '@/lib/auto-start'

export async function GET() {
  try {
    // Osiguraj da je tunnel pokrenut
    const url = await ensureStarted()
    const status = getStatus()
    
    return NextResponse.json({
      ...status,
      message: status.tunnelUrl ? 
        'Tunnel je aktivan!' : 
        'Čekam na tunnel...'
    })
  } catch (error) {
    return NextResponse.json({
      initialized: false,
      tunnelUrl: null,
      hasTunnel: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
