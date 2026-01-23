import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { dbGet, dbAll, dbRun, getBrasiliaTimestamp } from '../database';
import crypto from 'crypto';

const router = express.Router();

// Gerar URL pública única
const generatePublicUrl = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

// Gerar slug a partir do título
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

// Listar páginas (requer autenticação)
router.get('/', authenticate, requirePermission(RESOURCES.PAGES, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    const pages = await dbAll(`
      SELECT p.*,
             u.name as created_by_name,
             (SELECT COUNT(*) FROM page_buttons pb WHERE pb.page_id = p.id) as buttons_count
      FROM pages p
      LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.created_at DESC
    `);

    // Buscar botões de cada página
    const pagesWithButtons = await Promise.all(pages.map(async (page: any) => {
      const buttons = await dbAll(`
        SELECT pb.*, f.name as form_name, f.public_url as form_url
        FROM page_buttons pb
        LEFT JOIN forms f ON pb.form_id = f.id
        WHERE pb.page_id = ?
        ORDER BY pb.order_index ASC
      `, [page.id]);

      return {
        ...page,
        buttons: buttons.map((button: any) => ({
          id: button.id,
          label: button.label,
          formId: button.form_id,
          formName: button.form_name,
          formUrl: button.form_url,
          url: button.url,
          style: button.style ? JSON.parse(button.style) : null,
          orderIndex: button.order_index
        }))
      };
    }));

    res.json(pagesWithButtons);
  } catch (error) {
    console.error('Erro ao listar páginas:', error);
    res.status(500).json({ error: 'Erro ao buscar páginas' });
  }
});

