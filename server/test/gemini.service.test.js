import { test, before } from 'node:test';
import assert from 'node:assert/strict';

// La factory va importata dopo aver impostato l'ambiente (env.js lo controlla all'avvio)
let createValuator;
before(async () => {
  process.env.GEMINI_API_KEY ||= 'test';
  process.env.GEMINI_MODEL ||= 'test-model';
  process.env.DATABASE_URL ||= 'postgres://test@localhost:1/test';
  ({ createValuator } = await import('../src/services/gemini.service.js'));
});

const item = { category: 'Cappotto', brand: 'Zara', condition: 'buono' };
const image = { mimetype: 'image/jpeg', buffer: Buffer.from('x') };
const valid = {
  suggested_price: 30, range: { min: 24, max: 36 },
  motivation: 'Trench Zara, fascia mass market.', selling_tips: ['a'],
  input_consistency: { matches: true, detected_item: 'Trench', detected_category: 'Cappotto', brand_visible: false },
};

const ok = () => ({ text: JSON.stringify(valid) });
const httpError = (status) => () => { throw Object.assign(new Error(`HTTP ${status}`), { status }); };
const hang = () => new Promise(() => {}); // non risponde mai e ignora l'abort
const hangUntilAbort = (req) => new Promise((_, reject) => {
  req.config.abortSignal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
});

// SDK finto: ogni chiamata esegue il passo successivo dello script e registra il modello usato
function fakeSdk(script) {
  const calls = [];
  const signals = [];
  let i = 0;
  const generate = async (req) => {
    calls.push(req.model);
    signals.push(req.config.abortSignal);
    const step = script[i++];
    if (!step) throw new Error('chiamata in più non prevista');
    return step(req);
  };
  return { generate, calls, signals };
}

// Tempi ridotti per tenere i test veloci; sleep istantaneo
const fast = { models: ['primary', 'fallback'], deadlineMs: 600, attemptTimeoutMs: 200, backoffMs: 10, minAttemptMs: 50, sleep: async () => {}, log: () => {} };

test('successo al primo tentativo', async () => {
  const sdk = fakeSdk([ok]);
  const r = await createValuator({ ...fast, generate: sdk.generate })(item, image);
  assert.equal(r.model, 'primary');
  assert.equal(r.attempts, 1);
  assert.deepEqual(r.data, valid);
});

test('503: ritenta lo stesso modello', async () => {
  const sdk = fakeSdk([httpError(503), ok]);
  const r = await createValuator({ ...fast, generate: sdk.generate })(item, image);
  assert.deepEqual(sdk.calls, ['primary', 'primary']);
  assert.equal(r.attempts, 2);
});

test('429 (quota): nessun retry, passa subito al fallback', async () => {
  const sdk = fakeSdk([httpError(429), ok]);
  const r = await createValuator({ ...fast, generate: sdk.generate })(item, image);
  assert.deepEqual(sdk.calls, ['primary', 'fallback']);
  assert.equal(r.model, 'fallback');
});

test('400/404: nessun retry, passa al fallback', async () => {
  const sdk = fakeSdk([httpError(404), ok]);
  await createValuator({ ...fast, generate: sdk.generate })(item, image);
  assert.deepEqual(sdk.calls, ['primary', 'fallback']);
});

test('output non valido conta come tentativo fallito e viene ritentato', async () => {
  const badPrice = () => ({ text: JSON.stringify({ ...valid, suggested_price: 99 }) });
  const sdk = fakeSdk([() => ({ text: 'non è json' }), badPrice, ok]);
  const r = await createValuator({ ...fast, generate: sdk.generate })(item, image);
  assert.deepEqual(sdk.calls, ['primary', 'primary', 'fallback']);
  assert.equal(r.model, 'fallback');
});

test('timeout: il segnale viene davvero abortito e si passa al fallback', async () => {
  const sdk = fakeSdk([hangUntilAbort, ok]);
  const r = await createValuator({ ...fast, generate: sdk.generate })(item, image);
  assert.equal(sdk.signals[0].aborted, true, 'la richiesta appesa deve essere annullata');
  assert.equal(r.model, 'fallback');
});

test('timeout anche se l’SDK ignora il segnale (rete di sicurezza)', async () => {
  const sdk = fakeSdk([hang, ok]);
  const r = await createValuator({ ...fast, generate: sdk.generate })(item, image);
  assert.equal(r.model, 'fallback');
});

test('scadenza complessiva: con tutto bloccato risponde 503 entro il budget', async () => {
  const sdk = fakeSdk([hang, hang, hang, hang]);
  const started = Date.now();
  await assert.rejects(createValuator({ ...fast, generate: sdk.generate })(item, image), { status: 503 });
  const elapsed = Date.now() - started;
  assert.ok(elapsed < fast.deadlineMs + 100, `durata ${elapsed} ms oltre la scadenza di ${fast.deadlineMs} ms`);
});

test('la scadenza impedisce nuovi tentativi quando il tempo residuo non basta', async () => {
  let t = 0; // orologio finto
  const now = () => t;
  const sdk = fakeSdk([async () => { t += 590; throw Object.assign(new Error('503'), { status: 503 }); }]);
  await assert.rejects(createValuator({ ...fast, now, generate: sdk.generate })(item, image), { status: 503 });
  assert.equal(sdk.calls.length, 1, 'restano 10 ms: nessun altro tentativo');
});

test('tutti i tentativi falliti: errore 503 con messaggio per l’utente', async () => {
  const sdk = fakeSdk([httpError(503), httpError(503), httpError(503), httpError(503)]);
  await assert.rejects(createValuator({ ...fast, generate: sdk.generate })(item, image), {
    status: 503,
    message: /momentaneamente non disponibile/,
  });
  assert.equal(sdk.calls.length, 4); // 2 tentativi × 2 modelli
});
