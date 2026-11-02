import { Router } from 'express';
import { upload, verifyImage } from '../middleware/upload.js';
import { createValuation, getValuations, getValuation } from '../controllers/valuation.controller.js';
import { getConfig } from '../controllers/config.controller.js';

const router = Router();

router.get('/config', getConfig);
router.post('/valuate', upload.single('image'), verifyImage, createValuation);
router.get('/valuations', getValuations);
router.get('/valuations/:id', getValuation);

export default router;
