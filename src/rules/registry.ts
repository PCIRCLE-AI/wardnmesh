/**
 * Rule Registry - Manages loading and querying of rules
 *
 * Central registry for all compliance rules. Handles rule loading,
 * querying, and runtime enable/disable.
 */

import fs from 'fs';
import path from 'path';
import { Rule, RuleCategory, Severity } from './schema';
import { READ_BEFORE_EDIT } from './definitions/workflow/read-before-edit';
import { RUN_TESTS_BEFORE_CLAIM } from './definitions/workflow/run-tests-before-claim';
import { NO_HARDCODED_SECRETS } from './definitions/safety/no-hardcoded-secrets';
import { CONFIRM_DANGEROUS_ACTION } from './definitions/safety/confirm-dangerous-action';
import { NO_INCOMPLETE_WORK } from './definitions/quality/no-incomplete-work';
import { RESTRICT_OUTBOUND_TOOL } from './definitions/network/restrict-outbound';
import { DynamicRuleLoader } from './dynamic_loader';
import { adaptAllRules } from './threat-rule-adapter';
import { logger } from '../logging/logger';

// ...




/**
 * Rule Registry
 *
 * Singleton registry that manages all compliance rules.
 */
export class RuleRegistry {
  private static instance: RuleRegistry;
  private rules: Map<string, Rule> = new Map();
  private enabledRules: Set<string> = new Set();
  private dynamicRuleIds: Set<string> = new Set();
  private dynamicLoader: DynamicRuleLoader;

  private constructor() {
    this.dynamicLoader = new DynamicRuleLoader();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RuleRegistry {
    if (!RuleRegistry.instance) {
      RuleRegistry.instance = new RuleRegistry();
    }
    return RuleRegistry.instance;
  }

  /**
   * Load all rule definitions
   *
   * This method loads rules from the definitions directory.
   * Should be called once during initialization.
   */
  loadRules(): void {
    // Register workflow rules
    this.registerRule(READ_BEFORE_EDIT);
    this.registerRule(RUN_TESTS_BEFORE_CLAIM);
    this.registerRule(NO_HARDCODED_SECRETS);
    this.registerRule(CONFIRM_DANGEROUS_ACTION);
    this.registerRule(NO_INCOMPLETE_WORK);
    this.registerRule(RESTRICT_OUTBOUND_TOOL);

    console.error(`[RuleRegistry] Loaded ${this.rules.size} static rules`);

    // Load bundled threat rules from data/default-threat-rules.json
    this.loadBundledThreatRules();
  }

  /**
   * Load bundled threat rules from data/default-threat-rules.json
   * Converts flat JSON threat rules into the internal Rule schema
   */
  loadBundledThreatRules(): void {
    try {
      const dataPath = path.resolve(__dirname, '../../data/default-threat-rules.json');
      if (!fs.existsSync(dataPath)) {
        logger.warn('rules.registry', `Bundled threat rules not found at ${dataPath}`);
        return;
      }

      const raw = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      const { valid, skipped } = adaptAllRules(raw);

      for (const rule of valid) {
        this.registerRule(rule);
      }

      logger.info('rules.registry', `Loaded ${valid.length} bundled threat rules, skipped ${skipped.length}`, {
        skippedCount: skipped.length,
      });
    } catch (err) {
      logger.error('rules.registry', 'Failed to load bundled threat rules', undefined, err instanceof Error ? err : undefined);
    }
  }

  /**
   * Load dynamic rules from file and start watching
   * @param filePath Path to dynamic rules JSON
   */
  loadDynamicRules(filePath: string): void {
      this.dynamicLoader.watchFile(filePath, (newRules) => {
          console.error(`[RuleRegistry] Reloading ${newRules.length} dynamic rules from ${filePath}`);
          
          this.clearDynamicRules();
          
          for (const rule of newRules) {
              this.registerRule(rule, true); // true = isDynamic
          }
      });
  }

  /**
   * Clear all dynamic rules
   */
  clearDynamicRules(): void {
      for (const id of this.dynamicRuleIds) {
          this.unregisterRule(id);
      }
      this.dynamicRuleIds.clear();
  }

  /**
   * Register a single rule
   *
   * @param rule - Rule to register
   */
  registerRule(rule: Rule, isDynamic: boolean = false): void {
    if (this.rules.has(rule.id)) {
        // If existing rule is dynamic, we are just updating it.
        // If existing rule is static, we are overwriting it (user override).
      console.error(`[RuleRegistry] Rule ${rule.id} already registered, overwriting`);
    }

    this.rules.set(rule.id, rule);
    this.enabledRules.add(rule.id); // Enable by default
    
    if (isDynamic) {
        this.dynamicRuleIds.add(rule.id);
    }
  }

  /**
   * Unregister a rule
   *
   * @param ruleId - Rule ID to unregister
   */
  unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.enabledRules.delete(ruleId);
    this.dynamicRuleIds.delete(ruleId);
  }

  /**
   * Get rule by ID
   *
   * @param ruleId - Rule ID
   * @returns Rule or null if not found
   */
  getRule(ruleId: string): Rule | null {
    return this.rules.get(ruleId) || null;
  }

  /**
   * Get all rules
   *
   * @returns Array of all registered rules
   */
  getAllRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get enabled rules only
   *
   * @returns Array of enabled rules
   */
  getEnabledRules(): Rule[] {
    return Array.from(this.rules.values()).filter(rule =>
      this.enabledRules.has(rule.id)
    );
  }

  /**
   * Get rules by category
   *
   * @param category - Rule category
   * @returns Rules in the specified category
   */
  getRulesByCategory(category: RuleCategory): Rule[] {
    return Array.from(this.rules.values()).filter(
      rule => rule.category === category
    );
  }

  /**
   * Get rules by severity
   *
   * @param severity - Severity level
   * @returns Rules with the specified severity
   */
  getRulesBySeverity(severity: Severity): Rule[] {
    return Array.from(this.rules.values()).filter(
      rule => rule.severity === severity
    );
  }

  /**
   * Check if rule is enabled
   *
   * @param ruleId - Rule ID
   * @returns True if rule is enabled
   */
  isRuleEnabled(ruleId: string): boolean {
    return this.enabledRules.has(ruleId);
  }

  /**
   * Enable a rule
   *
   * @param ruleId - Rule ID to enable
   */
  enableRule(ruleId: string): void {
    if (!this.rules.has(ruleId)) {
      console.error(`[RuleRegistry] Cannot enable unknown rule: ${ruleId}`);
      return;
    }
    this.enabledRules.add(ruleId);
  }

  /**
   * Disable a rule
   *
   * @param ruleId - Rule ID to disable
   */
  disableRule(ruleId: string): void {
    this.enabledRules.delete(ruleId);
  }

  /**
   * Set rule enabled state
   *
   * @param ruleId - Rule ID
   * @param enabled - Enable or disable
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    if (enabled) {
      this.enableRule(ruleId);
    } else {
      this.disableRule(ruleId);
    }
  }

  /**
   * Get rule count
   *
   * @returns Total number of registered rules
   */
  getRuleCount(): number {
    return this.rules.size;
  }

  /**
   * Get enabled rule count
   *
   * @returns Number of enabled rules
   */
  getEnabledRuleCount(): number {
    return this.enabledRules.size;
  }

  /**
   * Clear all rules (for testing)
   */
  clear(): void {
    this.rules.clear();
    this.enabledRules.clear();
    this.dynamicRuleIds.clear();
  }
}

/**
 * Get the singleton registry instance
 */
export function getRuleRegistry(): RuleRegistry {
  return RuleRegistry.getInstance();
}