// Obter página específica (requer autenticação)
router.get('/:id', authenticate, requirePermission(RESOURCES.PAGES, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    const page = await dbGet(`
      SELECT p.*, u.name as created_by_name
      FROM pages p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!page) {
      return res.status(404).json({ error: 'Página não encontrada' });
    }

    const buttons = await dbAll(`
      SELECT pb.*, f.name as form_name, f.public_url as form_url
      FROM page_buttons pb
      LEFT JOIN forms f ON pb.form_id = f.id
      WHERE pb.page_id = ?
      ORDER BY pb.order_index ASC
    `, [page.id]);

    res.json({
      ...page,
      buttons: buttons.map((button: any) => ({
        id: button.id,
        label: button.label,
        formId: button.form_id,
        formName: button.form_name,
        formUrl: button.form_url,
        url: button.url,
        style: button.style ? JSON.parse(button.style) : null,
        orderIndex: button.order_index
      }))
    });
  } catch (error) {
    console.error('Erro ao buscar página:', error);
    res.status(500).json({ error: 'Erro ao buscar página' });
  }
});

// Buscar página pública por slug (NÃO requer autenticação)
router.get('/public/:slug', async (req, res) => {
  try {
    const page = await dbGet(`
      SELECT p.*
      FROM pages p
      WHERE p.slug = ? OR p.public_url = ?
    `, [req.params.slug, req.params.slug]);

    if (!page) {
      return res.status(404).json({ error: 'Página não encontrada' });
    }

    const buttons = await dbAll(`
      SELECT pb.*, f.name as form_name, f.public_url as form_url
      FROM page_buttons pb
      LEFT JOIN forms f ON pb.form_id = f.id
      WHERE pb.page_id = ?
      ORDER BY pb.order_index ASC
    `, [page.id]);

    res.json({
      id: page.id,
      title: page.title,
      description: page.description,
      content: page.content,
      buttons: buttons.map((button: any) => ({
        id: button.id,
        label: button.label,
        formId: button.form_id,
        formName: button.form_name,
        formUrl: button.form_url,
        url: button.url,
        style: button.style ? JSON.parse(button.style) : null
      }))
    });
  } catch (error) {
    console.error('Erro ao buscar página pública:', error);
    res.status(500).json({ error: 'Erro ao buscar página' });
  }
});

// Criar página
router.post('/', [
  authenticate,
  requirePermission(RESOURCES.PAGES, ACTIONS.CREATE),
  body('title').notEmpty().withMessage('Título é obrigatório'),
  body('buttons').optional().isArray()
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, content, buttons, slug } = req.body;

    // Gerar slug único
    let pageSlug = slug || generateSlug(title);
    let slugExists = await dbGet('SELECT id FROM pages WHERE slug = ?', [pageSlug]);
    let counter = 1;
    while (slugExists) {
      pageSlug = `${slug || generateSlug(title)}-${counter}`;
      slugExists = await dbGet('SELECT id FROM pages WHERE slug = ?', [pageSlug]);
      counter++;
    }

    // Gerar URL pública única
    let publicUrl = generatePublicUrl();
    let urlExists = await dbGet('SELECT id FROM pages WHERE public_url = ?', [publicUrl]);
    while (urlExists) {
      publicUrl = generatePublicUrl();
      urlExists = await dbGet('SELECT id FROM pages WHERE public_url = ?', [publicUrl]);
    }

    // Criar página
    const pageResult = await dbRun(`
      INSERT INTO pages (title, description, slug, content, public_url, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      title,
      description || null,
      pageSlug,
      content || null,
      publicUrl,
      req.userId
    ]);

    const pageId = (pageResult as any).lastID || (pageResult as any).id;

    // Criar botões
    if (buttons && Array.isArray(buttons)) {
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        await dbRun(`
          INSERT INTO page_buttons (page_id, label, form_id, url, style, order_index)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          pageId,
          button.label,
          button.formId || null,
          button.url || null,
          button.style ? JSON.stringify(button.style) : null,
          i
        ]);
      }
    }

    // Buscar página criada
    const page = await dbGet('SELECT * FROM pages WHERE id = ?', [pageId]);
    const createdButtons = await dbAll('SELECT * FROM page_buttons WHERE page_id = ? ORDER BY order_index ASC', [pageId]);

    res.status(201).json({
      ...page,
      buttons: createdButtons.map((button: any) => ({
        id: button.id,
        label: button.label,
        formId: button.form_id,
        url: button.url,
        style: button.style ? JSON.parse(button.style) : null,
        orderIndex: button.order_index
      }))
    });
  } catch (error) {
    console.error('Erro ao criar página:', error);
    res.status(500).json({ error: 'Erro ao criar página' });
  }
});

// Atualizar página
router.put('/:id', [
  authenticate,
  requirePermission(RESOURCES.PAGES, ACTIONS.EDIT),
  body('title').notEmpty().withMessage('Título é obrigatório')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, content, buttons, slug } = req.body;

    // Verificar se a página pertence ao usuário
    const existingPage = await dbGet('SELECT id, slug FROM pages WHERE id = ? AND created_by = ?', [req.params.id, req.userId]);
    if (!existingPage) {
      return res.status(404).json({ error: 'Página não encontrada' });
    }

    // Gerar novo slug se necessário
    let pageSlug = slug || existingPage.slug;
    if (slug && slug !== existingPage.slug) {
      let slugExists = await dbGet('SELECT id FROM pages WHERE slug = ? AND id != ?', [pageSlug, req.params.id]);
      let counter = 1;
      while (slugExists) {
        pageSlug = `${slug}-${counter}`;
        slugExists = await dbGet('SELECT id FROM pages WHERE slug = ? AND id != ?', [pageSlug, req.params.id]);
        counter++;
      }
    }

    // Atualizar página
    await dbRun(`
      UPDATE pages
      SET title = ?, description = ?, slug = ?, content = ?, updated_at = ?
      WHERE id = ?
    `, [title, description || null, pageSlug, content || null, getBrasiliaTimestamp(), req.params.id]);

    // Remover botões antigos
    await dbRun('DELETE FROM page_buttons WHERE page_id = ?', [req.params.id]);

    // Criar novos botões
    if (buttons && Array.isArray(buttons)) {
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        await dbRun(`
          INSERT INTO page_buttons (page_id, label, form_id, url, style, order_index)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          req.params.id,
          button.label,
          button.formId || null,
          button.url || null,
          button.style ? JSON.stringify(button.style) : null,
          i
        ]);
      }
    }

    // Buscar página atualizada
    const page = await dbGet('SELECT * FROM pages WHERE id = ?', [req.params.id]);
    const updatedButtons = await dbAll('SELECT * FROM page_buttons WHERE page_id = ? ORDER BY order_index ASC', [req.params.id]);

    res.json({
      ...page,
      buttons: updatedButtons.map((button: any) => ({
        id: button.id,
        label: button.label,
        formId: button.form_id,
        url: button.url,
        style: button.style ? JSON.parse(button.style) : null,
        orderIndex: button.order_index
      }))
    });
  } catch (error) {
    console.error('Erro ao atualizar página:', error);
    res.status(500).json({ error: 'Erro ao atualizar página' });
  }
});

// Excluir página
router.delete('/:id', authenticate, requirePermission(RESOURCES.PAGES, ACTIONS.DELETE), async (req: AuthRequest, res) => {
  try {
    // Verificar se a página pertence ao usuário
    const page = await dbGet('SELECT id FROM pages WHERE id = ? AND created_by = ?', [req.params.id, req.userId]);
    if (!page) {
      return res.status(404).json({ error: 'Página não encontrada' });
    }

    // Excluir página (botões serão excluídos em cascata)
    await dbRun('DELETE FROM pages WHERE id = ?', [req.params.id]);

    res.json({ message: 'Página excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir página:', error);
    res.status(500).json({ error: 'Erro ao excluir página' });
  }
});

export default router;
