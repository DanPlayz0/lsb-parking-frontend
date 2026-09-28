import { useEffect, useRef } from 'react';
import { availablePlugCount, isPlugUnknown, type LatestSnapshot } from '../api';

const RED = 'oklch(0.8 0.2 30)';
const ORANGE = 'oklch(0.8 0.2 80)';
const GREEN = 'oklch(0.8 0.2 150)';
const BLUE = 'oklch(0.8 0.2 250)';
const GRAY = 'oklch(0.7 0 0)';

export default function ParkingCanvas({ latestSnapshots, refreshedAt }: { latestSnapshots: LatestSnapshot[]; refreshedAt: Date | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!(latestSnapshots && canvasRef.current)) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '20px Arial';
    if (!latestSnapshots.length) {
      // This handles the initial connection and API/network failures.
      ctx.textAlign = 'center';
      ctx.fillStyle = 'lightgray';
      ctx.fillRect(30, 30, 260, 167);
      ctx.fillStyle = 'black';
      ctx.fillText('No Data Available.', 150, 105);
      ctx.fillText('Waiting on API...', 150, 130);
      return;
    }
    ctx.textAlign = 'left';
    for (const snapshot of latestSnapshots) {
      const available = availablePlugCount(snapshot);
      const [y, x] = snapshot.name
        .slice(1)
        .split(' ')
        .map((x) => Number(x))
        .slice(0, 2);
      if (isNaN(x) || isNaN(y)) continue;
      let availabilityColor = ORANGE;
      if (snapshot.plugs.length === 0 || snapshot.plugs.some(isPlugUnknown)) availabilityColor = GRAY;
      else if (y === 1 && x === 4) availabilityColor = available > 0 ? BLUE : RED; // Handicapped parking
      else if (available === 0) availabilityColor = RED;
      else if (available > 1) availabilityColor = GREEN;

      ctx.fillStyle = availabilityColor;

      const posX = 75;

      ctx.fillRect(posX * x - (posX - 10), y * 45, posX - 5, 40);

      ctx.fillStyle = 'black';
      ctx.fillText(`${available}/${snapshot.outlet_count}`, x * posX - (posX - 10) + 5, y * 45 + 27);
    }
  }, [latestSnapshots, refreshedAt]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={227}
      className="parking-canvas"
    ></canvas>
  );
}
