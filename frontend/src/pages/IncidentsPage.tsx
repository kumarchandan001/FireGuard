/**
 * FireGuard AI — Alert Center (Stitch Layout Style)
 *
 * Operational Alert Center layout matching Stitch mockup:
 *   - Filters at the top
 *   - Left: Full high-density Alert Timeline Table (Severity, Timestamp, Location, Detection Type, Confidence, Status, Assigned)
 *   - Right: Detail Sidebar containing Live Camera Snap, Terminal Log init/sweeps, Info Grid, Actions (HoldButtons)
 */

import { useState, useCallback, memo, useEffect, useRef } from 'react';
import { Flame, Check, Monitor, Download, Filter, HardDrive, Play, Pause, SkipBack, SkipForward, Video } from 'lucide-react';
import Button from '../components/shared/Button';
import HoldButton from '../components/shared/HoldButton';
import EmptyState from '../components/shared/EmptyState';
import { useApi } from '../hooks/useApi';
import { apiClient } from '../api/client';
import { formatConfidence } from '../utils/formatters';
import {
  DETECTION_TYPE_LABELS,
  INCIDENT_STATUS_LABELS,
} from '../utils/constants';
import type { Incident, IncidentReplayFrame, IncidentReplayEvent } from '../types';


type TypeFilter = 'all' | 'fire' | 'smoke';
type StatusFilter = 'all' | 'active' | 'acknowledged' | 'resolved';

