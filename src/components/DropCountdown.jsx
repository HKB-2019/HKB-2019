import { useEffect, useState } from 'react';
import { useShop, useHome } from '../store/ShopContext.jsx';
import { scrollToId } from '../lib/scroll.js';
import { ArrowShort } from './Icons.jsx';

const pad = (n) => String(n).padStart(2, '0');

/* Shown while pieces are waiting for their drop time (set per product in the
 * admin). When the time comes, the shop reloads its catalogue and the pieces
 * appear — nobody has to switch anything on. */
export default function DropCountdown() {
  const { site, loadCatalogue } = useShop();
  const { home } = useHome();
  const at = site?.nextDrop?.at ? new Date(site.nextDrop.at).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!at) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [at]);

  const left = at ? at - now : 0;
  useEffect(() => {
    // A second's grace so the server's clock has passed it too.
    if (at && left <= 0) { const t = setTimeout(loadCatalogue, 1500); return () => clearTimeout(t); }
  }, [at, left <= 0, loadCatalogue]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!at || left <= 0) return null;

  const s = Math.floor(left / 1000);
  const parts = [
    [Math.floor(s / 86400), 'DAYS'], [Math.floor(s / 3600) % 24, 'HRS'],
    [Math.floor(s / 60) % 60, 'MIN'], [s % 60, 'SEC']
  ];
  const when = new Date(at).toLocaleString('en-GB', {
    timeZone: 'Africa/Lagos', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
  });

  return (
    <section className="countdown" aria-labelledby="countdown-title">
      <div className="countdown__inner">
        <p className="eyebrow" id="countdown-title">{home.countdownTitle}</p>
        <p className="countdown__clock" role="timer" aria-label={`Opens ${when}, Lagos time`}>
          {parts.map(([n, unit]) => (
            <span key={unit}><b>{pad(n)}</b><small>{unit}</small></span>
          ))}
        </p>
        <p className="countdown__when">{when} · Lagos time</p>
        <a href="#list" className="btn btn--solid" onClick={(e) => { e.preventDefault(); scrollToId('.newsletter'); }}>
          JOIN THE LIST TO HEAR FIRST <ArrowShort className="btn__arrow" />
        </a>
      </div>
    </section>
  );
}
