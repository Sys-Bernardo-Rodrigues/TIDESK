import express, { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { body, param, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, getUserPermissions, RESOURCES, ACTIONS } from '../middleware/permissions';
import { dbGet, dbAll, dbRun, getBrasiliaTimestamp } from '../database';
import { uploadDocsFile, DOCS_UPLOAD_DIR } from '../middleware/upload';
import {
  buildEntrySearchText,
  extractDocxPreviewHtml,
  extractFileSearchText,
  makeSearchSnippet,
} from '../utils/doc-text-index';

const router = express.Router();

type RepoAccess = 'view' | 'edit' | 'owner';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '') || String(Date.now());
}

async function getRepoAccess(userId: number, repositoryId: number): Promise<RepoAccess | null> {
  const repo = await dbGet(
    `SELECT r.*, u.role as owner_role FROM doc_repositories r
     JOIN users u ON r.owner_id = u.id WHERE r.id = ?`,
    [repositoryId]
  ) as any;
  if (!repo) return null;

  const user = await dbGet('SELECT role FROM users WHERE id = ?', [userId]) as any;
  if (user?.role === 'admin') return 'owner';

  if (repo.owner_id === userId) return 'owner';

  const share = await dbGet(
    'SELECT permission FROM doc_repository_shares WHERE repository_id = ? AND user_id = ?',
    [repositoryId, userId]
  ) as any;
  if (share) return share.permission === 'edit' ? 'edit' : 'view';

  if (repo.visibility === 'team') {
    const perms = await getUserPermissions(userId);
    if (perms.has('docs:edit')) return 'edit';
    if (perms.has('docs:view')) return 'view';
  }

  return null;
}

async function requireRepoAccess(
  userId: number,
  repositoryId: number,
  min: RepoAccess
): Promise<{ ok: boolean; access: RepoAccess | null }> {
  const access = await getRepoAccess(userId, repositoryId);
  if (!access) return { ok: false, access: null };
  const rank: Record<RepoAccess, number> = { view: 1, edit: 2, owner: 3 };
  if (rank[access] < rank[min]) return { ok: false, access };
  return { ok: true, access };
}

type ShareMemberInput = { user_id: number; permission?: string };

