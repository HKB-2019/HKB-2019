import { useEffect, useRef, useState } from 'react';
import {
  adminJournal, adminAddStory, adminSaveStory, adminDeleteStory, adminStoryImage, adminRemoveStoryImage
} from '../../lib/api.js';
import { preparePhoto, STORY } from '../../lib/photo.js';
import { pageHref, NEW_TAB } from '../../lib/media.js';
import { TOPICS, topicOf } from '../../data/journal.js';
import Dialog from '../../components/Dialog.jsx';
import StateMark, { TrashMark } from '../../components/StateMark.jsx';

/* The Journal's writing desk: every story, live or not, and a form to write
 * or change one. A story shows in the shop once it is not hidden and its
 * publish time has come. Text is plain: a blank line starts a paragraph,
 * "## " a heading, "> " a quote set apart. */

const when = (iso) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
// "2026-10-21T09:00" for the date box, in the computer's own time.
const local = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const BLANK = { title: '', topic: TOPICS[0].key, dek: '', body: '', quote: '', author: 'MASQ. Editorial Team', featured: false, pick: false, hidden: true, publishedAt: '' };

function Note({ state }) {
  if (!state) return null;
  if (state === 'saving') return <span className="admin-note">saving…</span>;
  if (state === 'saved') return <span className="admin-note admin-note--ok">saved</span>;
  return <span className="admin-note admin-note--bad" role="alert">{state}</span>;
}

function Status({ s }) {
  if (s.hidden) return <span className="admin-status admin-status--abandoned">HIDDEN</span>;
  if (!s.live) return <span className="admin-status admin-status--pending">SCHEDULED</span>;
  return <span className="admin-status admin-status--paid">LIVE</span>;
}

function Toggle({ checked, onChange, children }) {
  return (
    <label className="admin-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="admin-toggle__box" aria-hidden="true" />{children}
    </label>
  );
}

function Editor({ story, onSaved, onCancel }) {
  const [f, setF] = useState(() => story
    ? { ...story, publishedAt: local(story.publishedAt) }
    : { ...BLANK, publishedAt: local(new Date().toISOString()) });
  const [state, setState] = useState(null);
  const [field, setField] = useState(null);
  const [photo, setPhoto] = useState(null);
  const fileRef = useRef(null);
  const set = (k) => (v) => { setF(x => ({ ...x, [k]: v })); setField(null); };
  const bad = (k) => (field === k ? 'is-error' : undefined);

  const save = async (e) => {
    e.preventDefault();
    setState('saving');
    const body = { ...f, publishedAt: f.publishedAt ? new Date(f.publishedAt).toISOString() : undefined };
    try {
      if (story) onSaved(await adminSaveStory(story.slug, body), story.slug);
      else { const r = await adminAddStory(body); onSaved(r.stories, r.slug); }
      setState('saved');
      setTimeout(() => setState(s => (s === 'saved' ? null : s)), 1600);
    } catch (err) { setState(err.message); setField(err.field ?? null); }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !story) return;
    setPhoto('saving');
    try {
      const p = await preparePhoto(file, STORY);
      onSaved(await adminStoryImage(story.slug, p.image, p.image2x), story.slug);
      setPhoto(p.small ? `Saved. This photo is only ${p.width} px wide, so it may look soft at the top of the story.` : 'saved');
    } catch (err) { setPhoto(err.message); }
  };

  return (
    <form className="admin-card admin-story" onSubmit={save} noValidate>
      <div className="admin-section__head">
        <h3 className="admin-card__title">{story ? 'Edit story' : 'New story'}</h3>
        {story?.live && <a className="admin-link" href={pageHref(`/journal/story/${story.slug}`)} {...NEW_TAB}>see it in the shop ↗</a>}
      </div>
      <label className="admin-field">Title
        <input value={f.title} maxLength={120} onChange={(e) => set('title')(e.target.value)} className={bad('title')} />
      </label>
      <div className="admin-story__two">
        <label className="admin-field">Topic
          <select value={f.topic} onChange={(e) => set('topic')(e.target.value)} className={bad('topic')}>
            {TOPICS.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
          </select>
        </label>
        <label className="admin-field">Publish<em> (it shows from this time)</em>
          <input type="datetime-local" value={f.publishedAt} onChange={(e) => set('publishedAt')(e.target.value)} className={bad('publishedAt')} />
        </label>
      </div>
      <label className="admin-field">Summary<em> (under the title, and on the story’s card)</em>
        <textarea rows={2} maxLength={300} value={f.dek} onChange={(e) => set('dek')(e.target.value)} className={bad('dek')} />
      </label>
      <label className="admin-field">Story<em> — a blank line starts a new paragraph; start a line with ## for a heading, or &gt; for a quote</em>
        <textarea rows={16} maxLength={30000} value={f.body} onChange={(e) => set('body')(e.target.value)} className={bad('body')} />
      </label>
      <label className="admin-field">Pull quote<em> (optional: shown large beside the story)</em>
        <input value={f.quote} maxLength={240} onChange={(e) => set('quote')(e.target.value)} className={bad('quote')} />
      </label>
      <label className="admin-field">Author
        <input value={f.author} maxLength={60} onChange={(e) => set('author')(e.target.value)} className={bad('author')} />
      </label>
      <div className="admin-story__toggles">
        <Toggle checked={!f.hidden} onChange={(v) => set('hidden')(!v)}>Show in the shop</Toggle>
        <Toggle checked={f.featured} onChange={set('featured')}>Featured <em>(top of the Journal and its topic)</em></Toggle>
        <Toggle checked={f.pick} onChange={set('pick')}>Editor’s pick <em>(first in “Trending”)</em></Toggle>
      </div>
      <div className="admin-story__photo">
        {story?.img ? <img src={story.img} alt="" /> : <span className="admin-home-photo__empty">No photo yet</span>}
        <div>
          <p className="admin-help">{story
            ? 'The photo at the top of the story and on its card. A wide picture works best, with the subject towards the right.'
            : 'Save the story first, then add its photo.'}</p>
          {story && (
            <div className="admin-product__photo-actions">
              <button type="button" className="admin-action" onClick={() => fileRef.current?.click()}>{story.img ? 'CHANGE PHOTO' : 'ADD PHOTO'}</button>
              {story.hasUpload && (
                <button type="button" className="admin-link" onClick={async () => {
                  setPhoto('saving');
                  try { onSaved(await adminRemoveStoryImage(story.slug), story.slug); setPhoto('saved'); } catch (err) { setPhoto(err.message); }
                }}>remove your photo</button>
              )}
              <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp,image/heic" aria-label="Photo for this story" onChange={onFile} />
              <Note state={photo} />
            </div>
          )}
        </div>
      </div>
      <div className="admin-card__foot">
        <button type="submit" className="admin-action admin-action--primary" disabled={state === 'saving'}>{story ? 'SAVE STORY' : 'CREATE STORY'}</button>
        <button type="button" className="admin-link" onClick={onCancel}>close</button>
        <Note state={state} />
      </div>
    </form>
  );
}

