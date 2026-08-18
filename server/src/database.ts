import sqlite3 from 'sqlite3';
import { Pool } from 'pg';
import { promisify } from 'util';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const DB_TYPE = process.env.DB_TYPE || 'sqlite';

// Interfaces
export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'agent' | 'user';
  created_at: string;
}

export interface Ticket {
  id: number;
  ticket_number: number | null;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'pending_approval' | 'scheduled' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category_id: number;
  user_id: number;
  assigned_to: number | null;
  assigned_at: string | null; // Momento em que o agente pegou o ticket para si (para métricas corretas)
  form_id: number | null;
  form_submission_id: number | null;
  needs_approval: number;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketCollaborator {
  id: number;
  ticket_id: number;
  user_id: number;
  added_by: number | null;
  created_at: string;
}

export interface TicketTimeEntry {
  id: number;
  ticket_id: number;
  user_id: number;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface TicketAttachment {
  id: number;
  ticket_id: number;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  source: 'manual' | 'ai_assistant';
  uploaded_by: number | null;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

export interface Form {
  id: number;
  name: string;
  description: string;
  public_url: string;
  linked_user_id: number | null;
  linked_group_id: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface FormField {
  id: number;
  form_id: number;
  type: string;
  label: string;
  placeholder: string | null;
  required: boolean;
  options: string | null; // JSON string para select/radio
  validation: string | null; // JSON string
  order_index: number;
  created_at: string;
}

export interface FormSubmission {
  id: number;
  form_id: number;
  submission_data: string; // JSON string
  created_at: string;
}

export interface Page {
  id: number;
  title: string;
  description: string | null;
  slug: string;
  content: string | null; // HTML content
  public_url: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface PageButton {
  id: number;
  page_id: number;
  label: string;
  form_id: number | null; // Link para formulário
  url: string | null; // URL externa (se não for formulário)
  style: string | null; // JSON string com estilos
  order_index: number;
  created_at: string;
}

export interface AccessProfile {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: number;
  access_profile_id: number;
  resource: string; // Ex: 'tickets', 'forms', 'pages', 'users'
  action: string; // Ex: 'create', 'view', 'edit', 'delete', 'approve'
  created_at: string;
}

export interface UserAccessProfile {
  id: number;
  user_id: number;
  access_profile_id: number;
  created_at: string;
}

export interface AccessProfilePage {
  id: number;
  access_profile_id: number;
  page_path: string; // Ex: '/', '/tickets', '/create/forms', etc.
  created_at: string;
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface GroupUser {
  id: number;
  group_id: number;
  user_id: number;
  created_at: string;
}

export interface TicketMessage {
  id: number;
  ticket_id: number;
  user_id: number;
  message: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  type: 'event' | 'ticket' | 'work';
  color: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface EventUser {
  id: number;
  event_id: number;
  user_id: number;
  created_at: string;
}

export interface Shift {
  id: number;
  title: string | null;
  start_time: string;
  end_time: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ShiftUser {
  id: number;
  shift_id: number;
  user_id: number;
  created_at: string;
}

export interface TvSlide {
  id: number;
  title: string;
  url: string;
  duration_seconds: number;
  sort_order: number;
  active: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

// Função para obter timestamp atual em horário de Brasília (UTC-3)
export function getBrasiliaTimestamp(): string {
  const now = new Date();
  
  // Obter componentes da data/hora no timezone de Brasília
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  const hour = parts.find(p => p.type === 'hour')?.value || '';
  const minute = parts.find(p => p.type === 'minute')?.value || '';
  const second = parts.find(p => p.type === 'second')?.value || '';
  
  // Formatar como YYYY-MM-DD HH:mm:ss
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

// Abstração do banco de dados
interface DatabaseAdapter {
  run(query: string, params?: any[]): Promise<any>;
  get(query: string, params?: any[]): Promise<any>;
  all(query: string, params?: any[]): Promise<any[]>;
  convertPlaceholders(query: string): string;
}

// Implementação SQLite
class SQLiteAdapter implements DatabaseAdapter {
  private db: sqlite3.Database;
  private dbRun: (query: string, params?: any[]) => Promise<any>;
  private dbGet: (query: string, params?: any[]) => Promise<any>;
  private dbAll: (query: string, params?: any[]) => Promise<any[]>;

  constructor() {
    const dbPath = process.env.SQLITE_DB_PATH || './tidesk.db';
    this.db = new sqlite3.Database(dbPath);
    this.dbRun = promisify(this.db.run.bind(this.db));
    this.dbGet = promisify(this.db.get.bind(this.db));
    this.dbAll = promisify(this.db.all.bind(this.db));
  }

  convertPlaceholders(query: string): string {
    // SQLite usa ?, não precisa converter
    return query;
  }

  async run(query: string, params?: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.run(query, params || [], function(err: Error | null) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID || null });
        }
      });
    });
  }

  async get(query: string, params?: any[]): Promise<any> {
    return this.dbGet(query, params || []);
  }

  async all(query: string, params?: any[]): Promise<any[]> {
    return this.dbAll(query, params || []);
  }

  getDb() {
    return this.db;
  }
}

// Implementação PostgreSQL
class PostgreSQLAdapter implements DatabaseAdapter {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'tidesk',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    this.pool.on('error', (err) => {
      console.error('Erro inesperado no pool do PostgreSQL:', err);
    });
  }

  convertPlaceholders(query: string): string {
    // Converter ? para $1, $2, $3, etc
    let paramIndex = 1;
    return query.replace(/\?/g, () => `$${paramIndex++}`);
  }

  async run(query: string, params?: any[]): Promise<any> {
    let pgQuery = this.convertPlaceholders(query);
    
    // Para INSERT sem RETURNING, adicionar RETURNING id
    if (pgQuery.trim().toUpperCase().startsWith('INSERT') && !pgQuery.toUpperCase().includes('RETURNING')) {
      // Adicionar RETURNING id antes do ponto e vírgula ou no final
      if (pgQuery.includes(';')) {
        pgQuery = pgQuery.replace(';', ' RETURNING id;');
      } else {
        pgQuery = pgQuery + ' RETURNING id';
      }
    }
    
    const result = await this.pool.query(pgQuery, params || []);
    
    // Para INSERT, retornar o ID inserido
    if (result.rows && result.rows.length > 0 && result.rows[0].id) {
      return { lastID: result.rows[0].id };
    }
    
    // Para outros comandos, tentar pegar o ID da última linha afetada
    if (result.rows && result.rows.length > 0) {
      return { lastID: result.rows[0].id || result.rows[0][Object.keys(result.rows[0])[0]] };
    }
    
    return { lastID: null };
  }

  async get(query: string, params?: any[]): Promise<any> {
    const pgQuery = this.convertPlaceholders(query);
    const result = await this.pool.query(pgQuery, params || []);
    return result.rows[0] || null;
  }

  async all(query: string, params?: any[]): Promise<any[]> {
    const pgQuery = this.convertPlaceholders(query);
    const result = await this.pool.query(pgQuery, params || []);
    return result.rows;
  }

  getPool() {
    return this.pool;
  }
}

// Selecionar adaptador baseado na variável de ambiente
let dbAdapter: DatabaseAdapter;
let db: any;

if (DB_TYPE === 'postgres') {
  dbAdapter = new PostgreSQLAdapter();
  db = (dbAdapter as PostgreSQLAdapter).getPool();
  console.log('📦 Usando PostgreSQL como banco de dados');
} else {
  dbAdapter = new SQLiteAdapter();
  db = (dbAdapter as SQLiteAdapter).getDb();
  console.log('📦 Usando SQLite como banco de dados');
}

// Funções de acesso ao banco (mantém compatibilidade com código existente)
export const dbRun = (query: string, params?: any[]) => dbAdapter.run(query, params);
export const dbGet = (query: string, params?: any[]) => dbAdapter.get(query, params);
export const dbAll = (query: string, params?: any[]) => dbAdapter.all(query, params);

export const initDatabase = async () => {
  try {
    if (DB_TYPE === 'postgres') {
      await initPostgreSQL();
    } else {
      // Para SQLite, usar serialize
      return new Promise<void>((resolve, reject) => {
        (db as sqlite3.Database).serialize(async () => {
          try {
            await initSQLite();
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    }
  } catch (error) {
    throw error;
  }
};

const initSQLite = async () => {
  // Tabela de usuários
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de categorias
  await dbRun(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de tickets
  await dbRun(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number INTEGER,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium',
      category_id INTEGER,
      user_id INTEGER NOT NULL,
      assigned_to INTEGER,
      form_id INTEGER,
      form_submission_id INTEGER,
      needs_approval INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id),
      FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE SET NULL,
      FOREIGN KEY (form_submission_id) REFERENCES form_submissions(id) ON DELETE SET NULL
    )
  `);

  // Tabela de formulários
  await dbRun(`
    CREATE TABLE IF NOT EXISTS forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      public_url TEXT UNIQUE NOT NULL,
      linked_user_id INTEGER,
      linked_group_id INTEGER,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (linked_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela de campos de formulário
  await dbRun(`
    CREATE TABLE IF NOT EXISTS form_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      placeholder TEXT,
      required INTEGER DEFAULT 0,
      options TEXT,
      validation TEXT,
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
    )
  `);

  // Tabela de submissões de formulário
  await dbRun(`
    CREATE TABLE IF NOT EXISTS form_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_id INTEGER NOT NULL,
      submission_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
    )
  `);

  // Tabela de arquivos anexados
  await dbRun(`
    CREATE TABLE IF NOT EXISTS form_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_submission_id INTEGER NOT NULL,
      field_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (form_submission_id) REFERENCES form_submissions(id) ON DELETE CASCADE
    )
  `);

  // Tabela de páginas públicas
  await dbRun(`
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      slug TEXT UNIQUE NOT NULL,
      content TEXT,
      public_url TEXT UNIQUE NOT NULL,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela de botões das páginas
  await dbRun(`
    CREATE TABLE IF NOT EXISTS page_buttons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      form_id INTEGER,
      url TEXT,
      style TEXT,
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
      FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE SET NULL
    )
  `);

  // Tabela de perfis de acesso
  await dbRun(`
    CREATE TABLE IF NOT EXISTS access_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de permissões
  await dbRun(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      access_profile_id INTEGER NOT NULL,
      resource TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (access_profile_id) REFERENCES access_profiles(id) ON DELETE CASCADE,
      UNIQUE(access_profile_id, resource, action)
    )
  `);

  // Tabela de vinculação usuário-perfil
  await dbRun(`
    CREATE TABLE IF NOT EXISTS user_access_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      access_profile_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (access_profile_id) REFERENCES access_profiles(id) ON DELETE CASCADE,
      UNIQUE(user_id, access_profile_id)
    )
  `);

  // Adicionar coluna access_profile_id na tabela users (SQLite não suporta ALTER TABLE ADD COLUMN IF NOT EXISTS)
  try {
    await dbRun(`
      ALTER TABLE users ADD COLUMN access_profile_id INTEGER REFERENCES access_profiles(id)
    `);
  } catch (error) {
    // Coluna já existe, ignorar erro
  }

  // Adicionar coluna ticket_number na tabela tickets (SQLite não suporta ALTER TABLE ADD COLUMN IF NOT EXISTS)
  try {
    await dbRun(`
      ALTER TABLE tickets ADD COLUMN ticket_number INTEGER
    `);
  } catch (error) {
    // Coluna já existe, ignorar erro
  }

  // Adicionar coluna scheduled_at na tabela tickets
  try {
    await dbRun(`
      ALTER TABLE tickets ADD COLUMN scheduled_at DATETIME
    `);
  } catch (error) {
    // Coluna já existe, ignorar erro
  }

  // Tabela de grupos
  await dbRun(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela de vinculação grupo-usuário
  await dbRun(`
    CREATE TABLE IF NOT EXISTS group_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(group_id, user_id)
    )
  `);

  // Tabela de mensagens do ticket
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ticket_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela de anexos de mensagens
  await dbRun(`
    CREATE TABLE IF NOT EXISTS message_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES ticket_messages(id) ON DELETE CASCADE
    )
  `);

  // Tabela de pausas de ticket (tempo em pausa não conta no tempo médio)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ticket_pauses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      paused_at DATETIME NOT NULL,
      resumed_at DATETIME,
      paused_by INTEGER,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (paused_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Tabela de colaboradores do ticket (usuários adicionais além do responsável em assigned_to)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ticket_collaborators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      added_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE (ticket_id, user_id)
    )
  `);

  // Tabela de cronômetro de tempo por usuário no ticket (sessões iniciar/parar)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ticket_time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      started_at DATETIME NOT NULL,
      ended_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  // Garante no máximo 1 cronômetro aberto por usuário/ticket
  await dbRun(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_time_entries_open
    ON ticket_time_entries (ticket_id, user_id)
    WHERE ended_at IS NULL
  `);

  // Tabela de anexos de ticket (genérica, não amarrada a formulário — ex. PDF de OS do assistente de IA)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ticket_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      uploaded_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Tabela de páginas permitidas por perfil de acesso
  await dbRun(`
    CREATE TABLE IF NOT EXISTS access_profile_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      access_profile_id INTEGER NOT NULL,
      page_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (access_profile_id) REFERENCES access_profiles(id) ON DELETE CASCADE,
      UNIQUE(access_profile_id, page_path)
    )
  `);

  // Tabela de eventos do calendário
  await dbRun(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      type TEXT NOT NULL DEFAULT 'event',
      color TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela de relacionamento entre eventos e usuários
  await dbRun(`
    CREATE TABLE IF NOT EXISTS event_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(event_id, user_id)
    )
  `);

  // Tabela de plantões
  await dbRun(`
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela de relacionamento entre plantões e usuários
  await dbRun(`
    CREATE TABLE IF NOT EXISTS shift_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(shift_id, user_id)
    )
  `);

  // Adicionar coluna scheduled_at na tabela tickets (SQLite)
  try {
    await dbRun(`ALTER TABLE tickets ADD COLUMN scheduled_at DATETIME`);
  } catch (error) {
    // Coluna já existe, ignorar erro
  }

  // Adicionar coluna assigned_at - momento em que o agente pegou o ticket para si
  try {
    await dbRun(`ALTER TABLE tickets ADD COLUMN assigned_at DATETIME`);
  } catch (error) {
    // Coluna já existe, ignorar erro
  }

  // Tabela de webhooks
  await dbRun(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      webhook_url TEXT UNIQUE NOT NULL,
      secret_key TEXT,
      active INTEGER DEFAULT 1,
      priority TEXT NOT NULL DEFAULT 'medium',
      category_id INTEGER,
      assigned_to INTEGER,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela de logs de webhooks
  await dbRun(`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webhook_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'success',
      response_code INTEGER,
      payload TEXT,
      error_message TEXT,
      ticket_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
    )
  `);

  // Tabela de slides (links externos) do painel de TV
  await dbRun(`
    CREATE TABLE IF NOT EXISTS tv_slides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 30,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS doc_repositories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      owner_id INTEGER NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS doc_repository_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repository_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      permission TEXT NOT NULL DEFAULT 'view',
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(repository_id, user_id),
      FOREIGN KEY (repository_id) REFERENCES doc_repositories(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS doc_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repository_id INTEGER NOT NULL,
      parent_id INTEGER,
      name TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      storage_path TEXT,
      mime_type TEXT,
      size_bytes INTEGER DEFAULT 0,
      content TEXT,
      description TEXT,
      tags TEXT,
      search_text TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repository_id) REFERENCES doc_repositories(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES doc_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  try {
    await dbRun(`ALTER TABLE doc_entries ADD COLUMN search_text TEXT`);
  } catch {
    // coluna já existe
  }

  await seedDatabase();
};

const initPostgreSQL = async () => {
  // Tabela de usuários
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de categorias
  await dbRun(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de tickets
  await dbRun(`
    CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      ticket_number INTEGER,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'open',
      priority VARCHAR(50) NOT NULL DEFAULT 'medium',
      category_id INTEGER,
      user_id INTEGER NOT NULL,
      assigned_to INTEGER,
      form_id INTEGER,
      form_submission_id INTEGER,
      needs_approval INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE SET NULL,
      FOREIGN KEY (form_submission_id) REFERENCES form_submissions(id) ON DELETE SET NULL
    )
  `);

  // Adicionar coluna ticket_number na tabela tickets (PostgreSQL)
  try {
    await dbRun(`
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_number INTEGER
    `);
  } catch (error) {
    // Coluna já existe, ignorar erro
  }

  // Adicionar coluna scheduled_at na tabela tickets (PostgreSQL)
  try {
    await dbRun(`
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP
    `);
  } catch (error) {
    // Coluna já existe, ignorar erro
  }

  // Adicionar coluna assigned_at - momento em que o agente pegou o ticket para si
  try {
    await dbRun(`
      ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP
    `);
  } catch (error) {
    // Coluna já existe, ignorar erro
  }

  // Tabela de webhooks
  await dbRun(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      webhook_url VARCHAR(255) UNIQUE NOT NULL,
      secret_key VARCHAR(255),
      active INTEGER DEFAULT 1,
      priority VARCHAR(50) NOT NULL DEFAULT 'medium',
      category_id INTEGER,
      assigned_to INTEGER,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela de logs de webhooks
  await dbRun(`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id SERIAL PRIMARY KEY,
      webhook_id INTEGER NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'success',
      response_code INTEGER,
      payload TEXT,
      error_message TEXT,
      ticket_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
    )
  `);

  // Tabela de formulários
  await dbRun(`
    CREATE TABLE IF NOT EXISTS forms (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      public_url VARCHAR(255) UNIQUE NOT NULL,
      linked_user_id INTEGER,
      linked_group_id INTEGER,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (linked_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela de campos de formulário
  await dbRun(`
    CREATE TABLE IF NOT EXISTS form_fields (
      id SERIAL PRIMARY KEY,
      form_id INTEGER NOT NULL,
      type VARCHAR(50) NOT NULL,
      label VARCHAR(255) NOT NULL,
      placeholder VARCHAR(255),
      required INTEGER DEFAULT 0,
      options TEXT,
      validation TEXT,
      order_index INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
    )
  `);

  // Tabela de submissões de formulário
  await dbRun(`
    CREATE TABLE IF NOT EXISTS form_submissions (
      id SERIAL PRIMARY KEY,
      form_id INTEGER NOT NULL,
      submission_data TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
    )
  `);

  // Tabela de arquivos anexados
  await dbRun(`
    CREATE TABLE IF NOT EXISTS form_attachments (
      id SERIAL PRIMARY KEY,
      form_submission_id INTEGER NOT NULL,
      field_id INTEGER NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (form_submission_id) REFERENCES form_submissions(id) ON DELETE CASCADE
    )
  `);

  // Tabela de grupos
  await dbRun(`
    CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela de vinculação grupo-usuário
  await dbRun(`
    CREATE TABLE IF NOT EXISTS group_users (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(group_id, user_id)
    )
  `);

  // Tabela de mensagens do ticket
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ticket_messages (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela de anexos de mensagens
  await dbRun(`
    CREATE TABLE IF NOT EXISTS message_attachments (
      id SERIAL PRIMARY KEY,
      message_id INTEGER NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES ticket_messages(id) ON DELETE CASCADE
    )
  `);

  // Tabela de pausas de ticket (tempo em pausa não conta no tempo médio)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ticket_pauses (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL,
      paused_at TIMESTAMP NOT NULL,
      resumed_at TIMESTAMP,
      paused_by INTEGER,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (paused_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Tabela de colaboradores do ticket (usuários adicionais além do responsável em assigned_to)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ticket_collaborators (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      added_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE (ticket_id, user_id)
    )
  `);

  // Tabela de cronômetro de tempo por usuário no ticket (sessões iniciar/parar)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ticket_time_entries (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      started_at TIMESTAMP NOT NULL,
      ended_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  // Garante no máximo 1 cronômetro aberto por usuário/ticket
  await dbRun(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_time_entries_open
    ON ticket_time_entries (ticket_id, user_id)
    WHERE ended_at IS NULL
  `);

  // Tabela de anexos de ticket (genérica, não amarrada a formulário — ex. PDF de OS do assistente de IA)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ticket_attachments (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_size INTEGER,
      mime_type VARCHAR(100),
      source VARCHAR(30) NOT NULL DEFAULT 'manual',
      uploaded_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Tabela de páginas permitidas por perfil de acesso
  await dbRun(`
    CREATE TABLE IF NOT EXISTS access_profile_pages (
      id SERIAL PRIMARY KEY,
      access_profile_id INTEGER NOT NULL,
      page_path TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (access_profile_id) REFERENCES access_profiles(id) ON DELETE CASCADE,
      UNIQUE(access_profile_id, page_path)
    )
  `);

  // Tabela de eventos do calendário
  await dbRun(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'event',
      color VARCHAR(50),
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela de relacionamento entre eventos e usuários
  await dbRun(`
    CREATE TABLE IF NOT EXISTS event_users (
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(event_id, user_id)
    )
  `);

  // Tabela de plantões
  await dbRun(`
    CREATE TABLE IF NOT EXISTS shifts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255),
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela de relacionamento entre plantões e usuários
  await dbRun(`
    CREATE TABLE IF NOT EXISTS shift_users (
      id SERIAL PRIMARY KEY,
      shift_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(shift_id, user_id)
    )
  `);

  // Tabela de webhooks
  await dbRun(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      webhook_url VARCHAR(255) UNIQUE NOT NULL,
      secret_key VARCHAR(255),
      active INTEGER DEFAULT 1,
      priority VARCHAR(50) NOT NULL DEFAULT 'medium',
      category_id INTEGER,
      assigned_to INTEGER,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela de logs de webhooks
  await dbRun(`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id SERIAL PRIMARY KEY,
      webhook_id INTEGER NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'success',
      response_code INTEGER,
      payload TEXT,
      error_message TEXT,
      ticket_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
    )
  `);

  // Tabela de slides (links externos) do painel de TV
  await dbRun(`
    CREATE TABLE IF NOT EXISTS tv_slides (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      url VARCHAR(2048) NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 30,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS doc_repositories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      description TEXT,
      owner_id INTEGER NOT NULL,
      visibility VARCHAR(50) NOT NULL DEFAULT 'private',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS doc_repository_shares (
      id SERIAL PRIMARY KEY,
      repository_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      permission VARCHAR(50) NOT NULL DEFAULT 'view',
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(repository_id, user_id),
      FOREIGN KEY (repository_id) REFERENCES doc_repositories(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS doc_entries (
      id SERIAL PRIMARY KEY,
      repository_id INTEGER NOT NULL,
      parent_id INTEGER,
      name VARCHAR(512) NOT NULL,
      entry_type VARCHAR(50) NOT NULL,
      storage_path TEXT,
      mime_type VARCHAR(255),
      size_bytes INTEGER DEFAULT 0,
      content TEXT,
      description TEXT,
      tags TEXT,
      search_text TEXT,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repository_id) REFERENCES doc_repositories(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES doc_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  try {
    await dbRun(`ALTER TABLE doc_entries ADD COLUMN IF NOT EXISTS search_text TEXT`);
  } catch {
    // SQLite ou versão antiga do PG
  }

  await seedDatabase();
};

const seedDatabase = async () => {
  // Criar usuário admin padrão se não existir
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@tidesk.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminName = process.env.ADMIN_NAME || 'Administrador';
  
  const adminExists = await dbGet('SELECT id FROM users WHERE email = ?', [adminEmail]);
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await dbRun(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [adminName, adminEmail, hashedPassword, 'admin']
    );
    console.log(`✅ Usuário admin criado: ${adminEmail} / ${adminPassword}`);
  }

  // Criar categorias padrão
  const categoriesExist = await dbGet('SELECT id FROM categories LIMIT 1');
  if (!categoriesExist) {
    const defaultCategories = [
      ['Suporte Técnico', 'Problemas técnicos e configurações'],
      ['Dúvidas', 'Perguntas e esclarecimentos'],
      ['Solicitações', 'Pedidos e solicitações gerais'],
      ['Problemas', 'Relatos de problemas e bugs']
    ];
    
    for (const [name, description] of defaultCategories) {
      await dbRun('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description]);
    }
    console.log('✅ Categorias padrão criadas');
  }

  // Invalidar cache de permissões para garantir que novas permissões sejam carregadas
  try {
    const { invalidateAllPermissions } = await import('./middleware/permissions');
    invalidateAllPermissions();
  } catch (error) {
    // Ignorar se não conseguir importar
  }

  console.log('✅ Banco de dados inicializado com sucesso');
};

// Exportar db para compatibilidade
export { db };
