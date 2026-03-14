// Expert Genome Manager - Agenti razmišljaju, biraju se i evoluira

import { AgentName, ExpertGenome, EvolutionEvent } from './types'

declare global {
  // eslint-disable-next-line no-var
  var expertGenomes: Map<AgentName, ExpertGenome> | undefined
  // eslint-disable-next-line no-var
  var evolutionHistory: EvolutionEvent[] | undefined
}

if (!globalThis.expertGenomes) globalThis.expertGenomes = new Map()
if (!globalThis.evolutionHistory) globalThis.evolutionHistory = []

const genomes = globalThis.expertGenomes
const history = globalThis.evolutionHistory

// Inicijalizacija agenata
const AGENT_CONFIGS: Record<AgentName, { domains: string[]; style: string }> = {
  orchestrator: { domains: ['planning', 'coordination'], style: 'strategic' },
  query: { domains: ['analysis', 'intent', 'extraction'], style: 'analytical' },
  retrieval: { domains: ['search', 'semantic', 'knowledge'], style: 'thorough' },
  reasoning: { domains: ['logic', 'inference', 'synthesis'], style: 'deep' },
  response: { domains: ['generation', 'communication'], style: 'creative' },
  reflection: { domains: ['evaluation', 'improvement'], style: 'critical' }
}

function initGenomes() {
  for (const [name, config] of Object.entries(AGENT_CONFIGS)) {
    if (!genomes.has(name as AgentName)) {
      genomes.set(name as AgentName, {
        name: name as AgentName,
        generation: 1,
        createdAt: new Date(),
        domains: config.domains.map(d => ({ domain: d, competence: 0.5, confidence: 0.3, experience: 0 })),
        primaryDomain: config.domains[0],
        behavior: { verbosity: 0.6, certaintyThreshold: 0.7, creativityLevel: 0.5, collaborationScore: 0.5 },
        learning: { learningRate: 0.1, adaptationSpeed: 0.5, memoryRetention: 0.8 },
        metrics: { totalInvocations: 0, successRate: 0, averageLatency: 0, userSatisfactionScore: 0 },
        fitness: 0.5,
        mutations: 0,
        lastEvolved: new Date()
      })
    }
  }
}
initGenomes()

// ============ GLAVNE FUNKCIJE ============

