import { Rule, ToolData, Violation, Detector } from './rules/schema';
import { RuleRegistry } from './rules/registry';
import { SessionStateManager } from './state/session';
import { SequenceDetector } from './detectors/sequence';
import { ViolationTracker } from './enforcement/tracker';
import { Escalator } from './enforcement/escalator';
import { Notifier, EscalationLevel } from './enforcement/notifier';
import { MCPMemoryClient } from './integrations/mcp-client';
import { ConfigLoader, UserConfig } from './state/config';
import { StateDetector } from './detectors/state';
import { PatternDetector } from './detectors/pattern';
import { ContentAnalysisDetector } from './detectors/content-analysis';
import { CCBClient } from './integrations/ccb';
import { AutoFixStrategyMapper } from './autofix/strategy';
import { AutoFixExecutor } from './autofix/executor';
import { InteractiveUI } from './ui/interactive';

import { TelemetryService } from './telemetry/service';

export class AgentGuard {
  private registry: RuleRegistry;
  private sessionState: SessionStateManager;
  public tracker: ViolationTracker;
  private escalator: Escalator;
  private notifier: Notifier;
  private mcpClient: MCPMemoryClient;
  private ccbClient: CCBClient;
  private strategyMapper: AutoFixStrategyMapper;
  private executor: AutoFixExecutor;
  private ui: InteractiveUI;
  private config: UserConfig = {};
  private telemetry: TelemetryService;

  private detectors: Detector[] = [];

  constructor() {
    this.sessionState = SessionStateManager.getInstance();
    this.tracker = new ViolationTracker(this.sessionState);
    this.escalator = new Escalator();
    this.notifier = new Notifier();
    this.mcpClient = new MCPMemoryClient();
    this.ccbClient = new CCBClient(this.mcpClient);
    this.strategyMapper = new AutoFixStrategyMapper();
    this.executor = new AutoFixExecutor(this.ccbClient);
    this.ui = new InteractiveUI();
    this.registry = RuleRegistry.getInstance();
    this.telemetry = TelemetryService.getInstance();
    
    // Initialize detectors
    this.detectors = [
      new SequenceDetector(),
      new StateDetector(),
      new PatternDetector(),
      new ContentAnalysisDetector()
    ];
  }

  async initialize() {
    // Load config
    this.config = ConfigLoader.load(); // user config
    
    // Load rules
    this.registry.loadRules(); // Load built-in rules
    
    // Connect to MCP (async, don't await if we want to be fast/resilient)
    this.mcpClient.connect().catch(err => console.error('MCP Connection failed', err));
  }

  async processToolCall(toolData: ToolData) {
    // 1. Record tool usage to session state
    this.sessionState.addToolCall(toolData);
    
    // 2. Get active rules
    const rules = this.registry.getAllRules();
    
    for (const rule of rules) {
      if (!this.isRuleEnabled(rule)) {
        continue;
      }

      // Find appropriate detector
      const detector = this.detectors.find(d => d.getType() === rule.detector.type);
      if (!detector) continue;

      // 3. Detect
      const violation = detector.detect(toolData, rule, this.sessionState);
      
      if (violation) {
        console.log(`[WardnMesh] Violation detected: ${violation.ruleId}`);
        await this.handleViolation(violation, rule);
      }
    }
    
    // Flush telemetry
    await this.telemetry.shutdown();
  }

  private isRuleEnabled(rule: Rule): boolean {
    // Check user config first
    if (this.config.rules && typeof this.config.rules[rule.id] === 'boolean') {
      return this.config.rules[rule.id];
    }
    
    // Fallback to registry default (which is usually true)
    return this.registry.isRuleEnabled(rule.id);
  }

  private async handleViolation(violation: Violation, rule: Rule) {
    // 1. Track
    const record = this.tracker.track(violation);
    
    // 2. Escalate (Initial)
    let level = this.escalator.escalate(rule, record);
    
    // 3. Interactive Verification (Phase 1.5)
    // If serious violation or block, ask user for verification
    if ((level === EscalationLevel.BLOCK || rule.severity === 'critical') && process.stdin.isTTY) {
        const { authorized, feedback } = await this.ui.askForVerification(
            rule.name,
            rule.severity,
            violation.description
        );

        if (feedback) {
            this.telemetry.track({
                event: 'agent_guard_user_feedback',
                properties: {
                    ruleId: rule.id,
                    verdict: feedback,
                    ruleSource: 'local', // Assuming local for now
                    comment: authorized ? 'User authorized action' : 'User confirmed block'
                }
            });
        }

        if (authorized) {
            console.log('✅ Violation overridden by user.');
            level = EscalationLevel.WARNING; // Downgrade to warning
        }
    }

    // 4. Notify
    this.notifier.notify(violation, level);

    // 5. Telemetry
    this.telemetry.track({
        event: 'agent_guard_rule_triggered',
        properties: {
            ruleId: rule.id,
            category: rule.category,
            severity: rule.severity,
            toolName: violation.context.toolName || 'unknown',
            blocked: level === EscalationLevel.BLOCK
        }
    });
    
    // 6. Record to Memory
    await this.mcpClient.recordViolation(violation);
    
    // 7. Block if needed (throw error to exit process with failure code?)
    if (level === EscalationLevel.BLOCK) {
       // For a passive hook, we might not be able to actually 'block' the tool 
       // unless this is a pre-hook. Post-hook is too late to block execution, 
       // but we can loudly complain or kill the session if possible.
       // The architecture says "BLOCK (prevent execution - experimental)".
       // Since this is post-tool-use, the tool already ran. 
       // We can only warn for now, or fail the hook which might signal Claude.
       process.exitCode = 1; // Signal failure
    }

    // 7. Attempt Auto-Fix (Phase 2)
    await this.attemptAutoFix(violation, rule);
  }

  private async attemptAutoFix(violation: Violation, rule: Rule) {
    // Only attempt fix if rule has autofix enabled (checked in strategyMapper)
    // and if severity warrants it (or config allows)
    
    const plan = this.strategyMapper.getFix(violation, rule);
    
    if (plan) {
      const userApproved = await this.ui.askToFix(plan);
      
      if (userApproved) {
        this.telemetry.track({
            event: 'agent_guard_autofix_action',
            properties: { ruleId: rule.id, strategy: plan.type, status: 'accepted' }
        });

        const result = await this.executor.execute(plan);
        if (result.success) {
          console.log('✅ Fix applied successfully.');
          this.telemetry.track({
             event: 'agent_guard_autofix_action',
             properties: { ruleId: rule.id, strategy: plan.type, status: 'succeeded' }
          });
        } else {
          console.error('❌ Fix failed:', result.output);
          this.telemetry.track({
             event: 'agent_guard_autofix_action',
             properties: { ruleId: rule.id, strategy: plan.type, status: 'failed', error: result.output }
          });
        }
      } else {
        this.telemetry.track({
            event: 'agent_guard_autofix_action',
            properties: { ruleId: rule.id, strategy: plan.type, status: 'rejected' }
        });
      }
    }
  }
}
