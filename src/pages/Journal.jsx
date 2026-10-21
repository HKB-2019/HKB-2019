import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import ShopLayout from '../components/ShopLayout.jsx';
import Reveal from '../components/Reveal.jsx';
import { JoinForm } from '../components/Newsletter.jsx';
import { ErrorBanner, detailsOf } from '../components/Notices.jsx';
import { ArrowShort, Copy, Check, XIcon } from '../components/Icons.jsx';
import { useShop } from '../store/ShopContext.jsx';
import { getJournal, getStory } from '../lib/api.js';
import { asset } from '../lib/media.js';
import { scrollToId } from '../lib/scroll.js';
import { TOPICS, topicOf, JOURNAL_HOME } from '../data/journal.js';
import { EASE_OUT } from '../lib/motion.js';

/* The MASQ. Journal, from the owner's boards: its front page, a page for
 * each of the six topics, and the story page. Stories come from the server
 * (the owner writes them in the admin's JOURNAL tab); the topics, their
 * headlines and their side panels are fixed in src/data/journal.js.
 *
 * Every section is drawn only when it has stories to show, so a topic with
 * one story is a short page rather than a page of gaps. */

const shortDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
const meta = (s) => `${shortDate(s.publishedAt)} · ${s.readMinutes} MIN READ`;
const srcSet = (s) => (s.img2x ? `${s.img} 1x, ${s.img2x} 2x` : undefined);
const Arrow = () => <span className="jr-go" aria-hidden="true"><ArrowShort /></span>;

/* All the stories, fetched once a visit and shared by every Journal page. */
let cache = null;
function useStories() {
  const [stories, setStories] = useState(cache);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const load = useCallback(async () => {
    setRetrying(true);
    try { cache = await getJournal(); setStories(cache); setError(null); } catch (err) { setError(err); }
    setRetrying(false);
  }, []);
  useEffect(() => { if (!cache) load(); }, [load]);
  return { stories, error, retrying, load };
}

function useTitle(title) {
  useEffect(() => {
    const was = document.title;
    document.title = `${title} — MASQ. Journal`;
    return () => { document.title = was; };
  }, [title]);
}

/* ------------------------------------------------------------- the pieces */

function Hero({ crumb, eyebrow, lines, sub, buttons, scribble, img }) {
  return (
    <section className="jr-hero">
      <div className="jr-hero__photo" aria-hidden="true"><img src={asset(img)} alt="" /></div>
      <div className="jr-hero__inner">
        {crumb && (
          <nav className="jr-crumb" aria-label="Breadcrumb">
            <Link to="/journal">Journal</Link><span aria-hidden="true">›</span><span aria-current="page">{crumb}</span>
          </nav>
        )}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }}>
          <p className="jr-eyebrow">{eyebrow}</p>
          <h1 className="jr-hero__title">
            {lines.map((l, i) => <span key={l} className={i === lines.length - 1 ? 'is-accent' : undefined}>{l}</span>)}
          </h1>
          <p className="jr-hero__sub">{sub}</p>
          {buttons && <div className="jr-hero__buttons">{buttons}</div>}
        </motion.div>
      </div>
      {scribble && (
        <p className="jr-scribble" aria-hidden="true">{scribble.map(w => <span key={w}>{w}</span>)}<i /></p>
      )}
    </section>
  );
}

function Chips({ active }) {
  return (
    <nav className="jr-chips" aria-label="Journal topics">
      <Link to="/journal" className={`jr-chip${!active ? ' is-on' : ''}`} aria-current={!active ? 'page' : undefined}>ALL</Link>
      {TOPICS.map(t => (
        <Link key={t.key} to={`/journal/${t.key}`} className={`jr-chip${active === t.key ? ' is-on' : ''}`}
              aria-current={active === t.key ? 'page' : undefined}>{t.name.toUpperCase()}</Link>
      ))}
    </nav>
  );
}

const linkTo = (s) => `/journal/story/${s.slug}`;