async function syncRepoShares(
  repositoryId: number,
  ownerId: number,
  members: ShareMemberInput[],
  createdBy: number
) {
  await dbRun('DELETE FROM doc_repository_shares WHERE repository_id = ?', [repositoryId]);
  const now = getBrasiliaTimestamp();
  const seen = new Set<number>();
  for (const m of members) {
    const uid = Number(m.user_id);
    if (!uid || uid === ownerId || seen.has(uid)) continue;
    seen.add(uid);
    const perm = m.permission === 'edit' ? 'edit' : 'view';
    await dbRun(
      `INSERT INTO doc_repository_shares (repository_id, user_id, permission, created_by, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [repositoryId, uid, perm, createdBy, now]
    );
  }
}

function parseTags(tags: unknown): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(String);
  if (typeof tags === 'string') {
    try {
      const p = JSON.parse(tags);
      return Array.isArray(p) ? p.map(String) : tags.split(',').map((t) => t.trim()).filter(Boolean);
    } catch {
      return tags.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }
  return [];
}

function formatRepo(row: any) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    visibility: row.visibility,
    item_count: row.item_count ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    access: row.access,
  };
}

function formatEntry(row: any) {
  return {
    id: row.id,
    repository_id: row.repository_id,
    parent_id: row.parent_id,
    name: row.name,
    entry_type: row.entry_type,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes ?? 0,
    description: row.description,
    tags: parseTags(row.tags),
    content: row.entry_type === 'note' ? row.content : undefined,
    created_by: row.created_by,
    created_by_name: row.created_by_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function buildEntryPath(repoId: number, parentId: number | null): Promise<string[]> {
  const pathNames: string[] = [];
  let pid = parentId;
  while (pid != null) {
    const row = (await dbGet(
      'SELECT id, parent_id, name, entry_type FROM doc_entries WHERE id = ? AND repository_id = ?',
      [pid, repoId]
    )) as any;
    if (!row) break;
    pathNames.unshift(row.name);
    pid = row.parent_id;
  }
  return pathNames;
}

async function indexFileEntry(
  entryId: number,
  storagePath: string,
  mime: string,
  name: string,
  description?: string | null,
  tags?: string | null
) {
  const filePath = path.join(DOCS_UPLOAD_DIR, storagePath);
  const extracted = await extractFileSearchText(filePath, mime, name);
  const searchText = buildEntrySearchText([
    name,
    description,
    parseTags(tags).join(' '),
    extracted,
  ]);
  await dbRun('UPDATE doc_entries SET search_text = ? WHERE id = ?', [searchText, entryId]);
}

function noteSearchText(name: string, content: string, description?: string | null, tags?: string | null) {
  return buildEntrySearchText([name, content, description, parseTags(tags).join(' ')]);
}

// Listar repositórios acessíveis
router.get(
  '/repositories',
  authenticate,
  requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const user = await dbGet('SELECT role FROM users WHERE id = ?', [userId]) as any;
      const isAdmin = user?.role === 'admin';

      let repos: any[];
      if (isAdmin) {
        repos = await dbAll(`
          SELECT r.*, u.name as owner_name,
            (SELECT COUNT(*) FROM doc_entries e WHERE e.repository_id = r.id) as item_count,
            'owner' as access
          FROM doc_repositories r
          JOIN users u ON r.owner_id = u.id
          ORDER BY r.updated_at DESC
        `);
      } else {
        repos = await dbAll(`
          SELECT DISTINCT r.*, u.name as owner_name,
            (SELECT COUNT(*) FROM doc_entries e WHERE e.repository_id = r.id) as item_count,
            CASE
              WHEN r.owner_id = ? THEN 'owner'
              WHEN sh.permission = 'edit' THEN 'edit'
              WHEN sh.permission = 'view' THEN 'view'
              WHEN r.visibility = 'team' THEN
                CASE WHEN EXISTS (
                  SELECT 1 FROM permissions p
                  JOIN user_access_profiles uap ON uap.access_profile_id = p.access_profile_id
                  WHERE uap.user_id = ? AND p.resource = 'docs' AND p.action = 'edit'
                ) THEN 'edit' ELSE 'view' END
              ELSE 'view'
            END as access
          FROM doc_repositories r
          JOIN users u ON r.owner_id = u.id
          LEFT JOIN doc_repository_shares sh ON sh.repository_id = r.id AND sh.user_id = ?
          WHERE r.owner_id = ?
             OR sh.user_id = ?
             OR r.visibility = 'team'
          ORDER BY r.updated_at DESC
        `, [userId, userId, userId, userId, userId]);
      }

      res.json(repos.map(formatRepo));
    } catch (error) {
      console.error('Erro ao listar repositórios docs:', error);
      res.status(500).json({ error: 'Erro ao listar repositórios' });
    }
  }
);

// Criar repositório
router.post(
  '/repositories',
  [
    authenticate,
    requirePermission(RESOURCES.DOCS, ACTIONS.CREATE),
    body('name').notEmpty().withMessage('Nome é obrigatório'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { name, description, visibility, members } = req.body;
      const vis = visibility === 'team' ? 'team' : 'private';
      const now = getBrasiliaTimestamp();
      const slug = slugify(name);
      const result = await dbRun(
        `INSERT INTO doc_repositories (name, slug, description, owner_id, visibility, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name.trim(), slug, description?.trim() || null, req.userId, vis, now, now]
      );
      const id = (result as any).lastID ?? (result as any).insertId;
      if (Array.isArray(members) && members.length > 0) {
        await syncRepoShares(id, req.userId!, members, req.userId!);
      }
      const repo = await dbGet(
        `SELECT r.*, u.name as owner_name FROM doc_repositories r
         JOIN users u ON r.owner_id = u.id WHERE r.id = ?`,
        [id]
      );
      res.status(201).json(formatRepo({ ...repo, item_count: 0, access: 'owner' }));
    } catch (error) {
      console.error('Erro ao criar repositório:', error);
      res.status(500).json({ error: 'Erro ao criar repositório' });
    }
  }
);

// Detalhe do repositório
router.get(
  '/repositories/:id',
  authenticate,
  requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const repoId = Number(req.params.id);
      const { ok, access } = await requireRepoAccess(req.userId!, repoId, 'view');
      if (!ok) return res.status(404).json({ error: 'Repositório não encontrado' });

      const repo = await dbGet(
        `SELECT r.*, u.name as owner_name,
          (SELECT COUNT(*) FROM doc_entries e WHERE e.repository_id = r.id) as item_count
         FROM doc_repositories r JOIN users u ON r.owner_id = u.id WHERE r.id = ?`,
        [repoId]
      );

      let shared_with: unknown[] = [];
      if (access === 'owner') {
        shared_with = await dbAll(
          `SELECT s.id, s.user_id, s.permission, u.name as user_name, u.email as user_email
           FROM doc_repository_shares s
           JOIN users u ON s.user_id = u.id
           WHERE s.repository_id = ?
           ORDER BY u.name`,
          [repoId]
        );
      }

      res.json({ ...formatRepo({ ...repo, access }), shared_with });
    } catch (error) {
      console.error('Erro ao buscar repositório:', error);
      res.status(500).json({ error: 'Erro ao buscar repositório' });
    }
  }
);

