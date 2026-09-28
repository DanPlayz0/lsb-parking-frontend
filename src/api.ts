const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://lsb-api.compiles.me').replace(/\/$/, '');

type EndpointString = `/${string}`;

async function fetchUpstream<T>(endpoint: EndpointString, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, { cache: 'no-cache', signal });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  return response.json() as Promise<T>;
}

export interface PlugSnapshot {
  outlet_number: number;
  status: string;
  updated_at: string;
}

const HAS_TIMEZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * The database historically returned UTC timestamps without an offset. Treat
 * those values as UTC instead of letting the browser interpret them as local
 * time. Offset-aware timestamps continue to be parsed normally.
 */
export function parseApiTimestamp(timestamp: string | Date) {
  if (timestamp instanceof Date) return timestamp;
  const normalized = HAS_TIMEZONE.test(timestamp) ? timestamp : `${timestamp}Z`;
  return new Date(normalized);
}

export interface LatestSnapshot {
  device_id: number;
  name: string;
  outlet_count: number;
  plugs: PlugSnapshot[];
}

export interface SnapshotMessage {
  type: 'snapshot';
  data: LatestSnapshot[];
}

export interface StationUpdateMessage {
  type: 'station_update';
  timestamp: string;
  fetchedAt?: string;
  publishedAt?: string;
  broadcastAt?: string;
  data: LatestSnapshot[];
}

export type RealtimeMessage = SnapshotMessage | StationUpdateMessage;

export function fetchLatestSnapshots({ include_faculty_parking = true, signal }: { include_faculty_parking?: boolean; signal?: AbortSignal } = {}) {
  return fetchUpstream<LatestSnapshot[]>(`/snapshots?include_faculty_parking=${include_faculty_parking}`, signal);
}

export function fetchStationHistory(deviceId: number, signal?: AbortSignal) {
  return fetchUpstream<PlugSnapshot[]>(`/stations/${deviceId}/history`, signal);
}

export function createSnapshotSocket({ include_faculty_parking = true } = {}) {
  const url = new URL(API_BASE_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/ws`;
  url.search = new URLSearchParams({ include_faculty_parking: String(include_faculty_parking) }).toString();
  return new WebSocket(url);
}

export function isRealtimeMessage(value: unknown): value is RealtimeMessage {
  if (typeof value !== 'object' || value === null) return false;
  const message = value as Partial<RealtimeMessage>;
  return (message.type === 'snapshot' || message.type === 'station_update') && Array.isArray(message.data);
}

const normalizedStatus = (status: string) => status.toLowerCase().replaceAll('_', '');

export const isPlugAvailable = (plug: PlugSnapshot) => normalizedStatus(plug.status) === 'available';
export const isPlugInUse = (plug: PlugSnapshot) => normalizedStatus(plug.status) === 'inuse';
export const isPlugUnknown = (plug: PlugSnapshot) => normalizedStatus(plug.status) === 'unknown';
export const availablePlugCount = (station: LatestSnapshot) => station.plugs.filter(isPlugAvailable).length;
export const usedPlugCount = (station: LatestSnapshot) => station.plugs.filter(isPlugInUse).length;

export function latestStationUpdate(station: LatestSnapshot) {
  return station.plugs.reduce((latest, plug) => {
    const updatedAt = parseApiTimestamp(plug.updated_at).getTime();
    return Number.isNaN(updatedAt) ? latest : Math.max(latest, updatedAt);
  }, 0);
}

export interface AllTimeWeeklyHourlyAverage {
  day_of_week_num: number;
  hour_num: number;
  hour_label: string;
  avg_available: number;
}

export function fetchWeeklyHourlyAverages() {
  return fetchUpstream<AllTimeWeeklyHourlyAverage[]>('/weekly-hourly/alltime');
}

export type ThisWeeklyHourlyAverage = AllTimeWeeklyHourlyAverage;

export function fetchThisWeeklyHourlyAverages() {
  return fetchUpstream<ThisWeeklyHourlyAverage[]>('/weekly-hourly/thisweek');
}
