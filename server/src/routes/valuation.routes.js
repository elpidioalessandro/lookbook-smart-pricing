import { Router } from 'express';
import { upload, verifyImage } from '../middleware/upload.js';
import { createValuation, getValuations, getValuation } from '../controllers/valuation.controller.js';
import { getConfig } from '../controllers/config.controller.js';
import { valuatePerIp, valuateGlobal, readLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.get('/config', readLimiter, getConfig);
// I limiti vengono PRIMA di multer: un abuso è respinto senza nemmeno leggere il file
router.post('/valuate', valuatePerIp, valuateGlobal, upload.single('image'), verifyImage, createValuation);
router.get('/valuations', readLimiter, getValuations);
router.get('/valuations/:id', readLimiter, getValuation);

export default router;
