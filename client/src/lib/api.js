const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const TIMEOUT_MS = 90000; // include il cold start di Render (fino a ~60 s)

function friendlyError(message, details = []) {
  const err = new Error(message);
  err.details = details;
  return err;
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw friendlyError('Il server non ha risposto in tempo. Riprova tra qualche istante.');
    }
    // TypeError: rete assente, server spento o richiesta bloccata dal CORS
    throw friendlyError('Impossibile contattare il server. Controlla la connessione e riprova.');
  } finally {
    clearTimeout(timer);
  }

  let body = null;
  try { body = await res.json(); } catch { /* risposta non JSON, es. pagina di errore dell'hosting */ }

  if (!res.ok) {
    if (body?.error) throw friendlyError(body.error, body.details || []);
    if ([502, 503, 504].includes(res.status)) {
      throw friendlyError('Il server si sta riavviando. Riprova tra un minuto.');
    }
    throw friendlyError(`Errore imprevisto (${res.status}). Riprova più tardi.`);
  }
  return body;
}

export function valuate({ image, category, brand, condition }) {
  const form = new FormData();
  form.append('image', image);
  form.append('category', category);
  form.append('brand', brand);
  form.append('condition', condition);
  return request('/api/valuate', { method: 'POST', body: form });
}

export function getHistory(limit = 5) {
  return request(`/api/valuations?limit=${limit}`);
}
