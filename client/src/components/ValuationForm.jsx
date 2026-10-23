import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, CONDITIONS, MAX_RAW_MB } from '../lib/constants.js';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

export default function ValuationForm({ onSubmit, loading, initial }) {
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState(initial?.category ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [condition, setCondition] = useState(initial?.condition ?? '');
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState('');
  const [prevInitial, setPrevInitial] = useState(initial);
  const inputRef = useRef(null);

  // Anteprima derivata dal file; l'URL temporaneo viene liberato quando cambia
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  // "Correggi i dati" dal risultato: aggiorna la categoria suggerita
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    if (initial?.category) setCategory(initial.category);
  }

  function pick(f) {
    setFileError('');
    if (!f) return;
    // Il resize lato client comprime la foto: blocchiamo solo file davvero enormi
    if (f.size > MAX_RAW_MB * 1024 * 1024) {
      setFileError(`File troppo grande (max ${MAX_RAW_MB} MB)`);
      return;
    }
    setFile(f);
  }

  const canSubmit = file && category && brand.trim() && condition && !loading;

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ image: file, category, brand: brand.trim(), condition });
  }

  return (
    <form className="card form" onSubmit={handleSubmit} id="valuation-form">
      <div
        className={`dropzone ${dragging ? 'is-dragging' : ''} ${preview ? 'has-image' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        aria-label="Carica la foto del capo"
      >
        {preview ? (
          <>
            <img src={preview} alt="Anteprima del capo" />
            <span className="dropzone-change">Cambia foto</span>
          </>
        ) : (
          <div className="dropzone-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M4 16l4-4 3 3 5-5 4 4" /><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
            </svg>
            <strong>Carica la foto del capo</strong>
            <span>Trascinala qui o clicca · JPG, PNG, HEIC</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => pick(e.target.files[0])}
        />
      </div>
      {fileError && <p className="field-error">{fileError}</p>}

      <div className="fields">
        <label className="field">
          <span>Categoria</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="" disabled>Scegli…</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="field">
          <span>Brand</span>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="es. Zara, Levi's, Burberry"
            maxLength={50}
            required
          />
        </label>

        <fieldset className="field">
          <legend>Stato</legend>
          <div className="segmented">
            {CONDITIONS.map((c) => (
              <label key={c.value} className={condition === c.value ? 'is-active' : ''}>
                <input
                  type="radio"
                  name="condition"
                  value={c.value}
                  checked={condition === c.value}
                  onChange={() => setCondition(c.value)}
                />
                <strong>{c.label}</strong>
                <small>{c.hint}</small>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <button className="btn-primary" type="submit" disabled={!canSubmit}>
        {loading ? 'Valutazione in corso…' : 'Valuta'}
      </button>
    </form>
  );
}