// Atualizar repositório
router.put(
  '/repositories/:id',
  authenticate,
  requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const repoId = Number(req.params.id);
      const { ok } = await requireRepoAccess(req.userId!, repoId, 'edit');
      if (!ok) return res.status(403).json({ error: 'Sem permissão para editar este repositório' });

      const { name, description, visibility, members } = req.body;
      const now = getBrasiliaTimestamp();
      const existing = await dbGet('SELECT * FROM doc_repositories WHERE id = ?', [repoId]) as any;
      const slug = name ? slugify(name) : existing.slug;

      await dbRun(
        `UPDATE doc_repositories SET name = ?, slug = ?, description = ?, visibility = ?, updated_at = ?
         WHERE id = ?`,
        [
          name?.trim() || existing.name,
          slug,
          description !== undefined ? (description?.trim() || null) : existing.description,
          visibility === 'team' ? 'team' : visibility === 'private' ? 'private' : existing.visibility,
          now,
          repoId,
        ]
      );

      const ownerCheck = await requireRepoAccess(req.userId!, repoId, 'owner');
      if (ownerCheck.access === 'owner' && Array.isArray(members)) {
        await syncRepoShares(repoId, existing.owner_id, members, req.userId!);
      }

      const repo = await dbGet(
        `SELECT r.*, u.name as owner_name,
          (SELECT COUNT(*) FROM doc_entries e WHERE e.repository_id = r.id) as item_count
         FROM doc_repositories r JOIN users u ON r.owner_id = u.id WHERE r.id = ?`,
        [repoId]
      );
      const access = await getRepoAccess(req.userId!, repoId);
      let shared_with: unknown[] = [];
      if (access === 'owner') {
        shared_with = await dbAll(
          `SELECT s.id, s.user_id, s.permission, u.name as user_name, u.email as user_email
           FROM doc_repository_shares s
           JOIN users u ON s.user_id = u.id
           WHERE s.repository_id = ?
           ORDER BY u.name`,
          [repoId]
        );
      }
      res.json({ ...formatRepo({ ...repo, access }), shared_with });
    } catch (error) {
      console.error('Erro ao atualizar repositório:', error);
      res.status(500).json({ error: 'Erro ao atualizar repositório' });
    }
  }
);

// Excluir repositório
router.delete(
  '/repositories/:id',
  authenticate,
  requirePermission(RESOURCES.DOCS, ACTIONS.DELETE),
  async (req: AuthRequest, res: Response) => {
    try {
      const repoId = Number(req.params.id);
      const { ok } = await requireRepoAccess(req.userId!, repoId, 'owner');
      if (!ok) return res.status(403).json({ error: 'Apenas o proprietário pode excluir o repositório' });

      const files = await dbAll(
        `SELECT storage_path FROM doc_entries WHERE repository_id = ? AND entry_type = 'file' AND storage_path IS NOT NULL`,
        [repoId]
      );
      for (const f of files as any[]) {
        if (f.storage_path) {
          const full = path.join(DOCS_UPLOAD_DIR, f.storage_path);
          if (fs.existsSync(full)) fs.unlinkSync(full);
        }
      }

      await dbRun('DELETE FROM doc_repositories WHERE id = ?', [repoId]);
      res.json({ message: 'Repositório excluído' });
    } catch (error) {
      console.error('Erro ao excluir repositório:', error);
      res.status(500).json({ error: 'Erro ao excluir repositório' });
    }
  }
);

