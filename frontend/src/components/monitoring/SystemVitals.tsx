/**
 * FireGuard AI — System Vitals (Compact HUD Panel)
 *
 * Condensed status indicators — no header, tight rows.
 * Designed for a narrow (220px) right panel.
 */

interface SystemVitalsProps {
  cameraOnline: boolean;
  cameraFps: number;
  aiReady: boolean;
  alarmState: string;
  wsConnected: boolean;
  incidentsToday: number;
}

export default function SystemVitals({
  cameraOnline,
  cameraFps,
  aiReady,
  alarmState,
  wsConnected,
  incidentsToday,
}: SystemVitalsProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        transition: 'background-color var(--transition-state), border-color var(--transition-state)',
      }}
    >
      {/* Vitals rows — no header, just dense data */}
      <Vital
        label="CAM"
        value={cameraOnline ? `LIVE · ${cameraFps.toFixed(0)}fps` : 'OFFLINE'}
        status={cameraOnline ? 'online' : 'offline'}
      />
      <Vital
        label="AI"
        value={aiReady ? 'READY' : 'LOADING'}
        status={aiReady ? 'online' : 'warning'}
      />
      <Vital
        label="ALARM"
        value={alarmState.toUpperCase()}
        status={
          alarmState === 'idle' ? 'online'
            : alarmState === 'acknowledged' ? 'warning'
              : 'error'
        }
      />
      <Vital
        label="WS"
        value={wsConnected ? 'CONNECTED' : 'DOWN'}
        status={wsConnected ? 'online' : 'offline'}
      />
      <Vital
        label="TODAY"
        value={`${incidentsToday} incident${incidentsToday !== 1 ? 's' : ''}`}
        status={incidentsToday > 0 ? 'error' : 'online'}
        isLast
      />
    </div>
  );
}

function Vital({
  label,
  value,
  status,
  isLast,
}: {
  label: string;
  value: string;
  status: 'online' | 'offline' | 'warning' | 'error';
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
      }}
    >
      <span className={`status-dot ${status}`} style={{ flexShrink: 0 }} />
      <span
        className="label"
        style={{
          fontSize: '8px',
          minWidth: '30px',
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '0.03em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </span>
    </div>
  );
}