const IncidentsPage = memo(function IncidentsPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);
  const [resolutionNote, setResolutionNote] = useState('Resolved via Alert Center Console');
  const [imgError, setImgError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const terminalScrollRef = useRef<HTMLDivElement>(null);
  const perPage = 15;

  // Replay timeline states
  const [replayFrames, setReplayFrames] = useState<IncidentReplayFrame[]>([]);
  const [replayTimeline, setReplayTimeline] = useState<IncidentReplayEvent[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('per_page', String(perPage));
  if (typeFilter !== 'all') queryParams.set('detection_type', typeFilter);
  if (statusFilter !== 'all') queryParams.set('status', statusFilter);

  const { data: incidentsData, meta, loading, refresh } = useApi<Incident[], { total: number }>(
    `/incidents?${queryParams.toString()}`,
    { pollInterval: 10000 },
  );

  const incidents = incidentsData || [];
  const total = meta?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // Determine selected incident
  const selectedIncident =
    incidents.find((i) => i.id === selectedIncidentId) ||
    (incidents.length > 0 ? incidents[0] : null);

  // Sync selected ID
  useEffect(() => {
    if (selectedIncident && selectedIncident.id !== selectedIncidentId) {
      setSelectedIncidentId(selectedIncident.id);
    }
  }, [incidents, selectedIncident, selectedIncidentId]);

  // Reset image error and recreate terminal log when selection changes
  useEffect(() => {
    setImgError(false);
    if (selectedIncident) {
      const typeStr = selectedIncident.detection_type.toUpperCase();
      const confStr = (selectedIncident.confidence * 100).toFixed(1);
      const zoneStr = selectedIncident.zone_id || 'SERVER_RM_B';
      const timeStr = new Date(selectedIncident.detected_at).toISOString();

      setTerminalLogs([
        '>> SYSTEM LOG INIT',
        `>> ${timeStr} - SENSOR_POLLING ACTIVE`,
        `>> WARNING: THERMAL DETECTOR GRADIENT DRIFT`,
        `>> CRIT: TEMP THRESHOLD EXCEEDED (142°C)`,
        `>> CRIT: OPTICAL ${typeStr} SENSOR TRIGGERED`,
        `>> EVENT GENERATED. CONFIDENCE: ${confStr}%`,
        `>> ZONE CLASSIFIED: ${zoneStr}`,
        `>> AWAITING OPERATOR DISPATCH INPUT...`,
      ]);
    }
  }, [selectedIncidentId]);

  // Fetch replay frames and timeline when selection or status changes
  useEffect(() => {
    if (selectedIncident) {
      setReplayFrames([]);
      setReplayTimeline([]);
      setCurrentFrameIndex(0);
      setIsPlaying(false);

      apiClient.get<IncidentReplayFrame[]>(`/incidents/${selectedIncident.id}/replay/frames`)
        .then((res) => {
          setReplayFrames(res || []);
        })
        .catch((err) => console.error("Failed to load replay frames", err));

      apiClient.get<IncidentReplayEvent[]>(`/incidents/${selectedIncident.id}/replay/timeline`)
        .then((res) => {
          setReplayTimeline(res || []);
        })
        .catch((err) => console.error("Failed to load replay timeline", err));
    }
  }, [selectedIncident?.id, selectedIncident?.status]);

  // Replay frame auto-playback loop
  useEffect(() => {
    let interval: any = null;
    if (isPlaying && replayFrames.length > 0) {
      interval = setInterval(() => {
        setCurrentFrameIndex((prev) => (prev + 1) % replayFrames.length);
      }, 350);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, replayFrames.length]);

  // Terminal scroll handler
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  const handleOperatorDecision = useCallback(async (id: number, decision: 'confirmed' | 'false_alarm' | 'resolved') => {
    setSubmitting(true);
    try {
      await apiClient.patch(`/incidents/${id}/decision`, { decision, note: resolutionNote });
      const actionLabels = {
        confirmed: 'THREAT CONFIRMED. PROTOCOL ACTIVE.',
        false_alarm: 'ALERT DISMISSED AS FALSE ALARM.',
        resolved: 'THREAT SUCCESSFULLY NEUTRALIZED AND CLOSED.'
      };
      addTerminalLogLine(`>> DISPATCH: OPERATOR DECISION - ${actionLabels[decision]}`);
      refresh();
    } catch {
      addTerminalLogLine('>> ERROR: COMMAND TRANSMISSION FAILED');
    } finally {
      setSubmitting(false);
    }
  }, [refresh, resolutionNote]);

  const addTerminalLogLine = (line: string) => {
    setTerminalLogs((prev) => [...prev, line]);
  };

  const screenshotUrl = selectedIncident
    ? apiClient.getResourceUrl(`/incidents/${selectedIncident.id}/screenshot`)
    : '';

  // Helper for Severity Badge
  const getSeverityBadge = (incident: Incident) => {
    const isCritical = incident.status === 'active' && incident.confidence > 0.85;
    if (isCritical) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--danger)',
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          fontWeight: 700,
          textTransform: 'uppercase',
        }}>
          CRITICAL
        </span>
      );
    }
    const isWarning = incident.status !== 'resolved';
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        background: isWarning ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.12)',
        border: isWarning ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: 'var(--radius-sm)',
        color: isWarning ? 'var(--warning)' : 'var(--success)',
        fontFamily: 'var(--font-mono)',
        fontSize: '9px',
        fontWeight: 700,
        textTransform: 'uppercase',
      }}>
        {isWarning ? 'WARNING' : 'INFO'}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', minHeight: 0 }}>
      {/* Top Filter and Actions Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <Filter size={14} />
            <span className="label">FILTERS</span>
          </div>

          <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>TYPE:</span>
            {(['all', 'fire', 'smoke'] as TypeFilter[]).map((f) => (
              <FilterPill
                key={f}
                label={f.toUpperCase()}
                active={typeFilter === f}
                onClick={() => { setTypeFilter(f); setPage(1); setSelectedIncidentId(null); }}
              />
            ))}
          </div>

          <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>STATUS:</span>
            {(['all', 'active', 'acknowledged', 'resolved'] as StatusFilter[]).map((f) => (
              <FilterPill
                key={f}
                label={f.toUpperCase()}
                active={statusFilter === f}
                onClick={() => { setStatusFilter(f); setPage(1); setSelectedIncidentId(null); }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
            {total} ACTIVE THREATS
          </span>
          <button
            style={{
              background: '#10131B',
              border: '1px solid #363942',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Download size={12} />
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Main split: Table on Left/Middle, details sidebar on Right */}
      <div style={{ flex: 1, display: 'flex', gap: '16px', minHeight: 0 }}>
        
        {/* Left Column: Full timeline alert table */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#181c23',
            border: '1px solid #363942',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}
        >
          {/* Table Header Section */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #363942',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#181c23',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="label" style={{ fontSize: '12px', color: 'var(--text-primary)' }}>Alert Center Timeline</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)', padding: '2px 8px', background: 'var(--bg-primary)', border: '1px solid #363942', borderRadius: 'var(--radius-sm)' }}>
                {total} Total
              </span>
            </div>
          </div>

          {/* Table Body Area */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && incidents.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                LIVE FETCHING OPERATIONAL ALERTS...
              </div>
            ) : incidents.length === 0 ? (
              <EmptyState variant="all-clear" />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#181c23', borderBottom: '1px solid #363942', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
                  <tr style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <th style={{ padding: '12px 8px', width: '36px', textAlign: 'center' }}></th>
                    <th style={{ padding: '12px 12px' }}>Severity</th>
                    <th style={{ padding: '12px 12px' }}>Timestamp</th>
                    <th style={{ padding: '12px 12px' }}>Location</th>
                    <th style={{ padding: '12px 12px' }}>Detection Type</th>
                    <th style={{ padding: '12px 12px', textAlign: 'right' }}>Confidence</th>
                    <th style={{ padding: '12px 12px' }}>Status</th>
                    <th style={{ padding: '12px 12px' }}>Assigned</th>
                    <th style={{ padding: '12px 12px', width: '50px', textAlign: 'center' }}>Report</th>
                  </tr>
                </thead>
                <tbody style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-primary)' }}>
                  {incidents.map((inc) => {
                    const isActive = selectedIncidentId === inc.id;
                    const isThreat = inc.status === 'active' || inc.status === 'detected';
                    const isResolved = inc.status === 'resolved';

                    // Status colored left accent line
                    const borderColors: Record<string, string> = {
                      active: 'var(--danger)',
                      detected: 'var(--accent)',
                      acknowledged: 'var(--warning)',
                      resolved: 'var(--success)',
                    };
                    const statusBorder = borderColors[inc.status] || 'transparent';

                    return (
                      <tr
                        key={inc.id}
                        onClick={() => setSelectedIncidentId(inc.id)}
                        style={{
                          borderBottom: '1px solid #363942',
                          borderLeft: `4px solid ${statusBorder}`,
                          cursor: 'pointer',
                          backgroundColor: isActive ? '#363942' : 'transparent',
                          transition: 'background-color var(--transition-fast)',
                          opacity: isResolved && !isActive ? 0.6 : 1,
                        }}
                        className="table-row-zebra"
                      >
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                            {isThreat ? (
                              <Flame size={14} color="var(--danger)" className="emergency-pulse" />
                            ) : (
                              <Check size={14} color="var(--success)" />
                            )}
                          </span>
                        </td>
                        <td style={{ padding: '12px 12px' }}>
                          {getSeverityBadge(inc)}
                        </td>
                        <td style={{ padding: '12px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)' }}>
                          {new Date(inc.detected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                        </td>
                        <td style={{ padding: '12px 12px', fontWeight: 500 }}>
                          {inc.zone_id || 'Sector 4'}, {inc.camera_id || 'Server Room B'}
                        </td>
                        <td style={{ padding: '12px 12px' }}>
                          {DETECTION_TYPE_LABELS[inc.detection_type] || inc.detection_type}
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: isThreat ? 'var(--danger)' : 'var(--text-secondary)' }}>
                          {formatConfidence(inc.confidence)}
                        </td>
                        <td style={{ padding: '12px 12px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: isThreat ? 'var(--danger)' : 'var(--success)' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isThreat ? 'var(--danger)' : 'var(--success)' }} />
                            {INCIDENT_STATUS_LABELS[inc.status] || inc.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {inc.status === 'resolved' ? 'Auto' : inc.status === 'acknowledged' ? 'OP-7721' : 'System'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <a
                            href={apiClient.getResourceUrl(`/incidents/${inc.id}/report`)}
                            download
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '24px',
                              height: '24px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--accent)';
                              e.currentTarget.style.background = 'rgba(0, 198, 255, 0.1)';
                              e.currentTarget.style.borderColor = 'rgba(0, 198, 255, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--text-secondary)';
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                            }}
                            title="Download PDF Report"
                          >
                            <Download size={11} />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Left Feed Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'between',
                padding: '8px 16px',
                background: '#10131B',
                borderTop: '1px solid #363942',
                flexShrink: 0,
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                Showing {((page - 1) * perPage) + 1} - {Math.min(page * perPage, total)} of {total} alerts
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  ◀ PREV
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  NEXT ▶
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Detail Sidebar (384px) */}
        <div style={{ width: '384px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, height: '100%', overflowY: 'auto' }}>
          
          {selectedIncident ? (
            <>
              {/* Camera Feed snapshot module */}
              <div
                style={{
                  backgroundColor: '#181c23',
                  border: '1px solid #363942',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Monitor size={12} color="var(--danger)" className="emergency-pulse" />
                    LIVE FEED: {selectedIncident.camera_id || 'CAM-SRB-12'}
                  </h4>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', padding: '2px 6px', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}>
                    REC
                  </span>
                </div>

                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '192px',
                    background: '#000',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #363942',
                    overflow: 'hidden',
                  }}
                >
                  {screenshotUrl && !imgError ? (
                    <img
                      src={screenshotUrl}
                      alt="Incident snapshot"
                      onError={() => setImgError(true)}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }}
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', color: 'var(--text-muted)' }}>
                      <HardDrive size={24} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em' }}>SNAPSHOT UNAVAILABLE</span>
                    </div>
                  )}

                  {/* targeting brackets */}
                  <div className="target-bracket-tl" />
                  <div className="target-bracket-tr" />
                  <div className="target-bracket-bl" />
                  <div className="target-bracket-br" />

                  {/* Overlays */}
                  <div style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: 'rgba(0, 0, 0, 0.65)', padding: '3px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--danger)', fontWeight: 700 }}>
                      TEMP: 142.5°C
                    </span>
                  </div>

                  <div style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: 'rgba(0, 0, 0, 0.65)', padding: '3px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#fff', fontWeight: 600 }}>
                      OBJ: {selectedIncident.detection_type.toUpperCase()} DETECTED
                    </span>
                  </div>
                </div>
              </div>

              {/* Alert details and logs module */}
              <div
                style={{
                  backgroundColor: '#181c23',
                  border: '1px solid #363942',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <div style={{ padding: '12px', borderBottom: '1px solid #363942', background: '#1a1c24', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--danger)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Alert Details</h4>
                    <p style={{ margin: '6px 0 0 0', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {DETECTION_TYPE_LABELS[selectedIncident.detection_type] || selectedIncident.detection_type} Threat Spike Detected
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-secondary)' }}>
                      ID: ALR-20260708-{selectedIncident.id}
                    </p>
                  </div>
                  <a
                    href={apiClient.getResourceUrl(`/incidents/${selectedIncident.id}/report`)}
                    download
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 10px',
                      background: 'rgba(0, 198, 255, 0.1)',
                      border: '1px solid rgba(0, 198, 255, 0.2)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      fontWeight: 600,
                      textDecoration: 'none',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#fff';
                      e.currentTarget.style.background = 'var(--accent)';
                      e.currentTarget.style.borderColor = 'var(--accent)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--accent)';
                      e.currentTarget.style.background = 'rgba(0, 198, 255, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(0, 198, 255, 0.2)';
                    }}
                    title="Download PDF Incident Report"
                  >
                    <Download size={10} />
                    <span>PDF REPORT</span>
                  </a>
                </div>

                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
                  {/* Command Line Terminal Logs */}
                  <div
                    ref={terminalScrollRef}
                    className="terminal-scroll"
                    style={{
                      background: '#000',
                      borderLeft: '2px solid var(--danger)',
                      padding: '12px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      lineHeight: '1.5',
                      borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                      height: '112px',
                      overflowY: 'auto',
                    }}
                  >
                    {terminalLogs.map((log, i) => {
                      let color = 'var(--text-secondary)';
                      if (log.includes('CRIT') || log.includes('ERROR')) color = 'var(--danger)';
                      else if (log.includes('WARN')) color = 'var(--warning)';
                      else if (log.includes('DISPATCH') || log.includes('AWAITING')) color = 'var(--accent)';

                      return (
                        <div key={i} style={{ color }}>
                          {log}
                        </div>
                      );
                    })}
                  </div>

                  {/* 1. Fire Intelligence Panel */}
                  {selectedIncident.severity && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', backgroundColor: '#10131B', border: '1px solid #363942', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)' }}>FIRE INTELLIGENCE</span>
                        {/* Severity Badge */}
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '9px',
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          textTransform: 'uppercase',
                          border: '1px solid',
                          ...(() => {
                            if (selectedIncident.severity === 'CRITICAL') return { color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)' };
                            if (selectedIncident.severity === 'HIGH') return { color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.4)' };
                            if (selectedIncident.severity === 'MEDIUM') return { color: '#06b6d4', background: 'rgba(6, 182, 212, 0.15)', borderColor: 'rgba(6, 182, 212, 0.4)' };
                            return { color: 'var(--success)', background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' };
                          })()
                        }}>
                          {selectedIncident.severity}
                        </span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>ESTIMATED CONTEXT</span>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedIncident.estimated_cause}</span>
                        </div>
                        <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>OBSERVED BEHAVIOUR</span>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedIncident.observed_behaviour}</span>
                        </div>
                      </div>

                      {/* Explainability Bullets */}
                      {selectedIncident.explanation && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)' }}>AI EXPLAINABILITY PROOFS</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {selectedIncident.explanation.split('\n').map((line, idx) => (
                              <div key={idx} style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                                ✓ {line}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Callout Summary */}
                      <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: 'var(--radius-sm)', borderLeft: '2px solid var(--accent)' }}>
                        {selectedIncident.ai_summary}
                      </p>
                    </div>
                  )}

                  {/* 2. Evidence Collected Panel */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: '#10131B', border: '1px solid #363942', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)' }}>EVIDENCE COLLECTED</span>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '8px', display: 'block' }}>SCREENSHOT STATUS</span>
                        <span style={{ color: selectedIncident.screenshot_path ? 'var(--success)' : 'var(--danger)' }}>
                          {selectedIncident.screenshot_path ? '✓ SAVED ON DISK' : '✗ NOT SAVED'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '8px', display: 'block' }}>TIMESTAMP</span>
                        <span style={{ color: 'var(--text-primary)' }}>
                          {new Date(selectedIncident.detected_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '8px', display: 'block' }}>DETECTION TYPE</span>
                        <span style={{ color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                          {selectedIncident.detection_type.replace('_', ' ')}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '8px', display: 'block' }}>MAX CONFIDENCE</span>
                        <span style={{ color: 'var(--text-primary)' }}>
                          {(selectedIncident.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '8px', display: 'block' }}>BOUNDING BOXES</span>
                        <span style={{ color: 'var(--text-primary)' }}>
                          {(() => {
                            const bulletLines = selectedIncident.explanation ? selectedIncident.explanation.split('\n') : [];
                            const bboxLine = bulletLines.find(l => l.includes('Multiple threat regions'));
                            if (bboxLine) {
                              const match = bboxLine.match(/\(count:\s*(\d+)\)/);
                              return match ? `${match[1]} regions detected` : '1 region detected';
                            }
                            return '1 region detected';
                          })()}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '8px', display: 'block' }}>SOURCE DEVICE ID</span>
                        <span style={{ color: 'var(--text-primary)' }}>
                          {selectedIncident.camera_id || 'CAM-SRB-12'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Incident Investigation Panel (Replay & Timeline) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', backgroundColor: '#10131B', border: '1px solid #363942', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Video size={12} color="var(--accent)" /> INCIDENT INVESTIGATION
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)' }}>
                        EVIDENCE REPLAY
                      </span>
                    </div>

                    {/* Replay Statistics Sub-panel */}
                    {replayFrames.length > 0 && (() => {
                      const maxConfidence = Math.max(...replayFrames.map(f => f.confidence), 0);
                      const detectionCount = replayFrames.filter(f => f.detection_type !== 'none').length;
                      
                      let duration = 0;
                      if (replayFrames.length >= 2) {
                        const start = new Date(replayFrames[0].timestamp).getTime();
                        const end = new Date(replayFrames[replayFrames.length - 1].timestamp).getTime();
                        duration = Math.max(0, (end - start) / 1000);
                      }

                      const firstDet = replayFrames.find(f => f.detection_type !== 'none');
                      const firstDetTime = firstDet ? new Date(firstDet.timestamp).toLocaleTimeString() : 'N/A';
                      
                      const alarmFrame = replayFrames.find(f => f.frame_index === 0);
                      const alarmTime = alarmFrame ? new Date(alarmFrame.timestamp).toLocaleTimeString() : new Date(selectedIncident.detected_at).toLocaleTimeString();

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.04)', fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '8px' }}>DURATION</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{duration.toFixed(1)}s</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '8px' }}>TOTAL FRAMES</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{replayFrames.length} frames</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '8px' }}>DETECTION COUNT</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{detectionCount} frames</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '8px' }}>MAX CONFIDENCE</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{(maxConfidence * 100).toFixed(1)}%</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '8px' }}>FIRST DETECTION</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{firstDetTime}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '8px' }}>ALARM TRIGGER</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{alarmTime}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Replay Media Player */}
                    {replayFrames.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div
                          style={{
                            position: 'relative',
                            width: '100%',
                            height: '160px',
                            background: '#000',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            overflow: 'hidden',
                          }}
                        >
                          {(() => {
                            const activeFrame = replayFrames[currentFrameIndex];
                            if (!activeFrame) return null;
                            const activeImageUrl = apiClient.getResourceUrl(`/incidents/${selectedIncident.id}/replay/frames/${activeFrame.frame_index}`);
                            
                            return (
                              <>
                                <img
                                  src={activeImageUrl}
                                  alt={`Replay frame ${activeFrame.frame_index}`}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                
                                {/* Overlay HUD */}
                                <div style={{ position: 'absolute', top: '6px', left: '6px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.15)', fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-secondary)' }}>
                                  FRAME: {activeFrame.frame_index} ({activeFrame.frame_index < 0 ? '' : '+'}{activeFrame.frame_index}f)
                                </div>

                                <div style={{ position: 'absolute', top: '6px', right: '6px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.15)', fontFamily: 'var(--font-mono)', fontSize: '8px', color: activeFrame.confidence > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                  AI: {(activeFrame.confidence * 100).toFixed(0)}% ({activeFrame.detection_type.toUpperCase()})
                                </div>

                                <div style={{ position: 'absolute', bottom: '6px', left: '6px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.15)', fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)' }}>
                                  {new Date(activeFrame.timestamp).toLocaleTimeString()}
                                </div>

                                <div style={{ position: 'absolute', bottom: '6px', right: '6px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.15)', fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-secondary)' }}>
                                  BOXES: {activeFrame.bbox_count}
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        {/* Player Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)' }}>
                          <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', padding: '4px' }}
                            title={isPlaying ? 'Pause' : 'Play'}
                          >
                            {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                          </button>
                          
                          <button
                            onClick={() => {
                              setIsPlaying(false);
                              setCurrentFrameIndex((prev) => (prev - 1 + replayFrames.length) % replayFrames.length);
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '4px' }}
                            title="Step Backward"
                          >
                            <SkipBack size={12} />
                          </button>

                          <input
                            type="range"
                            min={0}
                            max={replayFrames.length - 1}
                            value={currentFrameIndex}
                            onChange={(e) => {
                              setIsPlaying(false);
                              setCurrentFrameIndex(Number(e.target.value));
                            }}
                            style={{
                              flex: 1,
                              height: '4px',
                              background: '#2c313d',
                              borderRadius: '2px',
                              outline: 'none',
                              cursor: 'pointer',
                              accentColor: 'var(--accent)',
                            }}
                          />

                          <button
                            onClick={() => {
                              setIsPlaying(false);
                              setCurrentFrameIndex((prev) => (prev + 1) % replayFrames.length);
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '4px' }}
                            title="Step Forward"
                          >
                            <SkipForward size={12} />
                          </button>

                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', minWidth: '40px', textAlign: 'right' }}>
                            {currentFrameIndex + 1} / {replayFrames.length}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '20px', textAlign: 'center', background: '#0a0d14', borderRadius: 'var(--radius-sm)', border: '1px dashed rgba(255,255,255,0.08)' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>
                          NO REPLAY TIMELINE RECORDED FOR THIS INCIDENT
                        </span>
                      </div>
                    )}

                    {/* Chronological Timeline Events sub-panel */}
                    {replayTimeline.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: 'var(--text-secondary)' }}>INVESTIGATION TIMELINE LOG</span>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                          {replayTimeline.map((ev) => {
                            let iconColor = 'var(--text-muted)';
                            if (ev.event_type === 'alarm_triggered') iconColor = 'var(--danger)';
                            else if (ev.event_type === 'incident_resolved') iconColor = 'var(--success)';
                            else if (ev.event_type === 'operator_acknowledgment') iconColor = 'var(--warning)';
                            else if (ev.event_type.includes('detected')) iconColor = 'var(--warning)';

                            return (
                              <div key={ev.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {/* Timeline Dot */}
                                <div style={{
                                  position: 'absolute',
                                  left: '-12px',
                                  top: '4px',
                                  width: '7px',
                                  height: '7px',
                                  borderRadius: '50%',
                                  backgroundColor: iconColor,
                                  border: '1.5px solid #10131B',
                                }} />
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                                    {ev.event_type.replace('_', ' ')}
                                  </span>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)' }}>
                                    {new Date(ev.timestamp).toLocaleTimeString()}
                                  </span>
                                </div>
                                <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                                  {ev.description}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Operator Decision Console */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: '#10131B', border: '1px solid #363942', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)' }}>OPERATOR DECISION CONSOLE</span>
                    
                    {selectedIncident.operator_decision && selectedIncident.operator_decision !== 'none' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-sm)' }}>
                          <Check size={14} color="var(--success)" />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase' }}>
                            DECISION RECORDED: {selectedIncident.operator_decision.replace('_', ' ')}
                          </span>
                        </div>
                        {selectedIncident.resolution_note && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '6px 8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 'var(--radius-sm)' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', display: 'block' }}>OPERATOR NOTES</span>
                            {selectedIncident.resolution_note}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>OPERATOR ACTION NOTES</span>
                          <textarea
                            value={resolutionNote}
                            onChange={(e) => setResolutionNote(e.target.value)}
                            placeholder="Input rationale for action/dismissal..."
                            rows={2}
                            style={{
                              backgroundColor: '#060a13',
                              border: '1px solid #363942',
                              borderRadius: 'var(--radius-sm)',
                              padding: '8px',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: 'var(--text-primary)',
                              outline: 'none',
                              resize: 'none',
                            }}
                          />
                        </div>

                        {/* Explainable Decision buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <HoldButton
                            label="CONFIRM THREAT"
                            color="var(--warning)"
                            fillColor="rgba(245, 158, 11, 0.25)"
                            onConfirm={() => handleOperatorDecision(selectedIncident.id, 'confirmed')}
                            holdDuration={1000}
                            disabled={submitting}
                            icon={<Flame size={12} />}
                          />
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <div style={{ flex: 1 }}>
                              <HoldButton
                                label="FALSE ALARM"
                                color="var(--text-secondary)"
                                fillColor="rgba(136, 146, 168, 0.15)"
                                onConfirm={() => handleOperatorDecision(selectedIncident.id, 'false_alarm')}
                                holdDuration={1500}
                                disabled={submitting}
                                icon={<Check size={12} />}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <HoldButton
                                label="RESOLVE INCIDENT"
                                color="var(--success)"
                                fillColor="rgba(16, 185, 129, 0.25)"
                                onConfirm={() => handleOperatorDecision(selectedIncident.id, 'resolved')}
                                holdDuration={1500}
                                disabled={submitting}
                                icon={<Check size={12} />}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <EmptyState variant="no-data" compact title="Select an alert" description="Choose an incident from the timeline to monitor telemetry logs." />
            </div>
          )}

        </div>

      </div>
    </div>
  );
});

// ── Helpers ─────────────────────────────────────────────

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontFamily: 'var(--font-sans)',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        background: active ? 'rgba(0, 122, 255, 0.08)' : 'transparent',
        border: `1px solid ${active ? 'var(--accent)' : '#363942'}`,
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
      }}
    >
      {label}
    </button>
  );
}

export default IncidentsPage;
