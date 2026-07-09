/**
 * FireGuard AI — Video Feed (HUD-Enhanced)
 *
 * Full-size live camera feed with:
 *   - Corner HUD overlays (FPS, timestamp, recording indicator)
 *   - "NO SIGNAL" state when camera is off
 *   - Detection bounding boxes drawn on the feed
 *   - Alarm action buttons in feed footer (ACK/RESOLVE) — never in a modal
 */

import { useState, useCallback, useEffect } from 'react';
import { Flame, Maximize2, Minimize2 } from 'lucide-react';
import type { Detection, AlarmStatus } from '../../types';
import { apiClient } from '../../api/client';
import HoldButton from '../shared/HoldButton';

interface VideoFeedProps {
  frame: string | null;
  fps: number;
  detections: Detection[];
  cameraOnline: boolean;
  isAlert: boolean;
  alarmStatus?: AlarmStatus | null;
  onAcknowledge?: () => void;
  onDismiss?: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export default function VideoFeed({
  frame, fps, detections, cameraOnline, isAlert,
  alarmStatus, onAcknowledge, onDismiss,
  isMaximized = false, onToggleMaximize,
}: VideoFeedProps) {
  const [toggling, setToggling] = useState(false);
  const [time, setTime] = useState(new Date());
  const [thermalActive, setThermalActive] = useState(false);
  const hasDetections = detections.length > 0;
  const showActions = alarmStatus && alarmStatus.state !== 'idle';
  const isAlarmActive = alarmStatus?.state === 'active' || alarmStatus?.state === 'triggered';

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleStart = useCallback(async () => {
    setToggling(true);
    try {
      // If already "running" but no frames, stop first then restart
      if (cameraOnline) {
        await apiClient.post('/camera/stop');
        await new Promise(r => setTimeout(r, 500));
      }
      await apiClient.post('/camera/start');
    } catch { /* handled */ }
    finally { setToggling(false); }
  }, [cameraOnline]);

  const handleStop = useCallback(async () => {
    setToggling(true);
    try { await apiClient.post('/camera/stop'); } catch { /* handled */ }
    finally { setToggling(false); }
  }, []);

  const timestamp = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div
      className={cameraOnline && frame ? 'scanline-overlay' : ''}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#000',
        borderRadius: isAlert ? '0' : 'var(--radius-lg)',
        overflow: 'hidden',
        border: isAlert
          ? '2px solid rgba(239, 68, 68, 0.6)'
          : '1px solid var(--border-color)',
        transition: 'border-color 800ms ease-in-out, border-radius 400ms ease',
        boxShadow: frame ? 'inset 0 0 60px rgba(0, 0, 0, 0.3)' : 'none',
      }}
    >
      {/* SVG Thermal vision hardware-accelerated color-matrix lookup table filter */}
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} aria-hidden="true">
        <filter id="thermal-vision">
          <feColorMatrix
            type="matrix"
            values="0.2126 0.7152 0.0722 0 0
                    0.2126 0.7152 0.0722 0 0
                    0.2126 0.7152 0.0722 0 0
                    0 0 0 1 0"
            result="gray"
          />
          <feComponentTransfer in="gray">
            <feFuncR type="table" tableValues="0.0 0.1 0.7 1.0 1.0 1.0" />
            <feFuncG type="table" tableValues="0.0 0.0 0.0 0.4 0.9 1.0" />
            <feFuncB type="table" tableValues="0.3 0.6 0.8 0.0 0.0 0.9" />
          </feComponentTransfer>
        </filter>
      </svg>

      {/* Video Frame or No Signal */}
      {frame ? (
        <img
          src={`data:image/jpeg;base64,${frame}`}
          alt="Live camera feed"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            filter: thermalActive ? 'url(#thermal-vision) contrast(1.3) saturate(1.5)' : 'none',
            transition: 'filter 0.3s ease',
          }}
        />
      ) : (
        <NoSignal cameraOnline={cameraOnline} onStart={handleStart} toggling={toggling} />
      )}

      {/* Detection bounding boxes rendered ON the feed */}
      {frame && hasDetections && (
        <DetectionBoxes detections={detections} />
      )}

      {/* ── HUD Overlays ──────────────────────────────── */}

      {/* Top-Left: REC indicator */}
      {cameraOnline && (
        <div style={{ ...hudCorner, top: 8, left: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'pulse-dot 1s infinite', flexShrink: 0 }} />
          <span style={{ color: '#ef4444' }}>REC</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
            {fps.toFixed(1)} fps
          </span>
        </div>
      )}

      {/* Top-Right: Timestamp & Maximize/Minimize */}
      <div style={{ ...hudCorner, top: 8, right: 10, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          {timestamp}
        </span>
        {onToggleMaximize && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMaximize();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '2px',
              borderRadius: 'var(--radius-sm)',
              transition: 'color var(--transition-fast), background-color var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title={isMaximized ? 'Minimize' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        )}
      </div>

      {/* ── Feed Footer Bar ──────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 10,
        }}
      >
        {/* Left: Camera status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            className={`status-dot ${cameraOnline ? 'online' : 'offline'}`}
            style={{ width: 6, height: 6 }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
              letterSpacing: '0.04em',
              color: cameraOnline ? 'var(--success)' : 'var(--text-muted)',
            }}
          >
            {cameraOnline ? 'LIVE' : 'OFFLINE'}
          </span>
          {cameraOnline && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleStop} disabled={toggling} style={stopBtnStyle}>
                ■ STOP
              </button>
              <button
                onClick={() => setThermalActive(!thermalActive)}
                style={{
                  ...stopBtnStyle,
                  color: thermalActive ? '#10b981' : 'var(--accent)',
                  background: thermalActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 198, 255, 0.1)',
                  border: thermalActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(0, 198, 255, 0.2)',
                }}
              >
                {thermalActive ? '🌡️ NORMAL VISION' : '🌡️ THERMAL VISION'}
              </button>
            </div>
          )}
        </div>

        {/* Center: Alarm actions (only during active alarm — IN the feed, no modal) */}
        {showActions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Detection badge */}
            {hasDetections && (
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '2px 8px',
                  background: 'rgba(239, 68, 68, 0.9)',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                  color: '#fff', letterSpacing: '0.04em',
                }}
              >
                <Flame size={10} /> {detections.length} DETECTION{detections.length > 1 ? 'S' : ''}
              </span>
            )}

            {/* ACK button — hold to confirm */}
            {isAlarmActive && onAcknowledge && (
              <HoldButton
                label="ACK"
                color="#ffffff"
                fillColor="rgba(239, 68, 68, 0.5)"
                onConfirm={onAcknowledge}
                holdDuration={1500}
                size="sm"
              />
            )}

            {/* RESOLVE button — hold to confirm */}
            {onDismiss && (
              <HoldButton
                label="RESOLVE"
                color="var(--success)"
                fillColor="rgba(16, 185, 129, 0.3)"
                onConfirm={onDismiss}
                holdDuration={1500}
                size="sm"
              />
            )}
          </div>
        )}

        {/* Right: Detection count (when alarm not active but detections exist) */}
        {!showActions && hasDetections && (
          <span
            className="emergency-pulse"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '2px 10px',
              background: 'rgba(239, 68, 68, 0.9)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
              color: '#fff', letterSpacing: '0.04em',
            }}
          >
            <Flame size={10} /> {detections.length} DETECTION{detections.length > 1 ? 'S' : ''}
          </span>
        )}

        {/* Spacer when nothing on right */}
        {!showActions && !hasDetections && <div />}
      </div>
    </div>
  );
}

