import app from './app.js';
import { env } from './config/env.js';

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
