/**
 * FireGuard AI — Hold-to-Confirm Button
 *
 * Requires a sustained press (default 2s) to activate.
 * Visual: progress bar fills the button background during hold.
 * Prevents accidental triggers of critical actions (ACK/RESOLVE).
 */

import { useState, useRef, useCallback } from 'react';

interface HoldButtonProps {
  label: string;
  color: string;
  fillColor?: string;
  onConfirm: () => void;
  holdDuration?: number;
  size?: 'sm' | 'md';
  disabled?: boolean;
  icon?: React.ReactNode;
}

export default function HoldButton({
  label,
  color,
  fillColor,
  onConfirm,
  holdDuration = 2000,
  size = 'md',
  disabled = false,
  icon,
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const animRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  const startHold = useCallback(() => {
    if (disabled) return;
    setHolding(true);
    startRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startRef.current;
      const pct = Math.min(elapsed / holdDuration, 1);
      setProgress(pct);

      if (pct >= 1) {
        // Completed
        setHolding(false);
        setProgress(0);
        // Haptic feedback on mobile
        if (navigator.vibrate) navigator.vibrate(100);
        onConfirm();
        return;
      }
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
  }, [disabled, holdDuration, onConfirm]);

  const cancelHold = useCallback(() => {
    setHolding(false);
    setProgress(0);
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = 0;
    }
  }, []);

  const isSm = size === 'sm';
  const resolvedFill = fillColor || `${color}30`;

  return (
    <button
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
      onTouchCancel={cancelHold}
      disabled={disabled}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: isSm ? '6px 14px' : '8px 20px',
        fontSize: isSm ? '10px' : '11px',
        fontWeight: 700,
        fontFamily: 'var(--font-sans)',
        letterSpacing: '0.08em',
        color,
        background: 'transparent',
        border: `1px solid ${color}50`,
        borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        transition: 'border-color 0.15s ease',
        textTransform: 'uppercase',
      }}
    >
      {/* Progress fill bar */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: `${progress * 100}%`,
          background: resolvedFill,
          transition: holding ? 'none' : 'width 0.2s ease-out',
          pointerEvents: 'none',
        }}
      />

      {/* Content (above fill) */}
      <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '5px' }}>
        {icon}
        {holding ? `HOLD ${Math.ceil((1 - progress) * (holdDuration / 1000))}s` : label}
      </span>
    </button>
  );
}
