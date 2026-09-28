import { useCallback, useEffect, useState } from 'react';
import {
  createSnapshotSocket,
  fetchLatestSnapshots,
  isRealtimeMessage,
  type LatestSnapshot,
} from '../api';

export type RealtimeStatus = 'connecting' | 'live' | 'polling';

const POLL_INTERVAL_MS = 15_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const HIDDEN_TIMEOUT_MS = 2 * 60_000;

function mergeStations(current: LatestSnapshot[], updates: LatestSnapshot[]) {
  const merged = new Map(current.map((station) => [station.device_id, station]));
  updates.forEach((station) => merged.set(station.device_id, station));
  return [...merged.values()];
}

export function useLiveSnapshots() {
  const [snapshots, setSnapshots] = useState<LatestSnapshot[]>([]);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [paused, setPaused] = useState(false);
  const forceRefresh = useCallback(() => setRefreshVersion((version) => version + 1), []);

  useEffect(() => {
    let needsRefresh = document.visibilityState === 'hidden';
    let hiddenTimer: number | null = null;
    const clearHiddenTimer = () => {
      if (hiddenTimer !== null) window.clearTimeout(hiddenTimer);
      hiddenTimer = null;
    };
    const startHiddenTimer = () => {
      if (hiddenTimer !== null) return;
      hiddenTimer = window.setTimeout(() => {
        hiddenTimer = null;
        if (document.visibilityState === 'hidden') setPaused(true);
      }, HIDDEN_TIMEOUT_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === 'hidden') return;
      clearHiddenTimer();
      if (!needsRefresh) return;
      needsRefresh = false;
      setPaused(false);
      forceRefresh();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        needsRefresh = true;
        startHiddenTimer();
      }
      else onVisible();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      needsRefresh = true;
      onVisible();
    };

    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (document.visibilityState === 'hidden') startHiddenTimer();
    return () => {
      clearHiddenTimer();
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [forceRefresh]);

  useEffect(() => {
    if (paused) return;
    let disposed = false;
    const controller = new AbortController();
    let socket: WebSocket | null = null;
    let pollTimer: number | null = null;
    let reconnectTimer: number | null = null;
    let reconnectDelay = 1_000;

    const applySnapshot = (data: LatestSnapshot[]) => {
      if (disposed) return;
      setSnapshots(data);
      setRefreshedAt(new Date());
    };

    const poll = async () => {
      try {
        applySnapshot(await fetchLatestSnapshots({ signal: controller.signal }));
      } catch (error) {
        if (disposed) return;
        console.error('Unable to poll station snapshots:', error);
      }
    };

    const startPolling = () => {
      if (pollTimer !== null || disposed) return;
      setStatus('polling');
      void poll();
      pollTimer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (pollTimer === null) return;
      window.clearInterval(pollTimer);
      pollTimer = null;
    };

    const connect = () => {
      if (disposed) return;

      try {
        socket = createSnapshotSocket();
      } catch (error) {
        console.error('Unable to create station WebSocket:', error);
        startPolling();
        reconnectTimer = window.setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
        return;
      }

      socket.onopen = () => {
        reconnectDelay = 1_000;
        stopPolling();
        setStatus('live');
      };

      socket.onmessage = (event) => {
        try {
          const message: unknown = JSON.parse(String(event.data));
          if (!isRealtimeMessage(message)) return;

          if (message.type === 'snapshot') {
            applySnapshot(message.data);
          } else {
            if (import.meta.env.VITE_LOGGING_DEBUG === 'true') {
              console.debug('station_received', {
                fetchedAt: message.fetchedAt,
                publishedAt: message.publishedAt,
                broadcastAt: message.broadcastAt,
                receivedAt: new Date().toISOString(),
              });
            }
            setSnapshots((current) => mergeStations(current, message.data));
            setRefreshedAt(new Date());
          }
        } catch (error) {
          console.error('Unable to process station WebSocket message:', error);
        }
      };

      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (disposed) return;
        socket = null;
        startPolling();
        reconnectTimer = window.setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
      };
    };

    startPolling();
    connect();

    return () => {
      disposed = true;
      controller.abort();
      stopPolling();
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, [refreshVersion, paused]);

  return { snapshots, refreshedAt, status: paused ? 'paused' as const : status, forceRefresh, paused };
}
