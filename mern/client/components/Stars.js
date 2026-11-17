'use client';
import { Star } from 'lucide-react';

export function Stars({ value = 0, size = 14 }) {
  return (
    <span className="stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} className={i <= Math.round(value) ? 'on' : ''} aria-hidden="true" />)}
    </span>
  );
}

export function StarInput({ value, onChange }) {
  return (
    <div className="star-input" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} className={i <= value ? 'on' : ''} onClick={() => onChange(i)}>
          <Star size={26} />
        </button>
      ))}
    </div>
  );
}
