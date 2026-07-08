/**
 * FireGuard AI — Alarm Audio Hook
 *
 * Generates a repeating alert tone using Web Audio API (no file dependency).
 * Oscillates between 800Hz and 600Hz, 500ms on / 500ms off.
 * Auto-starts when alarm is triggered/active, stops on acknowledge/dismiss.
 * Mute state persisted to localStorage.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AlarmState } from '../types';

interface UseAlarmAudioOptions {
  alarmState: AlarmState | undefined;
}

interface UseAlarmAudioReturn {
  isMuted: boolean;
  isPlaying: boolean;
  toggleMute: () => void;
}

const MUTE_STORAGE_KEY = 'fireguard_alarm_muted';

export function useAlarmAudio({ alarmState }: UseAlarmAudioOptions): UseAlarmAudioReturn {
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [isPlaying, setIsPlaying] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const isAlarmActive = alarmState === 'triggered' || alarmState === 'active';

  const startTone = useCallback(() => {
    if (audioCtxRef.current) return; // already playing

    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();

      audioCtxRef.current = ctx;
      oscillatorRef.current = oscillator;
      gainRef.current = gain;

      // Oscillate between 800Hz and 600Hz every 500ms
      let high = true;
      intervalRef.current = setInterval(() => {
        if (oscillatorRef.current && audioCtxRef.current) {
          high = !high;
          oscillatorRef.current.frequency.setValueAtTime(
            high ? 800 : 600,
            audioCtxRef.current.currentTime,
          );
          // Brief silence gap between tones
          if (gainRef.current) {
            gainRef.current.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
            gainRef.current.gain.setValueAtTime(0.15, audioCtxRef.current.currentTime + 0.05);
          }
        }
      }, 500);

      setIsPlaying(true);
    } catch {
      // Web Audio API not available
    }
  }, []);

  const stopTone = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
    if (oscillatorRef.current) {
      try { oscillatorRef.current.stop(); } catch { /* already stopped */ }
      oscillatorRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* already closed */ }
      audioCtxRef.current = null;
    }
    gainRef.current = null;
    setIsPlaying(false);
  }, []);

  // Start/stop based on alarm state and mute
  useEffect(() => {
    if (isAlarmActive && !isMuted) {
      startTone();
    } else {
      stopTone();
    }

    return () => {
      stopTone();
    };
  }, [isAlarmActive, isMuted, startTone, stopTone]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTE_STORAGE_KEY, String(next));
      } catch { /* quota exceeded */ }
      return next;
    });
  }, []);

  return { isMuted, isPlaying, toggleMute };
}
