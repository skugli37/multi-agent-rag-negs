// Terminal Tool - Agenti imaju pristup sistemu!

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface TerminalResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number
  executionTime: number
}

export async function executeTerminal(command: string, timeout: number = 30000): Promise<TerminalResult> {
  const startTime = Date.now()
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      cwd: '/home/z/my-project'
    })
    
    return {
      success: true,
      stdout: stdout.slice(0, 5000), // Limit output
      stderr: stderr.slice(0, 1000),
      exitCode: 0,
      executionTime: Date.now() - startTime
    }
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; code?: number; killed?: boolean }
    return {
      success: false,
      stdout: execError.stdout?.slice(0, 5000) || '',
      stderr: execError.stderr?.slice(0, 1000) || (execError.killed ? 'Timeout!' : String(error)),
      exitCode: execError.code || 1,
      executionTime: Date.now() - startTime
    }
  }
}

// Agent capabilities
export const AGENT_CAPABILITIES = {
  // Shell komande
  shell: executeTerminal,
  
  // Čitanje fajla
  async readFile(path: string): Promise<string> {
    const result = await executeTerminal(`cat "${path}" 2>/dev/null || echo "FILE_NOT_FOUND"`)
    return result.stdout
  },
  
  // Pisanje fajla
  async writeFile(path: string, content: string): Promise<boolean> {
    const escaped = content.replace(/'/g, "'\"'\"'")
    const result = await executeTerminal(`echo '${escaped.slice(0, 5000)}' > "${path}"`)
    return result.success
  },
  
  // Listaj direktorijum
  async listDir(path: string): Promise<string> {
    const result = await executeTerminal(`ls -la "${path}" 2>/dev/null || echo "DIR_NOT_FOUND"`)
    return result.stdout
  },
  
  // Provera sistema
  async systemInfo(): Promise<string> {
    const result = await executeTerminal('uname -a && echo "---" && whoami && echo "---" && pwd')
    return result.stdout
  },
  
  // Instaliraj paket
  async install(packageName: string): Promise<string> {
    const result = await executeTerminal(`npm install ${packageName} 2>&1 | head -20`, 60000)
    return result.stdout + result.stderr
  },
  
  // Git operacije
  async git(command: string): Promise<string> {
    const result = await executeTerminal(`git ${command} 2>&1`)
    return result.stdout + result.stderr
  },
  
  // Pokreni skriptu
  async runScript(scriptPath: string, args: string = ''): Promise<string> {
    const result = await executeTerminal(`bash "${scriptPath}" ${args} 2>&1`, 60000)
    return result.stdout + result.stderr
  }
}

// Export za korišćenje u agentima
export const terminalTools = {
  name: 'terminal',
  description: 'Izvršava shell komande na sistemu',
  execute: async (input: { command: string }) => {
    return await executeTerminal(input.command)
  }
}

export const fileTools = {
  read: async (path: string) => AGENT_CAPABILITIES.readFile(path),
  write: async (path: string, content: string) => AGENT_CAPABILITIES.writeFile(path, content),
  list: async (path: string) => AGENT_CAPABILITIES.listDir(path)
}
