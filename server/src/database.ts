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
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category_id: number;
  user_id: number;
  assigned_to: number | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  created_at: string;
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
    const result = await this.dbRun(query, params || []);
    return { lastID: (result as any).lastID };
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
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium',
      category_id INTEGER,
      user_id INTEGER NOT NULL,
      assigned_to INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    )
  `);

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
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'open',
      priority VARCHAR(50) NOT NULL DEFAULT 'medium',
      category_id INTEGER,
      user_id INTEGER NOT NULL,
      assigned_to INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await seedDatabase();
};

const seedDatabase = async () => {
  // Criar usuário admin padrão se não existir
  const adminExists = await dbGet('SELECT id FROM users WHERE email = ?', ['admin@tidesk.com']);
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await dbRun(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Administrador', 'admin@tidesk.com', hashedPassword, 'admin']
    );
    console.log('✅ Usuário admin criado: admin@tidesk.com / admin123');
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

  console.log('✅ Banco de dados inicializado com sucesso');
};

// Exportar db para compatibilidade
export { db };
