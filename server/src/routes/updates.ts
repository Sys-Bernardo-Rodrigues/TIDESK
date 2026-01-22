import express, { Response } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { checkForUpdates, performUpdate, getRecentCommits, getCurrentVersion } from '../services/update-service';

interface AuthRequest extends express.Request {
  userId?: number;
  userRole?: string;
}

const router = express.Router();

// Verificar atualizações disponíveis
router.get(
  '/check',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const updateInfo = await checkForUpdates();
      res.json(updateInfo);
    } catch (error: any) {
      console.error('Erro ao verificar atualizações:', error);
      res.status(500).json({ error: 'Erro ao verificar atualizações: ' + (error.message || 'Erro desconhecido') });
    }
  }
);

// Obter versão atual
router.get(
  '/version',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.VIEW),
  (req: AuthRequest, res: Response) => {
    try {
      const version = getCurrentVersion();
      res.json({ version });
    } catch (error: any) {
      console.error('Erro ao obter versão:', error);
      res.status(500).json({ error: 'Erro ao obter versão' });
    }
  }
);

// Obter histórico de commits
router.get(
  '/commits',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const commits = await getRecentCommits(limit);
      res.json(commits);
    } catch (error: any) {
      console.error('Erro ao obter commits:', error);
      res.status(500).json({ error: 'Erro ao obter commits' });
    }
  }
);

// Executar atualização
router.post(
  '/update',
  authenticate,
  requirePermission(RESOURCES.CONFIG, ACTIONS.EDIT),
  async (req: AuthRequest, res: Response) => {
    try {
      const branch = req.body.branch || 'main';
      const result = await performUpdate(branch);
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          output: result.output
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }
    } catch (error: any) {
      console.error('Erro ao atualizar:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar',
        error: error.message || 'Erro desconhecido'
      });
    }
  }
);

export default router;
