import { Violation } from '../rules/schema';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
// import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export class MCPMemoryClient {
  public client: Client | null = null;
  public isConnected: boolean = false;

  constructor() {
    // In a real plugin scenario, we might refer to an existing connection 
    // or spin up a new transport. For the MVP, we start disconnected.
  }

  async connect() {
    // Phase 1 MVP: Connection logic to memory server would go here.
    // For now, we simply simulate a successful "virtual" connection flag
    // if we were to actually initialize the transport.
    
    // Example (commented out until we have a real server target):
    // const transport = new StdioClientTransport({ command: "npx", args: ["-y", "@modelcontextprotocol/server-memory"] });
    // this.client = new Client({ name: "agent-guard", version: "0.1.0" }, { capabilities: {} });
    // await this.client.connect(transport);
    
    this.isConnected = true; 
    // console.log('[MCP] Virtual connection established.');
  }

  async recordViolation(violation: Violation): Promise<void> {
    if (!this.isConnected || !this.client) {
        // Silent fail for MVP if not connected to avoid blocking user flow
        return;
    }

    try {
        const observation = [
            `Rule: ${violation.ruleName} (${violation.ruleId})`,
            `Message: ${violation.description}`,
            `Tool: ${violation.context?.toolName || 'N/A'}`,
            `File: ${violation.context?.filePath || 'N/A'}`,
            `Timestamp: ${new Date().toISOString()}`
        ].join('\n');

        await this.client.callTool({
            name: 'append_memory',
            arguments: {
                entities: [{
                    name: `[VIOLATION] ${violation.ruleId} ${Date.now()}`,
                    entityType: "compliance_violation",
                    observations: [observation]
                }]
            }
        });
        
    } catch (error) {
        console.error('Failed to record violation to MCP Memory', error);
    }
  }
}
