import React, { useState, useEffect } from 'react';
import './CountdownTimer.css';

interface CountdownTimerProps {
  targetDate: string;
  onComplete?: () => void;
  label?: string;
  showProgress?: boolean;
  startDate?: string;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate, onComplete, label, showProgress, startDate }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const target = new Date(targetDate).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft('Complete!');
        setProgress(100);
        setDone(true);
        if (onComplete) onComplete();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${mins}m ${secs}s`);
      } else if (mins > 0) {
        setTimeLeft(`${mins}m ${secs}s`);
      } else {
        setTimeLeft(`${secs}s`);
      }

      if (showProgress && startDate) {
        const start = new Date(startDate).getTime();
        const total = target - start;
        const elapsed = now - start;
        setProgress(Math.min(100, (elapsed / total) * 100));
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate, startDate]);

  return (
    <div className={`countdown-timer ${done ? 'countdown-done' : ''}`}>
      {label && <span className="countdown-label">{label}</span>}
      <span className="countdown-time">{timeLeft}</span>
      {showProgress && (
        <div className="countdown-progress">
          <div className="countdown-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
};

export default CountdownTimer;