/** A big story: the photo full-bleed, the words over its dark side. */
function Feature({ s, size = 'big', label = 'READ STORY' }) {
  return (
    <Link to={linkTo(s)} className={`jr-feature jr-feature--${size}`}>
      {s.img && <img src={s.img} srcSet={srcSet(s)} alt="" loading="lazy" />}
      <span className="jr-feature__text">
        <span className="jr-eyebrow">{topicOf(s.topic)?.name.toUpperCase()}</span>
        <span className="jr-feature__title">{s.title}</span>
        {size === 'big' && s.dek && <span className="jr-feature__dek">{s.dek}</span>}
        <span className="jr-meta">{meta(s)}</span>
        {size === 'big' ? <span className="jr-more">{label} <ArrowShort /></span> : <Arrow />}
      </span>
    </Link>
  );
}

function Card({ s }) {
  return (
    <Link to={linkTo(s)} className="jr-card">
      <span className="jr-card__photo">{s.img && <img src={s.img} srcSet={srcSet(s)} alt="" loading="lazy" />}</span>
      <span className="jr-card__text">
        <span className="jr-eyebrow">{topicOf(s.topic)?.name.toUpperCase()}</span>
        <span className="jr-card__title">{s.title}</span>
        {s.dek && <span className="jr-card__dek">{s.dek}</span>}
        <span className="jr-card__foot"><span className="jr-meta">{meta(s)}</span><Arrow /></span>
      </span>
    </Link>
  );
}

function Mini({ s }) {
  return (
    <Link to={linkTo(s)} className="jr-mini">
      <span className="jr-mini__photo">{s.img && <img src={s.img} srcSet={srcSet(s)} alt="" loading="lazy" />}</span>
      <span className="jr-mini__foot">
        <span><span className="jr-mini__title">{s.title}</span><span className="jr-meta">{s.readMinutes} MIN READ</span></span>
        <Arrow />
      </span>
    </Link>
  );
}

function SideList({ title, stories, id }) {
  return (
    <aside className="jr-side" id={id}>
      <h2 className="jr-head">{title}</h2>
      <ol className="jr-list">
        {stories.map((s, i) => (
          <li key={s.slug}>
            <Link to={linkTo(s)}>
              <span className="jr-list__photo">{s.img && <img src={s.img} alt="" loading="lazy" />}</span>
              <b>{String(i + 1).padStart(2, '0')}</b>
              <span><span className="jr-list__title">{s.title}</span><span className="jr-meta">{s.readMinutes} MIN READ</span></span>
            </Link>
          </li>
        ))}
      </ol>
    </aside>
  );
}

/* Behind the Design's side panel is the process itself. */
function Process({ title, steps, id }) {
  return (
    <aside className="jr-side" id={id}>
      <h2 className="jr-head">{title}</h2>
      <ol className="jr-list jr-list--steps">
        {steps.map(([name, note], i) => (
          <li key={name}><div>
            <b>{String(i + 1).padStart(2, '0')}</b>
            <span><span className="jr-list__title">{name}</span><span className="jr-list__note">{note}</span></span>
          </div></li>
        ))}
      </ol>
    </aside>
  );
}

function Promo({ promo, img, go }) {
  return (
    <div className="jr-promo">
      <img src={asset(img)} alt="" loading="lazy" />
      <div>
        <h2 className="jr-promo__title">{promo.title}</h2>
        <p>{promo.text}</p>
        <button type="button" className="btn btn--ghost jr-promo__go" onClick={() => go(promo.to)}>{promo.button} <ArrowShort className="btn__arrow" /></button>
      </div>
    </div>
  );
}

function Quote({ text, span = 1 }) {
  return (
    <figure className="jr-quote" style={span > 1 ? { gridColumn: `span ${span}` } : undefined}>
      <span className="jr-quote__mark" aria-hidden="true">“</span>
      <blockquote>{text}”</blockquote>
      <figcaption>MASQ. JOURNAL</figcaption>
    </figure>
  );
}

/* The board's sign-up band: a texture photo, the words, the email box. */
function Band({ title = 'Stories. Drops. Culture.' }) {
  const { toast } = useShop();
  return (
    <section className="jr-band" id="list" aria-labelledby="jr-band-title">
      <img src={asset('assets/img/band-design.webp')} alt="" aria-hidden="true" />
      <div className="jr-band__inner">
        <p className="jr-eyebrow">STAY IN THE LOOP</p>
        <h2 className="jr-band__title" id="jr-band-title">{title}</h2>
        <p className="jr-band__note">Be the first to get new stories, exclusive content and early access to upcoming collections.</p>
        <JoinForm id="journal-email" onJoined={() => toast({ tone: 'ok', title: 'You’re on the list', body: 'Welcome to the world of MASQ.' })} />
      </div>
    </section>
  );
}

