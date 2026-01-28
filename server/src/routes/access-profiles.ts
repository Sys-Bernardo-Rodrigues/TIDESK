import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth';
import { dbGet, dbAll, dbRun, getBrasiliaTimestamp } from '../database';
import { invalidateAllPermissions } from '../middleware/permissions';

const router = express.Router();

// Listar perfis de acesso
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const profiles = await dbAll(`
      SELECT ap.*,
             (SELECT COUNT(*) FROM user_access_profiles uap WHERE uap.access_profile_id = ap.id) as users_count,
             (SELECT COUNT(*) FROM permissions p WHERE p.access_profile_id = ap.id) as permissions_count
      FROM access_profiles ap
      ORDER BY ap.created_at DESC
    `);

    // Buscar permissões de cada perfil
    const profilesWithPermissions = await Promise.all(profiles.map(async (profile: any) => {
      const permissions = await dbAll(`
        SELECT resource, action
        FROM permissions
        WHERE access_profile_id = ?
        ORDER BY resource, action
      `, [profile.id]);

      return {
        ...profile,
        permissions: permissions.map((p: any) => ({
          resource: p.resource,
          action: p.action
        }))
      };
    }));

    res.json(profilesWithPermissions);
  } catch (error) {
    console.error('Erro ao listar perfis:', error);
    res.status(500).json({ error: 'Erro ao buscar perfis de acesso' });
  }
});

// Obter perfil específico
router.get('/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const profile = await dbGet('SELECT * FROM access_profiles WHERE id = ?', [req.params.id]);
    
    if (!profile) {
      return res.status(404).json({ error: 'Perfil não encontrado' });
    }

    const permissions = await dbAll(`
      SELECT resource, action
      FROM permissions
      WHERE access_profile_id = ?
      ORDER BY resource, action
    `, [profile.id]);

    const pages = await dbAll(`
      SELECT page_path
      FROM access_profile_pages
      WHERE access_profile_id = ?
      ORDER BY page_path
    `, [profile.id]);

    const users = await dbAll(`
      SELECT u.id, u.name, u.email
      FROM user_access_profiles uap
      JOIN users u ON uap.user_id = u.id
      WHERE uap.access_profile_id = ?
    `, [profile.id]);

    res.json({
      ...profile,
      permissions: permissions.map((p: any) => ({
        resource: p.resource,
        action: p.action
      })),
      pages: pages.map((p: any) => p.page_path),
      users: users
    });
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
});

// Criar perfil de acesso
router.post('/', [
  authenticate,
  requireAdmin,
  body('name').notEmpty().withMessage('Nome é obrigatório')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, permissions, pages } = req.body;

    // Verificar se nome já existe
    const existing = await dbGet('SELECT id FROM access_profiles WHERE name = ?', [name]);
    if (existing) {
      return res.status(400).json({ error: 'Já existe um perfil com este nome' });
    }

    // Criar perfil
    const profileResult = await dbRun(`
      INSERT INTO access_profiles (name, description)
      VALUES (?, ?)
    `, [name, description || null]);

    const profileId = (profileResult as any).lastID || (profileResult as any).id;

    // Criar permissões
    if (permissions && Array.isArray(permissions)) {
      for (const perm of permissions) {
        if (perm.resource && perm.action) {
          try {
            await dbRun(`
              INSERT INTO permissions (access_profile_id, resource, action)
              VALUES (?, ?, ?)
            `, [profileId, perm.resource, perm.action]);
          } catch (error: any) {
            // Ignorar erro de duplicata
            if (!error.message?.includes('UNIQUE')) {
              throw error;
            }
          }
        }
      }
    }

    // Criar páginas permitidas
    if (pages && Array.isArray(pages)) {
      for (const pagePath of pages) {
        if (pagePath && typeof pagePath === 'string') {
          try {
            await dbRun(`
              INSERT INTO access_profile_pages (access_profile_id, page_path)
              VALUES (?, ?)
            `, [profileId, pagePath]);
          } catch (error: any) {
            if (!error.message?.includes('UNIQUE')) {
              throw error;
            }
          }
        }
      }
    }

    invalidateAllPermissions();

    const profile = await dbGet('SELECT * FROM access_profiles WHERE id = ?', [profileId]);
    res.status(201).json(profile);
  } catch (error) {
    console.error('Erro ao criar perfil:', error);
    res.status(500).json({ error: 'Erro ao criar perfil de acesso' });
  }
});

