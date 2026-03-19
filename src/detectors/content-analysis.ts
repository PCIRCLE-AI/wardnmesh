/**
 * Content Analysis Detector
 *
 * Analyzes the content of Claude's output to detect violations like:
 * - ADMIT_UNCERTAINTY: Using uncertain language without explicit acknowledgment
 * - CITE_SOURCES: Making claims without citing sources
 * - AVOID_HALLUCINATION: Assuming facts without verification
 *
 * Detection logic:
 * - suspicious_without_valid: Has suspicious patterns but lacks valid patterns
 * - contains_suspicious: Contains suspicious patterns (regardless of valid ones)
 * - missing_valid: Lacks required valid patterns
 */

import { BaseDetector } from './base';
import {
  ToolData,
  Violation,
  Rule,
  ContentAnalysisDetectorConfig,
  SessionStateProvider
} from '../rules/schema';

/**
 * Content Analysis Detector
 *
 * Analyzes tool output content for pattern violations.
 */
export class ContentAnalysisDetector extends BaseDetector {
  getType(): string {
    return 'content_analysis';
  }

  detect(
    toolData: ToolData,
    rule: Rule,
    _sessionState: SessionStateProvider
  ): Violation | null {
    const config = rule.detector.config as ContentAnalysisDetectorConfig;

    // Get content to analyze (typically tool output or parameters)
    const content = this.extractContent(toolData);

    if (!content) {
      return null; // No content to analyze
    }

    // Apply detection logic
    const violation = this.analyzeContent(content, config, rule, toolData);

    return violation;
  }

  /**
   * Extract content to analyze from tool data
   *
   * @param toolData - Tool execution data
   * @returns Content string or null
   */
  private extractContent(toolData: ToolData): string | null {
    // For most tools, analyze the output
    if (toolData.result.output) {
      return toolData.result.output;
    }

    // For Write/Edit tools, analyze the content being written
    if (toolData.toolName === 'write_to_file') {
      return toolData.parameters.CodeContent as string;
    }
    
    if (toolData.toolName === 'replace_file_content') {
        return toolData.parameters.ReplacementContent as string;
    }

    if (toolData.toolName === 'multi_replace_file_content') {
        // Concatenate all replacement chunks
        const chunks = toolData.parameters.ReplacementChunks as Array<{ ReplacementContent: string }>;
        if (Array.isArray(chunks)) {
            return chunks.map(c => c.ReplacementContent).join('\n');
        }
        return null;
    }

    return null;
  }

  /**
   * Analyze content against patterns
   *
   * @param content - Content to analyze
   * @param config - Detector config
   * @param rule - Rule definition
   * @param toolData - Tool data for violation context
   * @returns Violation or null
   */
  private analyzeContent(
    content: string,
    config: ContentAnalysisDetectorConfig,
    rule: Rule,
    toolData: ToolData
  ): Violation | null {
    const suspiciousMatches = this.findMatches(
      content,
      config.suspiciousPatterns || []
    );
    const validMatches = this.findMatches(
      content,
      config.validPatterns || []
    );

    // Apply detection logic
    switch (config.logic) {
      case 'suspicious_without_valid':
        // Has suspicious patterns but lacks valid patterns
        if (suspiciousMatches.length > 0 && validMatches.length === 0) {
          return this.createViolation(rule, toolData, {
            reason: 'Suspicious patterns detected without valid patterns',
            suspiciousMatches,
            suspiciousCount: suspiciousMatches.length
          });
        }
        break;

      case 'contains_suspicious': {
        // Contains suspicious patterns (regardless of valid ones)
        const minMatches = config.minMatches || 1;
        if (suspiciousMatches.length >= minMatches) {
          return this.createViolation(rule, toolData, {
            reason: `Contains ${suspiciousMatches.length} suspicious pattern(s)`,
            suspiciousMatches,
            suspiciousCount: suspiciousMatches.length,
            threshold: minMatches
          });
        }
        break;
      }

      case 'missing_valid':
        // Lacks required valid patterns
        if (validMatches.length === 0) {
          return this.createViolation(rule, toolData, {
            reason: 'Missing required valid patterns',
            validPatternsRequired: config.validPatterns?.length || 0
          });
        }
        break;
    }

    return null;
  }

  /** Find unique pattern matches in content */
  private findMatches(content: string, patterns: RegExp[]): string[] {
    const matches: string[] = [];

    // SECURITY FIX Round 15: Use patterns directly (already validated RegExp objects)
    // VULNERABILITY: new RegExp(pattern, 'gi') recreated pattern without validation
    for (const pattern of patterns) {
      const found = content.match(pattern);  // Use pattern directly - already validated
      if (found) {
        matches.push(...found);
      }
    }

    return Array.from(new Set(matches));
  }
}
