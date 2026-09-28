import { useState, useEffect } from 'react';

export default function AgeText({ isoString }: { isoString: string | Date }) {
  const [ageText, setAgeText] = useState('');

  const calculateAgeText = () => {
    if (!isoString) return '';

    const now = new Date().getTime();
    const then = new Date(
      typeof isoString != 'string' && 'toISOString' in isoString && typeof isoString.toISOString === 'function'
        ? isoString.toISOString()
        : isoString
    ).getTime();
    const diffSeconds = Math.floor((now - then) / 1000);

    const isFuture = diffSeconds < 0;
    const absSeconds = Math.abs(diffSeconds);

    if (absSeconds < 3600) {
      const minutes = Math.round(absSeconds / 60);
      return `${isFuture ? '-' : ''}${minutes} min ago`;
    } else {
      const hours = Math.floor(absSeconds / 3600);
      const minutes = Math.round((absSeconds / 60) % 60);
      return `${isFuture ? '-' : ''}${hours} hr ${minutes} min ago`;
    }
  };

  useEffect(() => {
    if (!isoString) return;

    const update = () => setAgeText(calculateAgeText());
    update(); // initial render

    // figure out ms until next minute boundary
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    // timeout to sync with next minute tick
    const timeout = setTimeout(() => {
      update();
      // then start regular 60s interval updates
      const interval = setInterval(update, 60000);
      // cleanup function clears both
      return () => clearInterval(interval);
    }, msToNextMinute);

    return () => clearTimeout(timeout);
  }, [isoString]);

  return <span>{ageText}</span>;
}
