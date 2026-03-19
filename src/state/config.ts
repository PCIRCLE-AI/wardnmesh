import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Telemetry Configuration
 */
export interface TelemetryConfig {
  /** Master switch for telemetry collection */
  enabled: boolean;
  /** Anonymous UUID for session tracking (not PII) */
  anonymousId?: string;
  /** Last time the user was prompted about telemetry */
  lastPrompted?: number;
}

/**
 * User Configuration Interface
 */
export interface UserConfig {
  /** Map of rule IDs to boolean enabled/disabled status */
  rules?: Record<string, boolean>;
  
  /** Telemetry settings */
  telemetry?: TelemetryConfig;

  /** Authentication settings */
  auth?: {
    token: string;
    userId?: string;
    tier?: string;
  };

  /** Global settings (Phase 2 placeholder) */
  settings?: Record<string, unknown>;
}

/**
 * Configuration Loader
 * 
 * Handles loading of user configuration from the filesystem.
 */
export class ConfigLoader {
  
  /**
   * Load user configuration
   */
  static load(): UserConfig {
    const configPath = this.getConfigPath();
    
    if (!fs.existsSync(configPath)) {
      return {};
    }
    
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('[ConfigLoader] Failed to load config:', error);
      return {};
    }
  }
  
  /**
   * Save user configuration
   */
  static save(config: UserConfig): void {
    const configPath = this.getConfigPath();
    const configDir = path.dirname(configPath);

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.error('[ConfigLoader] Failed to save config:', error);
    }
  }

  private static getConfigPath(): string {
    const homeDir = os.homedir();
    // Updated to use the correct project name
    const configDir = path.join(homeDir, '.claude', 'agent-guard');
    
    if (!fs.existsSync(configDir)) {
      // Create directory if it doesn't exist
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    return path.join(configDir, 'config.json');
  }
}
