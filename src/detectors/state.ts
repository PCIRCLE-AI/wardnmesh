import { Detector, ToolData, Violation, Rule } from '../rules/schema';
import { getSessionStateManager } from '../state/session';
import { getCachedRegex } from '../utils/safe-regex';
import { getValueByPath } from '../utils/object-path';

interface StateConfig {
  requiredState: string;
  targetStateValue: unknown;
  // Tool that triggers the check (e.g. notify_user with "Task Completed")
  trigger: {
    tool: string;
    parameterMatch?: {
      key: string;
      valuePattern: string; // Regex string
    };
  };
  // Logic to determine current state from history if not explicitly set
  stateDerivation?: {
    fromTool: string;
    setState: string;
    setValue: unknown;
    validityDurationMs?: number;
  };
}

export class StateDetector implements Detector {
  private sessionState = getSessionStateManager();

  getType(): 'state' {
    return 'state';
  }

  detect(toolData: ToolData, rule: Rule): Violation | null {
    const config = rule.detector.config as StateConfig;

    this.updateStateFromTool(config, toolData);

    if (this.isTriggerEvent(config, toolData)) {
      const currentState = this.sessionState.getCustomState(config.requiredState);

      if (currentState !== config.targetStateValue) {
        return {
          id: crypto.randomUUID(),
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          timestamp: new Date().toISOString(),
          description: rule.description,
          context: {
            toolName: toolData.toolName,
            toolData: toolData,
            additionalInfo: {
                message: `Required state '${config.requiredState}' is '${currentState || 'undefined'}', expected '${config.targetStateValue}'.`
            }
          }
        };
      }

      if (config.stateDerivation?.validityDurationMs) {
          const lastUpdate = this.sessionState.getCustomState(`${config.requiredState}_timestamp`);
          if (lastUpdate) {
              const timeDiff = new Date().getTime() - new Date(String(lastUpdate)).getTime();
              if (timeDiff > config.stateDerivation.validityDurationMs) {
                  return {
                      id: crypto.randomUUID(),
                      ruleId: rule.id,
                      ruleName: rule.name,
                      severity: rule.severity,
                      timestamp: new Date().toISOString(),
                      description: rule.description,
                      context: {
                          toolName: toolData.toolName,
                          toolData: toolData,
                          additionalInfo: {
                              message: `Required state '${config.requiredState}' has expired (last verified ${Math.floor(timeDiff/1000)}s ago).`
                          }
                      }
                  };
              }
          }
      }
    }

    return null;
  }

  private isTriggerEvent(config: StateConfig, toolData: ToolData): boolean {
    if (toolData.toolName !== config.trigger.tool) return false;

    if (config.trigger.parameterMatch) {
      const paramValue = getValueByPath(toolData.parameters as Record<string, unknown>, config.trigger.parameterMatch.key);

      if (!paramValue || typeof paramValue !== 'string') return false;

      // SECURITY FIX Round 15: Use getCachedRegex for ReDoS protection
      const regex = getCachedRegex(config.trigger.parameterMatch.valuePattern, 'i');
      if (!regex) {
        console.warn(`[StateDetector] Invalid or unsafe regex pattern: ${config.trigger.parameterMatch.valuePattern}`);
        return false;
      }

      return regex.test(paramValue);
    }

    return true;
  }

  private updateStateFromTool(config: StateConfig, toolData: ToolData): void {
      if (config.stateDerivation && toolData.toolName === config.stateDerivation.fromTool) {
          // Heuristic check for 'test' in command line if it's run_command
          if (toolData.toolName === 'run_command' && toolData.parameters.CommandLine) {
             const commandLine = toolData.parameters.CommandLine as string;
             if (commandLine.includes('test') || commandLine.includes('vitest')) {
                 this.sessionState.setCustomState(config.stateDerivation.setState, config.stateDerivation.setValue);
                 this.sessionState.setCustomState(`${config.stateDerivation.setState}_timestamp`, new Date().toISOString());
             }
          } else {
             // For other tools, just trust the tool usage (mocking behavior for now)
             this.sessionState.setCustomState(config.stateDerivation.setState, config.stateDerivation.setValue);
             this.sessionState.setCustomState(`${config.stateDerivation.setState}_timestamp`, new Date().toISOString());
          }
      }
  }
}
