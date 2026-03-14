/**
 * Auto-Start Manager
 * 
 * Automatski pokreće server i tunnel kada se aplikacija startuje
 * Sve radi bez ikakvih manualnih komandi kor intervencije!
 */

import { spawn } from 'child_process'

let tunnelProcess: any = null
let tunnelUrl: string | ''
let isInitialized = false

// Pokreće tunnel i dobija URL
export async function getTunnelUrl(): Promise<string | null> {
  return tunnelUrl
}

export function isReady(): boolean {
  return isInitialized && !!tunnelUrl
}

// API endpoint za status
export function getStatus() {
  return {
    initialized: isInitialized,
    tunnelUrl: tunnelUrl,
    hasTunnel: !!tunnelProcess
  }
}

// Inicijalizacija (poziva se iz API-ja)
export async function ensureStarted(): Promise<string> {
  if (isInitialized) {
    return tunnelUrl || 'ready'
  }
  
  // Pokreni tunnel ako već nije pokrenut
  if (!tunnelProcess) {
    return await startTunnel()
  }
  
  return tunnelUrl || 'ready'
}

async function startTunnel(): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('🌐 Starting Cloudflare tunnel...')
    
    tunnelProcess = spawn('/tmp/cloudflared', [
      'tunnel',
      '--url',
      'http://localhost:3000'
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    let output = ''
    
    tunnelProcess.stdout?.on('data', (data) => {
      const text = data.toString()
      output += text
      
      // Nađi URL
      const match = text.match(/https:\/\/[^\s]+\.trycloudflare\.com/)
      if (match) {
        tunnelUrl = match[0]
        isInitialized = true
        console.log('✅ Tunnel URL:', tunnelUrl)
        resolve(tunnelUrl)
      }
    })
    
    tunnelProcess.stderr?.on('data', (data) => {
      // Ignoruj stderr
    })
    
    tunnelProcess.on('error', (err) => {
      console.error('Tunnel error:', err)
      reject(err)
    })
    
    // Timeout nakon 30 sekundi
    setTimeout(() => {
      if (!tunnelUrl) {
        reject(new Error('Tunnel timeout'))
      }
    }, 30000)
  })
}

// Cleanup
process.on('SIGINT', () => {
  if (tunnelProcess) {
    tunnelProcess.kill()
  }
})

process.on('SIGTERM', () => {
  if (tunnelProcess) {
    tunnelProcess.kill()
  }
})
