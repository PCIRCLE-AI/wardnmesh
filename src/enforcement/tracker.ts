import { Violation } from '../rules/schema';
import { SessionStateManager } from '../state/session';
import fs from 'fs';
import path from 'path';
import os from 'os';


export interface ViolationRecord {
  ruleId: string;
  violationCount: number;
  lastViolation: string;
  violations: ViolationEvent[];
}

export interface ViolationEvent {
  timestamp: string;
  message: string;
  toolName?: string;
  file?: string;
}

export interface GlobalViolationState {
  ruleViolations: Record<string, {
    count: number;
    firstViolation: string;
    lastViolation: string;
    history: ViolationEvent[];
  }>;
  globalViolations: {
    total: number;
    criticalCount: number;
    majorCount: number;
    minorCount: number;
  };
}

export class ViolationTracker {
  private sessionState: SessionStateManager;
  
  constructor(sessionState: SessionStateManager) {
    this.sessionState = sessionState;
  }

  /**
   * Get global violation statistics
   */
  public getGlobalStats(): GlobalViolationState {
    return this.loadGlobalState(this.getGlobalStatePath());
  }

  /**
   * Track a new violation
   */
  track(violation: Violation): ViolationRecord {
    // 1. Update Session State (in-memory & session file)
    this.sessionState.addViolation(violation);
    
    // 2. Update Persistent Global State (violations.json)
    const record = this.updatePersistentState(violation);
    
    return record;
  }

  private updatePersistentState(violation: Violation): ViolationRecord {
    const globalStatePath = this.getGlobalStatePath();
    const globalState = this.loadGlobalState(globalStatePath);
    
    // Initialize rule record if not exists
    if (!globalState.ruleViolations[violation.ruleId]) {
      globalState.ruleViolations[violation.ruleId] = {
        count: 0,
        firstViolation: new Date().toISOString(),
        lastViolation: new Date().toISOString(),
        history: []
      };
    }
    
    const ruleRecord = globalState.ruleViolations[violation.ruleId];
    
    // Update count
    ruleRecord.count++;
    ruleRecord.lastViolation = new Date().toISOString();
    
    // Add to history (limit to last 50)
    ruleRecord.history.unshift({
      timestamp: new Date().toISOString(),
      message: violation.description,
      toolName: violation.context?.toolName,
      file: violation.context?.filePath
    });
    
    if (ruleRecord.history.length > 50) {
      ruleRecord.history = ruleRecord.history.slice(0, 50);
    }
    
    // Update global counters
    globalState.globalViolations.total++;
    // (Severity counts would be updated here if we had severity in the violation object immediately accessible, 
    // but typically we get severity from the rule config. For now, just total.)
    
    // Save state
    this.saveGlobalState(globalStatePath, globalState);
    
    return {
      ruleId: violation.ruleId,
      violationCount: ruleRecord.count,
      lastViolation: ruleRecord.lastViolation,
      violations: ruleRecord.history
    };
  }
  
  private getGlobalStatePath(): string {
    const homeDir = os.homedir();
    const stateDir = path.join(homeDir, '.claude', 'state', 'agent-butler');
    
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    
    return path.join(stateDir, 'violations.json');
  }
  
  private loadGlobalState(filePath: string): GlobalViolationState {
    if (!fs.existsSync(filePath)) {
      return {
        ruleViolations: {},
        globalViolations: {
          total: 0,
          criticalCount: 0,
          majorCount: 0,
          minorCount: 0
        }
      };
    }
    
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
      console.error('Failed to load violations state:', error);
      return { ruleViolations: {}, globalViolations: { total: 0, criticalCount: 0, majorCount: 0, minorCount: 0 } };
    }
  }
  
  private saveGlobalState(filePath: string, state: GlobalViolationState): void {
    try {
      fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('Failed to save violations state:', error);
    }
  }
}

