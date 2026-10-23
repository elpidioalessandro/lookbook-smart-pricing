# LookBook Smart Pricing

Stima automatica del prezzo di capi d'abbigliamento usati, tramite LLM multimodale.
L'utente carica una foto e inserisce categoria, brand e stato. Il sistema restituisce un prezzo consigliato, un range realistico, la motivazione e i consigli per vendere più velocemente.

**App:** https://lookbook-smart.netlify.app
**API:** https://lookbook-api-4frp.onrender.com/api/health

> Il back end è su un piano gratuito: la prima richiesta dopo un periodo di inattività può richiedere fino a ~60 secondi (cold start).

---

## Architettura

```
 Browser (React)                 Back end (Node + Express)                  Servizi esterni
┌──────────────────┐   POST    ┌─────────────────────────────────────┐
│ Form + foto      │ ────────▶ │ multer → validazione input          │
│ resize 1024 px   │ multipart │        → gemini.service             │ ───▶ Gemini 3.5 Flash
│ risultato        │ ◀──────── │          (retry, timeout, fallback) │ ───▶ Gemini 3.5 Flash-Lite
│ storico          │   JSON    │        → validazione output         │
└──────────────────┘           │        → salvataggio                │ ───▶ PostgreSQL (Neon)
     Netlify                   └─────────────────────────────────────┘
                                              Render
```

| Livello | Tecnologia |
|---|---|
| Front end | React 19, Vite |
| Back end | Node.js, Express 5, multer |
| LLM | Google Gemini (`@google/genai`), output con JSON schema |
| Database | PostgreSQL su Neon (`pg`) |
| Deploy | Netlify (client), Render (server) |

---

## API

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `POST` | `/api/valuate` | `multipart/form-data`: `image`, `category`, `brand`, `condition` (`nuovo` \| `buono` \| `usato`) |
| `GET` | `/api/valuations?limit=20` | Storico delle ultime valutazioni |
| `GET` | `/api/valuations/:id` | Dettaglio completo di una valutazione |
| `GET` | `/api/health` | Stato del servizio |

Risposta di `POST /api/valuate`:

```json
{
  "suggested_price": 32,
  "range": { "min": 25, "max": 40 },
  "motivation": "Trench Zara, fascia mass market (listino stimato ~80 €). Per lo stato buono applico il 40% ...",
  "selling_tips": ["Fotografa l'etichetta con taglia e composizione", "..."],
  "input_consistency": { "matches": true, "detected_item": "Trench beige" },
  "meta": { "model": "gemini-3.5-flash", "attempts": 1, "latency_ms": 5499, "id": 12, "saved": true }
}
```

---

## Scelte tecniche

### 1. L'output dell'LLM non è fidato: tre livelli di validazione
1. **Schema JSON imposto a Gemini** (`responseSchema`): il modello non può restituire testo libero.
2. **Validazione applicativa** (`valuation.validator.js`): prezzi numerici e plausibili, `min ≤ prezzo ≤ max`, campi obbligatori presenti. Una risposta non valida conta come tentativo fallito e viene ritentata.
3. **Vincolo `CHECK` nel database**: un prezzo fuori range non può essere salvato.

Anche l'**input** è validato: categoria e stato da liste chiuse, brand max 50 caratteri, solo immagini fino a 5 MB.

### 2. Coerenza tra foto e dati
Il modello confronta la foto con i dati dichiarati e restituisce `input_consistency`. Se l'utente dichiara "Scarpe" ma la foto mostra un trench, l'interfaccia mostra un avviso e la stima si basa sulla foto.

### 3. Resilienza
| Errore | Comportamento |
|---|---|
| 500 / 503 / output non valido | fino a 3 tentativi con attesa crescente |
| 429 (quota esaurita) | nessun retry, passaggio immediato al modello di fallback |
| Nessuna risposta entro 20 s | passaggio immediato al modello di fallback |
| Database non disponibile | la valutazione viene restituita comunque (`saved: false`) e l'errore loggato |

### 4. Scelta del modello basata su misure
Benchmark con la stessa foto (`scripts/bench-models.js`):

