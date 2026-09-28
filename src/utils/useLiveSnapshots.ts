import { useEffect, useState } from 'react';
import {
  createSnapshotSocket,
  fetchLatestSnapshots,
  isRealtimeMessage,
  type LatestSnapshot,
} from '../api';

export type RealtimeStatus = 'connecting' | 'live' | 'polling';

const POLL_INTERVAL_MS = 15_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

function mergeStations(current: LatestSnapshot[], updates: LatestSnapshot[]) {
  const merged = new Map(current.map((station) => [station.device_id, station]));
  updates.forEach((station) => merged.set(station.device_id, station));
  return [...merged.values()];
}

export function useLiveSnapshots() {
  const [snapshots, setSnapshots] = useState<LatestSnapshot[]>([]);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    let disposed = false;
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
        applySnapshot(await fetchLatestSnapshots());
      } catch (error) {
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
      stopPolling();
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);

  return { snapshots, refreshedAt, status };
}
