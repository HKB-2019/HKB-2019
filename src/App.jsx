import { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { trackPageview } from './lib/analytics.js';
import Storefront from './pages/Storefront.jsx';
import OrderStatus from './pages/OrderStatus.jsx';
import Admin from './pages/Admin.jsx';
import ProductPage from './pages/ProductPage.jsx';
import { previewRoutes, PreviewBanner } from './lib/preview.jsx';

// The preview is one page on someone else's site, so its pages live after
// the # in the address. The real shop has real addresses.
const Router = import.meta.env.VITE_DEMO ? HashRouter : BrowserRouter;

/** Counts each page shown (see src/lib/analytics.js). */
function PageTracker() {
  const { pathname } = useLocation();
  useEffect(() => { trackPageview(); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Storefront />} />
        <Route path="/product/:id" element={<ProductPage />} />
        {/* where Paystack sends the customer back */}
        <Route path="/order" element={<OrderStatus />} />
        <Route path="/admin" element={<Admin />} />
        {previewRoutes}
        <Route path="*" element={<Storefront />} />
      </Routes>
      <PreviewBanner />
      <PageTracker />
    </Router>
  );
}
