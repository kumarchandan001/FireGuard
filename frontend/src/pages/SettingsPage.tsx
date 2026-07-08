/**
 * FireGuard AI — Devices & Settings Page (Stitch Style)
 *
 * Integrated tabbed view:
 *   - Tab 1: Device Inventory (mock Stitch Device Management table layout)
 *   - Tab 2: System Settings (the pre-existing dynamic configuration API panel)
 */

import { useState, useEffect, useCallback, memo } from 'react';
import { useApi } from '../hooks/useApi';
import { apiClient } from '../api/client';
import type { Setting } from '../types';
import {
  Filter,
  Download,
  Plus,
  AlertTriangle,
  RefreshCw,
  Activity,
  Wifi,
  WifiOff,
} from 'lucide-react';

const CATEGORY_ORDER = ['detection', 'alarm', 'camera', 'system'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  detection: 'DETECTION ENGINE',
  alarm: 'ALARM SYSTEM',
  camera: 'CAMERA MODULE',
  system: 'SYSTEM',
};

// Mock device inventory matching Stitch layout data
interface DeviceItem {
  id: string;
  type: string;
  location: string;
  status: 'Online' | 'Offline' | 'Maintenance Req';
  firmware: string;
  signal: 'full' | 'half' | 'none';
}

const INITIAL_DEVICES: DeviceItem[] = [
  { id: 'CAM-NS-041', type: 'Optical Surveillance', location: 'North Sector / Corridor A', status: 'Online', firmware: 'v4.2.1', signal: 'full' },
  { id: 'SMK-ES-112', type: 'Particulate Sensor', location: 'East Sector / Lab 3', status: 'Maintenance Req', firmware: 'v3.8.0', signal: 'half' },
  { id: 'THM-SS-008', type: 'Thermal Array', location: 'South Sector / Server Rm', status: 'Offline', firmware: 'v4.1.0', signal: 'none' },
  { id: 'CAM-WS-092', type: 'Optical Surveillance', location: 'West Sector / Loading Bay', status: 'Online', firmware: 'v4.2.1', signal: 'full' },
];