/* One piece fills the row; otherwise three or four to a row. */
const columns = (n) => (n <= 1 ? 1 : Math.min(4, Math.max(3, n)));

/* Somewhere to go: a page of this site ("/#drop"), or a part of this page ("#row"). */
function useGo() {
  const navigate = useNavigate();
  return (to) => (to.startsWith('#') ? scrollToId(document.querySelector(to) ? to : '#stories') : navigate(to));
}

function Loading() {
  return (
    <div className="jr-wrap jr-loading" aria-busy="true" aria-label="Loading stories">
      <div className="jr-ghost jr-ghost--big" />
      <div className="jr-ghost-row">{[0, 1, 2].map(i => <div key={i} className="jr-ghost" />)}</div>
    </div>
  );
}

function Problem({ error, retrying, load }) {
  return (
    <div className="jr-wrap">
      <ErrorBanner layout="panel" picture={error.status === 0 ? 'offline' : 'list'} title="We couldn’t load the Journal."
                   text="Please check your connection and try again." onRetry={load} retrying={retrying} retryLabel="Retry" details={detailsOf(error)} />
    </div>
  );
}

/* ------------------------------------------------------------ the pages */

export function JournalHome() {
  useTitle('Culture. Style. Identity.');
  const { stories, error, retrying, load } = useStories();
  const [all, setAll] = useState(false);
  const featured = (stories ?? []).filter(s => s.featured).slice(0, 3);
  const rest = (stories ?? []).filter(s => !featured.includes(s));
  const latest = all ? rest : rest.slice(0, 4);

  return (
    <ShopLayout footerJoin={false}>
      <Hero eyebrow="THE MASQ. JOURNAL" {...JOURNAL_HOME}
            buttons={<button type="button" className="btn btn--solid" onClick={() => scrollToId('#stories')}>EXPLORE STORIES <ArrowShort className="btn__arrow" /></button>} />
      <Chips />
      {error && !stories ? <Problem error={error} retrying={retrying} load={load} /> : !stories ? <Loading /> : (
        <div className="jr-wrap" id="stories">
          {featured.length > 0 && (
            <Reveal as="section" className="jr-section" aria-labelledby="jr-featured">
              <h2 className="jr-head" id="jr-featured">FEATURED STORIES</h2>
              <div className="jr-featured">
                <Feature s={featured[0]} />
                {featured.length > 1 && <div className="jr-featured__side">{featured.slice(1).map(s => <Feature key={s.slug} s={s} size="small" />)}</div>}
              </div>
            </Reveal>
          )}
          {rest.length > 0 && (
            <Reveal as="section" className="jr-section" aria-labelledby="jr-latest">
              <div className="jr-head-row">
                <h2 className="jr-head" id="jr-latest">LATEST STORIES</h2>
                {rest.length > 4 && (
                  <button type="button" className="jr-all" onClick={() => setAll(a => !a)}>{all ? 'SHOW FEWER' : 'VIEW ALL'} <ArrowShort /></button>
                )}
              </div>
              <div className="jr-grid jr-grid--4">{latest.map(s => <Card key={s.slug} s={s} />)}</div>
            </Reveal>
          )}
        </div>
      )}
      <Band />
    </ShopLayout>
  );
}

