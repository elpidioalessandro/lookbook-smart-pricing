import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { createValuation, getValuations, getValuation } from '../controllers/valuation.controller.js';

const router = Router();

router.post('/valuate', upload.single('image'), createValuation);
router.get('/valuations', getValuations);
router.get('/valuations/:id', getValuation);

export default router;
