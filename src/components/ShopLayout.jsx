import { useEffect } from 'react';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import Overlays from './Overlays.jsx';
import Toasts from './Toasts.jsx';
import { SiteBar, Maintenance } from './SiteNotices.jsx';
import { useShop } from '../store/ShopContext.jsx';
import { startSmoothScroll } from '../lib/smoothScroll.js';

/* What every customer-facing page shares: the header with the bag, the
 * footer, the drawers and the toasts. The catalogue is fetched on arrival at
 * each page, so a change made in the admin shows the next time anyone looks. */
export default function ShopLayout({ children }) {
  const { loadCatalogue, site } = useShop();
  useEffect(() => { loadCatalogue(); }, [loadCatalogue]);
  useEffect(() => startSmoothScroll(), []);

  // Closed for maintenance: "We'll be back soon", except for the owner,
  // signed in to the admin, who sees the shop with a note across the top.
  const closed = site?.maintenance && !site.maintenance.ownerView;
  if (closed) return <><Maintenance {...site.maintenance} /><Toasts /></>;

  return (
    <>
      <SiteBar />
      {/* Moves focus itself rather than following "#main", which the
          preview build would read as a page address. */}
      <a className="skip-link" href="#main" onClick={(e) => {
        e.preventDefault();
        document.getElementById('main')?.focus();
      }}>Skip to content</a>
      <Header />
      <main id="main" tabIndex={-1}>{children}</main>
      <Footer />
      <Overlays />
      <Toasts />
    </>
  );
}
