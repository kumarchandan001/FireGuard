/**
 * FireGuard AI — Top Bar (Stitch Style)
 *
 * Header bar with:
 *   Left: Breadcrumbs (Facility Status, Sync Status)
 *   Center: Threat Level badge
 *   Right: Search Input + Emergency Dispatch button + Mute Toggle + Clock
 */

import { useEffect, useState } from 'react';
import { Shield, Volume2, VolumeX, Search, AlertCircle } from 'lucide-react';
import type { ThreatLevel } from '../../hooks/useSystemState';
import type { AlarmStatus } from '../../types';
import { apiClient } from '../../api/client';

interface TopBarProps {
  threatLevel: ThreatLevel;
  wsConnected: boolean;
  cameraOnline: boolean;
  aiReady: boolean;
  isMuted: boolean;
  isAlarmPlaying: boolean;
  onToggleMute: () => void;
  alarmStatus: AlarmStatus | null;
}

const THREAT_COLORS: Record<ThreatLevel, string> = {
  CLEAR: 'var(--success)',
  ELEVATED: 'var(--warning)',
  CRITICAL: 'var(--danger)',
};

const THREAT_BG: Record<ThreatLevel, string> = {
  CLEAR: 'rgba(52, 211, 153, 0.1)',
  ELEVATED: 'rgba(251, 191, 36, 0.1)',
  CRITICAL: 'rgba(239, 68, 68, 0.15)',
};

export default function TopBar({
  threatLevel,
  wsConnected,
  cameraOnline,
  aiReady,
  isMuted,
  isAlarmPlaying,
  onToggleMute,
  alarmStatus,
}: TopBarProps) {
  const [time, setTime] = useState(new Date());
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const color = THREAT_COLORS[threatLevel];
  const isCritical = threatLevel === 'CRITICAL';

  const handleEmergencyDispatch = async () => {
    const isAlarmActive = alarmStatus && alarmStatus.state !== 'idle';
    const message = isAlarmActive
      ? 'CRITICAL: Are you sure you want to trigger EMERGENCY DISPATCH? This will immediately alert external emergency response teams for the active threat.'
      : 'WARNING: There is no active threat detected. Are you sure you want to trigger a MANUAL EMERGENCY DISPATCH and activate the sirens?';
      
    const confirmDispatch = window.confirm(message);
    if (confirmDispatch) {
      try {
        await apiClient.post('/alarm/dispatch');
        alert('Emergency Dispatch Initiated! Responders have been notified.');
      } catch (err) {
        alert('Failed to initiate emergency dispatch.');
      }
    }
  };

  return (
    <header
      style={{
        height: '64px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
        zIndex: 40,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Left — Breadcrumb/Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            cursor: 'pointer',
          }}
        >
          <Shield size={14} />
          <span>Facility: North Sector HQ</span>
        </div>
        <span style={{ color: 'var(--border-color)', fontSize: '12px' }}>|</span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--accent)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <span
            className="emergency-pulse"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent)',
            }}
          />
          <span>Active Sync</span>
        </div>
      </div>

      {/* Center — Threat Level Badge */}
      <div
        className={isCritical ? 'emergency-pulse' : ''}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: isCritical ? '6px 24px' : '4px 16px',
          borderRadius: 'var(--radius-full)',
          background: THREAT_BG[threatLevel],
          border: `1px solid ${color}40`,
          transition: 'all var(--transition-base)',
        }}
      >
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: isCritical ? '13px' : '11px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            color,
            textShadow: isCritical ? `0 0 10px ${color}` : 'none',
          }}
        >
          THREAT: {threatLevel}
        </span>
      </div>

      {/* Right — Actions & Tools */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* Search */}
        <div style={{ position: 'relative', width: '220px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
            }}
          />
          <input
            type="text"
            placeholder="Search logs, cameras..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            style={{
              width: '100%',
              height: '32px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              paddingLeft: '32px',
              paddingRight: '12px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              outline: 'none',
              transition: 'border-color var(--transition-fast)',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
          />
        </div>

        {/* Emergency Dispatch Button */}
        <button
          onClick={handleEmergencyDispatch}
          disabled={!!alarmStatus?.dispatched}
          style={{
            backgroundColor: alarmStatus?.dispatched ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.15)',
            border: alarmStatus?.dispatched ? '1px solid var(--warning)' : '1px solid rgba(239, 68, 68, 0.5)',
            color: alarmStatus?.dispatched ? 'var(--warning)' : 'var(--danger)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            cursor: alarmStatus?.dispatched ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: alarmStatus?.dispatched ? '0 0 10px rgba(245, 158, 11, 0.15)' : '0 0 10px rgba(239, 68, 68, 0.15)',
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            if (!alarmStatus?.dispatched) {
              e.currentTarget.style.backgroundColor = 'var(--danger)';
              e.currentTarget.style.color = '#fff';
            }
          }}
          onMouseLeave={(e) => {
            if (!alarmStatus?.dispatched) {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.color = 'var(--danger)';
            }
          }}
        >
          <AlertCircle size={12} className={alarmStatus?.dispatched ? 'emergency-pulse' : ''} />
          <span>{alarmStatus?.dispatched ? 'RESPONDERS DISPATCHED' : 'EMERGENCY DISPATCH'}</span>
        </button>

        {/* System status dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <StatusDot label="WS" online={wsConnected} />
          <StatusDot label="CAM" online={cameraOnline} />
          <StatusDot label="AI" online={aiReady} />
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)' }} />

        {/* Mute toggle */}
        <button
          onClick={onToggleMute}
          title={isMuted ? 'Unmute alarm audio' : 'Mute alarm audio'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            background: isAlarmPlaying && !isMuted ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: isMuted ? 'var(--text-muted)' : isAlarmPlaying ? 'var(--danger)' : 'var(--text-secondary)',
            transition: 'all var(--transition-fast)',
          }}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        {/* Clock */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            letterSpacing: '0.05em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </span>
      </div>
    </header>
  );
}

function StatusDot({ label, online }: { label: string; online: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title={`${label}: ${online ? 'Online' : 'Offline'}`}>
      <div
        className={`status-dot ${online ? 'online' : 'offline'}`}
        style={{ width: '6px', height: '6px' }}
      />
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.06em',
          color: online ? 'var(--text-secondary)' : 'var(--text-muted)',
        }}
      >
        {label}
      </span>
    </div>
  );
}
