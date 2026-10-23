import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { createValuation } from '../controllers/valuation.controller.js';

const router = Router();

router.post('/valuate', upload.single('image'), createValuation);

export default router;
