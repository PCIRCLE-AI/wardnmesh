/**
 * Default Configuration for WardnMesh
 */

export interface WardnConfig {
  version: number;
  scan: {
    enabledCategories: string[];
    minSeverity: 'critical' | 'major' | 'minor';
    confirmationRequired: 'critical' | 'major' | 'minor';
  };
  confirmation: {
    timeouts: {
      critical: number;
      major: number;
      minor: number;
    };
    defaultAction: 'block' | 'allow';
    preferDesktop: boolean;
  };
  audit: {
    retentionDays: number;
    maxDbSizeMb: number;
  };
  ui: {
    locale: string;
    theme: string;
  };
}

export interface ProjectConfig {
  rules?: Record<string, { enabled?: boolean; severity?: string }>;
  allowPatterns?: string[];
}

export const DEFAULT_CONFIG: WardnConfig = {
  version: 1,
  scan: {
    enabledCategories: ['safety', 'network_boundary'],
    minSeverity: 'minor',
    confirmationRequired: 'major',
  },
  confirmation: {
    timeouts: {
      critical: 60000,
      major: 45000,
      minor: 30000,
    },
    defaultAction: 'block',
    preferDesktop: true,
  },
  audit: {
    retentionDays: 90,
    maxDbSizeMb: 100,
  },
  ui: {
    locale: 'auto',
    theme: 'system',
  },
};
