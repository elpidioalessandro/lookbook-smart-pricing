import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Test d'integrazione sull'app Express reale, senza Gemini e senza database:
// coprono solo i percorsi che si fermano prima (rate limit, validazioni, config).
let server;
let base;

before(async () => {
  process.env.GEMINI_API_KEY ||= 'test';
  process.env.GEMINI_MODEL ||= 'test-model';
  process.env.DATABASE_URL ||= 'postgres://test@localhost:1/test';
  process.env.RATE_LIMIT_PER_IP = '3'; // prima dell'import: sovrascrive anche un eventuale .env
  const { default: app } = await import('../src/app.js');
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => server?.close());

test('GET /api/config restituisce categorie, stati e limite di upload', async () => {
  const res = await fetch(`${base}/config`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.categories.includes('Cappotto'));
  assert.deepEqual(body.conditions.map((c) => c.value), ['nuovo', 'buono', 'usato']);
  assert.equal(body.maxUploadMb, 5);
});

test('GET /api/valuations/1: gli id numerici non sono accettati', async () => {
  const res = await fetch(`${base}/valuations/1`);
  assert.equal(res.status, 400);
});

test('GET /api/valuations senza X-Client-Id: lista vuota, nessun dato altrui', async () => {
  const res = await fetch(`${base}/valuations`);
  assert.deepEqual(await res.json(), []);
});

test('file non immagine: 400 prima di chiamare il modello', async () => {
  const form = new FormData();
  form.append('image', new Blob(['ciao'], { type: 'image/jpeg' }), 'finto.jpg');
  form.append('category', 'Cappotto');
  const res = await fetch(`${base}/valuate`, { method: 'POST', body: form });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /non è un’immagine valida/);
});

test('rate limit: oltre il limite per IP risponde 429', async () => {
  const post = () => fetch(`${base}/valuate`, { method: 'POST', body: new FormData() });
  // Il test precedente ha già consumato 1 delle 3 richieste disponibili
  const statuses = [];
  for (let i = 0; i < 3; i++) statuses.push((await post()).status);
  assert.deepEqual(statuses, [400, 400, 429]);
});