| Modello | Latenza |
|---|---|
| gemini-3.8-flash | > 60 s (timeout) |
| gemini-3.7-flash | > 60 s (timeout) |
| gemini-3.5-flash | 3,5 s |
| gemini-3.5-flash-lite | 1,2 s |

Latenza end-to-end passata da **105 s a 5,5 s** scegliendo il modello in base ai dati, non al numero di versione più alto.

### 5. System prompt con metodo di calcolo esplicito
Il prompt (`server/src/prompts/systemPrompt.js`) impone un metodo in due passi:
1. stima del prezzo di listino da nuovo in base alla fascia del brand (lusso, premium, mass market, fast fashion);
2. percentuale fissa per stato: nuovo 50–70%, buono 30–50%, usato 15–30%.

In più: il contenuto inserito dall'utente è trattato come dato e mai come istruzione (difesa da prompt injection), e il server passa al modello la data corrente, altrimenti la stagionalità viene inventata.

### 6. Valutazione del prompt
`scripts/eval-prompt.js` esegue 8 test automatici sull'API:

| Test | Verifica |
|---|---|
| Baseline | prezzo plausibile, foto coerente |
| Brand di lusso | prezzo ≥ 2× la baseline |
| Stato | nuovo > buono > usato |
| Categoria errata | incoerenza rilevata |
| Prompt injection | prezzo non manipolato |
| Stabilità | stessa foto, prezzo entro ±30% |

| Prompt | Risultato |
|---|---|
| v1 (`systemPrompt.v1.js`) | 5/7 (stato ignorato, ordine nuovo/buono/usato non rispettato) |
| v2 | 8/8 su 3 esecuzioni consecutive (24/24) |

### 7. Privacy
La foto **non viene salvata**: nel database finisce solo la sua impronta SHA-256, oltre a input, output, modello e latenza.

---

## Avvio in locale

Prerequisiti: Node.js ≥ 20, una API key di [Google AI Studio](https://aistudio.google.com), un database PostgreSQL (es. [Neon](https://neon.tech)).

### Back end
```bash
cd server
npm install
cp .env.example .env   # poi compila i valori
npm run db:init        # crea la tabella
npm run dev            # http://localhost:3000
```

`server/.env`:
```
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
DATABASE_URL=postgresql://...
CORS_ORIGIN=http://localhost:5173
```

### Front end
```bash
cd client
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:3000
npm run dev            # http://localhost:5173
```

### Script utili (in `server/`)
| Comando | Scopo |
|---|---|
| `node scripts/test-gemini.js ./foto.jpg` | test diretto della chiamata a Gemini |
| `node scripts/bench-models.js ./foto.jpg` | confronto di latenza tra modelli |
| `node scripts/eval-prompt.js ./foto.jpg` | suite di test del prompt (server acceso) |

---

## Struttura

```
├── client/                     React + Vite
│   └── src/
│       ├── components/         ValuationForm, ResultCard, History
│       └── lib/                api, resizeImage, constants
└── server/                     Node + Express
    ├── db/schema.sql
    ├── scripts/                db-init, test-gemini, bench-models, eval-prompt
    └── src/
        ├── config/             env, db
        ├── controllers/
        ├── middleware/         upload, errorHandler
        ├── prompts/            systemPrompt (v2), systemPrompt.v1
        ├── repositories/
        ├── routes/
        ├── services/           gemini.service
        └── validators/
```

---

## Limiti noti

- **Variabilità:** a parità di input il prezzo può oscillare di circa ±25% tra due richieste. Possibile soluzione: temperatura 0 e riuso della valutazione per foto identiche (l'impronta SHA-256 è già salvata).
- **Stima, non dati di mercato:** il prezzo deriva dalle conoscenze del modello, non da annunci reali confrontabili.
- **Brand non verificabile:** se il brand dichiarato non è riconoscibile in foto, il modello lo segnala nella motivazione ma l'avviso dell'interfaccia riguarda solo la categoria.
- **Free tier:** quota giornaliera limitata su Gemini e cold start su Render. Sul free tier Google può usare input e output per migliorare i propri modelli: non adatto a dati reali di clienti.
- **Nessuna autenticazione:** lo storico è pubblico e condiviso.
