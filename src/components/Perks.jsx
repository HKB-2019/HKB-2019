import Reveal from './Reveal.jsx';
import { useHome } from '../store/ShopContext.jsx';

/* Three promises: delivery, returns, payment. The words are the owner's
 * (Home page → Words), kept to what the Delivery and Returns pages say. */

const ICONS = [
  // a van
  <svg viewBox="0 0 40 40" key="van" aria-hidden="true"><path d="M3 11h20v16H3zM23 16h8l6 6v5H23z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><circle cx="10" cy="29" r="3" fill="var(--bg)" stroke="currentColor" strokeWidth="1.6"/><circle cx="30" cy="29" r="3" fill="var(--bg)" stroke="currentColor" strokeWidth="1.6"/></svg>,
  // a parcel coming back
  <svg viewBox="0 0 40 40" key="back" aria-hidden="true"><path d="M20 5 34 12v16L20 35 6 28V12z M6 12l14 7 14-7 M20 19v16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M11 6.5 4 9.5l2.5 6.5" fill="none" stroke="var(--violet-soft)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  // a padlock on a shield
  <svg viewBox="0 0 40 40" key="lock" aria-hidden="true"><path d="M20 4 33 9v10c0 8-5.5 14-13 17C12.5 33 7 27 7 19V9z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><rect x="14" y="18" width="12" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M16.5 18v-2.5a3.5 3.5 0 0 1 7 0V18" fill="none" stroke="var(--violet-soft)" strokeWidth="1.6"/></svg>
];

export default function Perks() {
  const { home } = useHome();
  const perks = [1, 2, 3].map(n => [home[`perk${n}Title`], home[`perk${n}Text`]]).filter(([t]) => t);
  if (perks.length === 0) return null;
  return (
    <Reveal as="section" className="perks" aria-label="Delivery, returns and payment">
      {perks.map(([title, text], i) => (
        <div className="perk" key={title}>
          {ICONS[i]}
          <div>
            <h3 className="perk__title">{title}</h3>
            {text && <p className="perk__text">{text}</p>}
          </div>
        </div>
      ))}
    </Reveal>
  );
}
