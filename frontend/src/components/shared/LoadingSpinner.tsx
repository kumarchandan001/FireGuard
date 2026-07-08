/**
 * FireGuard AI — Loading Spinner
 */

import type { CSSProperties } from 'react';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
  label?: string;
}

export default function LoadingSpinner({
  size = 32,
  color = 'var(--accent)',
  label = 'Loading...',
}: LoadingSpinnerProps) {
  const spinnerStyle: CSSProperties = {
    width: size,
    height: size,
    border: `3px solid var(--bg-tertiary)`,
    borderTopColor: color,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  };

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '24px',
  };

  return (
    <div style={containerStyle}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={spinnerStyle} role="status" aria-label={label} />
      {label && (
        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{label}</span>
      )}
    </div>
  );
}
