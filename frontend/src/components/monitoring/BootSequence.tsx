/**
 * FireGuard AI — Boot Sequence
 *
 * Terminal-style animated startup screen.
 * Systems come online one by one, then fades to monitoring.
 */

import { useState, useEffect } from 'react';

const BOOT_LINES = [
  { text: '╔══════════════════════════════════════╗', delay: 0 },
  { text: '║     FIREGUARD AI  v1.0.0             ║', delay: 150 },
  { text: '║     Intelligent Fire Detection       ║', delay: 200 },
  { text: '╚══════════════════════════════════════╝', delay: 250 },
  { text: '', delay: 400 },
  { text: '[INIT] Loading core modules...', delay: 500 },
  { text: '[  ✓ ] Database connection established', delay: 900 },
  { text: '[  ✓ ] Event bus initialized', delay: 1200 },
  { text: '[  ✓ ] WebSocket server ready', delay: 1500 },
  { text: '[  ✓ ] AI model loaded — YOLOv8 (fire detection)', delay: 1900 },
  { text: '[  ✓ ] Camera service initialized', delay: 2200 },
  { text: '[  ✓ ] Alarm state machine: IDLE', delay: 2500 },
  { text: '', delay: 2700 },
  { text: '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ALL SYSTEMS OPERATIONAL', delay: 2900 },
  { text: '', delay: 3100 },
  { text: 'Entering monitoring mode...', delay: 3200 },
];

export default function BootSequence() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    BOOT_LINES.forEach((line, index) => {
      const timer = setTimeout(() => {
        setVisibleLines(index + 1);
      }, line.delay);
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          lineHeight: 1.8,
          color: '#00ff41',
          maxWidth: '600px',
          width: '100%',
          padding: '40px',
        }}
      >
        {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
          <div
            key={i}
            style={{
              opacity: line.text === '' ? 0 : 1,
              height: line.text === '' ? '12px' : 'auto',
              color:
                line.text.includes('✓')
                  ? '#00ff41'
                  : line.text.includes('ALL SYSTEMS')
                    ? '#00d4ff'
                    : line.text.includes('FIREGUARD')
                      ? '#ffffff'
                      : line.text.includes('Entering')
                        ? '#666'
                        : '#00cc33',
              fontWeight: line.text.includes('ALL SYSTEMS') || line.text.includes('FIREGUARD') ? 700 : 400,
            }}
          >
            {line.text}
          </div>
        ))}
        {visibleLines < BOOT_LINES.length && (
          <span className="cursor-blink" style={{ color: '#00ff41' }} />
        )}
      </div>
    </div>
  );
}
