import { EMAIL_OK, EMAIL_BAD } from '../lib/useEmailCheck.js';

/* The line under a box in the owner's design: red with a ringed cross when
 * something needs fixing, amber with a ringed "!" when it may be right but is
 * worth a look, green with a ringed tick when it is right, and plain grey for
 * help before anything is typed.
 *
 * `reserve` keeps the line's room even when it is empty, for a note that
 * appears as the box is left: otherwise the button below would move under a
 * finger already on its way to it, and the tap would miss. */
export default function FieldNote({ id, error, warn, ok, help, reserve = false, children }) {
  if (error) return <small className="field__error" id={id} role="alert">{error}</small>;
  if (warn) return <small className="field__warn" id={id}>{warn}{children}</small>;
  if (ok) return <small className="field__ok" id={id}>{ok}</small>;
  if (help) return <small className="field__help" id={id}>{help}</small>;
  return reserve ? <small className="field__note-room" aria-hidden="true" /> : null;
}

/** "Did you mean ada@gmail.com?" with the fix one tap away. */
export function EmailSlip({ suggestion, onUse }) {
  if (!suggestion) return null;
  return (
    <> Did you mean <button type="button" className="field__fix" onClick={() => onUse(suggestion)}>{suggestion}</button>?</>
  );
}

/** The note under any email box: one set of words for the whole shop. An
 *  `error` from the form (or the server) wins over the box's own check. */
export function EmailNote({ id, check, error, onUse, reserve = true }) {
  return (
    <FieldNote id={id} reserve={reserve}
               error={error ?? (check.state === 'bad' ? EMAIL_BAD : null)}
               warn={check.suggestion ? 'This email looks unusual.' : null}
               ok={check.state === 'ok' ? EMAIL_OK : null}>
      <EmailSlip suggestion={check.suggestion} onUse={onUse} />
    </FieldNote>
  );
}
