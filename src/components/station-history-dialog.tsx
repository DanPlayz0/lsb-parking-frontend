import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useEffect, useState } from 'react';
import RelativeTime from './relative-time';
import { formatDuration } from '../utils/historyDuration';
import { fetchStationHistory, parseApiTimestamp, type LatestSnapshot, type PlugSnapshot } from '../api';

export default function StationHistoryDialog({ station, refreshedAt, onClose }: {
  station: LatestSnapshot;
  refreshedAt: Date | null;
  onClose: () => void;
}) {
  const [updates, setUpdates] = useState<PlugSnapshot[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetchStationHistory(station.device_id, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setUpdates(data);
      setError(false);
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [station.device_id, refreshedAt, retry]);

  const plugNumbers = [...new Set([
    ...station.plugs.map((plug) => plug.outlet_number),
    ...(updates ?? []).map((update) => update.outlet_number),
  ])].sort((a, b) => a - b);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md"
      aria-labelledby="station-history-title" aria-describedby="station-history-description"
      slotProps={{ paper: { sx: { bgcolor: '#181b30', color: '#fff', borderRadius: 3 } } }}>
      <DialogTitle id="station-history-title">{station?.name} — Recent updates</DialogTitle>
      <DialogContent>
        <DialogContentText id="station-history-description" sx={{ color: '#c3c6d4' }}>
          The last five changes for each plug, newest first. Durations show how long each status
          lasted; “so far” marks the latest status. Times are based on recorded samples and shown
          in your local time zone.
        </DialogContentText>
        {error ? <div role="alert"><p>Unable to load station history.</p>
          <Button onClick={() => setRetry((value) => value + 1)}>Retry</Button></div>
          : updates === null ? <p role="status">Loading station history…</p>
          : updates.length === 0 ? <p>No recorded changes for this station.</p> : (
          <div className="station-history-columns">
          {plugNumbers.map((plugNumber) => {
            const changes = updates.filter((update) => update.outlet_number === plugNumber)
              .sort((a, b) => parseApiTimestamp(b.updated_at).getTime() - parseApiTimestamp(a.updated_at).getTime())
              .slice(0, 5);
            return <section key={plugNumber} aria-labelledby={`history-plug-${plugNumber}`}>
              <h3 id={`history-plug-${plugNumber}`}>Plug {plugNumber}</h3>
              {changes.length === 0 ? <p>No recorded changes for this plug.</p> : (
                <ol className="station-history-list">
                  {changes.map((update, index) => (
                    <li key={`${update.updated_at}-${update.status}`}>
                      <strong>{update.status} ({index === 0
                        ? <><RelativeTime isoString={update.updated_at} compact /> so far</>
                        : formatDuration(parseApiTimestamp(changes[index - 1].updated_at).getTime()
                          - parseApiTimestamp(update.updated_at).getTime())})</strong>
                      <time dateTime={parseApiTimestamp(update.updated_at).toISOString()}>
                        {parseApiTimestamp(update.updated_at).toLocaleString(undefined, { timeZoneName: 'short' })}
                      </time>
                    </li>
                  ))}
                </ol>
              )}
            </section>;
          })}
          </div>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose} sx={{ color: '#b8d9ff' }}>Close</Button></DialogActions>
    </Dialog>
  );
}
