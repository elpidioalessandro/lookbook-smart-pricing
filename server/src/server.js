import app from './app.js';
import { env } from './config/env.js';
import { migrate } from './db/migrate.js';

// Aggiorna lo schema prima di accettare richieste. Se fallisce, il server parte comunque:
// le valutazioni funzionano, ma non vengono salvate (meta.saved = false).
try {
  await migrate();
  console.log('[db] schema aggiornato');
} catch (err) {
  console.error('[db] migrazione fallita:', err.message);
}

app.listen(env.port, (err) => {
  if (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(`Porta ${env.port} già occupata. Chiudi l'altro server: lsof -ti :${env.port} | xargs kill`);
    } else {
      console.error('Avvio fallito:', err.message);
    }
    process.exit(1);
  }
  console.log(`LookBook API su http://localhost:${env.port}`);
  console.log(`Modelli: ${env.models.join(' → ')}`);
});
