/**
 * FireGuard AI — Keyboard Navigation Hook
 *
 * Handles global keyboard shortcuts:
 *   Ctrl+1 → Monitoring
 *   Ctrl+2 → Incidents
 *   Ctrl+3 → Analytics
 *   Ctrl+4 → System/Settings
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ROUTE_MAP: Record<string, string> = {
  '1': '/',
  '2': '/incidents',
  '3': '/analytics',
  '4': '/system',
};

export function useKeyboardNav() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+1-4 for route navigation
      if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        const route = ROUTE_MAP[e.key];
        if (route) {
          e.preventDefault();
          navigate(route);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
}
