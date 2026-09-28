import { useMemo, useState } from 'react';
import './App.css';
import {
  availablePlugCount,
  fetchThisWeeklyHourlyAverages,
  fetchWeeklyHourlyAverages,
  isPlugAvailable,
  isPlugInUse,
  isPlugUnknown,
  latestStationUpdate,
  parseApiTimestamp,
  usedPlugCount,
  type AllTimeWeeklyHourlyAverage,
  type LatestSnapshot,
  type ThisWeeklyHourlyAverage,
} from './api';
import ParkingCanvas from './components/parking-canvas';
import StationHistoryDialog from './components/station-history-dialog';
import { useAlignedInterval } from './utils/useAlignedInterval';
import { useLiveSnapshots } from './utils/useLiveSnapshots';
import RelativeTime from './components/relative-time';
import { BarChart } from '@mui/x-charts';
import useMediaQuery from '@mui/material/useMediaQuery';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ALL_TIME_COLOR = 'oklch(0.72 0.15 250)';
const THIS_WEEK_COLOR = 'oklch(0.82 0.16 80)';

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
  const day = DAY_NAMES[data.day_of_week_num];
  return `${day} ${data.hour_label} PT - ${data.avg_available.toFixed(2)} avg available`;
}

function formatHourLabel(hour: number) {
  const hour12 = hour % 12 || 12;
  return `${hour12.toString().padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

function weeklyHourKey(point: AllTimeWeeklyHourlyAverage) {
  return `${point.day_of_week_num}-${point.hour_num}`;
}

function fillMissingWeeklyHours<T extends AllTimeWeeklyHourlyAverage>(data: T[]): T[] {
  const pointsByHour = new Map(data.map((point) => [weeklyHourKey(point), point]));

  return Array.from({ length: 7 * 24 }, (_, index) => {
    const day = Math.floor(index / 24);
    const hour = index % 24;
    return pointsByHour.get(`${day}-${hour}`) ?? {
      day_of_week_num: day,
      hour_num: hour,
      hour_label: formatHourLabel(hour),
      avg_available: 0,
    } as T;
  });
}

function WeeklyHourlyChart({
  allTime,
  thisWeek,
}: {
  allTime: AllTimeWeeklyHourlyAverage[];
  thisWeek: ThisWeeklyHourlyAverage[];
}) {
  const isSmallScreen = useMediaQuery('(width <= 425px)');
  const [currentDay] = useState(() => {
    const today = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: 'America/Los_Angeles',
    }).format(new Date());
    return String(DAY_NAMES.indexOf(today));
  });
  const [dayChoice, setDayChoice] = useState<string | null>(null);
  const selectedDay = dayChoice ?? (isSmallScreen ? currentDay : 'all');
  const showAll = selectedDay === 'all';
  const hasRotatedHourLabels = isSmallScreen && !showAll;
  // Rotated text needs its full line height in horizontal edge clearance.
  // MUI otherwise removes the first label when the hourly bands get narrower.
  const chartEdgePadding = hasRotatedHourLabels ? 16 : 0;
  const visibleAllTime = allTime.filter((point) => showAll || point.day_of_week_num === Number(selectedDay));
  const visibleThisWeek = thisWeek.filter((point) => showAll || point.day_of_week_num === Number(selectedDay));
  const maximum = Math.max(1, ...visibleAllTime.map((point) => point.avg_available), ...visibleThisWeek.map((point) => point.avg_available));
  const visibleBarValue = (value: number) => value === 0 ? Number.EPSILON : value;

  return (
    <div className="weekly-chart">
      <div className="selection-row">
        <div>
          <label htmlFor="chart-day">Day (Pacific time)</label>
          <select id="chart-day" value={selectedDay} onChange={(event) => setDayChoice(event.target.value)}>
            <option value="all">All</option>
            {DAY_NAMES.map((day, index) => <option key={day} value={index}>{day}</option>)}
          </select>
        </div>
      </div>
      <div className="chart-legend" aria-label="Chart legend">
        <span><i style={{ backgroundColor: ALL_TIME_COLOR }} />Average Available Plugs (all time)</span>
        <span><i style={{ backgroundColor: THIS_WEEK_COLOR }} />Average Available Plugs (this week)</span>
      </div>
      <BarChart
        height={hasRotatedHourLabels ? 420 : 360}
        hideLegend
        grid={{ horizontal: true }}
        margin={{ top: 12, right: chartEdgePadding, bottom: 68, left: chartEdgePadding }}
        series={[
          {
            label: 'All time',
            data: visibleAllTime.map((point) => visibleBarValue(point.avg_available || Number.EPSILON)),
            color: ALL_TIME_COLOR,
            minBarSize: 2,
            valueFormatter: (_, context) => formatChartLabel(visibleAllTime[context.dataIndex]),
          },
          {
            label: 'This week',
            data: visibleThisWeek.map((point) => visibleBarValue(point.avg_available || Number.EPSILON)),
            color: THIS_WEEK_COLOR,
            minBarSize: 2,
            valueFormatter: (_, context) => formatChartLabel(visibleThisWeek[context.dataIndex]),
          },
        ]}
        xAxis={[{
          scaleType: 'band',
          // MUI truncates rotated labels to the axis height, not the outer margin.
          height: hasRotatedHourLabels ? 80 : undefined,
          // Keep endpoint ticks inside the plot instead of on its clipping boundary.
          tickPlacement: !showAll ? 'middle' : 'extremities',
          // Band-axis values must be unique. Reusing the same 24 hour labels for
          // every day collapses the domain and makes the chart stop at the last
          // hour that has data instead of reserving all 168 weekly slots.
          data: visibleAllTime.map(weeklyHourKey),
          valueFormatter: (value) => {
            const hour = Number(value.split('-')[1]);
            return !showAll
              ? `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`
              : formatHourLabel(hour);
          },
          tickLabelInterval: (_value, index) => !showAll || index % 6 === 0,
          tickLabelStyle: hasRotatedHourLabels
            ? { angle: -90, textAnchor: 'end', fontSize: 10, fill: '#fff' }
            : { fill: '#fff' },
          groups: !showAll ? undefined : [{
            getValue: (_value, index) => DAY_NAMES[visibleAllTime[index].day_of_week_num],
            tickSize: 28,
            tickLabelStyle: { fill: '#fff', fontWeight: 600 },
          }],
        }]}
        yAxis={[{
          min: 0,
          max: maximum,
          position: 'none',
        }]}
        sx={{
          backgroundColor: 'transparent',
          '& .MuiChartsAxis-tickLabel': { fill: '#fff' },
          '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: 'rgba(255, 255, 255, 0.55)' },
          '& .MuiChartsGrid-line': { stroke: 'rgba(255, 255, 255, 0.14)' },
        }}
      />
    </div>
  );
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
  if (station.plugs.length === 0 || station.plugs.some(isPlugUnknown)) return 'color-gray';
  if (station.plugs.length > 0 && station.plugs.every(isPlugAvailable)) return 'color-green';
  if (station.plugs.length > 0 && station.plugs.every(isPlugInUse)) return 'color-red';
  return 'color-orange';
}

function App() {
  const { snapshots: rawLatestSnapshots, refreshedAt, status, forceRefresh, paused } = useLiveSnapshots();
  const [selectedStation, setSelectedStation] = useState<LatestSnapshot | null>(null);
  const [weeklyHourly, setWeeklyHourly] = useState<AllTimeWeeklyHourlyAverage[]>(fillMissingWeeklyHours([]));
  const [thisWeeklyHourly, setThisWeeklyHourly] = useState<ThisWeeklyHourlyAverage[]>(fillMissingWeeklyHours([]));
  const [parkingFaculty, setParkingFaculty] = useState(false);
  const [sortBy, setSortBy] = useState('name');

  const latestSnapshots = useMemo(() => {
    const visible = rawLatestSnapshots.filter((station) => parkingFaculty || !station.name.includes('P3'));
    return sortStations([...visible], sortBy);
  }, [rawLatestSnapshots, sortBy, parkingFaculty]);

  useAlignedInterval(() => {
    void Promise.allSettled([fetchWeeklyHourlyAverages(), fetchThisWeeklyHourlyAverages()])
      .then(([allTime, thisWeek]) => {
        setWeeklyHourly(fillMissingWeeklyHours(allTime.status === 'fulfilled' ? allTime.value : []));
        setThisWeeklyHourly(fillMissingWeeklyHours(thisWeek.status === 'fulfilled' ? thisWeek.value : []));
      })
      .catch((error) => console.error('Unable to refresh historical averages:', error));
  }, 15 * 60, true, !paused);

  return (
    <>
      <h1 className="non-standard-font title">LSB EV Parking Spots</h1>
      <div className="canvas-container">
        <ParkingCanvas latestSnapshots={rawLatestSnapshots} refreshedAt={refreshedAt} onStationSelect={setSelectedStation} />
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
          <div className="mobile-status-key" aria-label="Status key">
            <span>Green = Available</span>
            <span>Red = In use</span>
            <span>Orange = Mixed availability</span>
            <span>Gray = Unknown</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Station</th>
                <th>Plug</th>
                <th className="status-column">Status</th>
                <th>Age</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            {latestSnapshots.map((station) => (
              <tbody className="station-group" key={station.device_id}>
                {station.plugs.map((plug, index) => {
                  let statusClass = 'color-orange';
                  if (isPlugAvailable(plug)) statusClass = 'color-green';
                  else if (isPlugInUse(plug)) statusClass = 'color-red';
                  else if (isPlugUnknown(plug)) statusClass = 'color-gray';
                  return (
                    <tr key={`${station.device_id}-${plug.outlet_number}`} className={statusClass}>
                      {index === 0 && (
                        <td className={`station-name ${stationStatusClass(station)}`} rowSpan={station.plugs.length}>
                          <button type="button" className="station-history-trigger" aria-haspopup="dialog"
                            aria-label={`View recent updates for ${station.name}`}
                            onClick={() => setSelectedStation(station)}>
                            {station.name}
                          </button>
                        </td>
                      )}
                      <td>{plug.outlet_number}</td>
                      <td className="status-column">{plug.status}</td>
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
            <button type="button" onClick={forceRefresh}>Force refresh</button>
            <span className={`connection-status ${status}`}>{status === 'live' ? 'Live' : status === 'polling' ? 'Polling' : status === 'paused' ? 'Paused' : 'Connecting'}</span>
            {refreshedAt && <span className="text-muted">Updated {refreshedAt.toLocaleTimeString()}</span>}
          </div>
        </div>

        <div>
          <h2 style={{ marginBottom: 0 }}>Snapshot Trends</h2>
          <p className="text-muted" style={{ marginTop: 0, fontSize: '0.8em' }}>
            * Data points are taken every minute; averages refresh every 15 minutes
          </p>
          <div className="chart-container">
            <WeeklyHourlyChart allTime={weeklyHourly} thisWeek={thisWeeklyHourly} />
          </div>
        </div>
      </div>
      {selectedStation && <StationHistoryDialog key={selectedStation.device_id} station={selectedStation}
        refreshedAt={refreshedAt} onClose={() => setSelectedStation(null)} />}
    </>
  );
}

export default App;
