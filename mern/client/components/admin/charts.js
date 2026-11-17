'use client';
import { useState } from 'react';

const niceMax = (v) => {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};
const fmtDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/**
 * Single-series column chart. One colour (the series), thin rounded bars on a shared baseline,
 * hairline grid, hover/focus tooltip, a screen-reader table, and the headline total up top.
 */
export function ColumnChart({ title, noun, data, total }) {
  const [hover, setHover] = useState(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.count)));
  const sum = total ?? data.reduce((a, d) => a + d.count, 0);
  const ticks = [max, max / 2, 0];
  const last = data.length - 1;
  const h = hover === null ? null : data[hover];

  return (
    <figure className="chart card">
      <figcaption>
        <span className="chart-title">{title}</span>
        <span className="chart-total"><strong>{sum.toLocaleString()}</strong> <span className="muted">in {data.length} days</span></span>
      </figcaption>
      <div className="chart-body" onMouseLeave={() => setHover(null)}>
        <div className="chart-y" aria-hidden="true">{ticks.map((t) => <span key={t}>{Number.isInteger(t) ? t : ''}</span>)}</div>
        <div className="chart-plot" role="img" aria-label={`${title}: ${sum} in the last ${data.length} days`}>
          <span className="chart-grid" style={{ top: 0 }} /><span className="chart-grid" style={{ top: '50%' }} /><span className="chart-grid chart-base" style={{ top: '100%' }} />
          <div className="chart-bars">
            {data.map((d, i) => (
              <div key={d.date} className="chart-col" tabIndex={0} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                aria-label={`${fmtDay(d.date)}: ${d.count} ${noun}`}>
                <span className={`chart-bar ${hover !== null && hover !== i ? 'is-dim' : ''}`} style={{ height: `${(d.count / max) * 100}%` }} />
              </div>
            ))}
          </div>
          {h && (
            <div className="chart-tip" style={{ left: `${((hover + 0.5) / data.length) * 100}%` }} role="status">
              <strong>{h.count}</strong> {noun}<span>{fmtDay(h.date)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="chart-x" aria-hidden="true"><span>{fmtDay(data[0].date)}</span><span>{fmtDay(data[Math.floor(last / 2)].date)}</span><span>{fmtDay(data[last].date)}</span></div>
      <table className="sr-only"><caption>{title}</caption><thead><tr><th>Date</th><th>{noun}</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.date}><td>{d.date}</td><td>{d.count}</td></tr>)}</tbody></table>
    </figure>
  );
}

/** Ranked horizontal bars: label, thin bar, value at the tip. */
export function BarList({ title, items, emptyText = 'No data yet' }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <section className="card card-pad barlist">
      <h3 className="card-title" style={{ marginBottom: 14 }}>{title}</h3>
      {items.length === 0 ? <p className="small muted">{emptyText}</p> : (
        <ul>
          {items.map((i) => (
            <li key={i.label}>
              <span className="barlist-label">{i.label}</span>
              <span className="barlist-track"><span className="barlist-fill" style={{ width: `${(i.value / max) * 100}%` }} /></span>
              <span className="barlist-val">{i.value.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
