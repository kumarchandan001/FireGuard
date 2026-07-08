/**
 * FireGuard AI — Event Timeline
 *
 * Scrollable timeline of recent incidents/events.
 * Color-coded left border, relative timestamps.
 */

import type { Incident } from '../../types';
import { formatRelativeTime } from '../../utils/formatters';
import EmptyState from '../shared/EmptyState';
import {
  DETECTION_TYPE_LABELS,
  DETECTION_TYPE_COLORS,
  INCIDENT_STATUS_LABELS,
} from '../../utils/constants';

interface EventTimelineProps {
  incidents: Incident[];
}

export default function EventTimeline({ incidents }: EventTimelineProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        flex: 1,
        minHeight: 0,
        transition: 'background-color var(--transition-state), border-color var(--transition-state)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '7px 10px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span className="label">RECENT EVENTS</span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--text-muted)',
          }}
        >
          {incidents.length}
        </span>
      </div>

      {/* Events */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
        {incidents.length === 0 ? (
          <EmptyState variant="monitoring" compact />
        ) : (
          incidents.slice(0, 15).map((inc) => (
            <EventRow key={inc.id} incident={inc} />
          ))
        )}
      </div>
    </div>
  );
}

function EventRow({ incident }: { incident: Incident }) {
  const borderColor = DETECTION_TYPE_COLORS[incident.detection_type] || 'var(--accent)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 8px',
        marginBottom: '2px',
        borderLeft: `2px solid ${borderColor}`,
        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
        background: 'var(--bg-tertiary)',
        fontSize: '11px',
        transition: 'background-color var(--transition-fast)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: borderColor,
            fontSize: '10px',
            letterSpacing: '0.05em',
          }}
        >
          {DETECTION_TYPE_LABELS[incident.detection_type]?.toUpperCase() || incident.detection_type.toUpperCase()}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
          {INCIDENT_STATUS_LABELS[incident.status] || incident.status} · {(incident.confidence * 100).toFixed(0)}%
        </div>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
        }}
      >
        {formatRelativeTime(incident.detected_at)}
      </span>
    </div>
  );
}
