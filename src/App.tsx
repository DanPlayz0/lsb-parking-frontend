import { useMemo, useState } from 'react';
import './App.css';
import {
  fetchLatestSnapshots,
  fetchWeeklyHourlyAverages,
  type LatestSnapshot,
  type AllTimeWeeklyHourlyAverage,
  type ThisWeeklyHourlyAverage,
  fetchThisWeeklyHourlyAverages,
} from './api';
import ParkingCanvas from './components/parking-canvas';
import { useAlignedInterval } from './utils/useAlignedInterval';
import RelativeTime from './components/relative-time';
import { BarChart } from '@mui/x-charts';

function sortSnaps(snapshots: LatestSnapshot[], sort: string) {
  if (sort === 'name') {
    snapshots.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'last_updated') {
    snapshots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } else if (sort === 'available') {
    snapshots.sort((a, b) => b.available - a.available);
  } else if (sort === 'inUse') {
    snapshots.sort((a, b) => b.used - a.used);
  } else if (sort === 'total') {
    snapshots.sort((a, b) => b.total - a.total);
  }
  return snapshots;
}

function formatChartLabel(data: AllTimeWeeklyHourlyAverage | ThisWeeklyHourlyAverage) {
  return (
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][Number(data.day_of_week_num)] +
    ' ' +
    data.hour_label +
    ' PST' +
    ' - ' +
    (data.avg_available ? data.avg_available : 0) +
    ' avg available'
  );
}

function App() {
  const [rawLatestSnapshots, setRawLatestSnapshots] = useState<LatestSnapshot[]>([]);
  const [weeklyHourly, setWeeklyHourly] = useState<AllTimeWeeklyHourlyAverage[]>([]);
  const [thisWeeklyHourly, setThisWeeklyHourly] = useState<ThisWeeklyHourlyAverage[]>([]);
  const [parkingFaculty, setParkingFaculty] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('name');
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  // Cache/Memoize the result based on last fetched data (preventing spam of api calls)
  const latestSnapshots = useMemo(() => {
    return sortSnaps([...rawLatestSnapshots], sortBy).filter((snap) => (parkingFaculty ? true : !snap.name.includes('P3')));
  }, [rawLatestSnapshots, sortBy, parkingFaculty]);

  useAlignedInterval(() => {
    fetchLatestSnapshots().then((data) => {
      setRawLatestSnapshots(data);
      setRefreshedAt(new Date());
    });
    fetchWeeklyHourlyAverages().then((data) => {
      setWeeklyHourly(data);
    });
    fetchThisWeeklyHourlyAverages().then((data) => {
      setThisWeeklyHourly(data);
    });
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
              defaultValue={parkingFaculty.toString()}
              onChange={(e) => {
                setParkingFaculty(e.target.value === 'true');
              }}
            >
              <option value="true">Include</option>
              <option value="false">Exclude</option>
            </select>
          </div>
          <div>
            <label htmlFor="sort">Sort:</label>
            <select
              name="sort"
              id="sort"
              defaultValue={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
              }}
            >
              <option value="name">Name</option>
              <option value="timestamp">Timestamp</option>
              <option value="available">Spots - Available</option>
              <option value="inUse">Spots - In Use</option>
              <option value="total">Spots - Total</option>
            </select>
          </div>
        </div>

        <div id="snapshot-container">
          {latestSnapshots && (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Available</th>
                  <th>Age (s)</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {latestSnapshots.map((snapshot) => {
                  let deviceActivity: 'full' | 'almost-full' | 'empty' =
                    snapshot.available === 0 ? 'full' : snapshot.available / snapshot.total <= 0.2 ? 'almost-full' : 'empty';
                  let ageClass = `${deviceActivity} age`;
                  const ageInSeconds = Math.floor((new Date().getTime() - new Date(snapshot.timestamp).getTime()) / 1000);
                  if (deviceActivity === 'full') {
                    ageClass += ' color-red';
                  } else {
                    if (ageInSeconds <= 30 * 60) {
                      ageClass += ' color-green';
                    } else if (ageInSeconds >= 3 * 60 * 60) {
                      ageClass += ' color-red';
                    } else {
                      ageClass += ' color-orange';
                    }
                  }
                  return (
                    <tr key={snapshot.name} className={ageClass}>
                      <td>{snapshot.name}</td>
                      <td>{snapshot.available}</td>
                      <td
                        style={{
                          textAlign: 'left',
                        }}
                      >
                        <RelativeTime isoString={snapshot.timestamp} />
                      </td>
                      <td>
                        {new Date(snapshot.timestamp).toLocaleString('en', {
                          month: '2-digit',
                          day: '2-digit',
                          year: new Date(snapshot.timestamp).getFullYear() === new Date().getFullYear() ? undefined : '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {refreshedAt && (
            <p className="text-muted" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
              Last refreshed at: {refreshedAt?.toLocaleTimeString()}
            </p>
          )}
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
                  label: 'Average Available Spots (all time)',
                  data: weeklyHourly.map((point) => point.avg_available ? Number(point.avg_available) : 0),
                  valueFormatter: (_, context) => formatChartLabel(weeklyHourly[context.dataIndex]),
                },
                {
                  label: 'Average Available Spots (this week)',
                  data: thisWeeklyHourly.map((point) => point.avg_available ? Number(point.avg_available) : 0),
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
