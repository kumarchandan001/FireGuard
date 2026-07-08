/**
 * FireGuard AI — Utility Functions
 */

import { DATE_FORMAT_OPTIONS } from './constants';

/**
 * Format an ISO timestamp to a human-readable local string.
 */
export function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', DATE_FORMAT_OPTIONS);
  } catch {
    return iso;
  }
}

/**
 * Format a relative time (e.g., "2 minutes ago").
 */
export function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}

/**
 * Format a confidence score as a percentage string.
 */
export function formatConfidence(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format seconds to HH:MM:SS uptime string.
 */
export function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

/**
 * Classify confidence into severity level.
 */
export function getConfidenceLevel(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}
