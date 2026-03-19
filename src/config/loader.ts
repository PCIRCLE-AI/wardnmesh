/**
 * Configuration Hierarchy Loader
 *
 * Priority (high → low):
 *   1. CLI flags
 *   2. Environment variables (WARDN_*)
 *   3. Project config (.wardnmesh.json in CWD)
 *   4. User config (~/.wardnmesh/config.json)
 *   5. Built-in defaults
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { DEFAULT_CONFIG, type WardnConfig, type ProjectConfig } from './defaults';

const WARDN_DIR = path.join(os.homedir(), '.wardnmesh');
const USER_CONFIG_PATH = path.join(WARDN_DIR, 'config.json');
const PROJECT_CONFIG_NAME = '.wardnmesh.json';

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function deepMerge(base: WardnConfig, override: Partial<WardnConfig>): WardnConfig {
  const result = JSON.parse(JSON.stringify(base)) as WardnConfig;
  if (override.scan) Object.assign(result.scan, override.scan);
  if (override.confirmation) {
    if (override.confirmation.timeouts) Object.assign(result.confirmation.timeouts, override.confirmation.timeouts);
    if (override.confirmation.defaultAction !== undefined) result.confirmation.defaultAction = override.confirmation.defaultAction;
    if (override.confirmation.preferDesktop !== undefined) result.confirmation.preferDesktop = override.confirmation.preferDesktop;
  }
  if (override.audit) Object.assign(result.audit, override.audit);
  if (override.ui) Object.assign(result.ui, override.ui);
  if (override.version !== undefined) result.version = override.version;
  return result;
}

function applyEnvOverrides(config: WardnConfig): WardnConfig {
  const env = process.env;

  if (env.WARDN_TIMEOUT_CRITICAL) {
    config.confirmation.timeouts.critical = parseInt(env.WARDN_TIMEOUT_CRITICAL, 10);
  }
  if (env.WARDN_TIMEOUT_MAJOR) {
    config.confirmation.timeouts.major = parseInt(env.WARDN_TIMEOUT_MAJOR, 10);
  }
  if (env.WARDN_TIMEOUT_MINOR) {
    config.confirmation.timeouts.minor = parseInt(env.WARDN_TIMEOUT_MINOR, 10);
  }
  if (env.WARDN_DEFAULT_ACTION === 'allow' || env.WARDN_DEFAULT_ACTION === 'block') {
    config.confirmation.defaultAction = env.WARDN_DEFAULT_ACTION;
  }
  if (env.WARDN_RETENTION_DAYS) {
    config.audit.retentionDays = parseInt(env.WARDN_RETENTION_DAYS, 10);
  }

  return config;
}

export interface CLIFlags {
  allowSeverity?: string;
  timeout?: number;
}

export function loadConfig(cliFlags?: CLIFlags): WardnConfig {
  // 5. Start with defaults
  let config = { ...DEFAULT_CONFIG };

  // 4. User config
  const userConfig = readJsonFile<Partial<WardnConfig>>(USER_CONFIG_PATH);
  if (userConfig) {
    config = deepMerge(config, userConfig);
  }

  // 3. Project config (not merged into WardnConfig — returned separately)
  // This is handled by loadProjectConfig()

  // 2. Environment variables
  config = applyEnvOverrides(config);

  // 1. CLI flags
  if (cliFlags?.allowSeverity) {
    config.scan.confirmationRequired = cliFlags.allowSeverity as WardnConfig['scan']['confirmationRequired'];
  }

  return config;
}

export function loadProjectConfig(projectDir?: string): ProjectConfig | null {
  const dir = projectDir || process.cwd();
  const configPath = path.join(dir, PROJECT_CONFIG_NAME);
  return readJsonFile<ProjectConfig>(configPath);
}

export function getWardnDir(): string {
  ensureDir(WARDN_DIR);
  return WARDN_DIR;
}

export function getDbPath(): string {
  return path.join(getWardnDir(), 'wardnmesh.db');
}

export function getSocketPath(): string {
  return path.join(getWardnDir(), 'wardn.sock');
}

export function getLogDir(): string {
  const logDir = path.join(getWardnDir(), 'logs');
  ensureDir(logDir);
  return logDir;
}

export function saveUserConfig(config: WardnConfig): void {
  ensureDir(WARDN_DIR);
  fs.writeFileSync(USER_CONFIG_PATH, JSON.stringify(config, null, 2));
}
