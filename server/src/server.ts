import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { initDatabase } from './database';
import authRoutes from './routes/auth';
import ticketRoutes from './routes/tickets';
import userRoutes from './routes/users';
import categoryRoutes from './routes/categories';
import formRoutes from './routes/forms';
import pageRoutes from './routes/pages';
import accessProfileRoutes from './routes/access-profiles';
import groupRoutes from './routes/groups';
import ticketMessageRoutes from './routes/ticket-messages';
import reportRoutes from './routes/reports';
import calendarRoutes from './routes/calendar';
import shiftRoutes from './routes/shifts';
import backupRoutes from './routes/backup';
import updateRoutes from './routes/updates';
import dashboardRoutes from './routes/dashboard';
import webhookRoutes from './routes/webhooks';
import { startBackupScheduler } from './services/backup-scheduler';

dotenv.config();

// Definir NODE_ENV como production se não estiver definido e não estiver em modo dev
if (!process.env.NODE_ENV && !process.argv.includes('watch')) {
  process.env.NODE_ENV = 'production';
}

// Configurar timezone para Brasília
process.env.TZ = 'America/Sao_Paulo';

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Configurar trust proxy para obter IP real do cliente quando atrás de proxy/load balancer
// Isso permite que o Express confie nos headers X-Forwarded-* de proxies reversos
app.set('trust proxy', true);

// Configuração HTTPS
const USE_HTTPS = process.env.USE_HTTPS === 'true';
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || path.join(process.cwd(), 'certs', 'server.key');
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path.join(process.cwd(), 'certs', 'server.crt');
const SSL_CHAIN_PATH = process.env.SSL_CHAIN_PATH || path.join(process.cwd(), 'certs', 'server.chain.crt');

// Função para carregar certificados SSL
function loadSSLCertificates(): { key: Buffer; cert: Buffer; ca?: Buffer } | null {
  if (!USE_HTTPS) {
    return null;
  }

  try {
    if (!fs.existsSync(SSL_KEY_PATH) || !fs.existsSync(SSL_CERT_PATH)) {
      console.warn('⚠️  HTTPS habilitado mas certificados não encontrados!');
      console.warn(`   Chave esperada em: ${SSL_KEY_PATH}`);
      console.warn(`   Certificado esperado em: ${SSL_CERT_PATH}`);
      console.warn('   Execute: npm run generate-certs');
      return null;
    }

    const sslOptions: { key: Buffer; cert: Buffer; ca?: Buffer } = {
      key: fs.readFileSync(SSL_KEY_PATH),
      cert: fs.readFileSync(SSL_CERT_PATH)
    };

    // Suportar certificado intermediário (chain) - útil para Cloudflare Origin Certificates
    if (fs.existsSync(SSL_CHAIN_PATH)) {
      sslOptions.ca = fs.readFileSync(SSL_CHAIN_PATH);
      console.log('✅ Certificado intermediário (chain) carregado');
    }

    return sslOptions;
  } catch (error) {
    console.error('❌ Erro ao carregar certificados SSL:', error);
    return null;
  }
}

