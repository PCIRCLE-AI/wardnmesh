// WardnMesh Desktop Types
// Mirroring types from the main SDK

export type ProtectionLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type ThreatLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface Violation {
  id: string;
  timestamp: string;
  toolName: string;
  threatLevel: ThreatLevel;
  reason: string;
  action: 'BLOCKED' | 'ALLOWED' | 'WARNED';
  ruleId?: string;
}

export interface SessionState {
  sessionId: string;
  startTime: string;
  isArmed: boolean;
  protectionLevel: ProtectionLevel;
  violations: Violation[];
  toolCalls: number;
  blockedCalls: number;
}

export interface AppStatus {
  activated: boolean;
  hasApiKey: boolean;
  protected: boolean;
  protectionLevel: ProtectionLevel;
  isArmed: boolean;
  todayBlocked: number;
  todayToolCalls: number;
  recentViolations: Violation[];
  cliVersion?: string;
  lastSync?: string;
}

export interface AppConfig {
  protectionLevel: ProtectionLevel;
  isArmed: boolean;
  apiKey?: string;
  cloudSyncEnabled: boolean;
}

// Health check status
export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  cliInstalled: boolean;
  cliVersion?: string;
  cliRunning: boolean;
  nodeSdkInstalled: boolean;
  nodeSdkVersion?: string;
  pythonSdkInstalled: boolean;
  pythonSdkVersion?: string;
  apiReachable: boolean;
  lastCheck: string;
}

// Setup Wizard Types
export type SetupStep = 'welcome' | 'system-check' | 'cli-install' | 'auth' | 'sdk-install' | 'complete';

export interface SystemInfo {
  os: 'macos' | 'windows' | 'linux' | 'unknown';
  arch: 'aarch64' | 'x86_64' | 'unknown';
  hasWardn: boolean;
  wardnVersion?: string;
  hasNode: boolean;
  nodeVersion?: string;
  hasPython: boolean;
  pythonVersion?: string;
  homePath?: string;
}

export interface SetupState {
  currentStep: SetupStep;
  systemInfo: SystemInfo | null;
  cliInstalled: boolean;
  apiKeySet: boolean;
  sdkInstalled: {
    node: boolean;
    python: boolean;
  };
}
