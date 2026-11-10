// Imitation of an OpenAI-compatible AI provider for the E2E run (no dependencies, Node 22).
//
//   GET  /v1/models              - two models, mock-fast and mock-strong; needs "Authorization: Bearer mock-key"
//   POST /v1/chat/completions    - an answer written "by" the requested model: a lesson summary or a homework
//                                  draft, chosen by the JSON schema in response_format
//   GET  /requests               - the model ids of the completions so far, oldest first
//   GET  /health                 - for docker compose --wait
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 8098);
const KEY = process.env.MOCK_KEY ?? 'mock-key';
const MODELS = ['mock-fast', 'mock-strong'];
const requested = [];

function json(response, status, body) {
  const data = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  });
  response.end(data);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text === '' ? {} : JSON.parse(text);
}

function answer(model, schema) {
  const content = schema.includes('summary')
    ? { summary: `Итоги написала модель ${model}` }
    : { title: `Задание от ${model}`, description: `Текст задания, ответ модели ${model}` };
  return {
    model,
    choices: [
      { finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(content) } },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 50 },
  };
}

createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', 'http://mock').pathname;
  if (path === '/health') {
    return json(response, 200, { ok: true });
  }
  if (path === '/requests') {
    return json(response, 200, requested);
  }
  if (request.headers.authorization !== `Bearer ${KEY}`) {
    return json(response, 401, { error: { message: 'Incorrect API key provided' } });
  }
  if (path === '/v1/models' && request.method === 'GET') {
    return json(response, 200, { data: MODELS.map((id) => ({ id })) });
  }
  if (path === '/v1/chat/completions' && request.method === 'POST') {
    const body = await readJson(request);
    requested.push(body.model);
    return json(response, 200, answer(body.model, JSON.stringify(body.response_format ?? '')));
  }
  return json(response, 404, { error: { message: 'not found' } });
}).listen(PORT, () => console.log(`AI mock on ${PORT}`));
