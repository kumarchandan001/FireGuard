/**
 * FireGuard AI — Empty State Component
 *
 * Context-aware empty states:
 *   'all-clear'  → Green shield, "ALL CLEAR — No active threats"
 *   'monitoring' → Compact radar-style, "No events in current window"
 *   'no-data'    → Chart icon, "Begin monitoring to generate analytics"
 *   'default'    → Generic inbox-style empty state
 */

import type { CSSProperties } from 'react';
import { ShieldCheck, Radio, BarChart3, Inbox } from 'lucide-react';

type EmptyStateVariant = 'default' | 'all-clear' | 'monitoring' | 'no-data';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  compact?: boolean;
}

const VARIANT_CONFIG: Record<EmptyStateVariant, {
  icon: typeof ShieldCheck;
  iconColor: string;
  defaultTitle: string;
  defaultDescription: string;
}> = {
  'all-clear': {
    icon: ShieldCheck,
    iconColor: 'var(--success)',
    defaultTitle: 'ALL CLEAR',
    defaultDescription: 'No active threats detected. All systems nominal.',
  },
  monitoring: {
    icon: Radio,
    iconColor: 'var(--accent)',
    defaultTitle: 'MONITORING',
    defaultDescription: 'No events in the current window. System is actively scanning.',
  },
  'no-data': {
    icon: BarChart3,
    iconColor: 'var(--text-muted)',
    defaultTitle: 'NO DATA',
    defaultDescription: 'Begin monitoring to generate analytics and reports.',
  },
  default: {
    icon: Inbox,
    iconColor: 'var(--text-muted)',
    defaultTitle: 'Nothing here',
    defaultDescription: '',
  },
};

export default function EmptyState({
  variant = 'default',
  title,
  description,
  compact = false,
}: EmptyStateProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;
  const resolvedTitle = title || config.defaultTitle;
  const resolvedDescription = description || config.defaultDescription;

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: compact ? '20px 16px' : '48px 24px',
    textAlign: 'center',
    gap: compact ? '8px' : '12px',
  };

  return (
    <div style={containerStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: compact ? 36 : 56,
          height: compact ? 36 : 56,
          borderRadius: '50%',
          background: `${config.iconColor}12`,
          border: `1px solid ${config.iconColor}25`,
        }}
      >
        <Icon
          size={compact ? 18 : 28}
          color={config.iconColor}
          strokeWidth={1.5}
        />
      </div>
      <h3
        style={{
          fontSize: compact ? '12px' : '14px',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          letterSpacing: '0.04em',
          color: 'var(--text-primary)',
          margin: 0,
        }}
      >
        {resolvedTitle}
      </h3>
      {resolvedDescription && (
        <p
          style={{
            fontSize: compact ? '11px' : '13px',
            fontFamily: 'var(--font-sans)',
            color: 'var(--text-muted)',
            margin: 0,
            maxWidth: '320px',
            lineHeight: 1.5,
          }}
        >
          {resolvedDescription}
        </p>
      )}
    </div>
  );
}
