import { useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import ShopLayout from '../components/ShopLayout.jsx';
import Hero from '../components/Hero.jsx';
import CraftBand from '../components/CraftBand.jsx';
import DropGrid from '../components/DropGrid.jsx';
import Manifesto from '../components/Manifesto.jsx';
import FilmStrip from '../components/FilmStrip.jsx';
import Essentials from '../components/Essentials.jsx';
import Newsletter from '../components/Newsletter.jsx';
import { useShop } from '../store/ShopContext.jsx';
import { scrollToId } from '../lib/scroll.js';

export default function Storefront() {
  const { openOverlay, catalogueStatus } = useShop();
  const { hash } = useLocation();

  // "Back to your bag" from an unfinished payment lands with the bag open.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('bag') !== 'open') return;
    openOverlay('cart');
    params.delete('bag');
    setParams(params, { replace: true });
  }, [params, setParams, openOverlay]);

  // Arriving from a product page's menu ("/#drop"): wait until the products
  // are in, so the sections are their full height, then go to the one asked for.
  const landed = useRef(null);
  useEffect(() => {
    if (!hash || catalogueStatus === 'loading' || catalogueStatus === 'idle' || landed.current === hash) return;
    landed.current = hash;
    requestAnimationFrame(() => scrollToId(hash));
  }, [hash, catalogueStatus]);

  return (
    <ShopLayout>
      <span id="top" />
      <Hero />
      <CraftBand />
      <DropGrid />
      <Manifesto />
      <FilmStrip />
      <Essentials />
      <Newsletter />
    </ShopLayout>
  );
}
