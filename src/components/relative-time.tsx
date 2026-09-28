import { useState, useEffect } from 'react';

export default function AgeText({ isoString }: { isoString: string | Date }) {
  const [ageText, setAgeText] = useState('');

  useEffect(() => {
    if (!isoString) return;

    const calculateAgeText = () => {
      const now = Date.now();
      const then = new Date(isoString).getTime();
      const diffSeconds = Math.floor((now - then) / 1000);
      const isFuture = diffSeconds < 0;
      const absSeconds = Math.abs(diffSeconds);

      if (absSeconds < 3600) {
        return `${isFuture ? '-' : ''}${Math.round(absSeconds / 60)} min ago`;
      }

      const hours = Math.floor(absSeconds / 3600);
      const minutes = Math.round((absSeconds / 60) % 60);
      return `${isFuture ? '-' : ''}${hours} hr ${minutes} min ago`;
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
