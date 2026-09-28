import { useState, useEffect } from 'react';
import { parseApiTimestamp } from '../api';

export default function AgeText({ isoString }: { isoString: string | Date }) {
  const [ageText, setAgeText] = useState('');

  useEffect(() => {
    if (!isoString) return;

    const calculateAgeText = () => {
      const now = Date.now();
      const then = parseApiTimestamp(isoString).getTime();
      if (Number.isNaN(then)) return 'Unknown';
      const diffSeconds = Math.floor((now - then) / 1000);
      const elapsedSeconds = Math.max(0, diffSeconds);

      if (elapsedSeconds < 3600) {
        return `${Math.floor(elapsedSeconds / 60)} min ago`;
      }

      const hours = Math.floor(elapsedSeconds / 3600);
      const minutes = Math.floor((elapsedSeconds / 60) % 60);
      return `${hours} hr ${minutes} min ago`;
    };

    const update = () => setAgeText(calculateAgeText());
    update();

    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    let interval: number | null = null;

    const timeout = setTimeout(() => {
      update();
      interval = window.setInterval(update, 60_000);
    }, msToNextMinute);

    return () => {
      clearTimeout(timeout);
      if (interval !== null) clearInterval(interval);
    };
  }, [isoString]);

  return <span>{ageText}</span>;
}
