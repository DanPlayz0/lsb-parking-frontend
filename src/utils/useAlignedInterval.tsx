import { useEffect, useRef } from 'react';

export function useAlignedInterval(task: () => void, intervalSeconds: number, instantRun: boolean = true) {
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    // Run immediately on mount
    if (instantRun) taskRef.current();

    const intervalMs = intervalSeconds * 1000;
    const now = new Date();
    const msIntoPeriod = now.getTime() % intervalMs;
    const delay = intervalMs - msIntoPeriod;

    let intervalId: number | null = null;
    const timeoutId: number = window.setTimeout(() => {
      taskRef.current(); // run at the next aligned boundary

      intervalId = window.setInterval(() => {
        taskRef.current();
      }, intervalMs);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [intervalSeconds]);
}
