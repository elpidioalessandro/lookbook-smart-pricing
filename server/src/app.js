import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import valuationRoutes from './routes/valuation.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Su Render l'app sta dietro un proxy: senza questo il rate limit vedrebbe un solo IP per tutti
app.set('trust proxy', 1);

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api', valuationRoutes);

app.use((req, res) => res.status(404).json({ error: 'Endpoint non trovato' }));
app.use(errorHandler);

export default app;
