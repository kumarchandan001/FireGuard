/**
 * FireGuard AI — WebSocket Hook
 *
 * React hook managing the WebSocket connection lifecycle.
 * Auto-reconnects on disconnect and provides parsed messages
 * with type discrimination.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WSMessage, AlarmStatus, Detection } from '../types';
import { WS_RECONNECT_DELAY_MS, WS_MAX_RECONNECT_ATTEMPTS } from '../utils/constants';

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

interface UseWebSocketReturn {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Latest camera frame as base64 */
  latestFrame: string | null;
  /** Current FPS from the camera */
  fps: number;
  /** Current detections in the frame */
  detections: Detection[];
  /** Current alarm status */
  alarmStatus: AlarmStatus | null;
  /** Send a command to the server */
  sendCommand: (action: string) => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [latestFrame, setLatestFrame] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [alarmStatus, setAlarmStatus] = useState<AlarmStatus | null>(null);

  const connect = useCallback(() => {
    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws/feed`;

    setConnectionState('connecting');
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnectionState('connected');
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'frame':
            setLatestFrame(message.data.image);
            setFps(message.data.fps);
            setDetections(message.data.detections);
            break;

          case 'alarm':
            setAlarmStatus(message.data);
            break;

          case 'status':
            // Future: update system status
            break;

          case 'incident':
            // Future: push notification
            break;
        }
      } catch {
        // Malformed message — ignore
      }
    };

    ws.onclose = () => {
      setConnectionState('disconnected');
      wsRef.current = null;

      // Auto-reconnect
      if (reconnectAttempts.current < WS_MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current += 1;
        reconnectTimer.current = setTimeout(connect, WS_RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  const sendCommand = useCallback((action: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'command', action }));
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    connectionState,
    latestFrame,
    fps,
    detections,
    alarmStatus,
    sendCommand,
  };
}
