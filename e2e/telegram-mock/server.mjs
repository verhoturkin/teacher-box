// Imitation of the Telegram Bot API and of the Telemost API for the E2E run (no dependencies, Node 22).
//
//   /bot<token>/getMe | getUpdates | sendMessage  - the bot API; only MOCK_TOKEN is accepted,
//                                                   other methods (answerCallbackQuery, ...) succeed
//   POST /inject {"text": "...", "chatId": 777}     - a private message from a test user (chat 777 by default)
//   POST /press {"data": "...", "chatId": 777}      - the user presses an inline button with the callback data
//   GET  /sent                                      - messages the bot has sent, with their buttons
//   /telemost/conferences                           - the Telemost API: creates meetings for MOCK_TELEMOST_TOKEN
//   GET  /health                                    - for docker compose --wait
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 8099);
const TOKEN = process.env.MOCK_TOKEN ?? '123456:e2e-token';
const BOT = process.env.MOCK_BOT ?? 'teacherbox_e2e_bot';
const TELEMOST_TOKEN = process.env.MOCK_TELEMOST_TOKEN ?? 'e2e-telemost-token';
const MAX_POLL_MS = 2_000;

const queue = [];
const sent = [];
let updateId = 100;
let conferences = 0;

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

/** Chat 777 is the teacher (@e2e_teacher), others are students. */
function user(chatId) {
  return { id: chatId, first_name: 'E2E', username: chatId === 777 ? 'e2e_teacher' : `e2e_${String(chatId)}` };
}

function telemost(request, response, path) {
  if (request.headers.authorization !== `OAuth ${TELEMOST_TOKEN}`) {
    return json(response, 401, { error: 'UnauthorizedError', description: 'Unauthorized' });
  }
  if (path === '/telemost/conferences' && request.method === 'POST') {
    conferences += 1;
    const id = String(10_000_000_000_000 + conferences);
    return json(response, 201, { id, join_url: `https://telemost.yandex.ru/j/${id}` });
  }
  return json(response, 404, { error: 'NotFoundError', description: 'Conference not found' });
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://mock');
  if (url.pathname === '/health') {
    return json(response, 200, { ok: true });
  }
  if (url.pathname === '/sent') {
    return json(response, 200, sent);
  }
  if (url.pathname.startsWith('/telemost/')) {
    return telemost(request, response, url.pathname);
  }
  if (url.pathname === '/inject' && request.method === 'POST') {
    const { text, chatId } = await body(request);
    const chat = Number(chatId ?? 777);
    updateId += 1;
    queue.push({
      update_id: updateId,
      message: {
        message_id: updateId,
        from: user(chat),
        chat: { id: chat, type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: String(text ?? ''),
      },
    });
    return json(response, 200, { ok: true });
  }
  if (url.pathname === '/press' && request.method === 'POST') {
    const { data, chatId } = await body(request);
    const chat = Number(chatId ?? 777);
    updateId += 1;
    queue.push({
      update_id: updateId,
      callback_query: {
        id: `cb-${String(updateId)}`,
        from: user(chat),
        message: { message_id: updateId, chat: { id: chat, type: 'private' } },
        data: String(data ?? ''),
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
      sent.push({
        chatId: String(payload.chat_id),
        text: String(payload.text ?? ''),
        buttons: payload.reply_markup?.inline_keyboard ?? [],
      });
      return json(response, 200, { ok: true, result: { message_id: sent.length } });
    default:
      return json(response, 200, { ok: true, result: true });
  }
}).listen(PORT, () => {
  console.log(`Telegram Bot API and Telemost API imitation on port ${PORT}`);
});
