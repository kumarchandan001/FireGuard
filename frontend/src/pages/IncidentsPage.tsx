/**
 * FireGuard AI — Alert Center (Stitch Layout Style)
 *
 * Operational Alert Center layout matching Stitch mockup:
 *   - Filters at the top
 *   - Left: Full high-density Alert Timeline Table (Severity, Timestamp, Location, Detection Type, Confidence, Status, Assigned)
 *   - Right: Detail Sidebar containing Live Camera Snap, Terminal Log init/sweeps, Info Grid, Actions (HoldButtons)
 */

import { useState, useCallback, memo, useEffect, useRef } from 'react';
import { Flame, Check, Monitor, Download, Filter, HardDrive } from 'lucide-react';
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
import type { Incident } from '../types';


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

  // Terminal scroll handler
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  const handleAction = useCallback(async (id: number, action: 'acknowledge' | 'resolve') => {
    setSubmitting(true);
    try {
      if (action === 'resolve') {
        await apiClient.patch(`/incidents/${id}/resolve`, { note: resolutionNote });
        addTerminalLogLine('>> DISPATCH: THREAT RESOLVED. CLOSE SIGNAL SENT.');
      } else {
        await apiClient.patch(`/incidents/${id}/acknowledge`);
        addTerminalLogLine('>> DISPATCH: OPERATOR ACKNOWLEDGED. THREAT CONFIRMED.');
      }
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

                  {/* Info grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ background: '#10131B', border: '1px solid #363942', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Zone</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {selectedIncident.zone_id || 'Server Room B'}
                      </span>
                    </div>

                    <div style={{ background: '#10131B', border: '1px solid #363942', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Impact</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--danger)' }}>
                        High / Mission Critical
                      </span>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #363942' }}>
                    <h5 style={{ margin: '0 0 10px 0', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Immediate Actions</h5>
                    
                    {(selectedIncident.status === 'active' || selectedIncident.status === 'acknowledged') ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>RESOLUTION NOTES</span>
                          <input
                            type="text"
                            value={resolutionNote}
                            onChange={(e) => setResolutionNote(e.target.value)}
                            placeholder="Describe action taken..."
                            style={{
                              backgroundColor: '#10131B',
                              border: '1px solid #363942',
                              borderRadius: 'var(--radius-sm)',
                              padding: '8px 10px',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: 'var(--text-primary)',
                              outline: 'none',
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                          {selectedIncident.status === 'active' && (
                            <HoldButton
                              label="Ack Alert"
                              color="var(--warning)"
                              fillColor="rgba(245, 158, 11, 0.25)"
                              onConfirm={() => handleAction(selectedIncident.id, 'acknowledge')}
                              holdDuration={1500}
                              disabled={submitting}
                              icon={<Flame size={12} />}
                            />
                          )}
                          <HoldButton
                            label="Resolve Alert"
                            color="var(--success)"
                            fillColor="rgba(16, 185, 129, 0.25)"
                            onConfirm={() => handleAction(selectedIncident.id, 'resolve')}
                            holdDuration={2000}
                            disabled={submitting}
                            icon={<Check size={12} />}
                          />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-sm)' }}>
                        <Check size={16} color="var(--success)" />
                        <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>This incident is resolved. No action required.</span>
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
