const eur = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const date = (d) => new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

export default function History({ items }) {
  if (!items?.length) return null;
  return (
    <section className="history">
      <h2>Ultime valutazioni</h2>
      <ul>
        {items.map((v) => (
          <li key={v.id}>
            <div>
              <strong>{v.brand}</strong> · {v.category} · {v.condition}
              {!v.input_matches && <span className="badge">foto ≠ dati</span>}
              <small>{date(v.created_at)}</small>
            </div>
            <span className="history-price">{eur(v.suggested_price)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
