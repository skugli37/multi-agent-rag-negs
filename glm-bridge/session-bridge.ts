/**
 * GLM Session Bridge
 *
 * Inovativno rešenje: Jedna prijava, trajna sesija!
 *
 * Kako radi:
 * 1. Prvi put se prijaviš na GLM web interfejs
 * 2. Session Bridge uhvati cookies i token
 * 3. Lokalni API proxy koristi tu sesiju
 * 4. Aplikacija komunicira preko lokalnog API-ja
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// Configuration
const CONFIG = {
  // GLM web interface URL - ovo je tvoj lokalni GLM server
  glmWebUrl: 'http://172.25.136.193:8080',
  // Local bridge API port
  bridgePort: 3100,
  // Session storage
  sessionFile: join(__dirname, '.glm-session.json'),
  // Session timeout (24 hours)
  sessionTimeout: 24 * 60 * 60 * 1000
}

interface SessionData {
  cookies: any[]
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
  savedAt: number
  chatId?: string
  userId?: string
  token?: string
}

class GLMSessionBridge {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private session: SessionData | null = null
  private isReady: boolean = false

  async initialize() {
    console.log('🚀 GLM Session Bridge v1.0')
    console.log('=' .repeat(40))

    // Try to load existing session
    if (await this.loadSession()) {
      console.log('✅ Sesija pronađena, pokušavam da je koristim...')
      await this.createBrowserWithSession()
      
      if (await this.testSession()) {
        console.log('✅ Sesija je validna!')
        this.isReady = true
      } else {
        console.log('⚠️ Sesija je istekla, potrebna nova prijava...')
        await this.loginFlow()
      }
    } else {
      console.log('⚠️ Nema sačuvane sesije, pokrećem login flow...')
      await this.loginFlow()
    }
  }

  private async loadSession(): Promise<boolean> {
    if (!existsSync(CONFIG.sessionFile)) return false

    try {
      const data = JSON.parse(readFileSync(CONFIG.sessionFile, 'utf-8'))
      
      // Check if session is expired
      if (Date.now() - data.savedAt > CONFIG.sessionTimeout) {
        console.log('⚠️ Sesija je istekla')
        return false
      }

      this.session = data
      return true
    } catch {
      return false
    }
  }

  private async saveSession() {
    if (!this.context) return

    try {
      const cookies = await this.context.cookies()
      const localStorage = await this.page?.evaluate(() => {
        const items: Record<string, string> = {}
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (key) items[key] = window.localStorage.getItem(key) || ''
        }
        return items
      })

      this.session = {
        cookies,
        localStorage: localStorage || {},
        sessionStorage: {},
        savedAt: Date.now()
      }

      // Extract token if available from cookies
      const authCookie = cookies.find(c => c.name === 'token' || c.name === 'auth')
      if (authCookie) {
        this.session.token = authCookie.value
      }

      writeFileSync(CONFIG.sessionFile, JSON.stringify(this.session, null, 2))
      console.log('💾 Sesija sačuvana!')
    } catch (e) {
      console.error('Greška pri čuvanju sesije:', e)
    }
  }

  private async createBrowserWithSession() {
    this.browser = await chromium.launch({
      headless: true // Headless mode za session reuse
    })

    if (this.session?.cookies?.length) {
      this.context = await this.browser.newContext()
      await this.context.addCookies(this.session.cookies)
    } else {
      this.context = await this.browser.newContext()
    }

    this.page = await this.context.newPage()
  }

  private async testSession(): Promise<boolean> {
    if (!this.page) return false

    try {
      await this.page.goto(CONFIG.glmWebUrl, { timeout: 10000 })
      await this.page.waitForTimeout(2000)

      // Check if we're logged in (look for chat interface)
      const chatExists = await this.page.$('textarea, [contenteditable="true"], .chat-input')
      return !!chatExists
    } catch {
      return false
    }
  }

  private async loginFlow() {
    console.log('\n📱 LOGIN FLOW')
    console.log('-'.repeat(40))

    // Launch visible browser for user to login
    this.browser = await chromium.launch({
      headless: false, // Show browser for login
      slowMo: 100
    })

    this.context = await this.browser.newContext()
    this.page = await this.context.newPage()

    console.log(`🌐 Otvaram GLM na: ${CONFIG.glmWebUrl}`)
    await this.page.goto(CONFIG.glmWebUrl)

    console.log('\n⏳ Molim vas da se prijavite u browser-u...')
    console.log('   Nakon prijave, pritisnite Enter u terminalu')

    // Wait for user to login and press Enter
    await new Promise<void>(resolve => {
      process.stdin.once('data', () => resolve())
    })

    // Save session after login
    await this.saveSession()
    this.isReady = true

    console.log('✅ Prijava uspešna! Sesija je sačuvana.')
    
    // Close visible browser, we'll use headless from now
    await this.browser.close()
    this.browser = null
    
    // Recreate in headless mode
    await this.createBrowserWithSession()
  }

  // API: Chat completion using session
  async chat(messages: { role: string; content: string }[]): Promise<string> {
    if (!this.isReady || !this.page) {
      throw new Error('Sesija nije spremna')
    }

    try {
      // Navigate to chat
      await this.page.goto(CONFIG.glmWebUrl)
      await this.page.waitForTimeout(1000)

      // Find input field
      const inputSelector = 'textarea, [contenteditable="true"], input[type="text"]'
      await this.page.waitForSelector(inputSelector, { timeout: 5000 })

      // Get last user message
      const lastMessage = messages.filter(m => m.role === 'user').pop()
      if (!lastMessage) throw new Error('Nema poruke')

      // Type message
      const input = await this.page.$(inputSelector)
      if (!input) throw new Error('Input nije pronađen')

      await input.click()
      await input.fill(lastMessage.content)
      await this.page.waitForTimeout(500)

      // Submit (try different methods)
      const submitSelectors = [
        'button[type="submit"]',
        'button:has-text("Send")',
        'button:has-text("Pošalji")',
        'button[aria-label*="send"]',
        '.send-button'
      ]

      for (const selector of submitSelectors) {
        const btn = await this.page.$(selector)
        if (btn) {
          await btn.click()
          break
        }
      }

      // If no button found, try Enter
      await input.press('Enter')

      // Wait for response
      await this.page.waitForTimeout(3000)

      // Get response (look for last assistant message)
      const responseSelectors = [
        '.assistant-message:last-child',
        '.ai-response:last-child',
        '[data-role="assistant"]:last-child',
        '.message:last-child'
      ]

      let response = ''
      for (const selector of responseSelectors) {
        const el = await this.page.$(selector)
        if (el) {
          response = await el.textContent() || ''
          if (response) break
        }
      }

      // If no specific selector worked, try to get all text
      if (!response) {
        // Wait a bit more for streaming to complete
        await this.page.waitForTimeout(2000)
        
        // Get all text content
        const body = await this.page.$('body')
        if (body) {
          const allText = await body.textContent()
          // Extract last meaningful part
          const parts = allText?.split('\n').filter(p => p.trim().length > 20)
          response = parts?.pop() || 'Nema odgovora'
        }
      }

      return response.trim()
    } catch (e) {
      console.error('Chat greška:', e)
      throw e
    }
  }

  // Start local API server
  startAPIServer() {
    const server = createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

      if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
      }

      // Health check
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          status: 'ok',
          ready: this.isReady,
          sessionAge: this.session ? Date.now() - this.session.savedAt : null
        }))
        return
      }

      // Chat endpoint
      if (req.url === '/chat' && req.method === 'POST') {
        let body = ''
        req.on('data', chunk => body += chunk)
        req.on('end', async () => {
          try {
            const { message, messages } = JSON.parse(body)
            const chatMessages = messages || [{ role: 'user', content: message }]
            
            const response = await this.chat(chatMessages)
            
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ response }))
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: (e as Error).message }))
          }
        })
        return
      }

      // Status page
      if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <html>
            <head><title>GLM Session Bridge</title></head>
            <body style="font-family: system-ui; padding: 40px; background: #1a1a2e; color: white;">
              <h1>🌉 GLM Session Bridge</h1>
              <p>Status: ${this.isReady ? '✅ Aktivan' : '⏳ Čekam sesiju...'}</p>
              <p>Sesija: ${this.session ? 'Sačuvana' : 'Nema'}</p>
              <h2>API Endpoints:</h2>
              <ul>
                <li><code>POST /chat</code> - Pošalji poruku</li>
                <li><code>GET /health</code> - Provera statusa</li>
              </ul>
              <h2>Usage:</h2>
              <pre style="background: #2a2a4e; padding: 20px; border-radius: 8px;">
curl -X POST http://localhost:${CONFIG.bridgePort}/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Zdravo!"}'
              </pre>
            </body>
          </html>
        `)
        return
      }

      res.writeHead(404)
      res.end('Not found')
    })

    server.listen(CONFIG.bridgePort, () => {
      console.log(`\n🌐 API Server running on http://localhost:${CONFIG.bridgePort}`)
      console.log(`   POST /chat - Pošalji poruku`)
      console.log(`   GET /health - Provera statusa`)
    })
  }

  async close() {
    await this.browser?.close()
  }
}

// Main
async function main() {
  const bridge = new GLMSessionBridge()
  
  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\n👋 Gasim bridge...')
    await bridge.close()
    process.exit(0)
  })

  await bridge.initialize()
  bridge.startAPIServer()

  console.log('\n✅ GLM Session Bridge je spreman!')
  console.log('   Koristi lokalni API za sve zahteve.')
}

main().catch(console.error)