export const ExpertGenomeManager = {
  
  // Agent RAZMIŠLJA o zadatku - ovo je prava moć!
  think(agentName: AgentName, query: string): { 
    reasoning: string[]
    confidence: number
    strategy: string
    selected: boolean
  } {
    const genome = genomes.get(agentName)
    if (!genome) return { reasoning: ['Unknown agent'], confidence: 0, strategy: 'none', selected: false }
    
    const competence = genome.domains[0]?.competence || 0.5
    const creativity = genome.behavior.creativityLevel
    const thoughts: string[] = []
    
    // Agent razmišlja na osnovu svog genoma
    thoughts.push(`🧠 ${agentName.toUpperCase()} razmišlja...`)
    thoughts.push(`📊 Kompetencija: ${(competence * 100).toFixed(0)}%`)
    thoughts.push(`🎯 Fitness: ${(genome.fitness * 100).toFixed(0)}%`)
    
    // Različito ponašanje po tipu agenta
    switch (agentName) {
      case 'query':
        thoughts.push(`🔍 Analiziram: "${query.slice(0, 30)}..."`)
        thoughts.push(`✨ Strategija: ${competence > 0.6 ? 'DUBOKA analiza' : 'Brza analiza'}`)
        thoughts.push(`📝 Ekstraktujem: entitete, intent, kontekst`)
        break
        
      case 'retrieval':
        thoughts.push(`📚 Pretražujem bazu znanja...`)
        thoughts.push(`🔗 Method: ${competence > 0.5 ? 'Hybrid (semantic + keyword)' : 'Keyword only'}`)
        thoughts.push(`📈 Očekivani rezultati: ${Math.round(competence * 5)} relevantnih`)
        break
        
      case 'reasoning':
        thoughts.push(`🤔 Primjenjujem chain-of-thought...`)
        thoughts.push(`⛓️ Depth: ${Math.round(competence * 5)} reasoning koraka`)
        thoughts.push(`💡 Stil: ${creativity > 0.6 ? 'Kreativni' : 'Logički'} zaključci`)
        break
        
      case 'response':
        thoughts.push(`✍️ Generišem odgovor...`)
        thoughts.push(`🎨 Kreativnost: ${(creativity * 100).toFixed(0)}%`)
        thoughts.push(`📝 Stil: ${genome.behavior.verbosity > 0.6 ? 'Detaljan' : 'Koncizan'}`)
        break
        
      case 'reflection':
        thoughts.push(`🔎 Evaluiram kvalitet...`)
        thoughts.push(`✅ Kriterijumi: tačnost, kompletnost, relevantnost`)
        thoughts.push(`⚠️ Prag: ${(genome.behavior.certaintyThreshold * 100).toFixed(0)}%`)
        break
    }
    
    // Evolution info
    if (genome.generation > 1 || genome.mutations > 0) {
      thoughts.push(`🧬 Gen ${genome.generation}, ${genome.mutations} mutacija`)
    }
    
    return {
      reasoning: thoughts,
      confidence: competence * genome.fitness,
      strategy: genome.behavior.certaintyThreshold > 0.6 ? 'conservative' : 'exploratory',
      selected: true
    }
  },
  
  // KO je najbolji agent za ovaj zadatak?
  selectBestAgent(task: string): { 
    agent: AgentName
    reason: string
    fitness: number
    allScores: { agent: AgentName; score: number }[]
  } {
    const taskLower = task.toLowerCase()
    const scores: { agent: AgentName; score: number; match: string }[] = []
    
    // Keyword matching
    const patterns: Record<string, AgentName[]> = {
      'pronađi|nađi|pretraga|dokument|fajl': ['retrieval'],
      'zašto|kako|objasni|analiziraj|uporedi|izvedi': ['reasoning'],
      'napiši|generiši|kreiraj|sastavi|priča': ['response'],
      'proveri|evaluiraj|da li|validiraj': ['reflection'],
      'šta|ko|gde|kada|koliko': ['query', 'reasoning']
    }
    
    for (const [pattern, agents] of Object.entries(patterns)) {
      if (new RegExp(pattern, 'i').test(taskLower)) {
        for (const agent of agents) {
          const genome = genomes.get(agent)
          if (genome) {
            const score = genome.fitness * genome.domains[0].competence
            scores.push({ agent, score, match: pattern.split('|')[0] })
          }
        }
      }
    }
    
    // Sortiraj
    scores.sort((a, b) => b.score - a.score)
    
    const best = scores[0] || { agent: 'query' as AgentName, score: 0.5, match: 'default' }
    const genome = genomes.get(best.agent)
    
    return {
      agent: best.agent,
      reason: `Match: "${best.match}" → Fitness: ${((genome?.fitness || 0.5) * 100).toFixed(0)}%`,
      fitness: genome?.fitness || 0.5,
      allScores: scores.slice(0, 3).map(s => ({ agent: s.agent, score: s.score }))
    }
  },
  
  // EVOLUCIJA - mutacija
  mutate(agentName: AgentName): { before: number; after: number; changes: string[] } {
    const genome = genomes.get(agentName)
    if (!genome) return { before: 0, after: 0, changes: [] }
    
    const before = genome.fitness
    const changes: string[] = []
    
    // Nasumične mutacije parametara
    if (Math.random() < 0.4) {
      const old = genome.behavior.creativityLevel
      genome.behavior.creativityLevel = Math.max(0.1, Math.min(1, old + (Math.random() - 0.5) * 0.2))
      changes.push(`Kreativnost: ${old.toFixed(2)} → ${genome.behavior.creativityLevel.toFixed(2)}`)
    }
    
    if (Math.random() < 0.4) {
      const old = genome.learning.learningRate
      genome.learning.learningRate = Math.max(0.01, Math.min(0.3, old + (Math.random() - 0.5) * 0.05))
      changes.push(`Learning: ${old.toFixed(3)} → ${genome.learning.learningRate.toFixed(3)}`)
    }
    
    if (Math.random() < 0.3) {
      const old = genome.domains[0].competence
      genome.domains[0].competence = Math.max(0.1, Math.min(1, old + (Math.random() - 0.3) * 0.15))
      changes.push(`Kompetencija: ${old.toFixed(2)} → ${genome.domains[0].competence.toFixed(2)}`)
    }
    
    genome.mutations++
    genome.generation++
    genome.lastEvolved = new Date()
    genome.fitness = this.calculateFitness(genome)
    
    genomes.set(agentName, genome)
    
    // Istorija
    history.push({
      timestamp: new Date(),
      type: 'mutation',
      agentName,
      changes: changes.map(c => ({ field: 'mutation', oldValue: null, newValue: c })),
      reason: `Gen ${genome.generation} evolution`,
      fitnessBefore: before,
      fitnessAfter: genome.fitness
    })
    
    console.log(`🧬 EVOLUTION: ${agentName} gen ${genome.generation} | ${before.toFixed(2)} → ${genome.fitness.toFixed(2)}`)
    
    return { before, after: genome.fitness, changes }
  },
  
  // Update metrika
  updateMetrics(agentName: AgentName, success: boolean, latency: number): void {
    const genome = genomes.get(agentName)
    if (!genome) return
    
    const m = genome.metrics
    const n = m.totalInvocations
    
    m.totalInvocations++
    m.successRate = (m.successRate * n + (success ? 1 : 0)) / (n + 1)
    m.averageLatency = (m.averageLatency * n + latency) / (n + 1)
    
    if (success) {
      genome.domains[0].competence = Math.min(1, genome.domains[0].competence + genome.learning.learningRate * 0.1)
    } else {
      genome.domains[0].competence = Math.max(0.1, genome.domains[0].competence - genome.learning.learningRate * 0.05)
    }
    
    genome.fitness = this.calculateFitness(genome)
    genome.domains[0].experience++
    
    genomes.set(agentName, genome)
  },
  
  calculateFitness(genome: ExpertGenome): number {
    const competence = genome.domains[0].competence
    const success = genome.metrics.successRate
    const experience = Math.min(genome.metrics.totalInvocations / 50, 1)
    return (competence * 0.4 + success * 0.35 + experience * 0.25)
  },
  
  analyzeQueryPattern(query: string, success: boolean, latency: number): string[] {
    const domains: string[] = []
    const patterns: Record<string, RegExp> = {
      'query_analysis': /ko|šta|gde|kada|zašto|kako/i,
      'document_retrieval': /pronađi|nađi|dokument|fajl/i,
      'logical_reasoning': /zašto|kako|analiziraj|uporedi/i,
      'creative_writing': /napiši|priča|pesma|kreativno/i,
      'coding': /kod|program|funkcija|api/i
    }
    for (const [domain, regex] of Object.entries(patterns)) {
      if (regex.test(query)) domains.push(domain)
    }
    return domains
  },
  
  // Getters
  getGenome(name: AgentName) { return genomes.get(name) },
  getAllGenomes() { return Array.from(genomes.values()) },
  getHistory() { return history.slice(-20) },
  
  getStats() {
    const all = Array.from(genomes.values())
    return {
      totalExperts: all.length,
      totalQueries: all.reduce((s, g) => s + g.metrics.totalInvocations, 0),
      avgFitness: all.reduce((s, g) => s + g.fitness, 0) / all.length,
      generation: Math.max(...all.map(g => g.generation)),
      topExpert: all.sort((a, b) => b.fitness - a.fitness)[0]?.name || 'none',
      recentMutations: history.filter(e => e.type === 'mutation').slice(-5),
      allAgents: all.map(g => ({
        name: g.name,
        fitness: g.fitness,
        competence: g.domains[0].competence,
        generation: g.generation,
        invocations: g.metrics.totalInvocations
      }))
    }
  },
  
  runEvolution(): EvolutionEvent[] {
    const events: EvolutionEvent[] = []
    for (const [name, genome] of genomes) {
      if (genome.metrics.totalInvocations > 3 && genome.fitness < 0.5) {
        const result = this.mutate(name)
        if (result.changes.length > 0 && history.length > 0) {
          events.push(history[history.length - 1])
        }
      }
    }
    return events
  }
}

// Auto-evolucija
if (typeof setInterval !== 'undefined') {
  setInterval(() => ExpertGenomeManager.runEvolution(), 5 * 60 * 1000)
}
