/**
 * FireGuard AI — Status & Telemetry Panel (Stitch Style)
 *
 * Left-side column panel containing:
 *   - Global system status (SAFE/ALERT)
 *   - Environment telemetry meters (Temp, Smoke, Thermal)
 *   - 24H Temperature trend SVG line graph
 */

import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';

interface StatusPanelProps {
  alarmState: string;
  incidentsToday: number;
  aiConfidence: number;
}

export default function StatusPanel({
  alarmState,
  incidentsToday,
  aiConfidence,
}: StatusPanelProps) {
  const [tempTrend, setTempTrend] = useState<string>('M0,25 L10,22 L20,24 L30,20 L40,21 L50,15 L60,18 L70,12 L80,14 L90,8 L100,10');
  const [selectedSector, setSelectedSector] = useState<string>('CAM_01');
  const isAlert = alarmState === 'triggered' || alarmState === 'active';

  const handleTriggerSimulation = async (type: 'fire' | 'smoke') => {
    try {
      await apiClient.post(`/alarm/test-trigger?detection_type=${type}&device_id=${selectedSector}`);
    } catch {
      alert('Failed to trigger simulation.');
    }
  };

  // Environment vitals calculated dynamically
  const temp = isAlert ? 142.5 : 22.4;
  const smoke = isAlert ? 340 : 12;
  const thermalAnomalies = isAlert ? 'Detected - Sect. 4' : 'None Detected';

  // Fill widths
  const tempPct = Math.min((temp / 150) * 100, 100);
  const smokePct = Math.min((smoke / 500) * 100, 100);
  const thermalPct = isAlert ? 90 : 5;

  // Render randomized slight fluctuations in temp trend SVG when in normal mode
  useEffect(() => {
    if (isAlert) {
      // Spike trend upwards
      setTempTrend('M0,25 L10,22 L20,24 L30,20 L40,21 L50,15 L60,25 L70,30 L80,5 L90,-5 L100,-15');
      return;
    }
    const interval = setInterval(() => {
      const points = Array.from({ length: 11 }, (_, i) => {
        const x = i * 10;
        const y = 15 + Math.floor(Math.random() * 12);
        return `${x === 0 ? 'M' : 'L'}${x},${y}`;
      }).join(' ');
      setTempTrend(points);
    }, 8000);

    return () => clearInterval(interval);
  }, [isAlert]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Global Status Panel */}
      <div
        style={{
          backgroundColor: '#181c23',
          border: '1px solid #363942',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '2px 8px 6px 8px',
            borderBottom: '1px solid #363942',
            marginBottom: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            System Status
          </span>
          <span
            className="status-dot online"
            style={{
              width: '8px',
              height: '8px',
              backgroundColor: isAlert ? 'var(--danger)' : 'var(--success)',
              boxShadow: isAlert ? '0 0 8px var(--danger)' : '0 0 8px var(--success)',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 0',
          }}
        >
          <h2
            className={isAlert ? 'emergency-pulse' : ''}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '48px',
              fontWeight: 900,
              color: isAlert ? 'var(--danger)' : 'var(--success)',
              margin: 0,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              textShadow: isAlert ? '0 0 20px rgba(239, 68, 68, 0.4)' : 'none',
            }}
          >
            {isAlert ? 'ALERT' : 'SAFE'}
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-secondary)',
              margin: '4px 0 0 0',
              letterSpacing: '0.05em',
            }}
          >
            {isAlert ? 'THREAT DETECTED' : 'ALL SECTORS SECURE'}
          </p>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
          <div
            style={{
              backgroundColor: '#121317',
              border: '1px solid #363942',
              padding: '10px',
              textAlign: 'center',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <span
              style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                color: 'var(--text-secondary)',
                marginBottom: '4px',
              }}
            >
              INCIDENTS
            </span>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '20px',
                fontWeight: 700,
                color: incidentsToday > 0 ? 'var(--danger)' : 'var(--text-primary)',
              }}
            >
              {incidentsToday}
            </span>
          </div>

          <div
            style={{
              backgroundColor: '#121317',
              border: '1px solid #363942',
              padding: '10px',
              textAlign: 'center',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <span
              style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                color: 'var(--text-secondary)',
                marginBottom: '4px',
              }}
            >
              AI CONFIDENCE
            </span>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--accent)',
              }}
            >
              {(aiConfidence * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Environment Telemetry */}
      <div
        style={{
          backgroundColor: '#181c23',
          border: '1px solid #363942',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          flex: 1,
        }}
      >
        <div
          style={{
            padding: '2px 8px 6px 8px',
            borderBottom: '1px solid #363942',
            marginBottom: '16px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Environment Telemetry
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 8px' }}>
          {/* Ambient Temp */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                marginBottom: '6px',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>Ambient Temp (Avg)</span>
              <span style={{ color: isAlert ? 'var(--danger)' : 'var(--text-primary)', fontWeight: 600 }}>
                {temp.toFixed(1)}°C
              </span>
            </div>
            <div style={{ height: '4px', backgroundColor: '#121317', border: '1px solid #363942', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  backgroundColor: isAlert ? 'var(--danger)' : 'var(--success)',
                  width: `${tempPct}%`,
                  transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1), background-color 1s ease',
                }}
              />
            </div>
          </div>

          {/* Smoke PPM */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                marginBottom: '6px',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>Smoke Particulates</span>
              <span style={{ color: isAlert ? 'var(--danger)' : 'var(--text-primary)', fontWeight: 600 }}>
                {smoke} PPM
              </span>
            </div>
            <div style={{ height: '4px', backgroundColor: '#121317', border: '1px solid #363942', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  backgroundColor: isAlert ? 'var(--danger)' : 'var(--success)',
                  width: `${smokePct}%`,
                  transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1), background-color 1s ease',
                }}
              />
            </div>
          </div>

          {/* Thermal Anomalies */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                marginBottom: '6px',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>Thermal Anomalies</span>
              <span style={{ color: isAlert ? 'var(--danger)' : 'var(--text-primary)', fontWeight: 600 }}>
                {thermalAnomalies}
              </span>
            </div>
            <div style={{ height: '4px', backgroundColor: '#121317', border: '1px solid #363942', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  backgroundColor: isAlert ? 'var(--danger)' : 'var(--success)',
                  width: `${thermalPct}%`,
                  transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1), background-color 1s ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* Trend Graph */}
        <div
          style={{
            marginTop: '24px',
            height: '96px',
            border: '1px solid #363942',
            backgroundColor: '#121317',
            padding: '8px',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              color: 'var(--text-muted)',
              zIndex: 5,
            }}
          >
            24H TEMP TREND
          </span>
          <svg
            style={{ width: '100%', height: '100%', opacity: 0.5 }}
            preserveAspectRatio="none"
            viewBox="0 0 100 30"
          >
            <path
              d={tempTrend}
              fill="none"
              stroke={isAlert ? 'var(--danger)' : 'var(--accent)'}
              strokeWidth="1.5"
              style={{ transition: 'd 1s ease, stroke 1s ease' }}
            />
          </svg>
        </div>
      </div>

      {/* Simulation Controls Panel (Developer Mode) */}
      <div
        style={{
          backgroundColor: '#181c23',
          border: '1px solid #363942',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '2px 8px 6px 8px',
            borderBottom: '1px solid #363942',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Threat Simulator
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
          <label style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
            TARGET SECTOR ZONE
          </label>
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            style={{
              backgroundColor: '#11151c',
              border: '1px solid #363942',
              color: '#fff',
              fontSize: '11px',
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <option value="CAM_01">North Server Room (CAM 01)</option>
            <option value="CAM_04">East Lab Corridor (CAM 04)</option>
            <option value="CAM_08">South Lobby Array (CAM 08)</option>
            <option value="CAM_12">West Loading Gate (CAM 12)</option>
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            onClick={() => handleTriggerSimulation('fire')}
            style={{
              padding: '6px 8px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: 'var(--danger)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Simulate Fire
          </button>
          <button
            onClick={() => handleTriggerSimulation('smoke')}
            style={{
              padding: '6px 8px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: 'var(--warning)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Simulate Smoke
          </button>
        </div>
      </div>
    </div>
  );
}
