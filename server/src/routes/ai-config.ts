import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { getAiConfig, saveAiConfig } from '../services/ai-config-service';

const router = express.Router();

const providerValidators = (prefix: string) => [
  body(`${prefix}.apiKey`).optional().isString(),
  body(`${prefix}.enabled`).optional().isBoolean()
];

router.get(
  '/ia-config',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.VIEW),
  (req: AuthRequest, res: Response) => {
    try {
      res.json(getAiConfig());
    } catch (error) {
      console.error('Erro ao ler configuração de IA:', error);
      res.status(500).json({ error: 'Erro ao ler configuração' });
    }
  }
);

router.put(
  '/ia-config',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.EDIT),
  [
    ...providerValidators('groq'),
    ...providerValidators('openrouter'),
    ...providerValidators('gemini')
  ],
  (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const config = saveAiConfig(req.body);
      res.json(config);
    } catch (error) {
      console.error('Erro ao salvar configuração de IA:', error);
      res.status(500).json({ error: 'Erro ao salvar configuração' });
    }
  }
);

export default router;