export function JournalTopic() {
  const { topic: key } = useParams();
  const topic = topicOf(key);
  useTitle(topic?.name ?? 'Journal');
  const { stories, error, retrying, load } = useStories();
  const go = useGo();
  if (!topic) return <Navigate to="/journal" replace />;

  const mine = (stories ?? []).filter(s => s.topic === topic.key);
  const lead = mine.find(s => s.featured) ?? mine[0];
  const others = mine.filter(s => s !== lead);
  const latest = others.slice(0, 3);
  const row = others.slice(3, 7);
  const pieces = latest.length + (topic.promo ? 1 : 0) + (row.length ? 0 : 1);
  const cols = columns(pieces);
  // Trending: the Journal's picks first, then the newest, from every topic.
  const trending = (stories ?? []).filter(s => s !== lead && !latest.includes(s))
    .sort((a, b) => (b.pick - a.pick) || b.publishedAt.localeCompare(a.publishedAt)).slice(0, 5);

  return (
    <ShopLayout footerJoin={false}>
      <Hero crumb={topic.name} eyebrow={topic.name.toUpperCase()} lines={topic.lines} sub={topic.sub} scribble={topic.scribble} img={topic.img}
            buttons={<>
              <button type="button" className="btn btn--solid" onClick={() => scrollToId('#stories')}>EXPLORE STORIES <ArrowShort className="btn__arrow" /></button>
              {topic.second && <button type="button" className="btn btn--ghost jr-hero__second" onClick={() => go(topic.second.to)}>{topic.second.label} <ArrowShort className="btn__arrow" /></button>}
            </>} />
      <Chips active={topic.key} />
      {error && !stories ? <Problem error={error} retrying={retrying} load={load} /> : !stories ? <Loading /> : (
        <div className="jr-wrap" id="stories">
          {!lead ? (
            <div className="empty jr-empty">
              <h2 className="empty__title">Stories are on their way.</h2>
              <p className="empty__text">Nothing in {topic.name} yet. Join the list below to hear when the first one lands.</p>
              <Link className="btn btn--ghost" to="/journal">BACK TO THE JOURNAL</Link>
            </div>
          ) : (
            <>
              <div className="jr-top">
                <Reveal as="section" className="jr-section" aria-labelledby="jr-featured">
                  <h2 className="jr-head" id="jr-featured">FEATURED STORY</h2>
                  <Feature s={lead} />
                </Reveal>
                {topic.process ? <Process id="side" title={topic.side} steps={topic.process} />
                  : trending.length > 0 && <SideList id="side" title={topic.side} stories={trending.slice(0, 4)} />}
              </div>
              {/* Latest, the topic's card, and (when nothing else follows) the
                  quote: in one row, as many columns as there are pieces. */}
              <Reveal as="section" className="jr-section" aria-labelledby={latest.length ? 'jr-latest' : undefined}>
                {latest.length > 0 && <h2 className="jr-head" id="jr-latest">LATEST STORIES</h2>}
                <div className="jr-grid jr-grid--promo" style={{ '--cols': cols }}>
                  {latest.map(s => <Card key={s.slug} s={s} />)}
                  {topic.promo && <Promo promo={topic.promo} img={topic.img} go={go} />}
                  {/* The quote takes up whatever the row has left. */}
                  {!row.length && <Quote text={topic.quote} span={cols - pieces + 1} />}
                </div>
              </Reveal>
              {row.length > 0 && (
                <Reveal as="section" className="jr-section" id="row" aria-labelledby="jr-row">
                  <h2 className="jr-head" id="jr-row">{topic.row}</h2>
                  <div className="jr-grid jr-grid--row">
                    {row.map(s => <Mini key={s.slug} s={s} />)}
                    <Quote text={topic.quote} />
                  </div>
                </Reveal>
              )}
            </>
          )}
        </div>
      )}
      <Band title={topic.key === 'people-creatives' || topic.key === 'lifestyle-community' ? 'Stories. People. Culture.' : undefined} />
    </ShopLayout>
  );
}

