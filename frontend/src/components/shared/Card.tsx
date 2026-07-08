/**
 * FireGuard AI — Shared Card Component
 *
 * Versatile card wrapper used across all dashboard views.
 * Supports glow effect and emergency styling variants.
 */

import type { ReactNode, CSSProperties } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
}

export default function Card({ children, className = '', glow = false, style, onClick }: CardProps) {
  const classes = [
    'card',
    glow ? 'card-glow' : '',
    onClick ? 'cursor-pointer' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={style} onClick={onClick} role={onClick ? 'button' : undefined}>
      {children}
    </div>
  );
}
