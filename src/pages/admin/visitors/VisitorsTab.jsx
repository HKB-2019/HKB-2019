import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminAnalytics } from '../../../lib/api.js';
import { MAPS } from '../../../data/maps.js';
import {
  ChartCard, DataTable, StatTile, LineChart, Funnel, BarList, Heatmap, ChoroplethMap,
  nf, naira, nairaCompact, pct, duration
} from './charts.jsx';

/* VISITORS — how people find the shop, what they look at, and where they
 * stop. Built on the shop's own counting (no cookies, nothing personal;
 * see server/lib/analytics.js) and on real orders for anything to do with
 * money. Loaded only when the tab is opened, maps included. */

const RANGES = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['12m', '12 months']];
const VS = { today: 'vs yesterday', '7d': 'vs previous 7 days', '30d': 'vs previous 30 days', '90d': 'vs previous 90 days', '12m': 'vs previous 12 months' };

const regionName = (() => {
  let names = null;
  try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { /* codes then */ }
  return (code) => { try { return names?.of(code) ?? code; } catch { return code; } };
})();

const GOALS = [
  ['subscribe', 'Joined the list'],
  ['restock_request', 'Asked for a sold-out size'],
  ['discount_applied', 'Used a discount code'],
  ['size_guide', 'Opened the size guide'],
  ['film_play', 'Played the film']
];

/* ------------------------------------------------------- link builder */

