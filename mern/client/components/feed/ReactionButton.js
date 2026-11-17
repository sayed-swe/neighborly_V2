'use client';
import { useRef, useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { REACTIONS, REACTION_BY_TYPE } from '@/lib/reactions';

/**
 * Like button with a reaction picker. Click toggles Like; hover (desktop), long-press (touch)
 * or keyboard focus reveals the other reactions.
 */
export default function ReactionButton({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const timer = useRef();
  const pressed = useRef(false);
  const current = value ? REACTION_BY_TYPE[value] : null;

  const show = (ms) => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(true), ms); };
  const hide = (ms = 250) => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), ms); };
  const choose = (type) => { setOpen(false); onChange(type === value ? null : type); };

  return (
    <div className="react" onMouseEnter={() => show(450)} onMouseLeave={() => hide()}
      onFocus={() => show(0)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) hide(0); }}>
      {open && (
        <div className="react-picker" role="group" aria-label="Choose a reaction">
          {REACTIONS.map((r) => (
            <button key={r.type} type="button" className="react-pick" onClick={() => choose(r.type)} aria-label={r.label} title={r.label}>
              <span aria-hidden="true">{r.emoji}</span>
            </button>
          ))}
        </div>
      )}
      <button type="button" className={`act ${current ? 'is-on' : ''}`} aria-pressed={Boolean(current)}
        style={current ? { color: current.color } : undefined}
        onClick={() => { if (pressed.current) { pressed.current = false; return; } setOpen(false); onChange(current ? null : 'like'); }}
        onTouchStart={() => { timer.current = setTimeout(() => { pressed.current = true; setOpen(true); }, 450); }}
        onTouchEnd={() => clearTimeout(timer.current)}
        onContextMenu={(e) => e.preventDefault()}>
        {current ? <span className="act-emoji" aria-hidden="true">{current.emoji}</span> : <ThumbsUp size={19} />}
        {current ? current.label : 'Like'}
      </button>
    </div>
  );
}
