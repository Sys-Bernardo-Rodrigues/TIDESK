import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { getSlackConfig, saveSlackConfig, sendSlackTestMessage } from '../services/slack-service';

const router = express.Router();

router.get(
  '/slack-config',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.VIEW),
  (req: AuthRequest, res: Response) => {
    try {
      res.json(getSlackConfig());
    } catch (error) {
      console.error('Erro ao ler configuração do Slack:', error);
      res.status(500).json({ error: 'Erro ao ler configuração' });
    }
  }
);

router.put(
  '/slack-config',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.EDIT),
  [
    body('enabled').optional().isBoolean(),
    body('webhookUrl').optional().isString()
  ],
  (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const config = saveSlackConfig(req.body);
      res.json(config);
    } catch (error) {
      console.error('Erro ao salvar configuração do Slack:', error);
      res.status(500).json({ error: 'Erro ao salvar configuração' });
    }
  }
);

router.post(
  '/slack-config/test',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.EDIT),
  async (req: AuthRequest, res: Response) => {
    try {
      const webhookUrl = (req.body?.webhookUrl as string) || getSlackConfig().webhookUrl;
      if (!webhookUrl) {
        return res.status(400).json({ error: 'Informe a URL do webhook do Slack' });
      }
      const result = await sendSlackTestMessage(webhookUrl);
      if (!result.ok) {
        return res.status(400).json({ error: 'Falha ao enviar mensagem de teste: ' + result.error });
      }
      res.json({ message: 'Mensagem de teste enviada com sucesso' });
    } catch (error: any) {
      console.error('Erro ao testar Slack:', error);
      res.status(500).json({ error: 'Erro ao testar Slack: ' + (error.message || 'Erro desconhecido') });
    }
  }
);

export default router;
