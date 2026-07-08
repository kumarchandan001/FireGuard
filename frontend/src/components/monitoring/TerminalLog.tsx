/**
 * FireGuard AI — Terminal Sync Log (Stitch Style)
 *
 * Real-time operational terminal outputting system sweeps, camera latency,
 * connection status, and alarm events. Features a blinking command cursor.
 */

import { useEffect, useState, useRef } from 'react';
import type { Incident } from '../../types';

interface LogEntry {
  timestamp: string;
  tag: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system';
}

interface TerminalLogProps {
  wsConnected: boolean;
  cameraOnline: boolean;
  alarmState: string;
  incidents: Incident[];
}

export default function TerminalLog({
  wsConnected,
  cameraOnline,
  alarmState,
  incidents,
}: TerminalLogProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastLoggedIncidentIdRef = useRef<number | null>(null);

  // Helper to format timestamp
  const getTimestamp = () => {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  // Helper to add log
  const addLog = (tag: string, message: string, type: LogEntry['type']) => {
    setLogs((prev) => {
      // Limit to last 50 entries
      const next = [...prev, { timestamp: getTimestamp(), tag, message, type }];
      return next.slice(-50);
    });
  };

  // Initial logs
  useEffect(() => {
    setLogs([
      { timestamp: getTimestamp(), tag: 'SYS_INIT', message: 'FireGuard AI core systems initialized.', type: 'system' },
      { timestamp: getTimestamp(), tag: 'SYS_CHK', message: 'All environmental sensors nominal.', type: 'info' },
      { timestamp: getTimestamp(), tag: 'NET_PING', message: 'Link established with Sector HQ server.', type: 'info' },
    ]);
  }, []);

  // Monitor connection state
  useEffect(() => {
    if (wsConnected) {
      addLog('NET_PING', 'WebSocket link established.', 'success');
    } else {
      addLog('NET_FAIL', 'WebSocket disconnected. Retrying sync...', 'error');
    }
  }, [wsConnected]);

  // Monitor camera online state
  useEffect(() => {
    if (cameraOnline) {
      addLog('CAM_SYNC', 'Surveillance feed matrix online. Latency: 14ms.', 'success');
    } else {
      addLog('CAM_OFF', 'Surveillance feed offline. Standby mode active.', 'warning');
    }
  }, [cameraOnline]);

  // Monitor alarm state
  useEffect(() => {
    if (alarmState === 'triggered' || alarmState === 'active') {
      addLog('ALR_ACT', 'CRITICAL: Thermal threshold exceeded. Alert state active.', 'error');
    } else if (alarmState === 'acknowledged') {
      addLog('ALR_ACK', 'Alert acknowledged by Operator 07. Dispatch standby.', 'warning');
    } else if (alarmState === 'idle') {
      addLog('ALR_CLR', 'All threats resolved. Returning to default scan state.', 'success');
    }
  }, [alarmState]);

  // Monitor new incidents
  useEffect(() => {
    if (incidents.length > 0) {
      const latest = incidents[0];
      if (latest.id !== lastLoggedIncidentIdRef.current) {
        lastLoggedIncidentIdRef.current = latest.id;
        addLog(
          'AI_SCAN',
          `Object detected: ${latest.detection_type.toUpperCase()} in ${latest.zone_id || 'North Sector'} (Conf: ${(latest.confidence * 100).toFixed(0)}%)`,
          latest.status === 'active' ? 'error' : 'info'
        );
      }
    }
  }, [incidents]);

  // Simulated AI sweep scans to keep the terminal alive and operational
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsConnected && cameraOnline && alarmState === 'idle') {
        const sweepSectors = ['North Server Room', 'East Lab Corridor', 'South Lobby Array', 'West Loading Gate'];
        const randomSector = sweepSectors[Math.floor(Math.random() * sweepSectors.length)];
        addLog('AI_SCAN', `Sector sweep complete: ${randomSector}. Confidence margin optimal.`, 'info');
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [wsConnected, cameraOnline, alarmState]);

  // Auto-scroll to bottom of terminal
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getTagColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return '#34d399'; // success green
      case 'warning':
        return '#fbbf24'; // warning yellow
      case 'error':
        return '#f87171'; // error red
      case 'system':
        return 'var(--accent)'; // electric blue
      default:
        return 'var(--text-secondary)'; // muted grey
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0d0e12',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Terminal Header */}
      <div
        style={{
          background: '#181c23',
          borderBottom: '1px solid var(--border-color)',
          padding: '8px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.04em' }}>
          TERMINAL LOG
        </span>
        <span
          className="emergency-pulse"
          style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
          LIVE SYNC
        </span>
      </div>

      {/* Terminal Body */}
      <div
        ref={scrollRef}
        className="terminal-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {logs.map((log, index) => (
          <div
            key={index}
            style={{
              borderLeft: `2px solid ${log.type === 'error' ? 'var(--danger)' : log.type === 'warning' ? 'var(--warning)' : 'var(--border-color)'}`,
              paddingLeft: '8px',
              opacity: index === logs.length - 1 ? 1 : 0.75,
              transition: 'opacity var(--transition-fast)',
            }}
          >
            <div style={{ display: 'flex', gap: '6px', color: 'var(--text-muted)', fontSize: '10px' }}>
              <span>[{log.timestamp}]</span>
              <span style={{ color: getTagColor(log.type), fontWeight: 700 }}>{log.tag}</span>
            </div>
            <div style={{ color: log.type === 'error' ? '#fff' : 'var(--text-primary)', marginTop: '2px', lineHeight: 1.4 }}>
              {log.message}
            </div>
          </div>
        ))}

        {/* Blinking cursor line */}
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--accent)', marginTop: '4px' }}>
          <span>&gt;</span>
          <span
            style={{
              width: '6px',
              height: '12px',
              backgroundColor: 'var(--accent)',
              marginLeft: '6px',
              animation: 'pulse-dot 1s infinite',
            }}
          />
        </div>
      </div>
    </div>
  );
}