// Busca no repositório (nome, descrição, tags, conteúdo de notas e texto indexado de arquivos)
router.get(
  '/repositories/:id/search',
  authenticate,
  requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const repoId = Number(req.params.id);
      const { ok } = await requireRepoAccess(req.userId!, repoId, 'view');
      if (!ok) return res.status(404).json({ error: 'Repositório não encontrado' });

      const q = String(req.query.q || '').trim().toLowerCase();
      if (q.length < 2) return res.json([]);

      const pattern = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
      const rows = await dbAll(
        `SELECT e.*, u.name as created_by_name
         FROM doc_entries e
         LEFT JOIN users u ON e.created_by = u.id
         WHERE e.repository_id = ?
           AND e.entry_type != 'folder'
           AND (
             LOWER(e.name) LIKE ? ESCAPE '\\'
             OR LOWER(COALESCE(e.description, '')) LIKE ? ESCAPE '\\'
             OR LOWER(COALESCE(e.search_text, '')) LIKE ? ESCAPE '\\'
             OR LOWER(COALESCE(e.content, '')) LIKE ? ESCAPE '\\'
             OR LOWER(COALESCE(e.tags, '')) LIKE ? ESCAPE '\\'
           )
         ORDER BY LOWER(e.name)
         LIMIT 80`,
        [repoId, pattern, pattern, pattern, pattern, pattern]
      );

      const results = [];
      for (const row of rows as any[]) {
        const pathNames = await buildEntryPath(repoId, row.parent_id);
        const haystack = [
          row.name,
          row.description,
          row.content,
          row.search_text,
          row.tags,
        ]
          .filter(Boolean)
          .join('\n');
        const snippet = makeSearchSnippet(haystack, q);
        results.push({
          ...formatEntry(row),
          path: pathNames,
          snippet,
        });
      }

      res.json(results);
    } catch (error) {
      console.error('Erro na busca do repositório:', error);
      res.status(500).json({ error: 'Erro na busca' });
    }
  }
);

// Reindexar texto pesquisável dos arquivos (proprietário / admin)
router.post(
  '/repositories/:id/reindex',
  authenticate,
  requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const repoId = Number(req.params.id);
      const access = await getRepoAccess(req.userId!, repoId);
      if (access !== 'owner') return res.status(403).json({ error: 'Apenas o proprietário pode reindexar' });

      const files = await dbAll(
        `SELECT id, storage_path, mime_type, name, description, tags FROM doc_entries
         WHERE repository_id = ? AND entry_type = 'file' AND storage_path IS NOT NULL`,
        [repoId]
      );

      let indexed = 0;
      for (const f of files as any[]) {
        await indexFileEntry(f.id, f.storage_path, f.mime_type, f.name, f.description, f.tags);
        indexed++;
      }

      const notes = await dbAll(
        `SELECT id, name, content, description, tags FROM doc_entries
         WHERE repository_id = ? AND entry_type = 'note'`,
        [repoId]
      );
      for (const n of notes as any[]) {
        const st = noteSearchText(n.name, n.content || '', n.description, n.tags);
        await dbRun('UPDATE doc_entries SET search_text = ? WHERE id = ?', [st, n.id]);
        indexed++;
      }

      res.json({ message: 'Reindexação concluída', indexed });
    } catch (error) {
      console.error('Erro ao reindexar:', error);
      res.status(500).json({ error: 'Erro ao reindexar' });
    }
  }
);

// Listar entradas (pasta)
router.get(
  '/repositories/:id/entries',
  authenticate,
  requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const repoId = Number(req.params.id);
      const { ok } = await requireRepoAccess(req.userId!, repoId, 'view');
      if (!ok) return res.status(404).json({ error: 'Repositório não encontrado' });

      const parentId = req.query.parent_id != null && req.query.parent_id !== ''
        ? Number(req.query.parent_id)
        : null;

      const entries = await dbAll(
        `SELECT e.*, u.name as created_by_name
         FROM doc_entries e
         LEFT JOIN users u ON e.created_by = u.id
         WHERE e.repository_id = ? AND (
           (? IS NULL AND e.parent_id IS NULL) OR e.parent_id = ?
         )
         ORDER BY
           CASE e.entry_type WHEN 'folder' THEN 0 ELSE 1 END,
           LOWER(e.name)`,
        [repoId, parentId, parentId]
      );

      res.json((entries as any[]).map(formatEntry));
    } catch (error) {
      console.error('Erro ao listar entradas:', error);
      res.status(500).json({ error: 'Erro ao listar arquivos' });
    }
  }
);

