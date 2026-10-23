import { useCallback, useEffect, useState } from 'react';
import ValuationForm from './components/ValuationForm.jsx';
import ResultCard from './components/ResultCard.jsx';
import History from './components/History.jsx';
import { valuate, getHistory } from './lib/api.js';
import { resizeImage } from './lib/resizeImage.js';
import { CATEGORIES } from './lib/constants.js';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [formInitial, setFormInitial] = useState(null);

  const refreshHistory = useCallback(() => {
    getHistory(5).then(setHistory).catch(() => {}); // lo storico è accessorio: se fallisce non blocca nulla
  }, []);

  useEffect(refreshHistory, [refreshHistory]);

  async function handleSubmit(values) {
    setLoading(true);
    setError(null);
    setResult(null);
    // Su hosting gratuito il server può essere "addormentato": avvisiamo se ci mette tanto
    const slowTimer = setTimeout(() => setSlow(true), 8000);
    try {
      const image = await resizeImage(values.image);
      const data = await valuate({ ...values, image });
      setResult(data);
      refreshHistory();
    } catch (err) {
      setError(err);
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
      setLoading(false);
    }
  }

  function handleFix() {
    // Se il modello ha riconosciuto una categoria della nostra lista, la pre-seleziona
    const detected = result?.input_consistency?.detected_item?.toLowerCase() ?? '';
    const match = CATEGORIES.find((c) => detected.includes(c.toLowerCase()));
    if (match) setFormInitial({ category: match });
    document.getElementById('valuation-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="brand">LookBook</p>
        <h1>Quanto vale il tuo capo?</h1>
        <p className="lead">
          Carica una foto, indica brand e stato: ricevi un prezzo realistico per il second-hand,
          con la motivazione e i consigli per venderlo prima.
        </p>
      </header>

      <main className="layout">
        <ValuationForm onSubmit={handleSubmit} loading={loading} initial={formInitial} />

        <div className="output">
          {loading && (
            <div className="card loading" aria-live="polite">
              <div className="spinner" aria-hidden="true" />
              <p>Sto analizzando il capo…</p>
              {slow && <small>Il server si sta svegliando, può volerci fino a un minuto.</small>}
            </div>
          )}

          {error && !loading && (
            <div className="card error" role="alert">
              <strong>{error.message}</strong>
              {error.details?.length > 0 && (
                <ul>{error.details.map((d) => <li key={d}>{d}</li>)}</ul>
              )}
            </div>
          )}

          {result && !loading && <ResultCard result={result} onFix={handleFix} />}

          {!result && !loading && !error && (
            <div className="card placeholder">
              <p>Il risultato della valutazione apparirà qui.</p>
            </div>
          )}

          <History items={history} />
        </div>
      </main>

      <footer className="footer">
        Stima generata da un modello AI: è un’indicazione, non una garanzia di vendita.
      </footer>
    </div>
  );
}
