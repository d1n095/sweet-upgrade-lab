import { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

interface CartReservationTimerProps {
  durationMinutes?: number;
  lang: string;
}

const CartReservationTimer = ({ durationMinutes = 15, lang }: CartReservationTimerProps) => {
  const endTimeRef = useRef(Date.now() + durationMinutes * 60 * 1000);
  const [remaining, setRemaining] = useState(durationMinutes * 60);

  useEffect(() => {
    const interval = setInterval(() => {
      const left = Math.max(0, Math.floor((endTimeRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (remaining <= 0) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-warning/10 text-warning text-xs font-medium">
      <Clock className="w-3.5 h-3.5" />
      <span>
        {lang === 'sv'
          ? `Din kundvagn reserveras i ${mins}:${secs.toString().padStart(2, '0')}`
          : `Cart reserved for ${mins}:${secs.toString().padStart(2, '0')}`}
      </span>
    </div>
  );
};

export default CartReservationTimer;