// Criar pasta
router.post(
  '/repositories/:id/folders',
  [authenticate, requirePermission(RESOURCES.DOCS, ACTIONS.VIEW), body('name').notEmpty()],
  async (req: AuthRequest, res: Response) => {
    try {
      const repoId = Number(req.params.id);
      const { ok } = await requireRepoAccess(req.userId!, repoId, 'edit');
      if (!ok) return res.status(403).json({ error: 'Sem permissão para criar pastas aqui' });

      const parentId = req.body.parent_id != null ? Number(req.body.parent_id) : null;
      if (parentId) {
        const parent = await dbGet(
          'SELECT id, entry_type FROM doc_entries WHERE id = ? AND repository_id = ?',
          [parentId, repoId]
        );
        if (!parent || (parent as any).entry_type !== 'folder') {
          return res.status(400).json({ error: 'Pasta pai inválida' });
        }
      }

      const now = getBrasiliaTimestamp();
      const result = await dbRun(
        `INSERT INTO doc_entries (repository_id, parent_id, name, entry_type, created_by, created_at, updated_at)
         VALUES (?, ?, ?, 'folder', ?, ?, ?)`,
        [repoId, parentId, req.body.name.trim(), req.userId, now, now]
      );
      const id = (result as any).lastID ?? (result as any).insertId;
      await dbRun('UPDATE doc_repositories SET updated_at = ? WHERE id = ?', [now, repoId]);

      const entry = await dbGet(
        `SELECT e.*, u.name as created_by_name FROM doc_entries e
         LEFT JOIN users u ON e.created_by = u.id WHERE e.id = ?`,
        [id]
      );
      res.status(201).json(formatEntry(entry));
    } catch (error) {
      console.error('Erro ao criar pasta:', error);
      res.status(500).json({ error: 'Erro ao criar pasta' });
    }
  }
);