/* Story text: blank lines make paragraphs, "## " a heading, "> " a quote. */
function Body({ text }) {
  const blocks = String(text ?? '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  let dropped = false;
  return blocks.map((b, i) => {
    if (b.startsWith('## ')) return <h2 key={i} className="jr-body__head">{b.slice(3)}</h2>;
    if (b.startsWith('>')) return <blockquote key={i} className="jr-body__quote">{b.replace(/^>\s?/gm, '')}</blockquote>;
    const first = !dropped; dropped = true;
    return <p key={i} className={first ? 'jr-body__first' : undefined}>{b.split('\n').map((l, n) => <span key={n}>{n > 0 && <br />}{l}</span>)}</p>;
  });
}

function Share({ title }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* not allowed */ }
  };
  const enc = encodeURIComponent;
  return (
    <div className="jr-share">
      <span>Share</span>
      <button type="button" onClick={copy} aria-label={copied ? 'Link copied' : 'Copy the link'}>{copied ? <Check /> : <Copy />}</button>
      <a href={`https://x.com/intent/post?text=${enc(title)}&url=${enc(url)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on X"><XIcon /></a>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7.5H16l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21z" /></svg>
      </a>
      <a href={`https://wa.me/?text=${enc(`${title} ${url}`)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.2 20.8l4.5-1.2A8.8 8.8 0 1 0 12 3.2zm0 16a7.2 7.2 0 0 1-3.7-1l-.3-.2-2.7.7.7-2.6-.2-.3A7.2 7.2 0 1 1 12 19.2zm4-5.4c-.2-.1-1.3-.6-1.5-.7s-.3-.1-.5.1-.6.7-.7.9-.3.2-.5.1a5.9 5.9 0 0 1-2.9-2.6c-.2-.4.2-.4.6-1.2.1-.1 0-.3 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.4a.8.8 0 0 0-.6.3 2.5 2.5 0 0 0-.8 1.9 4.4 4.4 0 0 0 .9 2.3 10 10 0 0 0 3.8 3.4c1.4.6 2 .7 2.7.6.4-.1 1.3-.5 1.5-1.1s.2-1 .1-1.1-.1-.1-.3-.2z" /></svg>
      </a>
    </div>
  );
}

export function JournalStory() {
  const { slug } = useParams();
  const [story, setStory] = useState(null);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const load = useCallback(async () => {
    setRetrying(true);
    try { setStory(await getStory(slug)); setError(null); } catch (err) { setError(err); }
    setRetrying(false);
  }, [slug]);
  useEffect(() => { setStory(null); load(); window.scrollTo(0, 0); }, [load]);
  useTitle(story?.title ?? 'Journal');
  const topic = story && topicOf(story.topic);

  return (
    <ShopLayout footerJoin={false}>
      {error && !story ? (
        <div className="jr-wrap jr-story-missing">
          {error.status === 404 ? (
            <div className="empty jr-empty">
              <h1 className="empty__title">That story isn’t here.</h1>
              <p className="empty__text">It may have moved, or been taken down.</p>
              <Link className="btn btn--contrast" to="/journal">BACK TO THE JOURNAL</Link>
            </div>
          ) : <Problem error={error} retrying={retrying} load={load} />}
        </div>
      ) : !story ? <Loading /> : (
        <article className="jr-story">
          <header className="jr-story__hero">
            {story.img && <div className="jr-hero__photo" aria-hidden="true"><img src={story.img2x ?? story.img} alt="" /></div>}
            <div className="jr-story__head">
              <Link to={topic ? `/journal/${topic.key}` : '/journal'} className="jr-back"><span aria-hidden="true">←</span> Back to {topic?.name ?? 'Journal'}</Link>
              <p className="jr-eyebrow">{topic?.name.toUpperCase()}</p>
              <h1 className="jr-story__title">{story.title}</h1>
              {story.dek && <p className="jr-story__dek">{story.dek}</p>}
              <div className="jr-byline">
                <span className="jr-byline__mark" aria-hidden="true">M.</span>
                <span><b>By {story.author}</b><span className="jr-meta">{meta(story)}</span></span>
                <Share title={story.title} />
              </div>
            </div>
          </header>
          <div className={`jr-story__body${story.quote ? ' has-quote' : ''}`}>
            <div className="jr-body"><Body text={story.body} /></div>
            {story.quote && (
              <aside className="jr-pull"><i aria-hidden="true" /><p>“{story.quote}”</p><i aria-hidden="true" /></aside>
            )}
          </div>
          {story.related.length > 0 && (
            <Reveal as="section" className="jr-wrap jr-section" aria-labelledby="jr-related">
              <h2 className="jr-head" id="jr-related">RELATED STORIES</h2>
              <div className="jr-grid jr-grid--3">{story.related.map(s => <Card key={s.slug} s={s} />)}</div>
            </Reveal>
          )}
        </article>
      )}
      <Band />
    </ShopLayout>
  );
}