export default function JournalTab() {
  const [stories, setStories] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);     // null | 'new' | slug
  const [deleting, setDeleting] = useState(null);
  const top = useRef(null);

  useEffect(() => { adminJournal().then(setStories).catch(err => setError(err.message)); }, []);
  const open = (which) => { setEditing(which); requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); };
  const remove = async () => {
    try { setStories(await adminDeleteStory(deleting.slug)); if (editing === deleting.slug) setEditing(null); setDeleting(null); }
    catch (err) { setError(err.message); setDeleting(null); }
  };
  const current = stories?.find(s => s.slug === editing);

  return (
    <section className="admin-section" ref={top}>
      <div className="admin-section__head">
        <h2 className="admin-h2">Journal {stories && <span className="admin-count">{stories.length}</span>}</h2>
        <button type="button" className="admin-action admin-action--primary" onClick={() => open('new')}>NEW STORY</button>
        <a className="admin-link" href={pageHref('/journal')} {...NEW_TAB}>see the Journal ↗</a>
      </div>
      <p className="admin-help">Stories for the Journal’s pages. A new story starts hidden, so you can write it in your own time; switch on “Show in the shop” when it is ready. Hidden and scheduled stories are seen only here.</p>
      {error && <p className="admin-note admin-note--bad" role="alert">{error}</p>}

      {editing && (
        <Editor key={editing} story={editing === 'new' ? null : current}
                onSaved={(list, slug) => { setStories(list); setEditing(slug); }} onCancel={() => setEditing(null)} />
      )}

      {!stories ? <p className="admin-empty">Loading…</p> : stories.length === 0 ? <p className="admin-empty">No stories yet. Write the first one.</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-stories">
            <thead><tr><th>Story</th><th>Topic</th><th>Publish</th><th>Status</th><th /></tr></thead>
            <tbody>
              {stories.map(s => (
                <tr key={s.slug} className={editing === s.slug ? 'is-on' : undefined}>
                  <td>
                    <span className="admin-story__row">
                      {s.img ? <img src={s.img} alt="" /> : <span className="admin-story__noimg" />}
                      <span><strong>{s.title}</strong>{(s.featured || s.pick) && <em>{[s.featured && 'Featured', s.pick && 'Editor’s pick'].filter(Boolean).join(' · ')}</em>}</span>
                    </span>
                  </td>
                  <td>{topicOf(s.topic)?.name}</td>
                  <td className="admin-when">{when(s.publishedAt)}</td>
                  <td><Status s={s} /></td>
                  <td className="admin-row-actions">
                    <button type="button" className="admin-action" onClick={() => open(s.slug)}>EDIT</button>
                    <button type="button" className="admin-link" onClick={() => setDeleting(s)}>delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={Boolean(deleting)} tone="bad" labelledBy="delStoryTitle" onClose={() => setDeleting(null)}>
        <TrashMark />
        <h2 className="state-panel__title" id="delStoryTitle">Delete this story?</h2>
        <p className="state-panel__note">“{deleting?.title}” and its photo will be gone for good. To take it off the shop for now, hide it instead.</p>
        <button type="button" className="btn btn--danger btn--block" onClick={remove}>DELETE STORY</button>
        <button type="button" className="state-panel__cancel" onClick={() => setDeleting(null)}>Cancel</button>
      </Dialog>
    </section>
  );
}
