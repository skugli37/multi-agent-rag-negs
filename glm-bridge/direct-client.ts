/**
 * GLM Direct Client
 *
 * Direktan pristup GLM API-ju bez tunnel-a!
 * Koristi lokalni GLM server direktno.
 */

import ZAI from 'z-ai-web-dev-sdk'

// Konfiguracija - koristi lokalni GLM server direktno
const GLM_CONFIG = {
  baseUrl: 'http://172.25.136.193:8080/v1',
  apiKey: 'Z.ai', // Default API key za lokalni server
}

// Global ZAI instance
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

export async function getGLMClient() {
  if (!zaiInstance) {
    // Kreiraj config fajl ako ne postoji
    const fs = await import('fs')
    const configPath = '/home/z/my-project/.z-ai-config'
    
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(GLM_CONFIG, null, 2))
    }
    
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

// Chat funkcija
export async function chat(message: string, history: {role: string, content: string}[] = []) {
  const client = await getGLMClient()
  
  const messages = [
    { role: 'system', content: 'Ti si korisni AI asistent. Odgovaraj na jeziku korisnika.' },
    ...history,
    { role: 'user', content: message }
  ]
  
  const response = await client.chat.completions.create({
    messages,
    temperature: 0.7,
    max_tokens: 2000
  })
  
  return response.choices[0]?.message?.content || ''
}

// Export za direktan poziv
export default { getGLMClient, chat }
