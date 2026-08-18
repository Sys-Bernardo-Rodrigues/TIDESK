import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { getTvConfig, saveTvConfig } from '../services/tv-config-service';

const router = express.Router();

router.get(
  '/tv-config',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.VIEW),
  (req: AuthRequest, res: Response) => {
    try {
      res.json(getTvConfig());
    } catch (error) {
      console.error('Erro ao ler configuração do painel de TV:', error);
      res.status(500).json({ error: 'Erro ao ler configuração' });
    }
  }
);

router.put(
  '/tv-config',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.EDIT),
  [body('dashboardDurationSeconds').optional().isInt({ min: 5 })],
  (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const config = saveTvConfig(req.body);
      res.json(config);
    } catch (error) {
      console.error('Erro ao salvar configuração do painel de TV:', error);
      res.status(500).json({ error: 'Erro ao salvar configuração' });
    }
  }
);

export default router;
