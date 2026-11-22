import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { runReconciliation, getTellerSummary } from '../services/reconciliationService.js';

export const reconciliationRouter = Router();

// POST /api/reconciliation/run
reconciliationRouter.post('/run', requireAuth, requirePermission('reconciliation.run'), async (req, res, next) => {
  try {
    const result = await runReconciliation();
    res.json({ status: 'ok', data: result });
  } catch (err) { next(err); }
});

// GET /api/reconciliation/teller-summary
reconciliationRouter.get('/teller-summary', requireAuth, requirePermission('teller.withdraw', 'teller.deposit'), async (req, res, next) => {
  try {
    const { date } = req.query;
    const result = await getTellerSummary(req.user.id, date || null);
    res.json({ status: 'ok', data: result });
  } catch (err) { next(err); }
});