// Upload de arquivo
router.post(
  '/repositories/:id/upload',
  authenticate,
  requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
  uploadDocsFile.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      const repoId = Number(req.params.id);
      const { ok } = await requireRepoAccess(req.userId!, repoId, 'edit');
      if (!ok) return res.status(403).json({ error: 'Sem permissão para enviar arquivos' });

      if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

      const parentId = req.body.parent_id != null && req.body.parent_id !== ''
        ? Number(req.body.parent_id)
        : null;

      const now = getBrasiliaTimestamp();
      const displayName = (req.body.name as string)?.trim() || req.file.originalname;

      const result = await dbRun(
        `INSERT INTO doc_entries (
          repository_id, parent_id, name, entry_type, storage_path, mime_type, size_bytes,
          description, tags, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, 'file', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          repoId,
          parentId,
          displayName,
          req.file.filename,
          req.file.mimetype,
          req.file.size,
          req.body.description?.trim() || null,
          req.body.tags ? JSON.stringify(parseTags(req.body.tags)) : null,
          req.userId,
          now,
          now,
        ]
      );

      const id = (result as any).lastID ?? (result as any).insertId;
      await indexFileEntry(
        id,
        req.file.filename,
        req.file.mimetype,
        displayName,
        req.body.description?.trim() || null,
        req.body.tags ? JSON.stringify(parseTags(req.body.tags)) : null
      );
      await dbRun('UPDATE doc_repositories SET updated_at = ? WHERE id = ?', [now, repoId]);

      const entry = await dbGet(
        `SELECT e.*, u.name as created_by_name FROM doc_entries e
         LEFT JOIN users u ON e.created_by = u.id WHERE e.id = ?`,
        [id]
      );
      res.status(201).json(formatEntry(entry));
    } catch (error) {
      console.error('Erro no upload:', error);
      res.status(500).json({ error: 'Erro ao enviar arquivo' });
    }
  }
);

// Criar nota de texto
router.post(
  '/repositories/:id/notes',
  [
    authenticate,
    requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
    body('name').notEmpty(),
    body('content').optional(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const repoId = Number(req.params.id);
      const { ok } = await requireRepoAccess(req.userId!, repoId, 'edit');
      if (!ok) return res.status(403).json({ error: 'Sem permissão' });

      const parentId = req.body.parent_id != null ? Number(req.body.parent_id) : null;
      const now = getBrasiliaTimestamp();
      const noteName = req.body.name.trim();
      const noteBody = req.body.content || '';
      const noteDesc = req.body.description?.trim() || null;
      const noteTags = req.body.tags ? JSON.stringify(parseTags(req.body.tags)) : null;
      const searchText = noteSearchText(noteName, noteBody, noteDesc, noteTags);

      const result = await dbRun(
        `INSERT INTO doc_entries (
          repository_id, parent_id, name, entry_type, content, description, tags, search_text,
          created_by, created_at, updated_at
        ) VALUES (?, ?, ?, 'note', ?, ?, ?, ?, ?, ?, ?)`,
        [
          repoId,
          parentId,
          noteName,
          noteBody,
          noteDesc,
          noteTags,
          searchText,
          req.userId,
          now,
          now,
        ]
      );
      const id = (result as any).lastID ?? (result as any).insertId;
      await dbRun('UPDATE doc_repositories SET updated_at = ? WHERE id = ?', [now, repoId]);
      const entry = await dbGet(
        `SELECT e.*, u.name as created_by_name FROM doc_entries e
         LEFT JOIN users u ON e.created_by = u.id WHERE e.id = ?`,
        [id]
      );
      res.status(201).json(formatEntry(entry));
    } catch (error) {
      console.error('Erro ao criar nota:', error);
      res.status(500).json({ error: 'Erro ao criar nota' });
    }
  }
);

// Atualizar entrada (renomear, mover, editar nota)
router.put(
  '/entries/:entryId',
  authenticate,
  requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const entryId = Number(req.params.entryId);
      const entry = await dbGet('SELECT * FROM doc_entries WHERE id = ?', [entryId]) as any;
      if (!entry) return res.status(404).json({ error: 'Item não encontrado' });

      const { ok } = await requireRepoAccess(req.userId!, entry.repository_id, 'edit');
      if (!ok) return res.status(403).json({ error: 'Sem permissão' });

      const { name, parent_id, content, description, tags } = req.body;
      const now = getBrasiliaTimestamp();

      if (parent_id !== undefined) {
        const newParent = parent_id === null ? null : Number(parent_id);
        if (newParent === entryId) {
          return res.status(400).json({ error: 'Não é possível mover para si mesmo' });
        }
        if (newParent != null) {
          const parent = await dbGet(
            'SELECT id, entry_type FROM doc_entries WHERE id = ? AND repository_id = ?',
            [newParent, entry.repository_id]
          );
          if (!parent || (parent as any).entry_type !== 'folder') {
            return res.status(400).json({ error: 'Destino inválido' });
          }
        }
      }

      const newName = name?.trim() || entry.name;
      const newParent =
        parent_id !== undefined ? (parent_id === null ? null : Number(parent_id)) : entry.parent_id;
      const newContent = content !== undefined ? content : entry.content;
      const newDesc =
        description !== undefined ? (description?.trim() || null) : entry.description;
      const newTags = tags !== undefined ? JSON.stringify(parseTags(tags)) : entry.tags;
      let newSearchText = entry.search_text;
      if (entry.entry_type === 'note') {
        newSearchText = noteSearchText(newName, newContent || '', newDesc, newTags);
      } else if (entry.entry_type === 'file' && name !== undefined) {
        newSearchText = buildEntrySearchText([
          newName,
          newDesc,
          parseTags(newTags).join(' '),
          entry.search_text,
        ]);
      }

      await dbRun(
        `UPDATE doc_entries SET name = ?, parent_id = ?, content = ?, description = ?, tags = ?, search_text = ?, updated_at = ?
         WHERE id = ?`,
        [newName, newParent, newContent, newDesc, newTags, newSearchText, now, entryId]
      );

      await dbRun('UPDATE doc_repositories SET updated_at = ? WHERE id = ?', [now, entry.repository_id]);
      const updated = await dbGet(
        `SELECT e.*, u.name as created_by_name FROM doc_entries e
         LEFT JOIN users u ON e.created_by = u.id WHERE e.id = ?`,
        [entryId]
      );
      res.json(formatEntry(updated));
    } catch (error) {
      console.error('Erro ao atualizar entrada:', error);
      res.status(500).json({ error: 'Erro ao atualizar' });
    }
  }
);

// Pré-visualização HTML (DOCX convertido para exibir no navegador)
router.get(
  '/entries/:entryId/preview-html',
  authenticate,
  requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const entryId = Number(req.params.entryId);
      const entry = await dbGet('SELECT * FROM doc_entries WHERE id = ?', [entryId]) as any;
      if (!entry || entry.entry_type !== 'file' || !entry.storage_path) {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
      }

      const { ok } = await requireRepoAccess(req.userId!, entry.repository_id, 'view');
      if (!ok) return res.status(403).json({ error: 'Acesso negado' });

      const filePath = path.join(DOCS_UPLOAD_DIR, entry.storage_path);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Arquivo não encontrado no disco' });
      }

      const ext = path.extname(entry.name).toLowerCase();
      const mime = (entry.mime_type || '').toLowerCase();
      if (
        ext === '.docx' ||
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const html = await extractDocxPreviewHtml(filePath);
        if (!html) return res.status(422).json({ error: 'Não foi possível converter o documento' });
        return res.json({ format: 'html', html });
      }

      return res.status(400).json({ error: 'Formato sem pré-visualização HTML' });
    } catch (error) {
      console.error('Erro na pré-visualização HTML:', error);
      res.status(500).json({ error: 'Erro ao gerar pré-visualização' });
    }
  }
);

// Visualizar arquivo no navegador (inline — ex.: PDF)
router.get(
  '/entries/:entryId/preview',
  authenticate,
  requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const entryId = Number(req.params.entryId);
      const entry = await dbGet('SELECT * FROM doc_entries WHERE id = ?', [entryId]) as any;
      if (!entry || entry.entry_type !== 'file' || !entry.storage_path) {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
      }

      const { ok } = await requireRepoAccess(req.userId!, entry.repository_id, 'view');
      if (!ok) return res.status(403).json({ error: 'Acesso negado' });

      const filePath = path.join(DOCS_UPLOAD_DIR, entry.storage_path);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Arquivo não encontrado no disco' });
      }

      const mime = entry.mime_type || 'application/octet-stream';
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(entry.name)}"`);
      res.sendFile(path.resolve(filePath));
    } catch (error) {
      console.error('Erro na pré-visualização:', error);
      res.status(500).json({ error: 'Erro ao abrir arquivo' });
    }
  }
);

