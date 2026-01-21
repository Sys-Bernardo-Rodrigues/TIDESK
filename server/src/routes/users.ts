import express from 'express';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth';
import { dbAll, dbGet } from '../database';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Listar usuários (apenas admin)
router.get('/', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const users = await dbAll(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(users);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// Obter usuário atual
router.get('/me', async (req: AuthRequest, res) => {
  try {
    const user = await dbGet(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [req.userId]
    );
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json(user);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// Listar agentes (para atribuição de tickets)
router.get('/agents', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const agents = await dbAll(
      'SELECT id, name, email FROM users WHERE role IN ("admin", "agent") ORDER BY name'
    );
    res.json(agents);
  } catch (error) {
    console.error('Erro ao listar agentes:', error);
    res.status(500).json({ error: 'Erro ao buscar agentes' });
  }
});

export default router;
