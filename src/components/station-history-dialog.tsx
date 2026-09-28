import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useEffect, useState } from 'react';
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
      setUpdates(data.slice(0, 5));
      setError(false);
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [station.device_id, refreshedAt, retry]);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm"
      aria-labelledby="station-history-title" aria-describedby="station-history-description"
      slotProps={{ paper: { sx: { bgcolor: '#181b30', color: '#fff', borderRadius: 3 } } }}>
      <DialogTitle id="station-history-title">{station?.name} — Recent updates</DialogTitle>
      <DialogContent>
        <DialogContentText id="station-history-description" sx={{ color: '#c3c6d4' }}>
          The last five recorded plug changes, newest first. Times show when each change was
          first sampled and are displayed in your local time zone.
        </DialogContentText>
        {error ? <div role="alert"><p>Unable to load station history.</p>
          <Button onClick={() => setRetry((value) => value + 1)}>Retry</Button></div>
          : updates === null ? <p role="status">Loading station history…</p>
          : updates.length === 0 ? <p>No recorded changes for this station.</p> : (
          <ol className="station-history-list">
            {updates.map((update) => (
              <li key={`${update.outlet_number}-${update.updated_at}-${update.status}`}>
                <strong>Plug {update.outlet_number}: {update.status}</strong>
                <time dateTime={parseApiTimestamp(update.updated_at).toISOString()}>
                  {parseApiTimestamp(update.updated_at).toLocaleString(undefined, { timeZoneName: 'short' })}
                </time>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose} sx={{ color: '#b8d9ff' }}>Close</Button></DialogActions>
    </Dialog>
  );
}
