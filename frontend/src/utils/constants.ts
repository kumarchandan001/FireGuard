/**
 * FireGuard AI — Application Constants
 */

// ── Navigation Items ────────────────────────────────────────

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string; // Using emoji for MVP — replace with icon library later
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: '📊' },
  { id: 'incidents', label: 'Incidents', path: '/incidents', icon: '🔥' },
  { id: 'analytics', label: 'Analytics', path: '/analytics', icon: '📈' },
  { id: 'reports', label: 'Reports', path: '/reports', icon: '📋' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: '⚙️' },
];

// ── Detection Types ─────────────────────────────────────────

export const DETECTION_TYPE_LABELS: Record<string, string> = {
  fire: 'Fire',
  smoke: 'Smoke',
  fire_and_smoke: 'Fire & Smoke',
};

export const DETECTION_TYPE_COLORS: Record<string, string> = {
  fire: '#ef4444',
  smoke: '#f59e0b',
  fire_and_smoke: '#dc2626',
};

// ── Incident Status ─────────────────────────────────────────

export const INCIDENT_STATUS_LABELS: Record<string, string> = {
  detected: 'Detected',
  active: 'Active',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
};

export const INCIDENT_STATUS_COLORS: Record<string, string> = {
  detected: '#f59e0b',
  active: '#ef4444',
  acknowledged: '#3b82f6',
  resolved: '#22c55e',
};

// ── WebSocket ───────────────────────────────────────────────

export const WS_RECONNECT_DELAY_MS = 3000;
export const WS_MAX_RECONNECT_ATTEMPTS = 10;

// ── Formatting ──────────────────────────────────────────────

export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};
