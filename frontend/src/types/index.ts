/**
 * FireGuard AI — TypeScript Type Definitions
 * Shared types used across the frontend application.
 */

// ── Detection Types ──────────────────────────────────────────

export type DetectionType = 'fire' | 'smoke' | 'fire_and_smoke';

export interface Detection {
  class_name: DetectionType;
  confidence: number;
  bbox: [number, number, number, number]; // x1, y1, x2, y2
}

export interface DetectionResult {
  detections: Detection[];
  frame_id: number;
  timestamp: string;
  inference_time_ms: number;
  has_fire: boolean;
  has_smoke: boolean;
  max_confidence: number;
}

// ── Alarm Types ──────────────────────────────────────────────

export type AlarmState = 'idle' | 'triggered' | 'active' | 'acknowledged';

export interface AlarmStatus {
  state: AlarmState;
  incident_id?: number;
  detection_type?: DetectionType;
  confidence?: number;
  dispatched?: boolean;
}

// ── Incident Types ───────────────────────────────────────────

export type IncidentStatus = 'detected' | 'active' | 'acknowledged' | 'resolved';

export interface Incident {
  id: number;
  detection_type: DetectionType;
  confidence: number;
  status: IncidentStatus;
  screenshot_path: string | null;
  detected_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  camera_id: string | null;
  zone_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Settings Types ───────────────────────────────────────────

export interface Setting {
  key: string;
  value: string;
  value_type: 'int' | 'float' | 'bool' | 'string';
  category: 'detection' | 'alarm' | 'camera' | 'system';
  description: string;
  updated_at: string;
}

export interface SettingsGrouped {
  detection: Setting[];
  alarm: Setting[];
  camera: Setting[];
  system: Setting[];
}

// ── Analytics Types ──────────────────────────────────────────

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export interface DetectionDistribution {
  type: DetectionType;
  count: number;
  percentage: number;
}

export interface AnalyticsSummary {
  total_incidents: number;
  incidents_today: number;
  avg_confidence: number;
  most_common_type: DetectionType;
  incidents_over_time: TimeSeriesPoint[];
  detection_distribution: DetectionDistribution[];
}

// ── Health Types ─────────────────────────────────────────────

export type ServiceStatus = 'online' | 'offline' | 'error';

export interface SystemHealth {
  status: string;
  version: string;
  uptime_seconds: number;
  timestamp: string;
  camera?: ServiceStatus;
  ai_engine?: ServiceStatus;
}

// ── WebSocket Message Types ──────────────────────────────────

export type WSMessageType = 'frame' | 'alarm' | 'status' | 'incident';

export interface WSFrameMessage {
  type: 'frame';
  data: {
    image: string;
    timestamp: string;
    fps: number;
    detections: Detection[];
  };
}

export interface WSAlarmMessage {
  type: 'alarm';
  data: AlarmStatus;
}

export interface WSStatusMessage {
  type: 'status';
  data: {
    camera: ServiceStatus;
    ai_engine: ServiceStatus;
    uptime_seconds: number;
  };
}

export interface WSIncidentMessage {
  type: 'incident';
  data: Incident;
}

export type WSMessage = WSFrameMessage | WSAlarmMessage | WSStatusMessage | WSIncidentMessage;

// ── API Response Types ───────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  field: string | null;
}

export interface ApiResponse<T> {
  data: T;
  meta: Record<string, unknown> | null;
  errors: ApiError[] | null;
}

export interface PaginatedMeta {
  page: number;
  per_page: number;
  total: number;
}
