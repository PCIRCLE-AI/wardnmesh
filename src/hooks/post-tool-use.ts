/**
 * Post Tool Use Hook
 * 
 * This script is executed by Claude Code after every tool use.
 * It receives the tool call details via stdin and runs the AgentGuard compliance checks.
 */

import { AgentGuard } from '../agent-guard';
import { ToolData } from '../rules/schema';

async function main() {
  // 1. Read input from stdin
  const input = await readStdin();
  if (!input) {
    return;
  }

  try {
    const data = JSON.parse(input);
    
    // Map input format to ToolData expected by AgentGuard
    // Note: The actual format from Claude Code needs to be verified. 
    // Assuming a structure like { tool: string, input: any, result: any, ... }
    const toolData: ToolData = {
        toolName: data.tool || data.toolName,
        parameters: data.input || data.parameters || {},
        result: data.result || {},
        timestamp: new Date().toISOString(),
        duration: data.duration || 0
    };

    // 2. Initialize AgentGuard
    const butler = new AgentGuard();
    await butler.initialize();

    // 3. Process tool call
    await butler.processToolCall(toolData);

  } catch {
    // Fail silently in production to not disrupt user, but log for debugging
    // console.error('AgentGuard Error:', error);
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    const stdin = process.stdin;

    // Set encoding to utf8
    stdin.setEncoding('utf8');

    // Read data
    stdin.on('data', (chunk) => {
      data += chunk;
    });

    // Handle end of stream
    stdin.on('end', () => {
      resolve(data);
    });

    // Handle empty input or interactive mode (shouldn't happen for this hook type)
    if (stdin.isTTY) {
      resolve('');
    }
  });
}

main();