// Atualizar perfil de acesso
router.put('/:id', [
  authenticate,
  requireAdmin,
  body('name').notEmpty().withMessage('Nome é obrigatório')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, permissions, pages } = req.body;

    // Verificar se perfil existe
    const existing = await dbGet('SELECT id FROM access_profiles WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Perfil não encontrado' });
    }

    // Verificar se nome já existe em outro perfil
    const nameExists = await dbGet('SELECT id FROM access_profiles WHERE name = ? AND id != ?', [name, req.params.id]);
    if (nameExists) {
      return res.status(400).json({ error: 'Já existe um perfil com este nome' });
    }

    // Atualizar perfil
    await dbRun(`
      UPDATE access_profiles
      SET name = ?, description = ?, updated_at = ?
      WHERE id = ?
    `, [name, description || null, getBrasiliaTimestamp(), req.params.id]);

    // Remover permissões antigas
    await dbRun('DELETE FROM permissions WHERE access_profile_id = ?', [req.params.id]);

    // Criar novas permissões
    if (permissions && Array.isArray(permissions)) {
      for (const perm of permissions) {
        if (perm.resource && perm.action) {
          try {
            await dbRun(`
              INSERT INTO permissions (access_profile_id, resource, action)
              VALUES (?, ?, ?)
            `, [req.params.id, perm.resource, perm.action]);
          } catch (error: any) {
            if (!error.message?.includes('UNIQUE')) {
              throw error;
            }
          }
        }
      }
    }

    // Remover páginas antigas
    await dbRun('DELETE FROM access_profile_pages WHERE access_profile_id = ?', [req.params.id]);

    // Criar novas páginas
    if (pages && Array.isArray(pages)) {
      for (const pagePath of pages) {
        if (pagePath && typeof pagePath === 'string') {
          try {
            await dbRun(`
              INSERT INTO access_profile_pages (access_profile_id, page_path)
              VALUES (?, ?)
            `, [req.params.id, pagePath]);
          } catch (error: any) {
            if (!error.message?.includes('UNIQUE')) {
              throw error;
            }
          }
        }
      }
    }

    invalidateAllPermissions();

    const profile = await dbGet('SELECT * FROM access_profiles WHERE id = ?', [req.params.id]);
    res.json(profile);
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ error: 'Erro ao atualizar perfil de acesso' });
  }
});

// Excluir perfil de acesso
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const profile = await dbGet('SELECT id FROM access_profiles WHERE id = ?', [req.params.id]);
    if (!profile) {
      return res.status(404).json({ error: 'Perfil não encontrado' });
    }

    // Verificar se há usuários vinculados
    const usersCount = await dbGet(`
      SELECT COUNT(*) as count FROM user_access_profiles WHERE access_profile_id = ?
    `, [req.params.id]) as any;

    if (usersCount && usersCount.count > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir perfil com usuários vinculados. Remova os usuários primeiro.' 
      });
    }

    // Excluir perfil (permissões serão excluídas em cascata)
    await dbRun('DELETE FROM access_profiles WHERE id = ?', [req.params.id]);

    invalidateAllPermissions();

    res.json({ message: 'Perfil excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir perfil:', error);
    res.status(500).json({ error: 'Erro ao excluir perfil de acesso' });
  }
});

