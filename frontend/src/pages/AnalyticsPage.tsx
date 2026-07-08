/**
 * FireGuard AI — Analytics Page (Ops-Center Style)
 *
 * Stats + distribution charts + CSV export (merged from Reports).
 * All data from existing /incidents/summary and /incidents/recent APIs.
 */

import { useState, memo } from 'react';
import { Download } from 'lucide-react';
import Badge from '../components/shared/Badge';
import EmptyState from '../components/shared/EmptyState';
import { useApi } from '../hooks/useApi';
import {
  DETECTION_TYPE_LABELS,
  DETECTION_TYPE_COLORS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_COLORS,
} from '../utils/constants';
import { formatTimestamp } from '../utils/formatters';
import type { Incident } from '../types';

interface IncidentSummary {
  today: number;
  by_status: Record<string, number>;
}

type Tab = 'overview' | 'export';

const AnalyticsPage = memo(function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const { data: summary } = useApi<IncidentSummary>('/incidents/summary', { pollInterval: 30000 });
  const { data: recent } = useApi<Incident[]>('/incidents/recent?limit=50');

  const totalIncidents = Object.values(summary?.by_status || {}).reduce((a, b) => a + b, 0);
  const statusEntries = Object.entries(summary?.by_status || {});
  const incidents = Array.isArray(recent) ? recent : [];

  // Type breakdown
  const typeBreakdown: Record<string, number> = {};
  for (const inc of incidents) {
    typeBreakdown[inc.detection_type] = (typeBreakdown[inc.detection_type] || 0) + 1;
  }

  const avgConfidence = incidents.length > 0
    ? incidents.reduce((s, i) => s + i.confidence, 0) / incidents.length
    : 0;

  // CSV export
  const handleExport = () => {
    if (incidents.length === 0) return;
    const headers = ['ID', 'Type', 'Confidence', 'Status', 'Detected At', 'Acknowledged At', 'Resolved At'];
    const rows = incidents.map((i) => [
      i.id, i.detection_type, (i.confidence * 100).toFixed(1) + '%', i.status,
      i.detected_at, i.acknowledged_at || '', i.resolved_at || '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fireguard_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          padding: '0 4px',
        }}
      >
        {(['overview', 'export'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 16px',
              fontFamily: 'var(--font-sans)',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
              background: tab === t ? 'var(--accent-glow)' : 'transparent',
              border: `1px solid ${tab === t ? 'var(--accent-border)' : 'transparent'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            <StatBlock label="TOTAL" value={totalIncidents} color="var(--accent)" />
            <StatBlock label="TODAY" value={summary?.today || 0} color="var(--warning)" />
            <StatBlock label="AVG CONF" value={`${(avgConfidence * 100).toFixed(0)}%`} color="var(--success)" />
            <StatBlock label="ACTIVE" value={summary?.by_status?.active || 0} color="var(--danger)" />
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Status dist */}
            <div style={panelStyle}>
              <span className="label" style={{ marginBottom: '12px', display: 'block' }}>STATUS DISTRIBUTION</span>
              {statusEntries.length === 0 ? (
                <EmptyChart />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {statusEntries.map(([status, count]) => (
                    <BarRow
                      key={status}
                      label={INCIDENT_STATUS_LABELS[status] || status}
                      value={count}
                      total={totalIncidents}
                      color={INCIDENT_STATUS_COLORS[status] || 'var(--accent)'}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Type dist */}
            <div style={panelStyle}>
              <span className="label" style={{ marginBottom: '12px', display: 'block' }}>TYPE BREAKDOWN</span>
              {Object.keys(typeBreakdown).length === 0 ? (
                <EmptyChart />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(typeBreakdown).map(([type, count]) => (
                    <BarRow
                      key={type}
                      label={DETECTION_TYPE_LABELS[type] || type}
                      value={count}
                      total={incidents.length}
                      color={DETECTION_TYPE_COLORS[type] || 'var(--accent)'}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div style={{ ...panelStyle, flex: 1, overflow: 'auto' }}>
            <span className="label" style={{ marginBottom: '10px', display: 'block' }}>ACTIVITY LOG</span>
            {incidents.length === 0 ? (
              <EmptyChart />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {incidents.slice(0, 20).map((inc) => (
                  <div
                    key={inc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '6px 10px',
                      borderLeft: `3px solid ${DETECTION_TYPE_COLORS[inc.detection_type] || 'var(--accent)'}`,
                      background: 'var(--bg-tertiary)',
                      borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                      fontSize: '11px',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', minWidth: '130px' }}>
                      {formatTimestamp(inc.detected_at)}
                    </span>
                    <Badge
                      label={DETECTION_TYPE_LABELS[inc.detection_type] || inc.detection_type}
                      color={DETECTION_TYPE_COLORS[inc.detection_type] || 'var(--accent)'}
                    />
                    <span className="data-value" style={{ fontSize: '11px' }}>
                      {(inc.confidence * 100).toFixed(0)}%
                    </span>
                    <div style={{ flex: 1 }} />
                    <Badge
                      label={INCIDENT_STATUS_LABELS[inc.status] || inc.status}
                      color={INCIDENT_STATUS_COLORS[inc.status] || 'var(--text-muted)'}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Export tab */
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <span className="label">INCIDENT REPORT</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {incidents.length} records · Generated {new Date().toLocaleDateString()}
              </div>
            </div>
            <button
              onClick={handleExport}
              disabled={incidents.length === 0}
              style={{
                padding: '6px 16px',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: 'var(--accent)',
                background: 'var(--accent-glow)',
                border: '1px solid var(--accent-border)',
                borderRadius: 'var(--radius-sm)',
                cursor: incidents.length === 0 ? 'not-allowed' : 'pointer',
                opacity: incidents.length === 0 ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Download size={12} /> EXPORT CSV
            </button>
          </div>

          {incidents.length === 0 ? (
            <EmptyChart />
          ) : (
            <div style={{ overflow: 'auto', maxHeight: '400px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr>
                    {['#', 'TYPE', 'CONF', 'STATUS', 'DETECTED', 'RESOLVED'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc) => (
                    <tr key={inc.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{String(inc.id).padStart(4, '0')}</td>
                      <td style={{ padding: '5px 10px' }}>
                        <Badge label={DETECTION_TYPE_LABELS[inc.detection_type] || inc.detection_type} color={DETECTION_TYPE_COLORS[inc.detection_type] || 'var(--accent)'} />
                      </td>
                      <td style={{ padding: '5px 10px' }}><span className="data-value">{(inc.confidence * 100).toFixed(0)}%</span></td>
                      <td style={{ padding: '5px 10px' }}>
                        <Badge label={INCIDENT_STATUS_LABELS[inc.status] || inc.status} color={INCIDENT_STATUS_COLORS[inc.status] || 'var(--text-muted)'} />
                      </td>
                      <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)' }}>{formatTimestamp(inc.detected_at)}</td>
                      <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>{inc.resolved_at ? formatTimestamp(inc.resolved_at) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ── Helpers ─────────────────────────────────────────────

function StatBlock({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={panelStyle}>
      <span className="label">{label}</span>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '32px', fontWeight: 700, color, marginTop: '4px', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
        {value}
      </div>
    </div>
  );
}

function BarRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {value} ({pct.toFixed(0)}%)
        </span>
      </div>
      <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

function EmptyChart() {
  return <EmptyState variant="no-data" compact />;
}

const panelStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-lg)',
  padding: '14px',
};

export default AnalyticsPage;
