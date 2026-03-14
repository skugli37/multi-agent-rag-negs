// NEGS Engine - Integrisan u RAG sistem
// Upravlja ekspertima, evolucijom i auto-genesis-om

import { AgentName, ExpertGenome, EvolutionEvent, NEGSState } from './types'

// Global state za NEGS
declare global {
  // eslint-disable-next-line no-var
  var negsState: NEGSState | undefined
  // eslint-disable-next-line no-var
  var evolutionHistory: EvolutionEvent[] | undefined
}

if (!globalThis.negsState) {
  globalThis.negsState = {
    experts: new Map(),
    totalQueries: 0,
    totalEvolutions: 0,
    lastEvolution: null
  }
}

if (!globalThis.evolutionHistory) {
  globalThis.evolutionHistory = []
}

const state = globalThis.negsState
const history = globalThis.evolutionHistory

// Inicijalizuj core agente
function initCoreExperts() {
  const coreAgents: AgentName[] = ['query', 'retrieval', 'reasoning', 'response', 'reflection']
  
  for (const name of coreAgents) {
    if (!state.experts.has(name)) {
      const genome: ExpertGenome = {
        id: `expert_${name}_${Date.now()}`,
        name,
        generation: 1,
        fitness: 0.5,
        competence: 0.5,
        invocations: 0,
        successes: 0,
        lastUsed: null,
        createdAt: new Date(),
        behavior: {
          avgLatency: 0,
          avgConfidence: 0,
          preferredStrategy: 'standard'
        },
        mutations: 0,
        parentIds: []
      }
      state.experts.set(name, genome)
    }
  }
}

initCoreExperts()

// ============ NEGS API ============

export const NEGS = {
  // Dohvati expert genome
  getExpert(name: AgentName): ExpertGenome | undefined {
    return state.experts.get(name)
  },
  
  // Svi eksperti
  getAllExperts(): ExpertGenome[] {
    return Array.from(state.experts.values())
  },
  
  // Azuriraj expert nakon koriscenja
  updateExpert(
    name: AgentName, 
    success: boolean, 
    latency: number, 
    confidence: number
  ): void {
    const expert = state.experts.get(name)
    if (!expert) return
    
    expert.invocations++
    if (success) expert.successes++
    
    // Azuriraj fitness (exponential moving average)
    const successRate = expert.successes / expert.invocations
    const performanceScore = success ? 0.1 : -0.05
    expert.fitness = Math.max(0.1, Math.min(1, expert.fitness + performanceScore * 0.1))
    
    // Azuriraj competence na osnovu uspeha
    if (success) {
      expert.competence = Math.min(1, expert.competence + 0.01)
    } else {
      expert.competence = Math.max(0.1, expert.competence - 0.02)
    }
    
    // Azuriraj behavior
    const n = expert.invocations
    expert.behavior.avgLatency = (expert.behavior.avgLatency * (n - 1) + latency) / n
    expert.behavior.avgConfidence = (expert.behavior.avgConfidence * (n - 1) + confidence) / n
    
    expert.lastUsed = new Date()
    state.experts.set(name, expert)
    
    state.totalQueries++
  },
  
  // Evolucija - mutacija slabih eksperata
  evolve(): EvolutionEvent[] {
    const events: EvolutionEvent[] = []
    const now = new Date()
    
    for (const [name, expert] of state.experts) {
      // Ako je expert koriscen vise od 10 puta i ima los fitness
      if (expert.invocations > 10 && expert.fitness < 0.4) {
        // Mutacija - resetujemo fitness i povecavamo generation
        const oldFitness = expert.fitness
        expert.fitness = 0.5
        expert.competence = 0.5
        expert.generation++
        expert.mutations++
        expert.behavior.preferredStrategy = 'quick' // Probaj drugu strategiju
        
        state.experts.set(name, expert)
        
        const event: EvolutionEvent = {
          type: 'mutation',
          agentId: expert.id,
          timestamp: now,
          reason: `Low fitness (${oldFitness.toFixed(2)}) - mutation triggered`,
          fitnessChange: 0.5 - oldFitness
        }
        
        history.push(event)
        events.push(event)
        
        console.log(`🧬 NEGS: Mutated ${name} (gen ${expert.generation})`)
      }
    }
    
    if (events.length > 0) {
      state.totalEvolutions++
      state.lastEvolution = now
    }
    
    return events
  },
  
  // Selekcija - vrati najbolje eksperte
  getTopExperts(count: number = 3): ExpertGenome[] {
    return Array.from(state.experts.values())
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, count)
  },
  
  // Pre-aktivacija - predvidi koje agente cemo trebati
  predictAgents(query: string): AgentName[] {
    const queryLower = query.toLowerCase()
    const agents: AgentName[] = []
    
    // Uvek query prvi
    agents.push('query')
    
    // Detektuj domene
    if (/\b(pronađi|nađi|pretraga|dokument|fajl|file)\b/i.test(query)) {
      agents.push('retrieval')
    }
    
    if (/\b(zašto|kako|objasni|analiziraj|uporedi)\b/i.test(query)) {
      agents.push('reasoning')
    }
    
    if (/\b(napiši|generiši|kreiraj|sastavi)\b/i.test(query)) {
      agents.push('response')
    }
    
    // Uvek reflection na kraju za kompleksne
    if (query.length > 100 || query.includes('?')) {
      agents.push('reflection')
    }
    
    // Sortiraj po fitness-u
    return agents.sort((a, b) => {
      const fitA = state.experts.get(a)?.fitness || 0
      const fitB = state.experts.get(b)?.fitness || 0
      return fitB - fitA
    })
  },
  
  // Statistika
  getStats() {
    const experts = Array.from(state.experts.values())
    return {
      totalExperts: experts.length,
      totalQueries: state.totalQueries,
      totalEvolutions: state.totalEvolutions,
      avgFitness: experts.reduce((sum, e) => sum + e.fitness, 0) / experts.length,
      topExpert: experts.sort((a, b) => b.fitness - a.fitness)[0]?.name || 'none',
      generation: Math.max(...experts.map(e => e.generation), 1),
      recentEvolutions: history.slice(-5)
    }
  },
  
  // Istorija evolucije
  getHistory(): EvolutionEvent[] {
    return history
  }
}

// Auto-evolucija svakih 5 minuta
setInterval(() => {
  const events = NEGS.evolve()
  if (events.length > 0) {
    console.log(`🧬 NEGS: Auto-evolution completed, ${events.length} mutations`)
  }
}, 5 * 60 * 1000)