// Middleware para configuração de segurança HTTPS
app.use((req, res, next) => {
  if (USE_HTTPS && req.secure) {
    // Adicionar HSTS apenas quando usando HTTPS
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Middleware CORS - Permitir acesso de qualquer origem
app.use(cors({
  origin: '*', // Permitir todas as origens
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-webhook-secret', 'x-secret-key'],
  credentials: false
}));

// Middleware condicional: aplicar raw body parsing apenas para rotas de recebimento de webhook
// Isso deve vir ANTES dos middlewares de parsing globais
const rawBodyMiddleware = express.raw({ type: '*/*', limit: '50mb' });
app.use((req, res, next) => {
  // Se for uma rota de recebimento ou teste de webhook, usar raw body parsing
  if (req.path.startsWith('/api/webhooks/receive/') || req.path.startsWith('/api/webhooks/test/')) {
    return rawBodyMiddleware(req, res, next);
  }
  // Caso contrário, passar para os middlewares normais
  next();
});

// Middleware para aceitar requisições de qualquer IP
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos (uploads)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/access-profiles', accessProfileRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/ticket-messages', ticketMessageRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/updates', updateRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Registrar rotas de webhook (incluindo recebimento que já tem raw body parsing)
app.use('/api/webhooks', webhookRoutes);

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TIDESK API está funcionando' });
});

// O cliente é servido separadamente pelo Vite preview na porta 3333
// Não precisamos servir arquivos estáticos aqui

// Função para atualizar tickets finalizados periodicamente
async function startClosedTicketsUpdater() {
  const updateInterval = 60 * 60 * 1000; // 1 hora
  
  const updateTickets = async () => {
    try {
      const ticketRoutes = await import('./routes/tickets');
      if (ticketRoutes.updateClosedTicketsToResolved) {
        await ticketRoutes.updateClosedTicketsToResolved();
      }
    } catch (error) {
      console.error('Erro no job de atualização de tickets:', error);
    }
  };
  
  // Executar imediatamente ao iniciar
  await updateTickets();
  
  // Executar a cada hora
  setInterval(updateTickets, updateInterval);
  
  console.log('✅ Job de atualização de tickets finalizados iniciado (executa a cada 1 hora)');
}

// Inicializar banco de dados e servidor
initDatabase().then(async () => {
  // Escutar em todas as interfaces de rede (0.0.0.0) para aceitar conexões externas
  const HOST = process.env.HOST || '0.0.0.0';
  const port = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
  const sslOptions = loadSSLCertificates();
  
  if (USE_HTTPS && sslOptions) {
    // Criar servidor HTTPS
    const httpsServer = https.createServer(sslOptions, app);
    
    httpsServer.listen(port, HOST, () => {
      console.log(`🔒 Servidor TIDESK rodando em HTTPS`);
      console.log(`   URL: https://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${port}`);
      console.log(`🌐 Acessível de qualquer IP na rede`);
      if (HOST === '0.0.0.0') {
        console.log(`📡 Para acessar externamente, use o IP desta máquina na porta ${port}`);
      }
      console.log(`🔐 Certificados SSL carregados com sucesso`);
    });
    
    // Opcional: Redirecionar HTTP para HTTPS na porta 80 (se configurado)
    const HTTP_REDIRECT_PORT = Number(process.env.HTTP_REDIRECT_PORT) || null;
    if (HTTP_REDIRECT_PORT) {
      const httpApp = express();
      httpApp.use((req, res) => {
        res.redirect(`https://${req.hostname}:${port}${req.url}`);
      });
      
      http.createServer(httpApp).listen(HTTP_REDIRECT_PORT, HOST, () => {
        console.log(`🔄 Redirecionamento HTTP (porta ${HTTP_REDIRECT_PORT}) → HTTPS (porta ${port})`);
      });
    }
  } else {
    // Criar servidor HTTP (padrão)
    app.listen(port, HOST, () => {
      console.log(`🚀 Servidor TIDESK rodando em HTTP`);
      console.log(`   URL: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${port}`);
      console.log(`🌐 Acessível de qualquer IP na rede`);
      if (HOST === '0.0.0.0') {
        console.log(`📡 Para acessar externamente, use o IP desta máquina na porta ${port}`);
      }
      if (USE_HTTPS) {
        console.log(`⚠️  HTTPS habilitado mas certificados não encontrados. Usando HTTP.`);
        console.log(`   Execute: npm run generate-certs`);
      }
    });
  }
  
  // Iniciar job de atualização de tickets finalizados
  await startClosedTicketsUpdater();
  
  // Iniciar agendador de backup automático
  startBackupScheduler();
}).catch((error) => {
  console.error('Erro ao inicializar banco de dados:', error);
  process.exit(1);
});
