import { useEffect, useRef, useState } from 'react';

/* The VISITORS tab's charts, drawn as plain SVG and HTML.
 *
 * Colour does one job per chart. A single measure takes one violet; the
 * previous period is amber; ordered steps (the funnel) take a violet ramp
 * from strong to faint; amounts on a map or grid take a violet scale from
 * faint to strong. The colours are CSS variables (styles.css, "charts"), one
 * set per theme, each checked with the dataviz validator against that
 * theme's card background. Text never wears a data colour, and every chart
 * can be read as a table. */

export const SERIES = 'var(--chart-series)';          // one measure
export const PREVIOUS = 'var(--chart-previous)';      // the period before, for comparison
export const FUNNEL = [1, 2, 3, 4, 5, 6].map(n => `var(--chart-funnel-${n})`);
export const SCALE = [1, 2, 3, 4, 5, 6, 7].map(n => `var(--chart-scale-${n})`);
export const NO_DATA = 'var(--chart-none)';

/* ------------------------------------------------------------ numbers */

export const nf = (n) => Math.round(n).toLocaleString('en-NG');
export const naira = (kobo) => '₦' + Math.round(kobo / 100).toLocaleString('en-NG');
export const pct = (r, digits = 1) => `${(r * 100).toFixed(r && r < 0.1 ? digits : 0)}%`;
export const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}m` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : `${Math.round(n)}`);
export const nairaCompact = (kobo) => '₦' + compact(kobo / 100);
export const duration = (ms) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};

/** A tidy top for an axis: 1, 2 or 5 × a power of ten, at least `max`. */
export function niceTop(max) {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 5, 10].map(m => m * p).find(v => v >= max);
}

/** Bin a value into the 7-step scale against the largest value shown. */
export const scaleColor = (v, max) => (!v ? NO_DATA : SCALE[Math.min(SCALE.length - 1, Math.floor((v / max) * SCALE.length - 1e-9))]);

/** Follows an element's width, so SVG text is never stretched. */
export function useWidth(initial = 640) {
  const ref = useRef(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/* -------------------------------------------------------------- frame */

/** A chart's card: title, a short note, and a switch to show it as a table. */
export function ChartCard({ title, note, table, actions, children, className = '' }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`admin-card viz-card ${className}`}>
      <div className="viz-card__head">
        <h3 className="admin-card__title">{title}</h3>
        <div className="viz-card__actions">
          {actions}
          {table && (
            <button className="admin-link" aria-pressed={asTable} onClick={() => setAsTable(v => !v)}>
              {asTable ? 'show chart' : 'show as table'}
            </button>
          )}
        </div>
      </div>
      {note && <p className="admin-help">{note}</p>}
      {asTable && table ? table : children}
    </section>
  );
}

export function DataTable({ head, rows, numeric = [] }) {
  return (
    <div className="admin-table-wrap viz-table">
      <table className="admin-mini-table">
        <thead><tr>{head.map((h, i) => <th key={h} className={numeric.includes(i) ? 'num' : ''}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, n) => (
            <tr key={n}>{r.map((c, i) => <td key={i} className={numeric.includes(i) ? 'num' : ''}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------- tile */

export function Sparkline({ values }) {
  if (!values || values.length < 2) return null;
  const w = 96, h = 26, max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - (v / max) * (h - 4)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  return (
    <svg className="viz-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" style={{ stroke: SERIES }} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"
            opacity="0.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * A headline number with how it moved against the period before. Whether up
 * is good depends on the number — more visitors is, a higher bounce rate is
 * not — and the arrow and words say so, not only the colour.
 */
export function StatTile({ label, value, now, before, upIsGood = true, spark, vs }) {
  let delta = null;
  if (typeof now === 'number' && typeof before === 'number') {
    if (before === 0 && now === 0) delta = { text: 'no change', tone: 'flat' };
    else if (before === 0) delta = { text: 'new', tone: upIsGood ? 'good' : 'bad' };
    else {
      const change = (now - before) / before;
      const up = change > 0.005, down = change < -0.005;
      delta = {
        text: `${up ? '↑' : down ? '↓' : '→'} ${Math.abs(change * 100).toFixed(Math.abs(change) < 0.1 ? 1 : 0)}%`,
        tone: !up && !down ? 'flat' : (up === upIsGood ? 'good' : 'bad')
      };
    }
  }
  return (
    <div className="admin-tile viz-tile">
      <span className="admin-tile__label">{label}</span>
      <span className="viz-tile__value">{value}</span>
      <span className="viz-tile__foot">
        {delta && <span className={`viz-delta viz-delta--${delta.tone}`}>{delta.text}<span className="viz-delta__vs"> {vs}</span></span>}
        <Sparkline values={spark} />
      </span>
    </div>
  );
}

/* --------------------------------------------------------- line chart */

/**
 * Visitors over time: this period as a line with a soft wash under it, the
 * period before as a grey line behind. One axis. A crosshair snaps to the
 * nearest point; arrow keys move it when the chart has focus.
 */
export function LineChart({ points, label, previousLabel, format = nf, xLabel }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const h = 220, padL = 40, padR = 12, padT = 12, padB = 26;
  const iw = width - padL - padR, ih = h - padT - padB;
  const hasPrev = points.some(p => p.previous != null);
  const top = niceTop(Math.max(...points.map(p => Math.max(p.value, p.previous ?? 0)), 1));
  const x = (i) => padL + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => padT + ih - (v / top) * ih;
  const line = (key) => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key] ?? 0).toFixed(1)}`).join('');
  const area = `${line('value')}L${x(points.length - 1)},${padT + ih}L${x(0)},${padT + ih}Z`;
  const shown = hover ?? points.length - 1;
  const every = Math.ceil(points.length / Math.max(2, Math.floor(iw / 70)));

  const pick = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    const i = Math.round(((clientX - r.left - padL) / iw) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };
  const p = points[shown];

  return (
    <div className="viz-line" ref={ref}>
      <div className="viz-legend">
        <span><i className="viz-key" style={{ background: SERIES }} />{label}</span>
        {hasPrev && <span><i className="viz-key" style={{ background: PREVIOUS }} />{previousLabel}</span>}
      </div>
      <div className="viz-readout" aria-live="polite">
        <strong>{format(p.value)}</strong> {label.toLowerCase()} · {xLabel(p)}
        {hasPrev && p.previous != null && <span className="viz-readout__prev"> · before: {format(p.previous)}</span>}
      </div>
      <svg width={width} height={h} role="img" tabIndex={0}
           aria-label={`${label}: ${points.map(q => `${xLabel(q)} ${format(q.value)}`).join(', ')}`}
           onPointerMove={(e) => pick(e.clientX)} onPointerLeave={() => setHover(null)}
           onKeyDown={(e) => {
             if (e.key === 'ArrowLeft') setHover(Math.max(0, shown - 1));
             if (e.key === 'ArrowRight') setHover(Math.min(points.length - 1, shown + 1));
           }}>
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={padL} x2={width - padR} y1={y(top * f)} y2={y(top * f)} className="viz-grid" />
            <text x={padL - 8} y={y(top * f) + 3.5} className="viz-axis" textAnchor="end">{compact(top * f)}</text>
          </g>
        ))}
        {points.map((q, i) => (i % every === 0 ? (points.length - 1 - i >= every / 2 || i === points.length - 1) : i === points.length - 1) && (
          <text key={q.key} x={x(i)} y={h - 8} className="viz-axis"
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>{q.tick}</text>
        ))}
        {hasPrev && <path d={line('previous')} fill="none" style={{ stroke: PREVIOUS }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        <path d={area} style={{ fill: SERIES }} opacity="0.1" />
        <path d={line('value')} fill="none" style={{ stroke: SERIES }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <line x1={x(shown)} x2={x(shown)} y1={padT} y2={padT + ih} className="viz-cross" />
        <circle cx={x(shown)} cy={y(p.value)} r="4.5" style={{ fill: SERIES, stroke: 'var(--bg-3)' }} strokeWidth="2" />
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------- funnel */

/** How far visits got. Each step shows its share of all visits and what the step before lost. */
export function Funnel({ steps }) {
  const first = steps[0]?.visits || 0;
  return (
    <ol className="viz-funnel">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].visits : null;
        const lost = prev ? 1 - s.visits / prev : 0;
        const share = first ? s.visits / first : 0;
        return (
          <li key={s.step} className="viz-funnel__row">
            <span className="viz-funnel__label">{s.step}</span>
            <span className="viz-funnel__track">
              <span className="viz-funnel__bar" style={{ width: `${Math.max(share * 100, s.visits ? 0.8 : 0)}%`, background: FUNNEL[i] }} />
            </span>
            <span className="viz-funnel__num">{nf(s.visits)}</span>
            <span className="viz-funnel__pct">{pct(share)}</span>
            <span className="viz-funnel__lost">{i && prev ? `−${pct(lost)}` : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------ bar list */

/**
 * Ranked rows with a quiet bar behind each, as Plausible draws them: the bar
 * is the first number's share of the largest; the others are read as text.
 */
export function BarList({ rows, columns, empty = 'Nothing yet.' }) {
  if (!rows.length) return <p className="admin-empty">{empty}</p>;
  const max = Math.max(...rows.map(r => r.bar), 1);
  return (
    <div className="viz-bars" role="table" style={{ '--cols': columns.length - 1 }}>
      <div className="viz-bars__row viz-bars__row--head" role="row">
        <span role="columnheader">{columns[0]}</span>
        {columns.slice(1).map(c => <span key={c} role="columnheader" className="num">{c}</span>)}
      </div>
      {rows.map(r => (
        <div className="viz-bars__row" role="row" key={r.key}>
          <span className="viz-bars__label" role="cell">
            <i className="viz-bars__fill" style={{ width: `${(r.bar / max) * 100}%` }} aria-hidden="true" />
            <span className="viz-bars__text">{r.label}</span>
          </span>
          {r.values.map((v, i) => <span key={i} role="cell" className="num">{v}</span>)}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- heatmap */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Weekday × hour, Lagos time. Brighter is busier. */
export function Heatmap({ grid, unit }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(...grid.flat(), 1);
  const best = (() => {
    let b = null;
    grid.forEach((row, d) => row.forEach((v, hr) => { if (v && (!b || v > b.v)) b = { d, hr, v }; }));
    return b;
  })();
  const hourLabel = (hr) => `${String(hr).padStart(2, '0')}:00`;
  const shown = hover ?? best;
  return (
    <div className="viz-heat">
      <p className="viz-readout" aria-live="polite">
        {shown
          ? <><strong>{nf(shown.v ?? grid[shown.d][shown.hr])}</strong> {unit} · {DAYS[shown.d]} {hourLabel(shown.hr)}–{hourLabel((shown.hr + 1) % 24)}{!hover && ' · the busiest hour'}</>
          : `No ${unit} yet.`}
      </p>
      <div className="viz-heat__grid" role="grid" aria-label={`${unit} by day and hour`}>
        <span />
        {Array.from({ length: 24 }, (_, hr) => <span key={hr} className="viz-heat__hour">{hr % 3 === 0 ? String(hr).padStart(2, '0') : ''}</span>)}
        {grid.map((row, d) => [
          <span key={`d${d}`} className="viz-heat__day">{DAYS[d]}</span>,
          ...row.map((v, hr) => (
            <button key={`${d}-${hr}`} className="viz-heat__cell" style={{ background: scaleColor(v, max) }}
                    aria-label={`${DAYS[d]} ${hourLabel(hr)}: ${v} ${unit}`}
                    onPointerEnter={() => setHover({ d, hr, v })} onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover({ d, hr, v })} onBlur={() => setHover(null)} />
          ))
        ])}
      </div>
      <ScaleLegend max={max} format={nf} />
    </div>
  );
}

export function ScaleLegend({ max, format }) {
  return (
    <div className="viz-scale" aria-hidden="true">
      <span>{format(0)}</span>
      <span className="viz-scale__ramp">
        <i style={{ background: NO_DATA }} />
        {SCALE.map(c => <i key={c} style={{ background: c }} />)}
      </span>
      <span>{format(max)}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- map */

/**
 * A map shaded by amount. Places with nothing stay near the background; the
 * busiest is brightest. Hover or focus names the place and its number.
 */
export function ChoroplethMap({ shapes, value, format, label, width: w, height: h, emptyNote }) {
  const [hover, setHover] = useState(null);
  const values = shapes.map(s => value(s) ?? 0);
  const max = Math.max(...values, 0);
  const top = shapes.map((s, i) => ({ s, v: values[i] })).filter(x => x.v).sort((a, b) => b.v - a.v)[0];
  const shown = hover ?? top ?? null;
  return (
    <div className="viz-map">
      <p className="viz-readout" aria-live="polite">
        {shown ? <><strong>{format(shown.v)}</strong> · {shown.s.label}{!hover && ' · the most'}</> : emptyNote}
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="viz-map__svg" role="img" aria-label={label}>
        {shapes.map((s, i) => (
          <path key={s.key} d={s.d} style={{ fill: scaleColor(values[i], max || 1) }} className="viz-map__shape"
                tabIndex={values[i] ? 0 : -1}
                aria-label={`${s.label}: ${format(values[i])}`}
                onPointerEnter={() => setHover({ s, v: values[i] })} onPointerLeave={() => setHover(null)}
                onFocus={() => setHover({ s, v: values[i] })} onBlur={() => setHover(null)} />
        ))}
      </svg>
      {max > 0 && <ScaleLegend max={max} format={format} />}
    </div>
  );
}