/** Tagged links, so a post's visitors are counted as that post's. */
function LinkBuilder() {
  const [source, setSource] = useState('instagram');
  const [campaign, setCampaign] = useState('');
  const [page, setPage] = useState('/');
  const [copied, setCopied] = useState(false);
  const base = window.location.origin + (window.location.hash ? window.location.pathname : '');
  const slug = (v) => v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const params = new URLSearchParams({ utm_source: source, ...(slug(campaign) ? { utm_campaign: slug(campaign) } : {}) });
  const link = `${base.replace(/\/$/, '')}${page}?${params}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { setCopied(false); }
  };

  return (
    <ChartCard title="Make a tracked link"
               note="Use these in your bio, stories, WhatsApp broadcasts and with influencers. Visits from the link — and what they buy — show up under its source and campaign. WhatsApp sends no other clue, so without a tagged link its visitors count as Direct.">
      <div className="viz-linkform">
        <label className="admin-field">
          <span>Where you’ll post it</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {['instagram', 'whatsapp', 'tiktok', 'x', 'facebook', 'snapchat', 'youtube', 'email', 'influencer'].map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="admin-field">
          <span>Campaign <em>optional, e.g. drop 02</em></span>
          <input value={campaign} maxLength={60} placeholder="drop 02" onChange={(e) => setCampaign(e.target.value)} />
        </label>
        <label className="admin-field">
          <span>Page</span>
          <input value={page} maxLength={80} onChange={(e) => setPage(e.target.value.startsWith('/') ? e.target.value : `/${e.target.value}`)} />
        </label>
      </div>
      <div className="viz-link">
        <code className="viz-link__url">{link}</code>
        <button className="admin-action" onClick={copy}>{copied ? 'COPIED' : 'COPY'}</button>
      </div>
    </ChartCard>
  );
}

/* ------------------------------------------------------------- the tab */

export default function VisitorsTab() {
  const [range, setRange] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageView, setPageView] = useState('pages');
  const [techView, setTechView] = useState('devices');
  const [heatView, setHeatView] = useState('visits');
  const [stateMetric, setStateMetric] = useState('revenueKobo');

  const load = useCallback(async (r) => {
    setLoading(true);
    try { setData(await adminAnalytics(r)); setError(null); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(range); }, [range, load]);
  // The live count refreshes itself while the tab is open.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(range); }, 60_000);
    return () => clearInterval(t);
  }, [range, load]);

  const points = useMemo(() => {
    if (!data) return [];
    const fmt = data.bucket === 'hour'
      ? (s) => new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })
      : data.bucket === 'month'
        ? (s) => new Date(s).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'Africa/Lagos' })
        : (s) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });
    return data.series.map(p => ({ key: p.start, tick: fmt(p.start), value: p.visitors, previous: p.previousVisitors, raw: p }));
  }, [data]);

  if (!data) {
    return (
      <section className="admin-section">
        <div className="admin-section__head"><h2 className="admin-h2">Visitors</h2></div>
        {error ? <p className="admin-note admin-note--bad" role="alert">{error}</p> : <p className="admin-empty">Loading…</p>}
      </section>
    );
  }

  const t = data.totals, p = data.previous, vs = VS[range];
  const s = data.series;
  const countries = new Map(data.countries.map(c => [c.key, c.visits]));
  const states = new Map(data.states.map(x => [x.state, x]));
  const detailCut = new Date(data.detailFrom) > new Date(data.from);
  const heatGrid = data.when[heatView];

  return (
    <section className={`admin-section admin-settings viz${loading ? ' is-loading' : ''}`}>
      <div className="admin-section__head">
        <h2 className="admin-h2">Visitors</h2>
        <span className="viz-live" title="Visits with activity in the last five minutes">
          <i aria-hidden="true" /> {data.live.visitors} on the site now
        </span>
      </div>

      {/* One filter row; everything below follows it. */}
      <div className="viz-filters" role="group" aria-label="Date range">
        {RANGES.map(([key, label]) => (
          <button key={key} className={`admin-chip${range === key ? ' is-on' : ''}`} aria-pressed={range === key}
                  onClick={() => setRange(key)}>{label}</button>
        ))}
      </div>
      {error && <p className="admin-note admin-note--bad" role="alert">{error}</p>}
      {detailCut && (
        <p className="admin-help">Visit details are kept for 90 days. Totals and money cover the whole range; the breakdowns below cover the last 90 days.</p>
      )}

      <div className="viz-tiles">
        <StatTile label="Visitors" value={nf(t.visitors)} now={t.visitors} before={p.visitors} vs={vs} spark={s.map(x => x.visitors)} />
        <StatTile label="Visits" value={nf(t.visits)} now={t.visits} before={p.visits} vs={vs} spark={s.map(x => x.visits)} />
        <StatTile label="Conversion rate" value={pct(t.conversionRate)} now={t.conversionRate} before={p.conversionRate} vs={vs}
                  spark={s.map(x => (x.visits ? x.orders / x.visits : 0))} />
        <StatTile label="Money in" value={naira(t.revenueKobo)} now={t.revenueKobo} before={p.revenueKobo} vs={vs} spark={s.map(x => x.revenueKobo)} />
        <StatTile label="Money per visitor" value={naira(t.revenuePerVisitorKobo)} now={t.revenuePerVisitorKobo} before={p.revenuePerVisitorKobo} vs={vs} />
        <StatTile label="Bounce rate" value={pct(t.bounceRate)} now={t.bounceRate} before={p.bounceRate} upIsGood={false} vs={vs} />
        <StatTile label="Time per visit" value={duration(t.avgVisitMs)} now={t.avgVisitMs} before={p.avgVisitMs} vs={vs} />
        <StatTile label="Returning visitors" value={pct(t.returningRate)} />
      </div>

      <ChartCard
        title="Visitors over time"
        note={data.bucket === 'hour' ? 'By hour, Lagos time.' : data.bucket === 'month' ? 'By month.' : 'By day, Lagos time.'}
        table={<DataTable head={['When', 'Visitors', 'Visits', 'Orders', 'Money in']} numeric={[1, 2, 3, 4]}
                          rows={points.map(q => [q.tick, nf(q.raw.visitors), nf(q.raw.visits), nf(q.raw.orders), naira(q.raw.revenueKobo)])} />}>
        <LineChart points={points} label="Visitors" previousLabel={vs.replace('vs ', '').replace(/^./, c => c.toUpperCase())}
                   xLabel={(q) => q.tick} />
      </ChartCard>

      <ChartCard
        title="Where people stop"
        note="Each step counts the visits that got at least that far. The red figure is how many the step before lost."
        table={<DataTable head={['Step', 'Visits', 'Of all visits']} numeric={[1, 2]}
                          rows={data.funnel.map(f => [f.step, nf(f.visits), pct(data.funnel[0].visits ? f.visits / data.funnel[0].visits : 0)])} />}>
        <Funnel steps={data.funnel} />
        <p className="viz-foot">
          {nf(data.unfinished.count)} checkouts were not paid ({naira(data.unfinished.valueKobo)}).
          {data.unfinished.pending > 0 && ` ${nf(data.unfinished.pending)} are still being paid for.`}
        </p>
      </ChartCard>

      <div className="viz-two">
        <ChartCard title="Where visitors came from" note="Visits, and the paid orders each source brought.">
          <BarList columns={['Source', 'Visits', 'Orders', 'Money in', 'Converts']}
                   rows={data.channels.map(c => ({
                     key: c.channel, label: c.channel, bar: c.visits,
                     values: [nf(c.visits), nf(c.orders), naira(c.revenueKobo), c.visits ? pct(c.conversionRate) : '—']
                   }))} empty="No visits yet." />
        </ChartCard>
        <ChartCard title="Campaigns and websites" note="From tagged links, and from other sites that linked to you.">
          <BarList columns={['Campaign', 'Visits', 'Orders', 'Money in']}
                   rows={data.campaigns.map(c => ({ key: c.campaign, label: c.campaign, bar: c.visits,
                     values: [nf(c.visits), nf(c.orders), naira(c.revenueKobo)] }))}
                   empty="No tagged links used yet — make one below." />
          {data.referrers.length > 0 && (
            <BarList columns={['Website', 'Visits']}
                     rows={data.referrers.map(r => ({ key: r.key, label: r.key, bar: r.visits, values: [nf(r.visits)] }))} />
          )}
        </ChartCard>
      </div>

      <LinkBuilder />

      <ChartCard title="Pieces" note="Views of each product page, adds to bag (from anywhere in the shop), and what sold.">
        <BarList columns={['Piece', 'Views', 'Adds', 'Add rate', 'Sold', 'Money in']}
                 rows={data.products.map(x => ({ key: x.productId, label: x.name, bar: x.views || x.adds,
                   values: [nf(x.views), nf(x.adds), x.views ? pct(x.addRate) : '—', nf(x.sold), naira(x.revenueKobo)] }))}
                 empty="No pieces viewed yet." />
        {data.sizes.length > 0 && (
          <p className="viz-foot">Sizes added to bag: {data.sizes.map(z => `${z.size} ${nf(z.adds)}`).join(' · ')}</p>
        )}
      </ChartCard>

      <div className="viz-two">
        <ChartCard title="Pages" actions={
          <span className="viz-switch" role="group" aria-label="Which pages">
            {[['pages', 'Most viewed'], ['entry', 'Arrived on'], ['exit', 'Left from']].map(([k, l]) => (
              <button key={k} aria-pressed={pageView === k} className={pageView === k ? 'is-on' : ''} onClick={() => setPageView(k)}>{l}</button>
            ))}
          </span>}>
          {pageView === 'pages'
            ? <BarList columns={['Page', 'Views', 'Visits']} rows={data.pages.map(x => ({ key: x.path, label: x.label, bar: x.views, values: [nf(x.views), nf(x.visits)] }))} />
            : <BarList columns={['Page', 'Visits']} rows={(pageView === 'entry' ? data.entryPages : data.exitPages).map(x => ({ key: x.key, label: x.label, bar: x.visits, values: [nf(x.visits)] }))} />}
        </ChartCard>
        <ChartCard title="Devices" actions={
          <span className="viz-switch" role="group" aria-label="Which breakdown">
            {[['devices', 'Type'], ['os', 'System'], ['browsers', 'Browser']].map(([k, l]) => (
              <button key={k} aria-pressed={techView === k} className={techView === k ? 'is-on' : ''} onClick={() => setTechView(k)}>{l}</button>
            ))}
          </span>}>
          <BarList columns={[{ devices: 'Device', os: 'System', browsers: 'Browser' }[techView], 'Visits', 'Share']}
                   rows={data[techView].map(x => ({ key: x.key, label: x.key, bar: x.visits,
                     values: [nf(x.visits), pct(data.funnel[0].visits ? x.visits / data.funnel[0].visits : 0)] }))} />
          {techView === 'browsers' && (
            <p className="viz-foot">“Instagram app” and the like are visitors who opened your link inside that app.</p>
          )}
        </ChartCard>
      </div>

      <ChartCard
        className="viz-mapcard"
        title="Where visitors are"
        note="By country, read from each device’s time zone — approximate, but no one’s address is looked up."
        table={<DataTable head={['Country', 'Visits']} numeric={[1]} rows={data.countries.map(c => [regionName(c.key), nf(c.visits)])} />}>
        <div className="viz-mapgrid">
          <ChoroplethMap
            shapes={MAPS.world.countries.map(c => ({ key: c.name, d: c.d, label: c.name, code: c.code }))}
            value={(sh) => (sh.code ? countries.get(sh.code) : 0)}
            format={(v) => `${nf(v)} visits`} label="Visits by country"
            width={MAPS.world.width} height={MAPS.world.height} emptyNote="No visits yet." />
          <BarList columns={['Country', 'Visits']}
                   rows={data.countries.slice(0, 8).map(c => ({ key: c.key, label: regionName(c.key), bar: c.visits, values: [nf(c.visits)] }))} />
        </div>
      </ChartCard>

      <ChartCard
        className="viz-mapcard"
        title="Where buyers are"
        note="Nigerian states, from the delivery address on each paid order — exact."
        actions={
          <span className="viz-switch" role="group" aria-label="Shade by">
            {[['revenueKobo', 'Money in'], ['orders', 'Orders']].map(([k, l]) => (
              <button key={k} aria-pressed={stateMetric === k} className={stateMetric === k ? 'is-on' : ''} onClick={() => setStateMetric(k)}>{l}</button>
            ))}
          </span>}
        table={<DataTable head={['State', 'Orders', 'Money in']} numeric={[1, 2]} rows={data.states.map(x => [x.state, nf(x.orders), naira(x.revenueKobo)])} />}>
        <div className="viz-mapgrid">
          <ChoroplethMap
            shapes={MAPS.nigeria.states.map(st => ({ key: st.name, d: st.d, label: st.name }))}
            value={(sh) => states.get(sh.key)?.[stateMetric] ?? 0}
            format={stateMetric === 'orders' ? (v) => `${nf(v)} orders` : nairaCompact}
            label="Paid orders by state" width={MAPS.nigeria.width} height={MAPS.nigeria.height}
            emptyNote="No paid orders in this range yet." />
          <div>
            <BarList columns={['State', 'Orders', 'Money in']}
                     rows={data.states.slice(0, 8).map(x => ({ key: x.state, label: x.state, bar: x[stateMetric], values: [nf(x.orders), naira(x.revenueKobo)] }))}
                     empty="No paid orders yet." />
            {data.abroad.length > 0 && (
              <p className="viz-foot">Abroad: {data.abroad.map(a => `${a.country} ${nf(a.orders)}`).join(' · ')}</p>
            )}
            <p className="viz-foot">
              <strong>{pct(data.repeatCustomers.rate)}</strong> of everyone who has bought has come back and bought again
              ({nf(data.repeatCustomers.repeat)} of {nf(data.repeatCustomers.buyers)}).
            </p>
          </div>
        </div>
      </ChartCard>

      <ChartCard
        title="When people come"
        note="By day of the week and hour, Lagos time. Worth knowing before you set a drop time or post."
        actions={
          <span className="viz-switch" role="group" aria-label="Show">
            {[['visits', 'Visits'], ['orders', 'Orders']].map(([k, l]) => (
              <button key={k} aria-pressed={heatView === k} className={heatView === k ? 'is-on' : ''} onClick={() => setHeatView(k)}>{l}</button>
            ))}
          </span>}
        table={<DataTable head={['Day', ...Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))]} numeric={Array.from({ length: 24 }, (_, i) => i + 1)}
                          rows={heatGrid.map((row, d) => [['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d], ...row.map(nf)])} />}>
        <Heatmap grid={heatGrid} unit={heatView} />
      </ChartCard>

      <ChartCard title="Things people did">
        <div className="viz-goals">
          {GOALS.map(([key, label]) => (
            <div className="viz-goal" key={key}>
              <span className="viz-goal__n">{nf(data.goals[key]?.count ?? 0)}</span>
              <span className="viz-goal__label">{label}</span>
            </div>
          ))}
        </div>
      </ChartCard>

      <p className="admin-help viz-privacy">
        Counted without cookies and without anything that identifies a person: a visitor is a code that changes
        every day, details are deleted after 90 days, your own visits while signed in are left out, and so are
        browsers that ask not to be tracked. Someone visiting on their phone and later on a laptop counts twice.
      </p>
    </section>
  );
}
