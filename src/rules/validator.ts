
import { Rule, RuleCategory, Severity, DetectorType, PatternDetectorConfig } from './schema';
import { validateRegexPatterns } from '../utils/safe-regex';

/**
 * Validates a rule object against the schema.
 * Throws an error if invalid.
 *
 * SECURITY FIX (MAJOR-3): Added regex validation to prevent ReDoS attacks
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateRule(data: any): Rule {
    if (!data || typeof data !== 'object') {
        throw new Error('Rule must be an object');
    }

    if (typeof data.id !== 'string' || !data.id) throw new Error('Rule.id is required and must be a string');
    if (typeof data.name !== 'string' || !data.name) throw new Error('Rule.name is required and must be a string');
    
    const categories: RuleCategory[] = ['workflow', 'quality', 'safety'];
    if (!categories.includes(data.category)) throw new Error(`Invalid category: ${data.category}. Must be one of ${categories.join(', ')}`);

    const severities: Severity[] = ['critical', 'major', 'minor'];
    if (!severities.includes(data.severity)) throw new Error(`Invalid severity: ${data.severity}. Must be one of ${severities.join(', ')}`);

    if (typeof data.description !== 'string') throw new Error('Rule.description is required');

    if (!data.detector || typeof data.detector !== 'object') throw new Error('Rule.detector is required');
    
    const detectorTypes: DetectorType[] = ['sequence', 'state', 'pattern', 'content_analysis'];
    if (!detectorTypes.includes(data.detector.type)) {
        throw new Error(`Invalid detector type: ${data.detector.type}`);
    }

    if (!data.detector.config || typeof data.detector.config !== 'object') {
         throw new Error('Rule.detector.config is required');
    }

    // Basic config validation based on type
    if (data.detector.type === 'content_analysis') {
        const config = data.detector.config;
        if (!config.logic) throw new Error('ContentAnalysis config requires "logic" field');
        // patterns are checked in loader (conversion to RegExp)
    }

    // SECURITY FIX (MAJOR-3): Validate regex patterns in pattern detector to prevent ReDoS
    if (data.detector.type === 'pattern') {
        const config = data.detector.config as PatternDetectorConfig;

        if (!config.patterns || !Array.isArray(config.patterns)) {
            throw new Error('Pattern detector config requires "patterns" array');
        }

        // Extract all regex patterns from the config
        const regexPatterns: string[] = config.patterns.map(p => p.regex);

        // Add exception patterns if they exist
        if (config.exceptions && Array.isArray(config.exceptions)) {
            regexPatterns.push(...config.exceptions);
        }

        // Validate all regex patterns for ReDoS safety
        const validation = validateRegexPatterns(regexPatterns);
        if (!validation.valid) {
            throw new Error(`Pattern detector contains unsafe regex patterns: ${validation.error}`);
        }
    }

    if (!data.escalation || typeof data.escalation !== 'object') throw new Error('Rule.escalation is required');

    if (data.autofix) {
        if (typeof data.autofix.enabled !== 'boolean') throw new Error('Autofix.enabled must be boolean');
        if (typeof data.autofix.strategy !== 'string') throw new Error('Autofix.strategy must be string');
    }

    return data as Rule;
}
