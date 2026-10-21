import { Component } from 'react';
import { motion } from 'framer-motion';
import StateMark from './StateMark.jsx';
import StateArt from './StateArt.jsx';
import Wordmark from './Wordmark.jsx';
import { pageHref } from '../lib/media.js';

/* The owner's "Something went wrong on our end": what a customer sees if a
 * page breaks, instead of a blank screen. Plain links rather than the
 * router, since the router may be what broke. The bag is in the browser's
 * storage, so it is still there after a reload. */

export function ErrorScreen() {
  return (
    <div className="status">
      <header className="status__bar"><a href={pageHref('/')} className="logo"><Wordmark /></a><a href={pageHref('/')} className="status__back"><span aria-hidden="true">←</span> Back to the shop</a></header>
      <motion.main className="status__panel status__panel--bad" role="alert"
                   initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                   transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}>
        <StateArt tone="bad" />
        <div className="status__inner">
          <div className="status__head">
            <p className="error-code" aria-hidden="true">500</p>
            <StateMark tone="bad" size="lg" delay={0.15} />
            <h1 className="status__title">Something went wrong on our end</h1>
            <p className="status__note">We’re sorry. Please try again; your bag is still saved. If it keeps happening, come back in a few minutes.</p>
          </div>
          <button type="button" className="btn btn--danger btn--block" onClick={() => window.location.reload()}>TRY AGAIN</button>
          <a className="btn btn--ghost btn--block state-panel__second" href={pageHref('/')}>BACK TO THE SHOP</a>
        </div>
      </motion.main>
    </div>
  );
}

export default class ErrorBoundary extends Component {
  state = { broken: false };
  static getDerivedStateFromError() { return { broken: true }; }
  componentDidCatch(error, info) { console.error('[page] broke:', error, info?.componentStack); }
  render() { return this.state.broken ? <ErrorScreen /> : this.props.children; }
}
