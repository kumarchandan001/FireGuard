/**
 * FireGuard AI — System State Machine Hook
 *
 * Central state manager that derives the application's visual state
 * from WebSocket connection, alarm status, and camera status.
 *
 * States:
 *   startup    → App booting, systems initializing
 *   monitoring → All clear, actively watching
 *   alert      → Fire/smoke detected, alarm active
 *   resolved   → Threat cleared (brief, auto-returns to monitoring)
 */

import { useState, useEffect, useRef } from 'react';
import type { AlarmStatus } from '../types';

export type SystemState = 'startup' | 'monitoring' | 'alert' | 'resolved';
export type ThreatLevel = 'CLEAR' | 'ELEVATED' | 'CRITICAL';

interface UseSystemStateOptions {
  wsConnected: boolean;
  alarmStatus: AlarmStatus | null;
  startupDurationMs?: number;
  resolvedDurationMs?: number;
}

interface UseSystemStateReturn {
  state: SystemState;
  threatLevel: ThreatLevel;
  bootComplete: boolean;
}

export function useSystemState({
  wsConnected: _wsConnected,
  alarmStatus,
  startupDurationMs = 3500,
  resolvedDurationMs = 3000,
}: UseSystemStateOptions): UseSystemStateReturn {
  const [state, setState] = useState<SystemState>('startup');
  const [bootComplete, setBootComplete] = useState(false);
  const prevAlarmState = useRef<string | null>(null);
  const resolvedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Startup → Monitoring ──────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setBootComplete(true);
      setState('monitoring');
    }, startupDurationMs);

    return () => clearTimeout(timer);
  }, [startupDurationMs]);

  // ── Alarm state changes ───────────────────────────────
  useEffect(() => {
    if (!bootComplete) return;

    const currentAlarm = alarmStatus?.state || 'idle';
    const prevAlarm = prevAlarmState.current;

    // Transition to alert
    if (currentAlarm === 'triggered' || currentAlarm === 'active') {
      setState('alert');
      if (resolvedTimer.current) {
        clearTimeout(resolvedTimer.current);
      }
    }
    // Transition to resolved (alarm was active, now idle/acknowledged)
    else if (
      prevAlarm &&
      (prevAlarm === 'triggered' || prevAlarm === 'active') &&
      (currentAlarm === 'idle' || currentAlarm === 'acknowledged')
    ) {
      setState('resolved');
      resolvedTimer.current = setTimeout(() => {
        setState('monitoring');
      }, resolvedDurationMs);
    }
    // Default: monitoring
    else if (currentAlarm === 'idle') {
      if (state !== 'resolved') {
        setState('monitoring');
      }
    }

    prevAlarmState.current = currentAlarm;

    return () => {
      if (resolvedTimer.current) {
        clearTimeout(resolvedTimer.current);
      }
    };
  }, [alarmStatus, bootComplete, resolvedDurationMs]);

  // ── Derive threat level ───────────────────────────────
  const threatLevel: ThreatLevel =
    state === 'alert'
      ? 'CRITICAL'
      : state === 'resolved'
        ? 'ELEVATED'
        : 'CLEAR';

  return { state, threatLevel, bootComplete };
}
