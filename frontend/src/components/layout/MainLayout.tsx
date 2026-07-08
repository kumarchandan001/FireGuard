/**
 * FireGuard AI — Main Layout (Operations Center)
 *
 * TopBar → Content → CommandBar
 * Manages global system state, alarm audio, and applies state CSS class to root.
 */

import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import ThreatBanner from '../monitoring/ThreatBanner';
import BootSequence from '../monitoring/BootSequence';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useSystemState } from '../../hooks/useSystemState';
import { useAlarmAudio } from '../../hooks/useAlarmAudio';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';
import { useApi } from '../../hooks/useApi';
import { apiClient } from '../../api/client';
import { createContext, useContext, useEffect, useCallback } from 'react';

// ── Context: share WS + state with all pages ────────────

interface AppContextType {
  ws: ReturnType<typeof useWebSocket>;
  systemState: ReturnType<typeof useSystemState>;
  cameraOnline: boolean;
  aiReady: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function useAppContext(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within MainLayout');
  return ctx;
}

// ── Layout ──────────────────────────────────────────────

export default function MainLayout() {
  const ws = useWebSocket();

  const { data: cameraStatus } = useApi<{ is_running: boolean; actual_fps: number }>(
    '/camera/status',
    { pollInterval: 5000 },
  );
  const { data: aiStatus } = useApi<{ model_loaded: boolean }>(
    '/ai-engine/status',
    { pollInterval: 5000 },
  );

  const cameraOnline = cameraStatus?.is_running ?? false;
  const aiReady = aiStatus?.model_loaded ?? false;

  const systemState = useSystemState({
    wsConnected: ws.connectionState === 'connected',
    alarmStatus: ws.alarmStatus,
  });

  // ── Keyboard shortcuts ──────────────────────────────
  useKeyboardNav();

  // ── Alarm Audio ─────────────────────────────────────
  const alarmAudio = useAlarmAudio({
    alarmState: ws.alarmStatus?.state,
  });

  // ── Alarm Actions ───────────────────────────────────
  const handleAcknowledge = useCallback(async () => {
    try { await apiClient.post('/alarm/acknowledge'); } catch { /* handled */ }
  }, []);

  const handleDismiss = useCallback(async () => {
    try { await apiClient.post('/alarm/dismiss'); } catch { /* handled */ }
  }, []);

  // Apply state class to document root
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('state-startup', 'state-monitoring', 'state-alert', 'state-resolved');
    root.classList.add(`state-${systemState.state}`);

    return () => {
      root.classList.remove('state-startup', 'state-monitoring', 'state-alert', 'state-resolved');
    };
  }, [systemState.state]);

  const contextValue: AppContextType = {
    ws,
    systemState,
    cameraOnline,
    aiReady,
  };

  // ── Boot sequence ─────────────────────────────────────
  if (!systemState.bootComplete) {
    return <BootSequence />;
  }

  const isAlert = systemState.state === 'alert';

  return (
    <AppContext.Provider value={contextValue}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          height: '100vh',
          width: '100vw',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        {/* Left Side Navigation */}
        <Sidebar />

        {/* Right Main Container */}
        <div
          style={{
            flex: 1,
            marginLeft: '256px',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            minWidth: 0,
            position: 'relative',
          }}
        >
          {/* Ambient threat glow overlay */}
          {isAlert && <div className="threat-glow" />}

          {/* Threat Banner — slides down during alerts, never covers the feed */}
          {ws.alarmStatus && ws.alarmStatus.state !== 'idle' && (
            <ThreatBanner
              alarm={ws.alarmStatus}
              detections={ws.detections}
              onAcknowledge={handleAcknowledge}
              onDismiss={handleDismiss}
            />
          )}

          <TopBar
            threatLevel={systemState.threatLevel}
            wsConnected={ws.connectionState === 'connected'}
            cameraOnline={cameraOnline}
            aiReady={aiReady}
            isMuted={alarmAudio.isMuted}
            isAlarmPlaying={alarmAudio.isPlaying}
            onToggleMute={alarmAudio.toggleMute}
            alarmStatus={ws.alarmStatus}
          />

          <main
            className={isAlert ? 'screen-shake' : ''}
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px',
              transition: 'background-color var(--transition-state)',
            }}
          >
            {/* Resolved flash effect */}
            {systemState.state === 'resolved' && (
              <div className="resolved-flash" style={{ position: 'fixed', inset: 0, zIndex: 50, pointerEvents: 'none' }} />
            )}
            <Outlet />
          </main>
        </div>
      </div>
    </AppContext.Provider>
  );
}
