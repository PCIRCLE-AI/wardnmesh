import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { AppStatus, ProtectionLevel, SessionState } from '../lib/types';
import { getErrorMessage } from '../lib/helpers';

const DEFAULT_STATUS: AppStatus = {
  activated: true,
  hasApiKey: true,
  protected: true,
  protectionLevel: 'MEDIUM',
  isArmed: false,
  todayBlocked: 0,
  todayToolCalls: 0,
  recentViolations: [],
};

const POLL_INTERVAL_MS = 5000;

export function useWardnState() {
  const [status, setStatus] = useState<AppStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [changingLevel, setChangingLevel] = useState(false);

  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await invoke<AppStatus>('get_status');
      if (mountedRef.current) {
        setStatus({
          ...DEFAULT_STATUS,
          ...result,
          activated: true,
          hasApiKey: true,
        });
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(getErrorMessage(err));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const toggleProtection = useCallback(async (): Promise<boolean> => {
    setToggling(true);
    setError(null);
    try {
      await invoke('toggle_protection');
      await fetchStatus();
      return true;
    } catch (err) {
      if (mountedRef.current) {
        setError(getErrorMessage(err));
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setToggling(false);
      }
    }
  }, [fetchStatus]);

  const setProtectionLevel = useCallback(async (level: ProtectionLevel): Promise<boolean> => {
    setChangingLevel(true);
    setError(null);
    try {
      await invoke('set_protection_level', { level });
      await fetchStatus();
      return true;
    } catch (err) {
      if (mountedRef.current) {
        setError(getErrorMessage(err));
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setChangingLevel(false);
      }
    }
  }, [fetchStatus]);

  const openExternalUrl = useCallback(async (url: string): Promise<boolean> => {
    try {
      await invoke('open_external_url', { url });
      return true;
    } catch (err) {
      if (mountedRef.current) {
        setError(getErrorMessage(err));
      }
      return false;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
  }, [fetchStatus]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchStatus();
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchStatus, startPolling, stopPolling]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<SessionState>('session-state-changed', (event) => {
        if (mountedRef.current) {
          setStatus((prev) => ({
            ...prev,
            todayToolCalls: event.payload.toolCalls,
            todayBlocked: event.payload.blockedCalls,
            recentViolations: event.payload.violations.slice(0, 10),
            isArmed: event.payload.isArmed,
            protectionLevel: (event.payload.protectionLevel || prev.protectionLevel) as ProtectionLevel,
          }));
        }
      });
    };

    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchStatus();
    startPolling();

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [fetchStatus, startPolling, stopPolling]);

  return {
    status,
    loading,
    error,
    toggling,
    changingLevel,
    refresh: fetchStatus,
    toggleProtection,
    setProtectionLevel,
    openExternalUrl,
  };
}
