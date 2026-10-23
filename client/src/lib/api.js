const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

async function parse(res) {
  let body = null;
  try { body = await res.json(); } catch { /* risposta non JSON */ }
  if (!res.ok) {
    const err = new Error(body?.error || `Errore ${res.status}`);
    err.details = body?.details || [];
    throw err;
  }
  return body;
}

export async function valuate({ image, category, brand, condition }) {
  const form = new FormData();
  form.append('image', image);
  form.append('category', category);
  form.append('brand', brand);
  form.append('condition', condition);
  const res = await fetch(`${API_URL}/api/valuate`, { method: 'POST', body: form });
  return parse(res);
}

export async function getHistory(limit = 5) {
  const res = await fetch(`${API_URL}/api/valuations?limit=${limit}`);
  return parse(res);
}
