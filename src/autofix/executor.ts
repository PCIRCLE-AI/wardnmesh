import { FixPlan } from './strategy';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

import { CCBClient, AgentRequest } from '../integrations/ccb';

// SECURITY FIX: Use execFile instead of exec to prevent command injection
// execFile executes a file directly without shell interpretation
const execFileAsync = promisify(execFile);

export class AutoFixExecutor {
  constructor(private ccbClient?: CCBClient) {}

  async execute(plan: FixPlan): Promise<{ success: boolean; output: string }> {
    console.log(`[AutoFix] Executing ${plan.type} fix: ${plan.description}`);

    try {
      if (plan.type === 'local') {
        return await this.executeLocal(plan);
      } else if (plan.type === 'agent') {
        return await this.executeAgent(plan);
      } else {
        throw new Error(`Unknown fix type: ${plan.type}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[AutoFix] Execution failed:', errorMessage);
      return { success: false, output: errorMessage };
    }
  }

  /**
   * Parse shell-style command string with proper quote handling
   * SECURITY FIX v2: Handle quoted arguments correctly
   *
   * Examples:
   *   'git status' -> ['git', 'status']
   *   'echo "hello world"' -> ['echo', 'hello world']
   *   "git commit -m 'fix: bug'" -> ['git', 'commit', '-m', 'fix: bug']
   */
  private parseCommandArgs(commandStr: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuote: string | null = null;  // Track quote type: ' or "

    for (let i = 0; i < commandStr.length; i++) {
      const char = commandStr[i];

      // Handle quotes
      if ((char === '"' || char === "'") && commandStr[i - 1] !== '\\') {
        if (inQuote === char) {
          // Close quote
          inQuote = null;
        } else if (!inQuote) {
          // Open quote
          inQuote = char;
        } else {
          // Different quote type inside quotes - treat as literal
          current += char;
        }
        continue;
      }

      // Handle whitespace
      if (/\s/.test(char) && !inQuote) {
        if (current) {
          args.push(current);
          current = '';
        }
        continue;
      }

      // Regular character
      current += char;
    }

    // Add final argument
    if (current) {
      args.push(current);
    }

    return args;
  }

  private async executeLocal(plan: FixPlan): Promise<{ success: boolean; output: string }> {
    if (plan.tool === 'run_command') {
      // SECURITY FIX v2: Parse command with proper quote handling
      //
      // VULNERABILITY (v1): split(/\s+/) broke quoted arguments:
      //   'echo "hello world"' -> ['echo', '"hello', 'world"'] (WRONG)
      //
      // SECURITY FIX (v2): Proper shell-style parsing:
      //   'echo "hello world"' -> ['echo', 'hello world'] (CORRECT)
      //   Preserves quoted strings as single arguments
      //   Still prevents shell metacharacter interpretation (no shell=true)
      //
      const commandStr = plan.args.command as string;
      const parts = this.parseCommandArgs(commandStr);

      if (parts.length === 0) {
        throw new Error('Empty command');
      }

      const cmd = parts[0];
      const args = parts.slice(1);

      const { stdout, stderr } = await execFileAsync(cmd, args);
      return { success: true, output: stdout || stderr };
    }

    if (plan.tool === 'view_file') {
        const filePath = plan.args.AbsolutePath as string;
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            // Mocking the 'view_file' behavior by returning content. 
            // In a real plugin, this might call the actual tool implementation or send a message to the agent.
            return { success: true, output: `[AutoFix] Read file ${filePath}:\n${content.slice(0, 500)}... (truncated)` };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
             return { success: false, output: `Failed to read file: ${msg}` };
        }
    }
    
    return { success: false, output: `Unknown local tool: ${plan.tool}` };
  }

  private async executeAgent(plan: FixPlan): Promise<{ success: boolean; output: string }> {
    if (!this.ccbClient) {
      return { success: false, output: 'CCB Client not available for agent delegation' };
    }
    
    // Delegate to CCB Client
    const request: AgentRequest = {
        agent: String(plan.args.agent || 'assistant'),
        prompt: String(plan.args.task || plan.args.prompt || 'Please help with this task.')
    };

    const response = await this.ccbClient.askAgent(request);
    return { success: response.success, output: response.message };
  }
}
