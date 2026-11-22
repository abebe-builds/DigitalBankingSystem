import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'digital-banking',
    timestamp: new Date().toISOString(),
  });
});

export default healthRouter;
