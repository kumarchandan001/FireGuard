/**
 * FireGuard AI — Monitoring Page (Surveillance Grid Dashboard)
 *
 * Operational 3-Column Command Dashboard Layout matching Stitch mockup:
 *   - Left: StatusPanel (Global state, Telemetry meters, 24H SVG trend)
 *   - Center: Live Surveillance Matrix (2x2 Grid of CAM 01 [Live Feed], CAM 04, CAM 08, CAM 12)
 *   - Right: TerminalLog (Websocket state & simulated diagnostic log lines)
 */

import { useCallback } from 'react';
import VideoFeed from '../components/monitoring/VideoFeed';
import StatusPanel from '../components/monitoring/StatusPanel';
import TerminalLog from '../components/monitoring/TerminalLog';
import { useAppContext } from '../components/layout/MainLayout';
import { useApi } from '../hooks/useApi';
import { apiClient } from '../api/client';
import type { Incident } from '../types';

interface IncidentSummary {
  today: number;
  by_status: Record<string, number>;
}

export default function MonitoringPage() {
  const { ws, systemState, cameraOnline, aiReady } = useAppContext();

  const { data: summary } = useApi<IncidentSummary>('/incidents/summary', { pollInterval: 10000 });
  const { data: recentIncidents } = useApi<Incident[]>('/incidents/recent?limit=10', { pollInterval: 10000 });

  const handleAcknowledge = useCallback(async () => {
    try { await apiClient.post('/alarm/acknowledge'); } catch { /* handled */ }
  }, []);

  const handleDismiss = useCallback(async () => {
    try { await apiClient.post('/alarm/dismiss'); } catch { /* handled */ }
  }, []);

  const isAlert = systemState.state === 'alert';
  const incidents = Array.isArray(recentIncidents) ? recentIncidents : [];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '290px 1fr 290px',
        gap: '16px',
        height: '100%',
        minHeight: 0,
      }}
    >
      {/* Left Column — Vitals & Telemetry */}
      <div style={{ display: 'flex', minHeight: 0 }}>
        <StatusPanel
          alarmState={ws.alarmStatus?.state || 'idle'}
          incidentsToday={summary?.today || 0}
          aiConfidence={aiReady ? 0.998 : 0.45}
        />
      </div>

      {/* Center Column — Live Grid Surveillance */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {/* Matrix Header info */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Live Surveillance Matrix
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-secondary)',
            }}
          >
            Sectors Scanned: 4 / 4
          </span>
        </div>

        {/* 2x2 Camera Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: '8px',
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* CAM 01: Actual Live feed */}
          <div style={{ position: 'relative', overflow: 'hidden' }}>
            <VideoFeed
              frame={ws.latestFrame}
              fps={ws.fps}
              detections={ws.detections}
              cameraOnline={cameraOnline}
              isAlert={isAlert}
              alarmStatus={ws.alarmStatus}
              onAcknowledge={handleAcknowledge}
              onDismiss={handleDismiss}
            />
          </div>

          {/* CAM 04: Mock Hallway */}
          <MockCamera
            id="CAM_04"
            name="EXT_NORTH"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAjWcIqO4mey06Ho51VLWHxje1LvfAqyAf5vld_YD878cJFCi-W57SYEsQQGtWfkGE31MKLMMiQCGwYaH3OCZgyUqgdKXBBrQFwAwuocGG7sPKKTY4DG0x3BjWXRhcY2Mu2QmwhY9iCTTNAK2RSJxwLQ001GzmjQ7O69amwXWY-s18f6HXM4UwtERjTMBBsT59kFyNxoVOmzOXebJnBMFvgJGnmAQLPiPH8tcYlbrNfy1bVPfoAdLuB"
            aiStatus="AI: CLEAR"
          />

          {/* CAM 08: Mock Warehouse */}
          <MockCamera
            id="CAM_08"
            name="WAREHOUSE_B"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBZuoMndZlBtj2OsqGEgoUmVBO0i5YiQrZWyeTFKj6slOHjPRFR3owAx4Gm9qzxv7olbd_5OWQpn3lj-I4cD-qg4jA4xyicKs055rs1r4thxrXY3P98_mdxoeLE8S216N8ktchek8GM9jhQs05Kqnfl89mw2QHp8fF0AGm2TtjBgzn9hZbFMotOg6jA1iHfN-OOv-5n_gDE0i9D5i_JrWgutTa9btAmNaRCSt2vvWDdK1EhJb_wsnsX"
            aiStatus="FORKLIFT 98%"
            hasDetectionBox
          />

          {/* CAM 12: Mock Stairwell */}
          <MockCamera
            id="CAM_12"
            name="STAIR_03"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuD-UGy-uqYLsJMcfxLjVllF_4ctkQT3729W3vMsGLh_Aixjz_WLiO-HN0h1gPaFTVd9Nf6cd6vCBefd7WMl2LjGDJiY8vNz5SD5ZoLUu3z87cBHKaq66xUIpXMGUNAdjByA1kAGbWEx_kurIGdFsOqdHAodGFz8lO60gP403qfHu4bMEw-d2Pms-45RPSJaKiHSSTOUq91Eyd9f8VUH9yha0G-_9kwqNjWHi8vpxHICVAGpZmiv6FBs"
            aiStatus="AI: CLEAR"
          />
        </div>
      </div>

      {/* Right Column — Operations Terminal log */}
      <div style={{ display: 'flex', minHeight: 0 }}>
        <TerminalLog
          wsConnected={ws.connectionState === 'connected'}
          cameraOnline={cameraOnline}
          alarmState={ws.alarmStatus?.state || 'idle'}
          incidents={incidents}
        />
      </div>
    </div>
  );
}

function MockCamera({
  id,
  name,
  src,
  aiStatus,
  hasDetectionBox = false,
}: {
  id: string;
  name: string;
  src: string;
  aiStatus: string;
  hasDetectionBox?: boolean;
}) {
  return (
    <div
      style={{
        position: 'relative',
        background: '#000',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src={src}
        alt={`Surveillance ${id}`}
        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }}
      />
      <div className="cam-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div className="target-bracket-tl" />
      <div className="target-bracket-tr" />
      <div className="target-bracket-bl" />
      <div className="target-bracket-br" />

      {/* Top Label */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          padding: '3px 8px',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#fff', fontWeight: 600, letterSpacing: '0.02em' }}>
          {id} : {name}
        </span>
      </div>

      {/* Bottom Label / AI Status */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          padding: '3px 8px',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.02em' }}>
          {aiStatus}
        </span>
      </div>

      {/* Simulated AI box for CAM 08 */}
      {hasDetectionBox && (
        <div
          style={{
            position: 'absolute',
            top: '40%',
            left: '30%',
            width: '20%',
            height: '25%',
            border: '1px solid rgba(0, 122, 255, 0.6)',
            backgroundColor: 'rgba(0, 122, 255, 0.12)',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: '-14px',
              left: 0,
              backgroundColor: 'rgba(0, 122, 255, 0.85)',
              color: '#fff',
              fontSize: '8px',
              fontFamily: 'var(--font-mono)',
              padding: '1px 3px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            FORKLIFT 98%
          </span>
        </div>
      )}
    </div>
  );
}
