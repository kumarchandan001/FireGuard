/**
 * FireGuard AI — Button Component
 *
 * Themed button with variants: primary, secondary, danger, ghost.
 */

import { type ButtonHTMLAttributes, type CSSProperties } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: '#ffffff',
    border: '1px solid var(--accent)',
  },
  secondary: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
  },
  danger: {
    background: 'var(--danger)',
    color: '#ffffff',
    border: '1px solid var(--danger)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid transparent',
  },
};

const SIZE_STYLES: Record<ButtonSize, CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: '12px' },
  md: { padding: '8px 16px', fontSize: '14px' },
  lg: { padding: '10px 24px', fontSize: '15px' },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  style,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontWeight: 500,
    borderRadius: 'var(--radius-md)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all var(--transition-fast)',
    fontFamily: 'var(--font-sans)',
    width: fullWidth ? '100%' : undefined,
    ...VARIANT_STYLES[variant],
    ...SIZE_STYLES[size],
    ...style,
  };

  return (
    <button style={baseStyle} disabled={disabled} {...props}>
      {children}
    </button>
  );
}
