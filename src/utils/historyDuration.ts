export function formatDuration(milliseconds: number) {
  if (!Number.isFinite(milliseconds)) return 'Unknown';
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours === 0 ? `${minutes}m` : `${hours}h${minutes ? `${minutes}m` : ''}`;
}
