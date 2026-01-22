import multer from 'multer';
import path from 'path';
import fs from 'fs';
import express from 'express';

// Criar diretório de uploads se não existir
const uploadsDir = path.join(process.cwd(), 'uploads', 'forms');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
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