// ── Detection Bounding Boxes (drawn on the feed) ────────

function DetectionBoxes({ detections }: { detections: Detection[] }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
      {detections.map((det, i) => {
        const [x1, y1, x2, y2] = det.bbox;
        const conf = (det.confidence * 100).toFixed(0);
        const color = det.class_name === 'smoke' ? '#f59e0b' : '#ef4444';

        return (
          <div key={i}>
            {/* Bounding box */}
            <div
              style={{
                position: 'absolute',
                left: `${x1 * 100}%`,
                top: `${y1 * 100}%`,
                width: `${(x2 - x1) * 100}%`,
                height: `${(y2 - y1) * 100}%`,
                border: `2px solid ${color}`,
                background: `${color}0d`,
                borderRadius: '2px',
              }}
            />
            {/* Label below bbox */}
            <div
              style={{
                position: 'absolute',
                left: `${x1 * 100}%`,
                top: `${y2 * 100}%`,
                marginTop: '2px',
                padding: '1px 6px',
                background: 'rgba(0,0,0,0.7)',
                borderRadius: '2px',
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                fontWeight: 700,
                color,
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
              }}
            >
              {det.class_name.toUpperCase()} · {conf}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── No Signal State ─────────────────────────────────────

function NoSignal({ cameraOnline, onStart, toggling }: { cameraOnline: boolean; onStart: () => void; toggling: boolean }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        background: 'radial-gradient(ellipse at center, #0a0e1a 0%, #000 100%)',
      }}
    >
      {/* Pulsing ring */}
      <div
        style={{
          width: 48, height: 48,
          borderRadius: '50%',
          border: '2px solid var(--text-muted)',
          opacity: 0.4,
          animation: 'pulse-dot 3s ease-in-out infinite',
        }}
      />

      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '16px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: 'var(--text-muted)',
        }}
      >
        CAMERA OFFLINE
      </div>

      <button
          onClick={onStart}
          disabled={toggling}
          style={{
            marginTop: '4px',
            padding: '8px 24px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            color: 'var(--accent)',
            background: 'var(--accent-glow)',
            border: '1px solid var(--accent-border)',
            borderRadius: 'var(--radius-md)',
            cursor: toggling ? 'not-allowed' : 'pointer',
            opacity: toggling ? 0.5 : 1,
            transition: 'all var(--transition-fast)',
          }}
        >
          {cameraOnline ? '↻ RETRY' : '▶ START FEED'}
        </button>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', opacity: 0.5 }}>
        Waiting for signal...
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────

const hudCorner: React.CSSProperties = {
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  padding: '3px 8px',
  background: 'rgba(0, 0, 0, 0.6)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.04em',
  zIndex: 10,
};

const stopBtnStyle: React.CSSProperties = {
  padding: '2px 8px',
  fontFamily: 'var(--font-mono)',
  fontSize: '9px',
  fontWeight: 600,
  letterSpacing: '0.06em',
  color: '#ef4444',
  background: 'rgba(239, 68, 68, 0.15)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
};
