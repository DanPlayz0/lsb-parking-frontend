import { useMemo, useState } from 'react';
import './App.css';
import {
  availablePlugCount,
  fetchThisWeeklyHourlyAverages,
  fetchWeeklyHourlyAverages,
  isPlugAvailable,
  isPlugInUse,
  latestStationUpdate,
  parseApiTimestamp,
  usedPlugCount,
  type AllTimeWeeklyHourlyAverage,
  type LatestSnapshot,
  type ThisWeeklyHourlyAverage,
} from './api';
import ParkingCanvas from './components/parking-canvas';
import { useAlignedInterval } from './utils/useAlignedInterval';
import { useLiveSnapshots } from './utils/useLiveSnapshots';
import RelativeTime from './components/relative-time';
import { BarChart } from '@mui/x-charts';

function sortStations(snapshots: LatestSnapshot[], sort: string) {
  if (sort === 'name') {
    snapshots.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'last_updated') {
    snapshots.sort((a, b) => latestStationUpdate(b) - latestStationUpdate(a));
  } else if (sort === 'available') {
    snapshots.sort((a, b) => availablePlugCount(b) - availablePlugCount(a));
  } else if (sort === 'in_use') {
    snapshots.sort((a, b) => usedPlugCount(b) - usedPlugCount(a));
  } else if (sort === 'total') {
    snapshots.sort((a, b) => b.outlet_count - a.outlet_count);
  }
  return snapshots;
}

function formatChartLabel(data: AllTimeWeeklyHourlyAverage | ThisWeeklyHourlyAverage) {
  const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][data.day_of_week_num];
  return `${day} ${data.hour_label} PST - ${data.avg_available || 0} avg available`;
}

function formatTimestamp(timestamp: string) {
  const date = parseApiTimestamp(timestamp);
  return date.toLocaleString('en', {
    month: '2-digit',
    day: '2-digit',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function stationStatusClass(station: LatestSnapshot) {
  if (station.plugs.length > 0 && station.plugs.every(isPlugAvailable)) return 'color-green';
  if (station.plugs.length > 0 && station.plugs.every(isPlugInUse)) return 'color-red';
  return 'color-orange';
}

function App() {
  const { snapshots: rawLatestSnapshots, refreshedAt, status } = useLiveSnapshots();
  const [weeklyHourly, setWeeklyHourly] = useState<AllTimeWeeklyHourlyAverage[]>([]);
  const [thisWeeklyHourly, setThisWeeklyHourly] = useState<ThisWeeklyHourlyAverage[]>([]);
  const [parkingFaculty, setParkingFaculty] = useState(false);
  const [sortBy, setSortBy] = useState('name');

  const latestSnapshots = useMemo(() => {
    const visible = rawLatestSnapshots.filter((station) => parkingFaculty || !station.name.includes('P3'));
    return sortStations([...visible], sortBy);
  }, [rawLatestSnapshots, sortBy, parkingFaculty]);

  useAlignedInterval(() => {
    void Promise.all([fetchWeeklyHourlyAverages(), fetchThisWeeklyHourlyAverages()])
      .then(([allTime, thisWeek]) => {
        setWeeklyHourly(allTime);
        setThisWeeklyHourly(thisWeek);
      })
      .catch((error) => console.error('Unable to refresh historical averages:', error));
  }, 15);

  return (
    <>
      <h1 className="non-standard-font title">LSB EV Parking Spots</h1>
      <div className="canvas-container">
        <ParkingCanvas latestSnapshots={rawLatestSnapshots} refreshedAt={refreshedAt} />
      </div>
      <div className="card">
        <div className="selection-row" id="snapshot-options">
          <div>
            <label htmlFor="faculty_parking">Faculty Parking:</label>
            <select
              name="faculty_parking"
              id="faculty_parking"
              value={parkingFaculty.toString()}
              onChange={(event) => setParkingFaculty(event.target.value === 'true')}
            >
              <option value="true">Include</option>
              <option value="false">Exclude</option>
            </select>
          </div>
          <div>
            <label htmlFor="sort">Sort:</label>
            <select name="sort" id="sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="name">Name</option>
              <option value="last_updated">Last updated</option>
              <option value="available">Plugs - Available</option>
              <option value="in_use">Plugs - In Use</option>
              <option value="total">Plugs - Total</option>
            </select>
          </div>
        </div>

        <div id="snapshot-container">
          <table>
            <thead>
              <tr>
                <th>Station</th>
                <th>Plug</th>
                <th>Status</th>
                <th>Age</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            {latestSnapshots.map((station) => (
              <tbody className="station-group" key={station.device_id}>
                {station.plugs.map((plug, index) => {
                  const statusClass = isPlugAvailable(plug) ? 'color-green' : isPlugInUse(plug) ? 'color-red' : 'color-orange';
                  return (
                    <tr key={`${station.device_id}-${plug.outlet_number}`} className={statusClass}>
                      {index === 0 && (
                        <td className={`station-name ${stationStatusClass(station)}`} rowSpan={station.plugs.length}>
                          {station.name}
                        </td>
                      )}
                      <td>{plug.outlet_number}</td>
                      <td>{plug.status}</td>
                      <td><RelativeTime isoString={plug.updated_at} /></td>
                      <td>{formatTimestamp(plug.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
          {latestSnapshots.length === 0 && <p className="text-muted">Waiting on station data…</p>}
          <div className="refresh-status">
            <span className={`connection-status ${status}`}>{status === 'live' ? 'Live' : status === 'polling' ? 'Polling' : 'Connecting'}</span>
            {refreshedAt && <span className="text-muted">Updated {refreshedAt.toLocaleTimeString()}</span>}
          </div>
        </div>

        <div>
          <h2 style={{ marginBottom: 0 }}>Snapshot Trends</h2>
          <p className="text-muted" style={{ marginTop: 0, fontSize: '0.8em' }}>
            * Data points are taken every minute
          </p>
          <div className="chart-container">
            <BarChart
              style={{ background: 'transparent' }}
              loading={weeklyHourly.length === 0 || thisWeeklyHourly.length === 0}
              series={[
                {
                  label: 'Average Available Plugs (all time)',
                  data: weeklyHourly.map((point) => point.avg_available || 0),
                  valueFormatter: (_, context) => formatChartLabel(weeklyHourly[context.dataIndex]),
                },
                {
                  label: 'Average Available Plugs (this week)',
                  data: thisWeeklyHourly.map((point) => point.avg_available || 0),
                  valueFormatter: (_, context) => formatChartLabel(thisWeeklyHourly[context.dataIndex]),
                },
              ]}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
