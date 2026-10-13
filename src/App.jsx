import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { trackPageview } from './lib/analytics.js';
import Storefront from './pages/Storefront.jsx';
import OrderStatus from './pages/OrderStatus.jsx';
import ProductPage from './pages/ProductPage.jsx';
import { previewRoutes, PreviewBanner } from './lib/preview.jsx';

// The preview is one page on someone else's site, so its pages live after
// the # in the address. The real shop has real addresses.
const Router = import.meta.env.VITE_DEMO ? HashRouter : BrowserRouter;

// The admin is fetched only when someone opens it, so shoppers' phones never
// download it.
const Admin = lazy(() => import('./pages/Admin.jsx'));

/** Counts each page shown (see src/lib/analytics.js). */
function PageTracker() {
  const { pathname } = useLocation();
  useEffect(() => { trackPageview(); }, [pathname]);
  return null;
}

export default function App() {
  return (
    // Page changes apply at once rather than in the background, so the
    // browser's page transition can picture the new page (src/lib/pageMorph.js).
    <Router useTransitions={false}>
      <Routes>
        <Route path="/" element={<Storefront />} />
        <Route path="/product/:id" element={<ProductPage />} />
        {/* where Paystack sends the customer back */}
        <Route path="/order" element={<OrderStatus />} />
        <Route path="/admin" element={<Suspense fallback={null}><Admin /></Suspense>} />
        {previewRoutes}
        <Route path="*" element={<Storefront />} />
      </Routes>
      <PreviewBanner />
      <PageTracker />
    </Router>
  );
}