// Download de arquivo
router.get(
  '/entries/:entryId/download',
  authenticate,
  requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const entryId = Number(req.params.entryId);
      const entry = await dbGet('SELECT * FROM doc_entries WHERE id = ?', [entryId]) as any;
      if (!entry || entry.entry_type !== 'file' || !entry.storage_path) {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
      }

      const { ok } = await requireRepoAccess(req.userId!, entry.repository_id, 'view');
      if (!ok) return res.status(403).json({ error: 'Acesso negado' });

      const filePath = path.join(DOCS_UPLOAD_DIR, entry.storage_path);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Arquivo não encontrado no disco' });
      }

      res.download(filePath, entry.name);
    } catch (error) {
      console.error('Erro no download:', error);
      res.status(500).json({ error: 'Erro ao baixar arquivo' });
    }
  }
);

// Excluir entrada
router.delete(
  '/entries/:entryId',
  authenticate,
  requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const entryId = Number(req.params.entryId);
      const entry = await dbGet('SELECT * FROM doc_entries WHERE id = ?', [entryId]) as any;
      if (!entry) return res.status(404).json({ error: 'Item não encontrado' });

      const { ok } = await requireRepoAccess(req.userId!, entry.repository_id, 'edit');
      if (!ok) return res.status(403).json({ error: 'Sem permissão' });

      if (entry.entry_type === 'folder') {
        const children = await dbAll(
          'SELECT id FROM doc_entries WHERE parent_id = ?',
          [entryId]
        );
        if ((children as any[]).length > 0) {
          return res.status(400).json({ error: 'A pasta não está vazia. Remova o conteúdo antes.' });
        }
      }

      if (entry.entry_type === 'file' && entry.storage_path) {
        const filePath = path.join(DOCS_UPLOAD_DIR, entry.storage_path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      const now = getBrasiliaTimestamp();
      await dbRun('DELETE FROM doc_entries WHERE id = ?', [entryId]);
      await dbRun('UPDATE doc_repositories SET updated_at = ? WHERE id = ?', [now, entry.repository_id]);
      res.json({ message: 'Item excluído' });
    } catch (error) {
      console.error('Erro ao excluir entrada:', error);
      res.status(500).json({ error: 'Erro ao excluir' });
    }
  }
);

// Usuários disponíveis para compartilhar (proprietário do repositório)
router.get(
  '/share-users',
  authenticate,
  requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const users = await dbAll(
        'SELECT id, name, email FROM users ORDER BY name ASC'
      );
      res.json(users);
    } catch (error) {
      console.error('Erro ao listar usuários para compartilhar:', error);
      res.status(500).json({ error: 'Erro ao listar usuários' });
    }
  }
);

