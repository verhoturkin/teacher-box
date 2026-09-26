// Imitation of the Telegram Bot API for the E2E run (no dependencies, Node 22).
//
//   /bot<token>/getMe | getUpdates | sendMessage  - the bot API; only MOCK_TOKEN is accepted
//   POST /inject {"text": "..."}                    - a private message from the test user (chat 777)
//   GET  /sent                                      - messages the bot has sent
//   GET  /health                                    - for docker compose --wait
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 8099);
const TOKEN = process.env.MOCK_TOKEN ?? '123456:e2e-token';
const BOT = process.env.MOCK_BOT ?? 'teacherbox_e2e_bot';
const MAX_POLL_MS = 2_000;

const queue = [];
const sent = [];
let updateId = 100;

function json(response, status, body) {
  const data = JSON.stringify(body);
  response.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
  response.end(data);
}

async function body(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (text === '') {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return Object.fromEntries(new URLSearchParams(text));
  }
}

async function updates(response) {
  const deadline = Date.now() + MAX_POLL_MS;
  while (queue.length === 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  json(response, 200, { ok: true, result: queue.splice(0, queue.length) });
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://mock');
  if (url.pathname === '/health') {
    return json(response, 200, { ok: true });
  }
  if (url.pathname === '/sent') {
    return json(response, 200, sent);
  }
  if (url.pathname === '/inject' && request.method === 'POST') {
    const { text } = await body(request);
    updateId += 1;
    queue.push({
      update_id: updateId,
      message: {
        message_id: updateId,
        from: { id: 777, first_name: 'E2E', username: 'e2e_teacher' },
        chat: { id: 777, type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: String(text ?? ''),
      },
    });
    return json(response, 200, { ok: true });
  }
  const match = /^\/bot([^/]+)\/(\w+)$/.exec(url.pathname);
  if (match === null) {
    return json(response, 404, { ok: false, description: 'Not Found' });
  }
  const [, token, method] = match;
  const payload = await body(request);
  if (token !== TOKEN) {
    return json(response, 401, { ok: false, error_code: 401, description: 'Unauthorized' });
  }
  switch (method) {
    case 'getMe':
      return json(response, 200, { ok: true, result: { id: 1, is_bot: true, username: BOT } });
    case 'getUpdates':
      return updates(response);
    case 'sendMessage':
      sent.push({ chatId: String(payload.chat_id), text: String(payload.text ?? '') });
      return json(response, 200, { ok: true, result: { message_id: sent.length } });
    default:
      return json(response, 200, { ok: true, result: true });
  }
}).listen(PORT, () => {
  console.log(`Telegram Bot API imitation on port ${PORT}`);
});
