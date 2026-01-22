import express from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { authenticate, AuthRequest, requireAdmin, requireAgent } from '../middleware/auth';
import { dbAll, dbGet, dbRun } from '../database';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Listar usuários (apenas admin)
router.get('/', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const users = await dbAll(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    );

    // Buscar perfis de acesso de cada usuário
    const usersWithProfiles = await Promise.all(users.map(async (user: any) => {
      const profiles = await dbAll(`
        SELECT ap.id, ap.name, ap.description
        FROM user_access_profiles uap
        JOIN access_profiles ap ON uap.access_profile_id = ap.id
        WHERE uap.user_id = ?
      `, [user.id]);

      return {
        ...user,
        access_profiles: profiles
      };
    }));

    res.json(usersWithProfiles);
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

    // Buscar perfis de acesso
    const profiles = await dbAll(`
      SELECT ap.id, ap.name, ap.description
      FROM user_access_profiles uap
      JOIN access_profiles ap ON uap.access_profile_id = ap.id
      WHERE uap.user_id = ?
    `, [req.userId]);

    res.json({
      ...user,
      access_profiles: profiles
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// Listar agentes (para atribuição de tickets)
router.get('/agents', requireAgent, async (req: AuthRequest, res) => {
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

// Obter usuário específico com perfis
router.get('/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const user = await dbGet(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Buscar perfis de acesso
    const profiles = await dbAll(`
      SELECT ap.id, ap.name, ap.description
      FROM user_access_profiles uap
      JOIN access_profiles ap ON uap.access_profile_id = ap.id
      WHERE uap.user_id = ?
    `, [req.params.id]);

    res.json({
      ...user,
      access_profiles: profiles
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// Vincular usuário a perfil de acesso
router.post('/:id/access-profiles', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { access_profile_id } = req.body;

    if (!access_profile_id) {
      return res.status(400).json({ error: 'ID do perfil de acesso é obrigatório' });
    }

    // Verificar se usuário existe
    const user = await dbGet('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se perfil existe
    const profile = await dbGet('SELECT id FROM access_profiles WHERE id = ?', [access_profile_id]);
    if (!profile) {
      return res.status(404).json({ error: 'Perfil de acesso não encontrado' });
    }

    // Vincular
    try {
      await dbRun(`
        INSERT INTO user_access_profiles (user_id, access_profile_id)
        VALUES (?, ?)
      `, [req.params.id, access_profile_id]);

      // Invalidar cache de permissões
      const { invalidateUserPermissions } = await import('../middleware/permissions');
      invalidateUserPermissions(parseInt(req.params.id));

      res.status(201).json({ message: 'Perfil vinculado com sucesso' });
    } catch (error: any) {
      if (error.message?.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Usuário já está vinculado a este perfil' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Erro ao vincular perfil:', error);
    res.status(500).json({ error: 'Erro ao vincular perfil de acesso' });
  }
});

// Desvincular usuário de perfil de acesso
router.delete('/:id/access-profiles/:profileId', requireAdmin, async (req: AuthRequest, res) => {
  try {
    await dbRun(`
      DELETE FROM user_access_profiles
      WHERE user_id = ? AND access_profile_id = ?
    `, [req.params.id, req.params.profileId]);

    // Invalidar cache de permissões
    const { invalidateUserPermissions } = await import('../middleware/permissions');
    invalidateUserPermissions(parseInt(req.params.id));

    res.json({ message: 'Perfil desvinculado com sucesso' });
  } catch (error) {
    console.error('Erro ao desvincular perfil:', error);
    res.status(500).json({ error: 'Erro ao desvincular perfil de acesso' });
  }
});

// Criar usuário
router.post('/', [
  requireAdmin,
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres'),
  body('access_profile_ids').isArray().withMessage('Perfis de acesso devem ser um array'),
  body('access_profile_ids.*').isInt().withMessage('IDs de perfis devem ser números inteiros')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, access_profile_ids } = req.body;

    // Verificar se email já existe
    const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Verificar se pelo menos um perfil foi selecionado
    if (!access_profile_ids || access_profile_ids.length === 0) {
      return res.status(400).json({ error: 'Selecione pelo menos um perfil de acesso' });
    }

    // Verificar se todos os perfis existem
    for (const profileId of access_profile_ids) {
      const profile = await dbGet('SELECT id FROM access_profiles WHERE id = ?', [profileId]);
      if (!profile) {
        return res.status(400).json({ error: `Perfil de acesso com ID ${profileId} não encontrado` });
      }
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar usuário (role padrão 'user' para compatibilidade, mas não será usado)
    const result = await dbRun(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, 'user']
    );

    const userId = (result as any).lastID || (result as any).id;

    // Vincular perfis de acesso
    for (const profileId of access_profile_ids) {
      await dbRun(
        'INSERT INTO user_access_profiles (user_id, access_profile_id) VALUES (?, ?)',
        [userId, profileId]
      );
    }

    // Invalidar cache de permissões
    const { invalidateUserPermissions } = await import('../middleware/permissions');
    invalidateUserPermissions(userId);

    // Buscar usuário criado com perfis
    const user = await dbGet(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [userId]
    );

    const profiles = await dbAll(`
      SELECT ap.id, ap.name, ap.description
      FROM user_access_profiles uap
      JOIN access_profiles ap ON uap.access_profile_id = ap.id
      WHERE uap.user_id = ?
    `, [userId]);

    res.status(201).json({
      ...user,
      access_profiles: profiles
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// Atualizar usuário
router.put('/:id', [
  requireAdmin,
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').optional().isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres'),
  body('access_profile_ids').optional().isArray().withMessage('Perfis de acesso devem ser um array'),
  body('access_profile_ids.*').optional().isInt().withMessage('IDs de perfis devem ser números inteiros')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, access_profile_ids } = req.body;

    // Verificar se usuário existe
    const existingUser = await dbGet('SELECT id, email FROM users WHERE id = ?', [req.params.id]);
    if (!existingUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se email já existe em outro usuário
    if (email !== existingUser.email) {
      const emailExists = await dbGet('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.params.id]);
      if (emailExists) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }
    }

    // Atualizar dados do usuário
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await dbRun(
        'UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?',
        [name, email, hashedPassword, req.params.id]
      );
    } else {
      await dbRun(
        'UPDATE users SET name = ?, email = ? WHERE id = ?',
        [name, email, req.params.id]
      );
    }

    // Atualizar perfis de acesso se fornecidos
    if (access_profile_ids !== undefined) {
      if (access_profile_ids.length === 0) {
        return res.status(400).json({ error: 'Selecione pelo menos um perfil de acesso' });
      }

      // Verificar se todos os perfis existem
      for (const profileId of access_profile_ids) {
        const profile = await dbGet('SELECT id FROM access_profiles WHERE id = ?', [profileId]);
        if (!profile) {
          return res.status(400).json({ error: `Perfil de acesso com ID ${profileId} não encontrado` });
        }
      }

      // Remover todos os perfis atuais
      await dbRun('DELETE FROM user_access_profiles WHERE user_id = ?', [req.params.id]);

      // Vincular novos perfis
      for (const profileId of access_profile_ids) {
        await dbRun(
          'INSERT INTO user_access_profiles (user_id, access_profile_id) VALUES (?, ?)',
          [req.params.id, profileId]
        );
      }
    }

    // Invalidar cache de permissões
    const { invalidateUserPermissions } = await import('../middleware/permissions');
    invalidateUserPermissions(parseInt(req.params.id));

    // Buscar usuário atualizado com perfis
    const user = await dbGet(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [req.params.id]
    );

    const profiles = await dbAll(`
      SELECT ap.id, ap.name, ap.description
      FROM user_access_profiles uap
      JOIN access_profiles ap ON uap.access_profile_id = ap.id
      WHERE uap.user_id = ?
    `, [req.params.id]);

    res.json({
      ...user,
      access_profiles: profiles
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// Excluir usuário
router.delete('/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    // Verificar se usuário existe
    const user = await dbGet('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Não permitir excluir a si mesmo
    if (parseInt(req.params.id) === req.userId) {
      return res.status(400).json({ error: 'Você não pode excluir seu próprio usuário' });
    }

    // Excluir usuário (perfis serão desvinculados em cascata)
    await dbRun('DELETE FROM users WHERE id = ?', [req.params.id]);

    res.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
});

export default router;
