/**
 * FireGuard AI — Side Navigation Bar (Stitch Layout)
 *
 * Collapsible or fixed sidebar matching the mock layout:
 *   - Brand / Header (FireGuard AI Command Center)
 *   - Nav links with Lucide icons (Dashboard, Alert Center, Analytics, System/Devices)
 *   - Operator profile block at bottom
 */

import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Video, AlertOctagon, BarChart3, Settings, Shield } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { id: 'monitoring', label: 'Live Monitoring', path: '/', icon: Video },
  { id: 'alerts', label: 'Alert Center', path: '/incidents', icon: AlertOctagon },
  { id: 'analytics', label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { id: 'system', label: 'Devices & Settings', path: '/system', icon: Settings },
];

export default function Sidebar() {
  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: '256px',
        backgroundColor: 'var(--bg-tertiary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(0, 122, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
            flexShrink: 0,
          }}
        >
          <Shield size={22} fill="currentColor" style={{ opacity: 0.8 }} />
        </div>
        <div style={{ overflow: 'hidden' }}>
          <h1
            style={{
              fontSize: '18px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            FireGuard AI
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-secondary)',
              margin: '2px 0 0 0',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Command Center
          </p>
        </div>
      </div>

      {/* Nav Links */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 8px' }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            // Prevent active clash on Dashboard / Live Monitoring
            const isDashboard = item.id === 'dashboard' || item.id === 'monitoring';
            return (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  end={isDashboard}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 700 : 500,
                    textDecoration: 'none',
                    fontSize: '13px',
                    background: isActive ? 'rgba(0, 122, 255, 0.08)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                    transition: 'all var(--transition-fast)',
                  })}
                >
                  <Icon size={18} strokeWidth={2} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Profile Card Footer */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid var(--border-color)',
          marginTop: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'background var(--transition-fast)',
          }}
          className="clickable"
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <img
              alt="Operator"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC43mMlptrcYEtL-8hT5Y6SSscCgsnkK0xmViGSG59L_p9AjsqlY-b-cj7TNRXWwQ1my6rsksvFy5lFYzs4e3ucORF8xdm-w0UrkbeMzsoZnz-LPHpE3U2BSRDLzVsEJpZ8dBFnSgPZ3d9Wk7YhNxtOzTOMn_vwY0j3ZHh8y0qUQBEaUPlBMhYYDzwxEK03M0oJcttpnV_WYiYKF4emHndtl8zAutpAXXly_0l5W1skpSVsglrtF8CA"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              Operator 07
            </p>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--success)',
                margin: '2px 0 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--success)',
                  display: 'inline-block',
                }}
              />
              Active
            </p>
          </div>
        </div>
      </div>
    </nav>
  );
}
