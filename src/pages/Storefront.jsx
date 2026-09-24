import Header from '../components/Header.jsx';
import Hero from '../components/Hero.jsx';
import CraftBand from '../components/CraftBand.jsx';
import DropGrid from '../components/DropGrid.jsx';
import Manifesto from '../components/Manifesto.jsx';
import FilmStrip from '../components/FilmStrip.jsx';
import Essentials from '../components/Essentials.jsx';
import Newsletter from '../components/Newsletter.jsx';
import Footer from '../components/Footer.jsx';
import Overlays from '../components/Overlays.jsx';
import Toasts from '../components/Toasts.jsx';

export default function Storefront() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <span id="top" />
        <Hero />
        <CraftBand />
        <DropGrid />
        <Manifesto />
        <FilmStrip />
        <Essentials />
        <Newsletter />
      </main>
      <Footer />
      <Overlays />
      <Toasts />
    </>
  );
}
