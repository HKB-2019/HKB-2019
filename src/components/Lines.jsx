import { Fragment } from 'react';

/** Text from the admin with its line breaks kept — as text, never as HTML. */
export default function Lines({ text }) {
  const lines = String(text ?? '').split('\n');
  return lines.map((line, i) => (
    <Fragment key={i}>{line}{i < lines.length - 1 && <br />}</Fragment>
  ));
}
