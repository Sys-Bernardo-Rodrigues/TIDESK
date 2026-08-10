import multer from 'multer';
import path from 'path';
import fs from 'fs';
import express from 'express';

// Criar diretório de uploads se não existir
const uploadsDir = path.join(process.cwd(), 'uploads', 'forms');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Criar diretório de uploads de mensagens se não existir
const messagesUploadsDir = path.join(process.cwd(), 'uploads', 'messages');
if (!fs.existsSync(messagesUploadsDir)) {
  fs.mkdirSync(messagesUploadsDir, { recursive: true });
}

// Configuração de armazenamento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Gerar nome único para o arquivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// Filtro de tipos de arquivo
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Aceitar todos os arquivos por padrão
  // A validação específica será feita na rota baseada nas configurações do campo
  cb(null, true);
};

// Configuração do multer
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB por padrão
  }
});

// Middleware customizado para aceitar arquivos e campos de texto
export const uploadMultiple = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Usar upload.any() mas com tratamento de erro customizado
  upload.any()(req, res, (err: any) => {
    // Ignorar erros de campos inesperados (campos de texto são esperados)
    if (err && err.code !== 'LIMIT_UNEXPECTED_FILE') {
      return next(err);
    }
    // Continuar mesmo se houver campos não-arquivo
    next();
  });
};

// Configuração de armazenamento para mensagens
const messagesStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, messagesUploadsDir);
  },
  filename: (req, file, cb) => {
    // Gerar nome único para o arquivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// Configuração do multer para mensagens
export const uploadMessage = multer({
  storage: messagesStorage,
  fileFilter: (req, file, cb) => {
    // Aceitar apenas imagens e alguns tipos de arquivo
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB para mensagens
  }
});

// Diretório de anexos de tarefas de projeto
const projectTasksUploadsDir = path.join(process.cwd(), 'uploads', 'project-tasks');
if (!fs.existsSync(projectTasksUploadsDir)) {
  fs.mkdirSync(projectTasksUploadsDir, { recursive: true });
}

const projectTasksStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, projectTasksUploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '';
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

export const uploadProjectTaskAttachment = multer({
  storage: projectTasksStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

const docsUploadsDir = path.join(process.cwd(), 'uploads', 'docs');
if (!fs.existsSync(docsUploadsDir)) {
  fs.mkdirSync(docsUploadsDir, { recursive: true });
}

const docsStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, docsUploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '';
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

export const uploadDocsFile = multer({
  storage: docsStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

export const DOCS_UPLOAD_DIR = docsUploadsDir;

const ticketAssistantUploadsDir = path.join(process.cwd(), 'uploads', 'ticket-assistant');
if (!fs.existsSync(ticketAssistantUploadsDir)) {
  fs.mkdirSync(ticketAssistantUploadsDir, { recursive: true });
}

const ticketAssistantStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ticketAssistantUploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

export const uploadTicketAssistant = multer({
  storage: ticketAssistantStorage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('Apenas arquivos PDF são aceitos'));
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

export const TICKET_ASSISTANT_UPLOAD_DIR = ticketAssistantUploadsDir;
