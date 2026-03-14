'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Send, Upload, Trash2, Settings, FileText, MessageSquare, 
  Plus, Loader2, Sparkles, Database, ChevronLeft, ChevronRight,
  Brain, Cpu, Network, Zap, Dna, TrendingUp, Terminal
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  confidence?: number
  agentName?: string
}

interface Document {
  id: string
  filename: string
  fileType: string
  fileSize: number
  chunkCount: number
}

interface Citation {
  documentId: string
  filename: string
  content: string
  score: number
}

interface NEGSStats {
  totalExperts: number
  totalQueries: number
  avgFitness: number
  generation: number
  topExpert: string
  allAgents?: { name: string; fitness: number; competence: number; generation: number; invocations: number }[]
}

interface AgentThinking {
  agent: string
  reasoning: string[]
  confidence: number
  strategy: string
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedPrompt, setSelectedPrompt] = useState('')
  const [useRag, setUseRag] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'chat' | 'docs' | 'settings'>('chat')
  const [uploading, setUploading] = useState(false)
  const [citations, setCitations] = useState<Citation[]>([])
  const [negsStats, setNegsStats] = useState<NEGSStats | null>(null)
  const [agentThinking, setAgentThinking] = useState<AgentThinking | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [evolutionEvents, setEvolutionEvents] = useState<{ agent: string; before: number; after: number }[]>([])
  const [terminalOutput, setTerminalOutput] = useState<{ command: string; output: string; success: boolean } | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetchDocuments().catch(() => {})
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamContent])

  const fetchDocuments = async () => {
    const res = await fetch('/api/documents')
    const data = await res.json()
    setDocuments(data.documents || [])
  }

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      createdAt: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setCitations([])
    setAgentThinking(null)
    setSelectedAgent(null)
    setStreamContent('')
    setStreaming(true)
    setTerminalOutput(null)

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, conversationId, systemPrompt: selectedPrompt, useRag })
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No reader')

      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (line.startsWith('event: conversation')) {
            const dataLine = lines[i + 1]
            if (dataLine?.startsWith('data:')) {
              const data = JSON.parse(dataLine.slice(5))
              setConversationId(data.conversationId)
            }
          } else if (line.startsWith('event: negs_selection')) {
            const dataLine = lines[i + 1]
            if (dataLine?.startsWith('data:')) {
              const data = JSON.parse(dataLine.slice(5))
              setSelectedAgent(data.selectedAgent)
            }
          } else if (line.startsWith('event: negs_thinking')) {
            const dataLine = lines[i + 1]
            if (dataLine?.startsWith('data:')) {
              const data = JSON.parse(dataLine.slice(5))
              setAgentThinking(data)
            }
          } else if (line.startsWith('event: negs_evolution')) {
            const dataLine = lines[i + 1]
            if (dataLine?.startsWith('data:')) {
              const data = JSON.parse(dataLine.slice(5))
              setEvolutionEvents(prev => [...prev, ...data.events])
            }
          } else if (line.startsWith('event: terminal')) {
            const dataLine = lines[i + 1]
            if (dataLine?.startsWith('data:')) {
              const data = JSON.parse(dataLine.slice(5))
              setTerminalOutput({ command: data.command, output: data.output, success: data.success })
            }
          } else if (line.startsWith('event: retrieval')) {
            const dataLine = lines[i + 1]
            if (dataLine?.startsWith('data:')) {
              const data = JSON.parse(dataLine.slice(5))
              if (data.citations) setCitations(data.citations)
            }
          } else if (line.startsWith('event: token')) {
            const dataLine = lines[i + 1]
            if (dataLine?.startsWith('data:')) {
              const data = JSON.parse(dataLine.slice(5))
              if (data.content) {
                fullContent += data.content
                setStreamContent(fullContent)
              }
            }
          } else if (line.startsWith('event: done')) {
            const dataLine = lines[i + 1]
            if (dataLine?.startsWith('data:')) {
              const data = JSON.parse(dataLine.slice(5))
              setMessages(prev => [...prev, {
                id: data.messageId || Date.now().toString(),
                role: 'assistant',
                content: fullContent,
                createdAt: new Date().toISOString(),
                agentName: 'multi_agent'
              }])
              if (data.negs) setNegsStats(data.negs)
              setStreamContent('')
            }
          }
        }
      }
    } catch (error) {
      console.error('Stream error:', error)
    }

    setStreaming(false)
  }, [input, streaming, conversationId, selectedPrompt, useRag])

  const newConversation = () => {
    setMessages([])
    setConversationId(null)
    setCitations([])
    setAgentThinking(null)
    setEvolutionEvents([])
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/documents', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.document) setDocuments(prev => [data.document, ...prev])
    } catch (error) {
      console.error('Upload error:', error)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const deleteDocument = async (id: string) => {
    await fetch(`/api/documents/${id}`, { method: 'DELETE' })
    setDocuments(prev => prev.filter(d => d.id !== id))
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getAgentIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'query': return <Brain className="w-4 h-4" />
      case 'retrieval': return <Database className="w-4 h-4" />
      case 'reasoning': return <Network className="w-4 h-4" />
      case 'response': return <Sparkles className="w-4 h-4" />
      case 'reflection': return <TrendingUp className="w-4 h-4" />
      case 'terminal': return <Terminal className="w-4 h-4" />
      default: return <Cpu className="w-4 h-4" />
    }
  }

  const getAgentColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'query': return 'bg-blue-500'
      case 'retrieval': return 'bg-green-500'
      case 'reasoning': return 'bg-purple-500'
      case 'response': return 'bg-orange-500'
      case 'reflection': return 'bg-pink-500'
      case 'terminal': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="h-screen flex bg-gray-900 text-white">
      {/* SIDEBAR */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-gray-800 flex flex-col transition-all duration-300 overflow-hidden`}>
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Dna className="w-5 h-5 text-purple-400" />
            <h1 className="font-bold text-lg">NEGS RAG</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">Neural Expert Genesis System</p>
        </div>

        <div className="flex border-b border-gray-700">
          {[
            { id: 'chat', icon: MessageSquare, label: 'Chat' },
            { id: 'docs', icon: Database, label: 'Docs' },
            { id: 'settings', icon: Settings, label: 'Agents' }
          ].map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setActiveTab(id as typeof activeTab)}
              className={`flex-1 p-2 text-xs ${activeTab === id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}>
              <Icon className="w-4 h-4 mx-auto mb-1" />
              {label}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1">
          {activeTab === 'chat' && (
            <div className="p-3 space-y-3">
              <Button onClick={newConversation} variant="outline" className="w-full" size="sm">
                <Plus className="w-4 h-4 mr-2" /> Nova konverzacija
              </Button>
              
              {/* Agent Thinking - OVO JE MOĆ! */}
              {agentThinking && (
                <div className="bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {getAgentIcon(agentThinking.agent)}
                    <span className="font-semibold capitalize">{agentThinking.agent}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {(agentThinking.confidence * 100).toFixed(0)}% conf
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs text-gray-300">
                    {agentThinking.reasoning.map((r, i) => (
                      <div key={i} className="flex items-start gap-1">
                        <span className="text-gray-500">→</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evolution Events */}
              {evolutionEvents.length > 0 && (
                <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-purple-400 text-xs mb-2">
                    <Dna className="w-4 h-4" />
                    <span className="font-semibold">EVOLUCIJA</span>
                  </div>
                  {evolutionEvents.slice(-3).map((e, i) => (
                    <div key={i} className="text-xs text-gray-300 flex items-center gap-2">
                      <span className="capitalize">{e.agent}</span>
                      <span className="text-red-400">{(e.before * 100).toFixed(0)}%</span>
                      <span>→</span>
                      <span className="text-green-400">{(e.after * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* NEGS Stats */}
              {negsStats && (
                <div className="bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-semibold">Agent Fitness</span>
                  </div>
                  <div className="space-y-2">
                    {negsStats.allAgents?.map(agent => (
                      <div key={agent.name} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getAgentColor(agent.name)}`} />
                        <span className="text-xs capitalize flex-1">{agent.name}</span>
                        <span className="text-xs text-gray-400">Gen {agent.generation}</span>
                        <span className="text-xs font-bold">{(agent.fitness * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="p-3 space-y-3">
              <input ref={fileInputRef} type="file" accept=".txt,.md,.json,.csv" onChange={handleFileUpload} className="hidden" />
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full" size="sm" disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Upload fajl
              </Button>
              <Separator className="bg-gray-700" />
              <div className="space-y-1">
                {documents.map(doc => (
                  <div key={doc.id} className="group flex items-center gap-2 p-2 bg-gray-700 rounded text-sm">
                    <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{doc.filename}</div>
                      <div className="text-xs text-gray-400">{formatBytes(doc.fileSize)} • {doc.chunkCount} chunks</div>
                    </div>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-6 w-6" onClick={() => deleteDocument(doc.id)}>
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </Button>
                  </div>
                ))}
                {documents.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nema dokumenata</p>}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="p-3 space-y-4">
              <div>
                <Label className="text-xs text-gray-400">System Prompt</Label>
                <Textarea value={selectedPrompt} onChange={(e) => setSelectedPrompt(e.target.value)} className="mt-1 min-h-[80px] text-sm" />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Koristi RAG</Label>
                <Switch checked={useRag} onCheckedChange={setUseRag} />
              </div>
              <Separator className="bg-gray-700" />
              <div className="text-xs text-gray-500 space-y-2">
                <p className="font-semibold text-gray-400">🧬 Kako NEGS radi:</p>
                <p>• Agenti se BIRAJU na osnovu query-ja</p>
                <p>• Svaki agent RAZMIŠLJA pre odgovora</p>
                <p>• Fitness se menja sa uspehom</p>
                <p>• Slabi agenti EVOLUIRAJU (mutacija)</p>
                <p>• Sve se prikazuje u realnom vremenu</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-gray-700 rounded p-2">
                  <div className="text-lg font-bold">{documents.length}</div>
                  <div className="text-xs text-gray-400">Dokumenata</div>
                </div>
                <div className="bg-gray-700 rounded p-2">
                  <div className="text-lg font-bold">{negsStats?.totalQueries || 0}</div>
                  <div className="text-xs text-gray-400">Queries</div>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* TOGGLE SIDEBAR */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)} 
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-gray-800 p-1 rounded-r hover:bg-gray-700"
        style={{ left: sidebarOpen ? '320px' : '0' }}>
        {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* MAIN CHAT */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <Network className="w-4 h-4 text-purple-400" />
                NEGS RAG Pipeline
              </h2>
              <p className="text-xs text-gray-400">
                {selectedAgent ? `Aktivan: ${selectedAgent}` : 'Spreman'}
                {negsStats && ` • Gen ${negsStats.generation}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {negsStats && (
                <Badge variant="default" className="text-xs">
                  <Dna className="w-3 h-3 mr-1" />
                  {(negsStats.avgFitness * 100).toFixed(0)}%
                </Badge>
              )}
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 && !streaming && (
              <div className="text-center py-12">
                <Dna className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                <h3 className="text-2xl font-semibold mb-2">NEGS RAG System</h3>
                <p className="text-gray-400 max-w-lg mx-auto mb-4">
                  Agenti se biraju, razmišljaju i evoluira. Sve vidiš u realnom vremenu.
                </p>
                <div className="grid grid-cols-5 gap-2 max-w-md mx-auto text-xs">
                  {['Query', 'Retrieval', 'Reasoning', 'Response', 'Reflection'].map((agent, i) => (
                    <div key={i} className="bg-gray-800 rounded p-2 text-center">
                      <div className="text-purple-400 font-semibold">{agent}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-2' : ''}`}>
                  <div className={`rounded-lg p-4 ${msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-100'}`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {streaming && streamContent && (
              <div className="flex justify-start">
                <div className="max-w-[85%]">
                  <div className="rounded-lg p-4 bg-gray-800 text-gray-100">
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{streamContent}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {streaming && !streamContent && agentThinking && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg p-4 bg-gray-800">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${getAgentColor(agentThinking.agent)} animate-pulse`}>
                      {getAgentIcon(agentThinking.agent)}
                    </div>
                    <div className="text-sm">
                      <span className="capitalize font-semibold">{agentThinking.agent}</span>
                      <span className="text-gray-400 ml-2">razmišlja...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TERMINAL OUTPUT */}
            {terminalOutput && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg overflow-hidden bg-gray-900 border border-gray-700">
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-b border-gray-700">
                    <div className={`w-2 h-2 rounded-full ${terminalOutput.success ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-xs font-mono text-gray-400">$ {terminalOutput.command}</span>
                  </div>
                  <pre className="p-3 text-xs font-mono text-green-400 overflow-x-auto max-h-60">
                    {terminalOutput.output || '(prazan izlaz)'}
                  </pre>
                </div>
              </div>
            )}

            {citations.length > 0 && !streaming && (
              <div className="bg-gray-800/50 rounded-lg p-3 text-sm">
                <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                  <Database className="w-3 h-3" /> Izvori ({citations.length})
                </div>
                <div className="space-y-1">
                  {citations.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <Badge variant="outline" className="shrink-0 text-[10px]">{i + 1}</Badge>
                      <div className="text-purple-400">{c.filename}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-gray-800 bg-gray-900/50 backdrop-blur">
          <div className="max-w-4xl mx-auto flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Postavi pitanje..."
              className="min-h-[44px] max-h-[200px] resize-none"
              disabled={streaming}
            />
            <Button onClick={sendMessage} disabled={streaming || !input.trim()} className="h-11 px-4">
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
