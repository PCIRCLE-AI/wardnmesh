/**
 * Session State Manager
 *
 * Manages the state of the current AgentGuard session, including:
 * - Tool call history
 * - Recent tools (sliding window for sequence detection)
 * - Detected violations
 * - Custom state storage for detectors
 */

import { SessionState, SessionStateProvider, ToolData, Violation } from '../rules/schema';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Session State Manager
 *
 * Singleton manager for session state. Provides methods to:
 * - Track tool calls
 * - Manage sliding window of recent tools
 * - Record detected violations
 * - Store/retrieve custom state for detectors
 */
export class SessionStateManager implements SessionStateProvider {
  private static instance: SessionStateManager;
  private state: SessionState;
  private readonly maxRecentTools: number = 50; // Sliding window size

  private constructor() {
    this.state = this.loadState();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SessionStateManager {
    if (!SessionStateManager.instance) {
      SessionStateManager.instance = new SessionStateManager();
    }
    return SessionStateManager.instance;
  }

  /**
   * Add a tool call to the session
   *
   * @param toolData - Tool execution data
   */
  addToolCall(toolData: ToolData): void {
    // Add to full history
    this.state.toolCalls.push(toolData);

    // Add to recent tools (sliding window)
    this.state.recentTools.push(toolData);

    // Maintain sliding window size
    if (this.state.recentTools.length > this.maxRecentTools) {
      this.state.recentTools.shift();
    }

    // Update current file if tool is Read or Edit
    if (toolData.toolName === 'Read' || toolData.toolName === 'Edit') {
      const filePath = toolData.parameters.file_path;
      if (filePath) {
        this.state.currentFile = filePath as string;
      }
    }
    
    this.saveState();
  }

  /**
   * Add a detected violation to the session
   *
   * @param violation - Violation record
   */
  addViolation(violation: Violation): void {
    this.state.detectedViolations.push(violation);
  }

  /**
   * Get recent tool calls for sequence detection
   *
   * @param count - Number of recent tools to retrieve (default: all in window)
   * @returns Recent tool calls
   */
  getRecentTools(count?: number): ToolData[] {
    if (count === undefined) {
      return [...this.state.recentTools];
    }
    return this.state.recentTools.slice(-count);
  }

  /**
   * Get all tool calls in this session
   *
   * @returns All tool calls
   */
  getAllToolCalls(): ToolData[] {
    return [...this.state.toolCalls];
  }

  /**
   * Get all detected violations in this session
   *
   * @returns All violations
   */
  getViolations(): Violation[] {
    return [...this.state.detectedViolations];
  }

  /**
   * Get current file being worked on
   *
   * @returns Current file path or undefined
   */
  getCurrentFile(): string | undefined {
    return this.state.currentFile;
  }

  /**
   * Get session start time
   *
   * @returns ISO 8601 timestamp
   */
  getStartTime(): string {
    return this.state.startTime;
  }

  /**
   * Get session duration in milliseconds
   *
   * @returns Duration in ms
   */
  getSessionDuration(): number {
    const start = new Date(this.state.startTime).getTime();
    const now = Date.now();
    return now - start;
  }

  /**
   * Set custom state value for detectors
   *
   * Detectors can use this to store custom state between detections.
   * For example, StateDetector can track file modification counts.
   *
   * @param key - State key
   * @param value - State value
   */
  setCustomState(key: string, value: unknown): void {
    this.state.customState[key] = value;
  }

  /**
   * Get custom state value
   *
   * @param key - State key
   * @returns State value or undefined
   */
  getCustomState(key: string): unknown {
    return this.state.customState[key];
  }

  /**
   * Check if custom state key exists
   *
   * @param key - State key
   * @returns True if key exists
   */
  hasCustomState(key: string): boolean {
    return key in this.state.customState;
  }

  /**
   * Delete custom state key
   *
   * @param key - State key
   */
  deleteCustomState(key: string): void {
    delete this.state.customState[key];
  }

  /**
   * Clear all custom state
   */
  clearCustomState(): void {
    this.state.customState = {};
  }

  /**
   * Get full session state (for debugging/inspection)
   */
  getState(): SessionState {
    return structuredClone(this.state);
  }

  /**
   * Reset session state (for testing or session restart)
   */
  reset(): void {
    this.state = this.createDefaultState();
  }

  private createDefaultState(): SessionState {
    return {
      startTime: new Date().toISOString(),
      toolCalls: [],
      recentTools: [],
      detectedViolations: [],
      customState: {}
    };
  }

  /**
   * Get session statistics
   *
   * @returns Session stats
   */
  getStats(): {
    totalToolCalls: number;
    totalViolations: number;
    sessionDuration: number;
    currentFile?: string;
    recentToolsCount: number;
  } {
    return {
      totalToolCalls: this.state.toolCalls.length,
      totalViolations: this.state.detectedViolations.length,
      sessionDuration: this.getSessionDuration(),
      currentFile: this.state.currentFile,
      recentToolsCount: this.state.recentTools.length
    };
  }

  private getStatePath(): string {
    const homeDir = os.homedir();
    const stateDir = path.join(homeDir, '.claude', 'state', 'agent-guard');
    
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    
    return path.join(stateDir, 'session-state.json');
  }
  
  private loadState(): SessionState {
    const statePath = this.getStatePath();
    if (fs.existsSync(statePath)) {
      try {
        return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      } catch (e) {
        console.error('[SessionState] Failed to load state', e);
      }
    }
    return this.createDefaultState();
  }

  private saveState(): void {
    try {
      fs.writeFileSync(this.getStatePath(), JSON.stringify(this.state, null, 2));
    } catch (e) {
      console.error('[SessionState] Failed to save state', e);
    }
  }
}

/**
 * Get the singleton session state manager
 */
export function getSessionStateManager(): SessionStateManager {
  return SessionStateManager.getInstance();
}
