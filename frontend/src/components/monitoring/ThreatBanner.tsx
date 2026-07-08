/**
 * FireGuard AI — Threat Banner (replaces ThreatOverlay modal)
 *
 * Full-width top banner that slides down during active alerts.
 * Never covers the camera feed — sits above the TopBar.
 * Shows detection details + ACK/DISMISS actions in a single row.
 */

import { AlertTriangle, Flame, Radio } from 'lucide-react';
import type { AlarmStatus, Detection } from '../../types';
import { DETECTION_TYPE_LABELS } from '../../utils/constants';
import HoldButton from '../shared/HoldButton.tsx';

interface ThreatBannerProps {
  alarm: AlarmStatus;
  detections: Detection[];
  onAcknowledge: () => void;
  onDismiss: () => void;
}

export default function ThreatBanner({ alarm, detections, onAcknowledge, onDismiss }: ThreatBannerProps) {
  if (alarm.state === 'idle') return null;

  const isActive = alarm.state === 'active' || alarm.state === 'triggered';
  const typeLabel = alarm.detection_type
    ? DETECTION_TYPE_LABELS[alarm.detection_type]?.toUpperCase() || alarm.detection_type.toUpperCase()
    : 'UNKNOWN';
  const confidence = alarm.confidence != null ? `${(alarm.confidence * 100).toFixed(0)}%` : '—';

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 200,
        width: '100%',
        flexShrink: 0,
        animation: 'threat-banner-slide 0.3s ease-out forwards',
      }}
    >
      {/* Slide-in keyframe injected once */}
      <style>{`
        @keyframes threat-banner-slide {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
      `}</style>

      <div
        className={isActive ? 'alert-border' : ''}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '0 20px',
          height: '56px',
          background: isActive
            ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(245, 158, 11, 0.9)',
          borderBottom: `2px solid ${isActive ? 'rgba(239, 68, 68, 0.8)' : 'rgba(245, 158, 11, 0.6)'}`,
          color: '#ffffff',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Left — Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div
            className={isActive ? 'emergency-pulse' : ''}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.15)',
            }}
          >
            <Flame size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              lineHeight: 1.2,
            }}>
              {isActive ? 'FIRE DETECTED' : 'ALARM ACKNOWLEDGED'}
            </div>
            <div style={{
              fontSize: '11px',
              fontWeight: 500,
              opacity: 0.85,
              marginTop: '1px',
            }}>
              Operator action required
            </div>
          </div>
        </div>

        {/* Center — Telemetry chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'center' }}>
          <TelemetryChip icon={<AlertTriangle size={12} />} label="TYPE" value={typeLabel} />
          <TelemetryChip icon={<Radio size={12} />} label="CONF" value={confidence} />
          {alarm.incident_id != null && (
            <TelemetryChip label="INC" value={`#${alarm.incident_id}`} />
          )}
          {detections.length > 0 && (
            <TelemetryChip label="DETECTIONS" value={String(detections.length)} />
          )}
        </div>

        {/* Right — Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {isActive && (
            <HoldButton
              label="ACKNOWLEDGE"
              color="#ffffff"
              fillColor="rgba(255, 255, 255, 0.3)"
              onConfirm={onAcknowledge}
              holdDuration={1500}
              size="sm"
            />
          )}
          <HoldButton
            label="DISMISS"
            color="rgba(255, 255, 255, 0.7)"
            fillColor="rgba(255, 255, 255, 0.15)"
            onConfirm={onDismiss}
            holdDuration={1000}
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}

function TelemetryChip({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        background: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '11px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      <span style={{ opacity: 0.7, fontFamily: 'var(--font-sans)', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>
        {value}
      </span>
    </div>
  );
}
