import type { AlarmStatus } from '../../types';

interface EvacuationMapProps {
  alarmStatus?: AlarmStatus | null;
}

export default function EvacuationMap({ alarmStatus }: EvacuationMapProps) {
  const isAlert = alarmStatus?.state === 'triggered' || alarmStatus?.state === 'active';
  const compromisedDevice = isAlert ? alarmStatus?.device_id || 'CAM_01' : null;

  // Define facility sectors and map device_id to them
  const sectors = [
    {
      id: 'CAM_01',
      name: 'North Server Room',
      x: 300,
      y: 40,
      width: 200,
      height: 100,
      labelX: 400,
      labelY: 95,
    },
    {
      id: 'CAM_04',
      name: 'East Lab Corridor',
      x: 530,
      y: 180,
      width: 220,
      height: 120,
      labelX: 640,
      labelY: 245,
    },
    {
      id: 'CAM_08',
      name: 'South Lobby Array',
      x: 280,
      y: 340,
      width: 240,
      height: 100,
      labelX: 400,
      labelY: 395,
    },
    {
      id: 'CAM_12',
      name: 'West Loading Gate',
      x: 50,
      y: 180,
      width: 220,
      height: 120,
      labelX: 160,
      labelY: 245,
    },
  ];

  // Determine blocked exits based on compromised sector
  // Exits: A (North), B (East), C (West)
  const isExitBlocked = {
    A: compromisedDevice === 'CAM_01', // Block North Exit
    B: compromisedDevice === 'CAM_04' || compromisedDevice === 'CAM_08', // Block East Exit
    C: compromisedDevice === 'CAM_12' || compromisedDevice === 'MANUAL_PANIC', // Block West Exit
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#11151c',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        color: '#fff',
        fontFamily: 'var(--font-sans)',
        minHeight: 0,
        position: 'relative',
        boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.6)',
      }}
    >
      {/* Dynamic Keyframe Animations */}
      <style>{`
        @keyframes pulse-compromised {
          0% { fill: rgba(239, 68, 68, 0.15); stroke: rgba(239, 68, 68, 0.8); }
          50% { fill: rgba(239, 68, 68, 0.4); stroke: rgba(239, 68, 68, 1); }
          100% { fill: rgba(239, 68, 68, 0.15); stroke: rgba(239, 68, 68, 0.8); }
        }
        @keyframes pulse-blocked-exit {
          0% { fill: rgba(239, 68, 68, 0.8); r: 12; }
          50% { fill: rgba(220, 38, 38, 1); r: 16; }
          100% { fill: rgba(239, 68, 68, 0.8); r: 12; }
        }
        @keyframes pulse-safe-exit {
          0% { fill: rgba(16, 185, 129, 0.8); r: 12; }
          50% { fill: rgba(5, 150, 105, 1); r: 15; }
          100% { fill: rgba(16, 185, 129, 0.8); r: 12; }
        }
        @keyframes flow-route-green {
          to { stroke-dashoffset: -20; }
        }
        @keyframes pulse-text {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; text-shadow: 0 0 8px rgba(239, 68, 68, 0.8); }
        }
      `}</style>

      {/* Map Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '8px',
          flexShrink: 0,
        }}
      >
        <div>
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            📍 Live Evacuation Wayfinding Blueprint
          </span>
          <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
            {isAlert 
              ? `🔥 THREAT DETECTED IN ${compromisedDevice === 'MANUAL_PANIC' ? 'SYSTEM' : sectors.find(s => s.id === compromisedDevice)?.name || 'UNKNOWN ZONE'}` 
              : '✅ ALL EVACUATION EXITS CLEAR - STATUS STABLE'}
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '12px', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            <span>SAFE EXIT</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
            <span>BLOCKED EXIT</span>
          </div>
        </div>
      </div>

      {/* SVG Map Layout */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg
          viewBox="0 0 800 480"
          style={{
            width: '100%',
            height: '100%',
            maxHeight: '400px',
            backgroundColor: '#0a0d14',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          {/* Tech Grid Background pattern */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.02)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* CENTRAL HALLWAY (Hub) */}
          <rect
            x="300"
            y="180"
            width="200"
            height="120"
            fill="rgba(255, 255, 255, 0.02)"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text
            x="400"
            y="245"
            textAnchor="middle"
            fill="rgba(255, 255, 255, 0.25)"
            fontSize="10"
            fontFamily="var(--font-mono)"
            letterSpacing="0.1em"
          >
            MAIN HUB / CONCOURSE
          </text>

          {/* Draw Corridors */}
          {/* North Corridor */}
          <rect x="375" y="140" width="50" height="40" fill="rgba(255, 255, 255, 0.03)" stroke="rgba(255, 255, 255, 0.1)" />
          {/* East Corridor */}
          <rect x="500" y="220" width="30" height="40" fill="rgba(255, 255, 255, 0.03)" stroke="rgba(255, 255, 255, 0.1)" />
          {/* South Corridor */}
          <rect x="375" y="300" width="50" height="40" fill="rgba(255, 255, 255, 0.03)" stroke="rgba(255, 255, 255, 0.1)" />
          {/* West Corridor */}
          <rect x="270" y="220" width="30" height="40" fill="rgba(255, 255, 255, 0.03)" stroke="rgba(255, 255, 255, 0.1)" />

          {/* SECTORS / ROOMS */}
          {sectors.map((sector) => {
            const isCompromised = compromisedDevice === sector.id || compromisedDevice === 'MANUAL_PANIC';
            return (
              <g key={sector.id}>
                {/* Room bounding box */}
                <rect
                  x={sector.x}
                  y={sector.y}
                  width={sector.width}
                  height={sector.height}
                  rx="6"
                  ry="6"
                  style={{
                    animation: isCompromised ? 'pulse-compromised 2s infinite' : 'none',
                    fill: isCompromised ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.01)',
                    stroke: isCompromised ? '#ef4444' : 'rgba(0, 198, 255, 0.3)',
                    strokeWidth: isCompromised ? 2 : 1.5,
                    transition: 'all 0.5s ease',
                  }}
                />
                
                {/* Sector Label */}
                <text
                  x={sector.labelX}
                  y={sector.y + 35}
                  textAnchor="middle"
                  fill={isCompromised ? '#ef4444' : 'var(--text-primary)'}
                  fontSize="11"
                  fontWeight="700"
                  letterSpacing="0.02em"
                  style={{ animation: isCompromised ? 'pulse-text 2s infinite' : 'none' }}
                >
                  {sector.name.toUpperCase()}
                </text>

                {/* Device ID / Camera Tag */}
                <text
                  x={sector.labelX}
                  y={sector.y + 55}
                  textAnchor="middle"
                  fill="rgba(255, 255, 255, 0.4)"
                  fontSize="8"
                  fontFamily="var(--font-mono)"
                >
                  {sector.id} {isCompromised ? '[HAZARD AREA]' : '[SECURE]'}
                </text>
              </g>
            );
          })}

          {/* DYNAMIC EVACUATION PATHS (FLOW LINES) */}
          {/* Route 1: North Server Room to Central Hub */}
          <path
            d="M 400 140 L 400 180"
            fill="none"
            stroke={isExitBlocked.A ? '#ef4444' : '#10b981'}
            strokeWidth="3"
            strokeDasharray={isExitBlocked.A ? 'none' : '6 4'}
            style={{
              animation: isExitBlocked.A ? 'none' : 'flow-route-green 1s linear infinite',
              opacity: isExitBlocked.A ? 0.3 : 0.8,
            }}
          />

          {/* Route 2: East Lab to Central Hub */}
          <path
            d="M 530 240 L 500 240"
            fill="none"
            stroke={isExitBlocked.B ? '#ef4444' : '#10b981'}
            strokeWidth="3"
            strokeDasharray={isExitBlocked.B ? 'none' : '6 4'}
            style={{
              animation: isExitBlocked.B ? 'none' : 'flow-route-green 1s linear infinite',
              opacity: isExitBlocked.B ? 0.3 : 0.8,
            }}
          />

          {/* Route 3: South Lobby to Central Hub */}
          <path
            d="M 400 340 L 400 300"
            fill="none"
            stroke={isExitBlocked.B ? '#ef4444' : '#10b981'}
            strokeWidth="3"
            strokeDasharray={isExitBlocked.B ? 'none' : '6 4'}
            style={{
              animation: isExitBlocked.B ? 'none' : 'flow-route-green 1s linear infinite',
              opacity: isExitBlocked.B ? 0.3 : 0.8,
            }}
          />

          {/* Route 4: West Gate to Central Hub */}
          <path
            d="M 270 240 L 300 240"
            fill="none"
            stroke={isExitBlocked.C ? '#ef4444' : '#10b981'}
            strokeWidth="3"
            strokeDasharray={isExitBlocked.C ? 'none' : '6 4'}
            style={{
              animation: isExitBlocked.C ? 'none' : 'flow-route-green 1s linear infinite',
              opacity: isExitBlocked.C ? 0.3 : 0.8,
            }}
          />

          {/* Central Hub Escape Branches to Exits */}
          {/* Hub to Exit A (North Exit) */}
          <path
            d="M 400 180 L 400 10"
            fill="none"
            stroke={isExitBlocked.A ? '#ef4444' : '#10b981'}
            strokeWidth="4"
            strokeDasharray={isExitBlocked.A ? 'none' : '8 6'}
            style={{
              animation: isExitBlocked.A ? 'none' : 'flow-route-green 0.8s linear infinite',
              opacity: isExitBlocked.A ? 0.2 : 1,
            }}
          />

          {/* Hub to Exit B (East Exit) */}
          <path
            d="M 450 240 L 780 240"
            fill="none"
            stroke={isExitBlocked.B ? '#ef4444' : '#10b981'}
            strokeWidth="4"
            strokeDasharray={isExitBlocked.B ? 'none' : '8 6'}
            style={{
              animation: isExitBlocked.B ? 'none' : 'flow-route-green 0.8s linear infinite',
              opacity: isExitBlocked.B ? 0.2 : 1,
            }}
          />

          {/* Hub to Exit C (West Exit) */}
          <path
            d="M 350 240 L 20 240"
            fill="none"
            stroke={isExitBlocked.C ? '#ef4444' : '#10b981'}
            strokeWidth="4"
            strokeDasharray={isExitBlocked.C ? 'none' : '8 6'}
            style={{
              animation: isExitBlocked.C ? 'none' : 'flow-route-green 0.8s linear infinite',
              opacity: isExitBlocked.C ? 0.2 : 1,
            }}
          />

          {/* PHYSICAL EXITS (Outer Circles with exit labels) */}
          {/* EXIT A - NORTH */}
          <g>
            <circle
              cx="400"
              cy="10"
              style={{
                animation: isExitBlocked.A ? 'pulse-blocked-exit 1.5s infinite' : 'pulse-safe-exit 1.5s infinite',
                transition: 'all 0.5s ease',
              }}
            />
            <text x="400" cy="14" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="var(--font-mono)">
              {isExitBlocked.A ? '✕' : 'A'}
            </text>
            <text x="400" y="-12" textAnchor="middle" fill={isExitBlocked.A ? '#ef4444' : '#10b981'} fontSize="9" fontWeight="bold">
              EXIT A {isExitBlocked.A ? '[BLOCKED]' : '[SAFE]'}
            </text>
          </g>

          {/* EXIT B - EAST */}
          <g>
            <circle
              cx="780"
              cy="240"
              style={{
                animation: isExitBlocked.B ? 'pulse-blocked-exit 1.5s infinite' : 'pulse-safe-exit 1.5s infinite',
                transition: 'all 0.5s ease',
              }}
            />
            <text x="780" cy="244" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="var(--font-mono)">
              {isExitBlocked.B ? '✕' : 'B'}
            </text>
            <text x="780" y="215" textAnchor="end" fill={isExitBlocked.B ? '#ef4444' : '#10b981'} fontSize="9" fontWeight="bold">
              EXIT B {isExitBlocked.B ? '[BLOCKED]' : '[SAFE]'}
            </text>
          </g>

          {/* EXIT C - WEST */}
          <g>
            <circle
              cx="20"
              cy="240"
              style={{
                animation: isExitBlocked.C ? 'pulse-blocked-exit 1.5s infinite' : 'pulse-safe-exit 1.5s infinite',
                transition: 'all 0.5s ease',
              }}
            />
            <text x="20" cy="244" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="var(--font-mono)">
              {isExitBlocked.C ? '✕' : 'C'}
            </text>
            <text x="20" y="215" textAnchor="start" fill={isExitBlocked.C ? '#ef4444' : '#10b981'} fontSize="9" fontWeight="bold">
              EXIT C {isExitBlocked.C ? '[BLOCKED]' : '[SAFE]'}
            </text>
          </g>

        </svg>
      </div>

      {/* Dynamic Evacuation Action Instructions */}
      <div
        style={{
          marginTop: '12px',
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: isAlert ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.05)',
          border: `1px solid ${isAlert ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)'}`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: isAlert ? '#ef4444' : '#10b981', fontWeight: 700, letterSpacing: '0.04em' }}>
          {isAlert ? '🚨 EMERGENCY ACTION DIRECTIVE' : '🛡️ ROUTINE COMPLIANCE STATUS'}
        </span>
        <p style={{ fontSize: '11px', color: '#e2e8f0', margin: '4px 0 0 0', lineHeight: '1.4' }}>
          {isAlert 
            ? `Hazard in Sector ${sectors.find(s => s.id === compromisedDevice)?.name || 'System'}. Exit ${isExitBlocked.A ? 'A (North Corridor)' : isExitBlocked.B ? 'B (East Gate Corridor)' : 'C (West Main Gate)'} is compromised. Instruct all personnel to use the active green flashing routes toward safe exits.` 
            : 'Facility status secure. Evacuation routes are fully operational. Weekly fire drills scheduled on Friday at 10:00 AM.'}
        </p>
      </div>
    </div>
  );
}
