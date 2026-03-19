import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  durationMs: number;
  onTimeout: () => void;
}

export function CountdownTimer({ durationMs, onTimeout }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(durationMs);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1000;
        if (next <= 0) {
          clearInterval(interval);
          onTimeout();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [durationMs, onTimeout]);

  const seconds = Math.ceil(remaining / 1000);
  const percent = (remaining / durationMs) * 100;
  const isUrgent = seconds <= 10;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span className={isUrgent ? 'text-red-400 font-bold' : 'text-[var(--color-text-muted)]'}>
          Auto-block in {seconds}s
        </span>
      </div>
      <div className="w-full bg-[var(--color-bg-secondary)] rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-1000 ${isUrgent ? 'bg-red-500' : 'bg-[var(--color-brand)]'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
