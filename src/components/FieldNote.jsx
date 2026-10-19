/* The line under a box in the owner's design: red with a ringed cross when
 * something needs fixing, green with a ringed tick when it is right.
 *
 * `reserve` keeps the line's room even when it is empty, for a note that
 * appears as the box is left: otherwise the button below would move under a
 * finger already on its way to it, and the tap would miss. */
export default function FieldNote({ id, error, ok, reserve = false }) {
  if (error) return <small className="field__error" id={id} role="alert">{error}</small>;
  if (ok) return <small className="field__ok" id={id}>{ok}</small>;
  return reserve ? <small className="field__note-room" aria-hidden="true" /> : null;
}
