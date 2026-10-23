const eur = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export default function ResultCard({ result, onFix }) {
  const { suggested_price, range, motivation, selling_tips, input_consistency, meta } = result;
  const span = range.max - range.min || 1;
  const pos = Math.min(100, Math.max(0, ((suggested_price - range.min) / span) * 100));
  const notGarment = !input_consistency.matches && suggested_price === 0;

  return (
    <section className="card result" aria-live="polite">
      {!input_consistency.matches && (
        <div className="warning" role="alert">
          <strong>{notGarment ? 'Non sembra un capo d’abbigliamento' : 'La foto non corrisponde ai dati'}</strong>
          <p>
            Nella foto vediamo: <em>{input_consistency.detected_item}</em>.
            {!notGarment && ' La stima si basa sulla foto: correggi i dati per una valutazione più precisa.'}
          </p>
          <button type="button" className="btn-ghost" onClick={onFix}>Correggi i dati</button>
        </div>
      )}

      {!notGarment && (
        <>
          <p className="eyebrow">Prezzo consigliato</p>
          <p className="price">{eur(suggested_price)}</p>

          <div className="range" aria-label={`Range da ${eur(range.min)} a ${eur(range.max)}`}>
            <div className="range-track">
              <div className="range-marker" style={{ left: `${pos}%` }} />
            </div>
            <div className="range-labels">
              <span>{eur(range.min)}</span>
              <span>{eur(range.max)}</span>
            </div>
          </div>
        </>
      )}

      <h3>Perché questo prezzo</h3>
      <p className="motivation">{motivation}</p>

      {selling_tips?.length > 0 && !notGarment && (
        <>
          <h3>Per vendere più velocemente</h3>
          <ol className="tips">
            {selling_tips.map((t, i) => <li key={i}>{t}</li>)}
          </ol>
        </>
      )}

      {meta && (
        <p className="meta">
          {meta.model} · {(meta.latency_ms / 1000).toFixed(1)} s
          {meta.attempts > 1 && ` · ${meta.attempts} tentativi`}
          {meta.saved === false && ' · non salvata nello storico'}
        </p>
      )}
    </section>
  );
}
