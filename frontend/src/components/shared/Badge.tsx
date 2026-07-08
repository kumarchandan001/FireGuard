/**
 * FireGuard AI — Status Badge Component
 *
 * Small colored badge for displaying status labels.
 * Used in incident tables, dashboard cards, etc.
 */

import type { CSSProperties } from 'react';

interface BadgeProps {
  label: string;
  color: string;
  size?: 'sm' | 'md';
}

export default function Badge({ label, color, size = 'sm' }: BadgeProps) {
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: size === 'sm' ? '3px 8px' : '4px 12px',
    fontSize: size === 'sm' ? '11px' : '12px',
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    borderRadius: 'var(--radius-sm)',
    color: color,
    backgroundColor: `${color}18`,
    border: `1px solid ${color}30`,
    whiteSpace: 'nowrap' as const,
    lineHeight: 1.4,
    letterSpacing: '0.02em',
    textTransform: 'uppercase' as const,
  };

  return <span style={style}>{label}</span>;
}