const SettingsPage = memo(function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'settings'>('inventory');
  
  // Settings Tab states
  const { data: settings, loading, refresh } = useApi<Setting[]>('/settings');
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  // Device inventory states
  const [devices, setDevices] = useState<DeviceItem[]>(INITIAL_DEVICES);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Online' | 'Offline' | 'Maintenance Req'>('All');

  const handleCycleFilter = () => {
    const states = ['All', 'Online', 'Offline', 'Maintenance Req'] as const;
    const currentIndex = states.indexOf(statusFilter);
    const nextIndex = (currentIndex + 1) % states.length;
    setStatusFilter(states[nextIndex]);
  };

  const handleExportCSV = () => {
    const headers = ['Device ID', 'Type', 'Location', 'Status', 'Firmware'];
    const rows = devices.map(d => [d.id, d.type, d.location, d.status, d.firmware]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `device_inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleProvisionDevice = () => {
    const id = `CAM-WS-${Math.floor(100 + Math.random() * 900)}`;
    const types = ['Optical Surveillance', 'Particulate Sensor', 'Thermal Array'];
    const locations = ['North Sector / Corridor B', 'East Sector / Server Rm 2', 'West Sector / Loading Bay B'];
    const newDevice: DeviceItem = {
      id,
      type: types[Math.floor(Math.random() * types.length)],
      location: locations[Math.floor(Math.random() * locations.length)],
      status: 'Online',
      firmware: 'v4.2.1',
      signal: 'full',
    };
    setDevices(prev => [...prev, newDevice]);
  };

  const filteredDevices = devices.filter(d => statusFilter === 'All' || d.status === statusFilter);

  useEffect(() => {
    if (settings) {
      const values: Record<string, string> = {};
      settings.forEach((s) => (values[s.key] = s.value));
      setLocalValues(values);
    }
  }, [settings]);

  const grouped = (settings || []).reduce<Record<string, Setting[]>>((acc, s) => {
    (acc[s.category] = acc[s.category] || []).push(s);
    return acc;
  }, {});

  const handleChange = (key: string, value: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const original = (settings || []).reduce<Record<string, string>>((acc, s) => {
        acc[s.key] = s.value;
        return acc;
      }, {});

      const changed = Object.entries(localValues).filter(([k, v]) => original[k] !== v);
      for (const [key, value] of changed) {
        await apiClient.put(`/settings/${key}`, { value });
      }
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
      refresh();
    } catch { /* handled */ }
    finally { setSaving(false); }
  }, [localValues, settings, refresh]);

  const handleReset = () => {
    if (settings) {
      const values: Record<string, string> = {};
      settings.forEach((s) => (values[s.key] = s.value));
      setLocalValues(values);
    }
  };

  const handleRestartDevice = (id: string) => {
    alert(`Initiating force restart for device: ${id}`);
    setDevices(prev =>
      prev.map(d =>
        d.id === id ? { ...d, status: 'Online', signal: 'full' } : d
      )
    );
  };

  const handleDeleteDevice = (id: string) => {
    if (confirm(`Are you sure you want to decommission and delete device ${id}?`)) {
      setDevices(prev => prev.filter(d => d.id !== id));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflow: 'auto' }}>
      
      {/* Page Header and Tab controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            {activeTab === 'inventory' ? 'Device Inventory' : 'System Configuration'}
          </h2>
          <p style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {activeTab === 'inventory' 
              ? `Total Registered: ${devices.length} | Online: ${devices.filter(d => d.status !== 'Offline').length} | Offline: ${devices.filter(d => d.status === 'Offline').length}`
              : 'Global Engine Customizations'
            }
          </p>
        </div>

        <div style={{ display: 'flex', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '2px', borderRadius: 'var(--radius-sm)' }}>
          <button
            onClick={() => setActiveTab('inventory')}
            style={{
              padding: '6px 12px',
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              fontWeight: 600,
              color: activeTab === 'inventory' ? '#fff' : 'var(--text-secondary)',
              background: activeTab === 'inventory' ? 'var(--accent)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            Inventory
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              padding: '6px 12px',
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              fontWeight: 600,
              color: activeTab === 'settings' ? '#fff' : 'var(--text-secondary)',
              background: activeTab === 'settings' ? 'var(--accent)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            System Settings
          </button>
        </div>
      </div>

      {/* Tab 1: Device Inventory */}
      {activeTab === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          
          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={actionBtnStyle} onClick={handleCycleFilter}>
                <Filter size={12} /> Filter: {statusFilter.toUpperCase()}
              </button>
              <button style={actionBtnStyle} onClick={handleExportCSV}>
                <Download size={12} /> Export CSV
              </button>
            </div>
            <button
              onClick={handleProvisionDevice}
              style={{ ...actionBtnStyle, background: 'var(--accent)', border: '1px solid var(--accent)', color: '#fff', fontWeight: 700 }}
            >
              <Plus size={12} /> Provision Device
            </button>
          </div>

          {/* Warning Bar */}
          <div
            style={{
              background: '#000',
              borderLeft: '2px solid var(--warning)',
              borderRight: '1px solid #363942',
              borderTop: '1px solid #363942',
              borderBottom: '1px solid #363942',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--warning)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={12} />
              <span>SYS_WARN: High latency detected on Sector 4 Thermal Array (Response &gt; 400ms). Diagnostics recommended.</span>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>14:02:44 PST</span>
          </div>

          {/* Devices Inventory Table */}
          <div style={{ backgroundColor: '#181c23', border: '1px solid #363942', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 3fr 2fr 1fr 1fr 2fr', padding: '12px 16px', background: '#10131B', borderBottom: '1px solid #363942', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <div>Device ID</div>
              <div>Type</div>
              <div>Location</div>
              <div>Status</div>
              <div style={{ textAlign: 'center' }}>Health</div>
              <div style={{ textAlign: 'center' }}>Firmware</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredDevices.map((dev) => (
                <div
                  key={dev.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 2fr 3fr 2fr 1fr 1fr 2fr',
                    padding: '12px 16px',
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(54, 57, 66, 0.5)',
                    fontSize: '13px',
                  }}
                  className="table-row-zebra"
                >
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: dev.status === 'Offline' ? 'var(--danger)' : 'var(--accent)' }}>
                    {dev.id}
                  </div>
                  <div style={{ color: 'var(--text-primary)' }}>{dev.type}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{dev.location}</div>
                  <div>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: dev.status === 'Online' ? 'var(--success)' : dev.status === 'Offline' ? 'var(--danger)' : 'var(--warning)'
                    }}>
                      <span className="emergency-pulse" style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: dev.status === 'Online' ? 'var(--success)' : dev.status === 'Offline' ? 'var(--danger)' : 'var(--warning)'
                      }} />
                      {dev.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {dev.signal === 'full' && <Wifi size={14} color="var(--success)" />}
                    {dev.signal === 'half' && <Activity size={14} color="var(--warning)" />}
                    {dev.signal === 'none' && <WifiOff size={14} color="var(--danger)" />}
                  </div>
                  <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '11px' }}>
                    {dev.firmware}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {dev.status === 'Offline' ? (
                      <>
                        <button
                          onClick={() => handleRestartDevice(dev.id)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: 'var(--danger)',
                            fontSize: '10px',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 700,
                          }}
                        >
                          <RefreshCw size={10} /> Restart
                        </button>
                        <button
                          style={{ ...devActionBtnStyle, border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)' }}
                          onClick={() => handleDeleteDevice(dev.id)}
                        >
                          Decom
                        </button>
                      </>
                    ) : (
                      <>
                        <button style={devActionBtnStyle} onClick={() => alert(`Running telemetry diagnostics on ${dev.id}...`)}>Diag</button>
                        <button style={devActionBtnStyle} onClick={() => alert(`Checking software version updates for ${dev.id}...`)}>Update</button>
                        <button
                          style={{ ...devActionBtnStyle, border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)' }}
                          onClick={() => handleDeleteDevice(dev.id)}
                        >
                          Decom
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: System Settings */}
      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <span className="label">GLOBAL SYSTEM CONFIGURATION</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {savedMsg && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--success)' }}>
                  ✓ SAVED
                </span>
              )}
              <button onClick={handleReset} style={ghostBtnStyle}>RESET</button>
              <button onClick={handleSave} disabled={saving} style={accentBtnStyle}>
                {saving ? 'SAVING...' : 'SAVE'}
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
              LOADING CONFIGURATION...
            </div>
          ) : (
            CATEGORY_ORDER.map((cat) => {
              const items = grouped[cat];
              if (!items || items.length === 0) return null;
              return (
                <div
                  key={cat}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
                    <span className="label">{CATEGORY_LABELS[cat] || cat.toUpperCase()}</span>
                  </div>
                  {items.map((setting, i) => (
                    <SettingRow
                      key={setting.key}
                      setting={setting}
                      value={localValues[setting.key] ?? setting.value}
                      onChange={(v) => handleChange(setting.key, v)}
                      isLast={i === items.length - 1}
                    />
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
});

function SettingRow({
  setting,
  value,
  onChange,
  isLast,
}: {
  setting: Setting;
  value: string;
  onChange: (v: string) => void;
  isLast: boolean;
}) {
  const isBool = setting.value_type === 'bool';
  const boolVal = value === 'true' || value === '1';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
      }}
    >
      <div>
        <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
          {setting.description || setting.key}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {setting.key}
        </div>
      </div>

      {isBool ? (
        <button
          onClick={() => onChange(boolVal ? 'false' : 'true')}
          style={{
            width: '40px',
            height: '22px',
            borderRadius: 'var(--radius-full)',
            background: boolVal ? 'var(--accent)' : 'var(--bg-tertiary)',
            border: `1px solid ${boolVal ? 'var(--accent-border)' : 'var(--border-color)'}`,
            position: 'relative',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '2px',
              left: boolVal ? '20px' : '2px',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: '#fff',
              transition: 'left var(--transition-fast)',
            }}
          />
        </button>
      ) : (
        <input
          type={setting.value_type === 'int' || setting.value_type === 'float' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          step={setting.value_type === 'float' ? '0.01' : '1'}
          style={{
            width: '100px',
            padding: '6px 8px',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-data)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'right',
            outline: 'none',
          }}
        />
      )}
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  background: '#181C23',
  border: '1px solid #363942',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
};

const devActionBtnStyle: React.CSSProperties = {
  padding: '4px 8px',
  background: 'transparent',
  border: '1px solid #363942',
  color: 'var(--text-secondary)',
  fontSize: '10px',
  fontFamily: 'var(--font-mono)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  transition: 'all var(--transition-fast)',
};

const ghostBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  fontFamily: 'var(--font-sans)',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.06em',
  color: 'var(--text-muted)',
  background: 'transparent',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
};

const accentBtnStyle: React.CSSProperties = {
  padding: '4px 16px',
  fontFamily: 'var(--font-sans)',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  color: 'var(--accent)',
  background: 'var(--accent-glow)',
  border: '1px solid var(--accent-border)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
};

export default SettingsPage;
