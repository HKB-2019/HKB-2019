/* A stand-in for Anthropic's API, for the browser tests only: the admin's
 * "write it for me" gets a draft made from the owner's notes, instantly and
 * for nothing. The shop only talks to it because the test server points
 * ANTHROPIC_BASE_URL here. */

import { createServer } from 'node:http';

export function startFakeAnthropic({ port, apiKey }) {
  return createServer((req, res) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      const send = (status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      if (req.method !== 'POST' || !req.url.startsWith('/v1/messages')) return send(404, {});
      if (req.headers['x-api-key'] !== apiKey) {
        return send(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
      }
      const brief = JSON.parse(raw).messages[0].content;
      const notes = brief.split("Owner's notes:\n")[1] ?? '';
      const name = (brief.match(/^Product name: (.*)$/m) ?? [])[1] ?? '';
      const draft = {
        description: `${name}: a drafted description. ${notes}`,
        details: notes.split(/,\s*/).join('\n')
      };
      send(200, {
        id: 'msg_e2e', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
        content: [{ type: 'text', text: JSON.stringify(draft) }],
        stop_reason: 'end_turn', usage: { input_tokens: 400, output_tokens: 120 }
      });
    });
  }).listen(port);
}