// Listar compartilhamentos
router.get(
  '/repositories/:id/shares',
  authenticate,
  requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const repoId = Number(req.params.id);
      const { ok, access } = await requireRepoAccess(req.userId!, repoId, 'view');
      if (!ok) return res.status(404).json({ error: 'Repositório não encontrado' });
      if (access !== 'owner') {
        return res.status(403).json({ error: 'Apenas o proprietário pode ver compartilhamentos' });
      }

      const shares = await dbAll(
        `SELECT s.*, u.name as user_name, u.email as user_email, cb.name as created_by_name
         FROM doc_repository_shares s
         JOIN users u ON s.user_id = u.id
         JOIN users cb ON s.created_by = cb.id
         WHERE s.repository_id = ?
         ORDER BY s.created_at DESC`,
        [repoId]
      );
      res.json(shares);
    } catch (error) {
      console.error('Erro ao listar shares:', error);
      res.status(500).json({ error: 'Erro ao listar compartilhamentos' });
    }
  }
);

// Sincronizar lista de usuários com acesso (substitui compartilhamentos atuais)
router.put(
  '/repositories/:id/access',
  authenticate,
  requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const repoId = Number(req.params.id);
      const { ok, access } = await requireRepoAccess(req.userId!, repoId, 'owner');
      if (!ok || access !== 'owner') {
        return res.status(403).json({ error: 'Apenas o proprietário pode definir acessos' });
      }

      const existing = await dbGet('SELECT owner_id FROM doc_repositories WHERE id = ?', [repoId]) as any;
      const members = Array.isArray(req.body.members) ? req.body.members : [];
      await syncRepoShares(repoId, existing.owner_id, members, req.userId!);

      const shared_with = await dbAll(
        `SELECT s.id, s.user_id, s.permission, u.name as user_name, u.email as user_email
         FROM doc_repository_shares s
         JOIN users u ON s.user_id = u.id
         WHERE s.repository_id = ?
         ORDER BY u.name`,
        [repoId]
      );
      res.json({ shared_with });
    } catch (error) {
      console.error('Erro ao sincronizar acessos:', error);
      res.status(500).json({ error: 'Erro ao salvar acessos' });
    }
  }
);

// Compartilhar com usuário
router.post(
  '/repositories/:id/shares',
  [
    authenticate,
    requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
    body('user_id').isInt(),
    body('permission').isIn(['view', 'edit']),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const repoId = Number(req.params.id);
      const { ok, access } = await requireRepoAccess(req.userId!, repoId, 'owner');
      if (!ok || access !== 'owner') {
        return res.status(403).json({ error: 'Apenas o proprietário pode compartilhar' });
      }

      const repo = await dbGet('SELECT owner_id FROM doc_repositories WHERE id = ?', [repoId]) as any;
      const targetUserId = Number(req.body.user_id);
      if (targetUserId === repo.owner_id) {
        return res.status(400).json({ error: 'O proprietário já tem acesso total' });
      }

      const existing = await dbGet(
        'SELECT id FROM doc_repository_shares WHERE repository_id = ? AND user_id = ?',
        [repoId, targetUserId]
      );
      const now = getBrasiliaTimestamp();
      if (existing) {
        await dbRun(
          'UPDATE doc_repository_shares SET permission = ?, created_by = ? WHERE id = ?',
          [req.body.permission, req.userId, (existing as any).id]
        );
      } else {
        await dbRun(
          `INSERT INTO doc_repository_shares (repository_id, user_id, permission, created_by, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [repoId, targetUserId, req.body.permission, req.userId, now]
        );
      }

      const shares = await dbAll(
        `SELECT s.*, u.name as user_name, u.email as user_email
         FROM doc_repository_shares s JOIN users u ON s.user_id = u.id
         WHERE s.repository_id = ? AND s.user_id = ?`,
        [repoId, targetUserId]
      );
      res.status(201).json(shares[0]);
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      res.status(500).json({ error: 'Erro ao compartilhar' });
    }
  }
);

// Remover compartilhamento
router.delete(
  '/shares/:shareId',
  authenticate,
  requirePermission(RESOURCES.DOCS, ACTIONS.VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const share = await dbGet('SELECT * FROM doc_repository_shares WHERE id = ?', [req.params.shareId]) as any;
      if (!share) return res.status(404).json({ error: 'Compartilhamento não encontrado' });

      const { ok, access } = await requireRepoAccess(req.userId!, share.repository_id, 'owner');
      if (!ok || access !== 'owner') {
        return res.status(403).json({ error: 'Sem permissão' });
      }

      await dbRun('DELETE FROM doc_repository_shares WHERE id = ?', [share.id]);
      res.json({ message: 'Compartilhamento removido' });
    } catch (error) {
      console.error('Erro ao remover share:', error);
      res.status(500).json({ error: 'Erro ao remover compartilhamento' });
    }
  }
);

export default router;
