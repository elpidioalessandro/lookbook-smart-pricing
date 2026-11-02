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
| `GET` | `/api/config` | Categorie, stati e limite di upload: unica fonte di verità per il form |
| `POST` | `/api/valuate` | `multipart/form-data`: `image`, `category`, `brand`, `condition` (`nuovo` \| `buono` \| `usato`) |
| `GET` | `/api/valuations?limit=20` | Storico **del browser che chiama** (header `X-Client-Id`) |
| `GET` | `/api/valuations/:id` | Dettaglio di una valutazione; `id` è un UUID casuale, non un numero progressivo |
| `GET` | `/api/health` | Stato del servizio |

L'header `X-Client-Id` è un UUID anonimo generato dal browser e salvato in `localStorage`: serve solo a mostrare a ciascuno il proprio storico.

Risposta di `POST /api/valuate`:

```json
{
  "suggested_price": 32,
  "range": { "min": 25, "max": 40 },
  "motivation": "Trench Zara, fascia mass market (listino stimato ~80 €). Per lo stato buono applico il 40% ...",
  "selling_tips": ["Fotografa l'etichetta con taglia e composizione", "..."],
  "input_consistency": {
    "matches": true,
    "detected_item": "Trench beige",
    "detected_category": "Cappotto",
    "brand_visible": false
  },
  "meta": { "model": "gemini-3.5-flash", "attempts": 1, "latency_ms": 5499, "id": "380943f3-161d-4b81-a8df-b94c44b08184", "saved": true }
}
```

---

## Scelte tecniche

### 1. L'output dell'LLM non è fidato: tre livelli di validazione
1. **Schema JSON imposto a Gemini** (`responseSchema`): il modello non può restituire testo libero.
2. **Validazione applicativa** (`valuation.validator.js`): prezzi numerici e plausibili, `min ≤ prezzo ≤ max`, campi obbligatori presenti. Una risposta non valida conta come tentativo fallito e viene ritentata.
3. **Vincolo `CHECK` nel database**: un prezzo fuori range non può essere salvato.

Anche l'**input** è validato: categoria e stato da liste chiuse, brand max 50 caratteri, immagini fino a 5 MB. Il tipo del file è verificato **leggendo i primi byte** (`file-type`), non fidandosi del mimetype dichiarato dal browser: un file di testo rinominato `.jpg` viene rifiutato.

### 2. Coerenza tra foto e dati
Il modello confronta la foto con i dati dichiarati e restituisce `input_consistency`:
- `detected_category`: la categoria vista in foto, vincolata da un **enum** alle categorie del form (più `Altro`). Se l'utente dichiara "Scarpe" e la foto mostra un trench, l'interfaccia propone **"Usa la categoria Cappotto"** con un clic;
- `brand_visible`: `false` se in foto non c'è nulla che confermi il brand dichiarato. L'interfaccia lo segnala: la stima assume il brand inserito dall'utente.

### 3. Resilienza
La richiesta ha una **scadenza complessiva di 40 s**, tutti i tentativi inclusi: sempre più bassa del timeout del client (110 s, che deve coprire anche il cold start di Render). Ogni tentativo usa il tempo residuo, mai più di 20 s (tarato sulle latenze misurate, fino a ~15 s).

| Errore | Comportamento |
|---|---|
| 500 / 503 / output non valido | 1 nuovo tentativo sullo stesso modello, solo se resta tempo |
| 429 (quota esaurita) / 400 / 404 | nessun retry, passaggio immediato al modello di fallback |
| Tentativo oltre il tempo limite | la chiamata viene **annullata** con `AbortController` e si passa al fallback |
| Scadenza complessiva raggiunta | 503 con messaggio comprensibile per l'utente |
| Database non disponibile | la valutazione viene restituita comunque (`saved: false`) e l'errore loggato |

Nota: l'annullamento chiude la connessione lato client, ma per Google la richiesta conta comunque. A proteggere davvero la quota sono la scadenza complessiva (meno tentativi) e i limiti di richiesta.

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

### 7. Sicurezza e privacy
| Rischio | Contromisura |
|---|---|
| Uno script esaurisce la quota gratuita di Gemini | **rate limit**: 10 valutazioni ogni 15 minuti per IP, tetto globale di 200 al giorno (`express-rate-limit`). I limiti scattano prima della lettura del file |
| Lettura delle valutazioni altrui contando gli id | verso l'esterno solo **UUID casuali**; lo storico è filtrato per browser |
| File non immagine travestiti | controllo dei byte del file lato server |
| Dati sensibili | la foto **non viene salvata**: nel database finiscono solo la sua impronta SHA-256, input, output, modello e latenza |

Il CORS non è una protezione contro le chiamate dirette (curl, script): limita solo quali siti possono usare l'API da un browser.

### 8. Test
`npm test` (in `server/`) esegue **31 test** con `node:test`, senza chiamare Gemini né il database:

| File | Cosa verifica |
|---|---|
| `validator.test.js` | validazione di input e output: liste chiuse, prezzi fuori range, enum di `detected_category` |
| `gemini.service.test.js` | logica di retry con un **SDK finto**: retry su 503, nessun retry su 429, abort al timeout, rispetto della scadenza complessiva |
| `upload.test.js` | riconoscimento del formato dai byte |
| `http.test.js` | app Express reale: `/api/config`, id numerici rifiutati, storico senza identificativo, rate limit (429) |

La pipeline GitHub Actions (`.github/workflows/ci.yml`) esegue i test e il build del client a ogni push. La suite `eval-prompt.js` resta separata: misura la qualità del prompt chiamando il modello reale, quindi consuma quota e non gira in CI.

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
# opzionali
RATE_LIMIT_PER_IP=1000        # in locale: evita il blocco durante le eval (default 10)
RATE_LIMIT_GLOBAL_DAILY=200
```

Lo schema del database si aggiorna da solo all'avvio del server (`db/schema.sql` è idempotente); `npm run db:init` resta disponibile per farlo a mano.

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
| `npm test` | unit test (31) |
| `node scripts/eval-prompt.js ./foto.jpg` | valutazione della qualità del prompt sul modello reale (server acceso) |

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
    ├── test/                   unit e integration test (node:test)
    └── src/
        ├── config/             env, db
        ├── controllers/        valuation, config
        ├── db/                 migrate
        ├── middleware/         upload, rateLimit, errorHandler
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
- **Brand non verificabile:** `brand_visible` segnala solo se il brand *si vede*; non distingue un capo originale da uno contraffatto.
- **Free tier:** quota giornaliera limitata su Gemini e cold start su Render. Sul free tier Google può usare input e output per migliorare i propri modelli: non adatto a dati reali di clienti.
- **Nessuna autenticazione:** lo storico è legato al browser, non a un account. Cancellando i dati del sito lo storico non è più visibile.
- **Rate limit in memoria:** i contatori si azzerano a ogni riavvio del server e non sono condivisi tra più istanze. Con più istanze servirebbe uno store condiviso (es. Redis).