// Vincular usuário a perfil
router.post('/:id/users', [
  authenticate,
  requireAdmin,
  body('userId').isInt().withMessage('ID do usuário é obrigatório')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.body;

    // Verificar se perfil existe
    const profile = await dbGet('SELECT id FROM access_profiles WHERE id = ?', [req.params.id]);
    if (!profile) {
      return res.status(404).json({ error: 'Perfil não encontrado' });
    }

    // Verificar se usuário existe
    const user = await dbGet('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Vincular
    try {
      await dbRun(`
        INSERT INTO user_access_profiles (user_id, access_profile_id)
        VALUES (?, ?)
      `, [userId, req.params.id]);

      // Verificar se o perfil é de administrador e atualizar role
      const profile = await dbGet('SELECT name FROM access_profiles WHERE id = ?', [req.params.id]) as any;
      if (profile && profile.name === 'Administrador') {
        await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', userId]);
      } else if (profile && profile.name === 'Agente') {
        // Verificar se não tem perfil de admin antes de definir como agent
        const adminProfile = await dbAll(`
          SELECT ap.id
          FROM user_access_profiles uap
          JOIN access_profiles ap ON uap.access_profile_id = ap.id
          WHERE uap.user_id = ? AND ap.name = 'Administrador'
        `, [userId]);
        if (adminProfile.length === 0) {
          await dbRun('UPDATE users SET role = ? WHERE id = ?', ['agent', userId]);
        }
      }

      invalidateAllPermissions();

      res.status(201).json({ message: 'Usuário vinculado ao perfil com sucesso' });
    } catch (error: any) {
      if (error.message?.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Usuário já está vinculado a este perfil' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Erro ao vincular usuário:', error);
    res.status(500).json({ error: 'Erro ao vincular usuário ao perfil' });
  }
});

// Desvincular usuário de perfil
router.delete('/:id/users/:userId', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    await dbRun(`
      DELETE FROM user_access_profiles
      WHERE access_profile_id = ? AND user_id = ?
    `, [req.params.id, req.params.userId]);

    // Verificar perfis restantes e atualizar role
    const adminProfile = await dbAll(`
      SELECT ap.id
      FROM user_access_profiles uap
      JOIN access_profiles ap ON uap.access_profile_id = ap.id
      WHERE uap.user_id = ? AND ap.name = 'Administrador'
    `, [req.params.userId]);
    
    const agentProfile = await dbAll(`
      SELECT ap.id
      FROM user_access_profiles uap
      JOIN access_profiles ap ON uap.access_profile_id = ap.id
      WHERE uap.user_id = ? AND ap.name = 'Agente'
    `, [req.params.userId]);

    if (adminProfile.length > 0) {
      await dbRun('UPDATE users SET role = ? WHERE id = ?', ['admin', req.params.userId]);
    } else if (agentProfile.length > 0) {
      await dbRun('UPDATE users SET role = ? WHERE id = ?', ['agent', req.params.userId]);
    } else {
      await dbRun('UPDATE users SET role = ? WHERE id = ?', ['user', req.params.userId]);
    }

    invalidateAllPermissions();

    res.json({ message: 'Usuário desvinculado do perfil com sucesso' });
  } catch (error) {
    console.error('Erro ao desvincular usuário:', error);
    res.status(500).json({ error: 'Erro ao desvincular usuário do perfil' });
  }
});

// Obter permissões do usuário atual
router.get('/me/permissions', authenticate, async (req: AuthRequest, res) => {
  try {
    const { getUserPermissions } = await import('../middleware/permissions');
    const permissions = await getUserPermissions(req.userId!);
    
    // Buscar páginas permitidas do usuário
    const pages = await dbAll(`
      SELECT DISTINCT app.page_path
      FROM access_profile_pages app
      JOIN user_access_profiles uap ON app.access_profile_id = uap.access_profile_id
      WHERE uap.user_id = ?
      ORDER BY app.page_path
    `, [req.userId]);
    
    res.json({
      permissions: Array.from(permissions),
      pages: pages.map((p: any) => p.page_path),
      userId: req.userId
    });
  } catch (error) {
    console.error('Erro ao buscar permissões:', error);
    res.status(500).json({ error: 'Erro ao buscar permissões' });
  }
});

export default router;
