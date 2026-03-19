import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { HealthStatus } from '../lib/types';
import { getErrorMessage } from '../lib/helpers';

const DEFAULT_HEALTH: HealthStatus = {
  overall: 'unhealthy',
  cliInstalled: false,
  cliRunning: false,
  nodeSdkInstalled: false,
  pythonSdkInstalled: false,
  apiReachable: false,
  lastCheck: '',
};

export function useHealthCheck() {
  const [health, setHealth] = useState<HealthStatus>(DEFAULT_HEALTH);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<HealthStatus>('check_health');
      setHealth(result);
      return result;
    } catch (err) {
      setError(getErrorMessage(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    health,
    loading,
    error,
    checkHealth,
  };
}
