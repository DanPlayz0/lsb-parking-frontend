const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://lsb-api.compiles.me').replace(/\/$/, '');

type EndpointString = `/${string}`;

async function fetchUpstream<T>(endpoint: EndpointString): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
  return response.json() as Promise<T>;
}

export interface PlugSnapshot {
  outlet_number: number;
  status: string;
  updated_at: string;
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
  data: LatestSnapshot[];
}

export type RealtimeMessage = SnapshotMessage | StationUpdateMessage;

export function fetchLatestSnapshots({ include_faculty_parking = true } = {}) {
  return fetchUpstream<LatestSnapshot[]>(`/snapshots?include_faculty_parking=${include_faculty_parking}`);
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
export const availablePlugCount = (station: LatestSnapshot) => station.plugs.filter(isPlugAvailable).length;
export const usedPlugCount = (station: LatestSnapshot) => station.plugs.filter(isPlugInUse).length;

export function latestStationUpdate(station: LatestSnapshot) {
  return station.plugs.reduce((latest, plug) => {
    const updatedAt = new Date(plug.updated_at).getTime();
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
