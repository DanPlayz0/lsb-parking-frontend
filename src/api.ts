const API_BASE_URL = 'https://lsb-api.compiles.me';
// const API_BASE_URL = 'http://localhost:8001';

type EndpointString = `/${string}`;

function fetchUpstream<T=any>(endpoint: EndpointString) {
  return new Promise<T>((resolve, reject) => {
    if (force_fail) reject('Failed to fetch upstream');
    try {
      fetch(`${API_BASE_URL}${endpoint}`, {
        cache: 'no-cache',
      })
        .then((response) => {
          if (response.status === 200) return resolve(response.json() as Promise<T>);
          else return reject('Failed to fetch upstream');
        })
        .catch((error) => reject(error));
    } catch (error) {
      reject(error);
    }
  });
}

export interface Snapshot {
  device_id: number;
  timestamp: string;
  available: number;
  used: number;
  total: number;
}

export interface LatestSnapshot extends Snapshot {
  name: string;
}

const force_fail = false;

export function fetchLatestSnapshots({ include_faculty_parking = true } = {}) {
  return fetchUpstream<LatestSnapshot[]>(`/snapshots?include_faculty_parking=${include_faculty_parking}`);
}

export interface AllTimeWeeklyHourlyAverage {
  day_of_week_num: string;
  hour_num: string;
  hour_label: string;
  avg_available: string;
}

export function fetchWeeklyHourlyAverages() {
  return fetchUpstream<AllTimeWeeklyHourlyAverage[]>(`/weekly-hourly/alltime`);
}

export interface ThisWeeklyHourlyAverage {
  calendar_date: string;
  day_of_week_num: string;
  hour_num: string;
  hour_label: string;
  avg_available: string;
}

export function fetchThisWeeklyHourlyAverages() {
  return fetchUpstream<ThisWeeklyHourlyAverage[]>(`/weekly-hourly/thisweek`);
}

export function fetchSnapshotHistory(device_id: number) {
  return fetchUpstream<Snapshot[]>(`/snapshots/${device_id}`);
}
