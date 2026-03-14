/**
 * GLM Standalone Chat Server
 *
 * Kompletna aplikacija koja:
 * - Radi na lokalnom serveru
 * - Pristupa GLM direktno
 * - Bez tunela, bez cloud-a
 * - Jednom pokrenuta, zauvek radi!
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import ZAI from 'z-ai-web-dev-sdk'

// ============ CONFIG ============
const CONFIG = {
  port: 3200,
  host: '0.0.0.0', // Dostupno na mreži!
  glm: {
    baseUrl: 'http://172.25.136.193:8080/v1',
    apiKey: 'Z.ai'
  }
}

// ============ SESSION STORAGE ============
interface Session {
  id: string
  messages: { role: string; content: string; timestamp: number }[]
  createdAt: number
}

const sessions = new Map<string, Session>()

// ============ GLM CLIENT ============
let zaiInstance: any = null

async function initGLM() {
  const configPath = join('/home/z/my-project', '.z-ai-config')
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(CONFIG.glm, null, 2))
  }
  zaiInstance = await ZAI.create()
  console.log('✅ GLM klijent inicijalizovan!')
}

async function chat(userMessage: string, sessionId: string): Promise<string> {
  if (!zaiInstance) await initGLM()
  
  // Get or create session
  let session = sessions.get(sessionId)
  if (!session) {
    session = {
      id: sessionId,
      messages: [],
      createdAt: Date.now()
    }
    sessions.set(sessionId, session)
  }
  
  // Add user message
  session.messages.push({
    role: 'user',
    content: userMessage,
    timestamp: Date.now()
  })
  
  // Build history
  const history = session.messages.slice(-20).map(m => ({
    role: m.role,
    content: m.content
  }))
  
  // Get response
  const messages = [
    { role: 'system', content: 'Ti si pametan AI asistent. Odgovaraj na jeziku korisnika. Budu koncizan i precizan.' },
    ...history
  ]
  
  const response = await zaiInstance.chat.completions.create({
    messages,
    temperature: 0.7,
    max_tokens: 2000
  })
  
  const assistantMessage = response.choices[0]?.message?.content || 'Nema odgovora'
  
  // Save response
  session.messages.push({
    role: 'assistant',
    content: assistantMessage,
    timestamp: Date.now()
  })
  
  return assistantMessage
}

// ============ HTTP SERVER ============
const HTML_PAGE = `
<!DOCTYPE html>
<html lang="sr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#7c3aed">
  <title>GLM Chat - Lokalni AI</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      background: rgba(0,0,0,0.3);
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .header h1 { font-size: 18px; font-weight: 600; }
    .header .badge {
      background: #7c3aed;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 500;
    }
    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .message {
      max-width: 85%;
      padding: 14px 18px;
      border-radius: 18px;
      line-height: 1.5;
      font-size: 15px;
    }
    .message.user {
      align-self: flex-end;
      background: linear-gradient(135deg, #7c3aed, #9333ea);
      border-bottom-right-radius: 4px;
    }
    .message.assistant {
      align-self: flex-start;
      background: rgba(255,255,255,0.1);
      border-bottom-left-radius: 4px;
    }
    .message.loading {
      opacity: 0.7;
    }
    .message.loading::after {
      content: '...';
      animation: dots 1.5s infinite;
    }
    @keyframes dots {
      0%, 20% { content: '.'; }
      40% { content: '..'; }
      60%, 100% { content: '...'; }
    }
    .input-container {
      padding: 16px 20px;
      background: rgba(0,0,0,0.3);
      border-top: 1px solid rgba(255,255,255,0.1);
      display: flex;
      gap: 12px;
    }
    .input-container input {
      flex: 1;
      background: rgba(255,255,255,0.1);
      border: none;
      border-radius: 24px;
      padding: 14px 20px;
      color: white;
      font-size: 16px;
      outline: none;
    }
    .input-container input::placeholder { color: rgba(255,255,255,0.5); }
    .input-container button {
      background: linear-gradient(135deg, #7c3aed, #9333ea);
      border: none;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      color: white;
      font-size: 20px;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .input-container button:hover { transform: scale(1.1); }
    .input-container button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    .welcome {
      text-align: center;
      padding: 60px 20px;
      opacity: 0.8;
    }
    .welcome h2 { font-size: 24px; margin-bottom: 12px; }
    .welcome p { color: rgba(255,255,255,0.6); }
    .status {
      position: fixed;
      top: 70px;
      right: 20px;
      background: rgba(0,200,0,0.2);
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .status::before {
      content: '';
      width: 8px;
      height: 8px;
      background: #00c800;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🤖 GLM Chat</h1>
    <span class="badge">Lokalni AI</span>
  </div>
  
  <div class="status">Online • Bez tunela</div>
  
  <div class="chat-container" id="chat">
    <div class="welcome">
      <h2>🎉 Lokalni GLM Chat</h2>
      <p>Radi na vašoj mreži, bez interneta!</p>
    </div>
  </div>
  
  <div class="input-container">
    <input 
      type="text" 
      id="input" 
      placeholder="Napiši poruku..." 
      autocomplete="off"
    >
    <button id="send" onclick="sendMessage()">➤</button>
  </div>

  <script>
    const chatEl = document.getElementById('chat');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    
    let sessionId = 'session_' + Date.now();
    let isLoading = false;
    
    function addMessage(content, isUser) {
      const welcome = chatEl.querySelector('.welcome');
      if (welcome) welcome.remove();
      
      const msg = document.createElement('div');
      msg.className = 'message ' + (isUser ? 'user' : 'assistant');
      msg.textContent = content;
      chatEl.appendChild(msg);
      chatEl.scrollTop = chatEl.scrollHeight;
      return msg;
    }
    
    async function sendMessage() {
      const message = inputEl.value.trim();
      if (!message || isLoading) return;
      
      inputEl.value = '';
      sendBtn.disabled = true;
      isLoading = true;
      
      addMessage(message, true);
      const loadingMsg = addMessage('', false);
      loadingMsg.classList.add('loading');
      
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, sessionId })
        });
        
        const data = await res.json();
        loadingMsg.classList.remove('loading');
        loadingMsg.textContent = data.response || 'Greška';
      } catch (e) {
        loadingMsg.textContent = 'Greška: ' + e.message;
      }
      
      sendBtn.disabled = false;
      isLoading = false;
      inputEl.focus();
    }
    
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    inputEl.focus();
  </script>
</body>
</html>
`

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || '/'
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }
  
  // API: Chat
  if (url === '/api/chat' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', async () => {
      try {
        const { message, sessionId } = JSON.parse(body)
        const response = await chat(message, sessionId || 'default')
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ response }))
      } catch (e) {
        console.error('Chat error:', e)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    })
    return
  }
  
  // API: Health
  if (url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ 
      status: 'ok', 
      sessions: sessions.size,
      glm: 'connected'
    }))
    return
  }
  
  // HTML page
  if (url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(HTML_PAGE)
    return
  }
  
  res.writeHead(404)
  res.end('Not found')
}

// ============ START ============
async function start() {
  console.log('🚀 GLM Standalone Chat Server')
  console.log('='.repeat(40))
  
  await initGLM()
  
  const server = createServer(handleRequest)
  
  server.listen(CONFIG.port, CONFIG.host, () => {
    console.log(`\n✅ Server pokrenut!`)
    console.log(`\n📱 Pristup:`)
    console.log(`   Lokalno: http://localhost:${CONFIG.port}`)
    console.log(`   Mreža:   http://21.0.9.210:${CONFIG.port}`)
    console.log(`\n🎯 Instalacija na telefon:`)
    console.log(`   1. Poveži telefon na istu WiFi mrežu`)
    console.log(`   2. Otvori: http://21.0.9.210:${CONFIG.port}`)
    console.log(`   3. Add to Home Screen`)
    console.log(`\n⚠️ Server mora biti pokrenut da bi aplikacija radila`)
    console.log(`   Pokreni sa: bun run standalone-server.ts`)
  })
}

start().catch(console.error)
