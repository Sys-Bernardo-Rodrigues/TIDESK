import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos (uploads)
import path from 'path';
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

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TIDESK API está funcionando' });
});

// Inicializar banco de dados e servidor
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor TIDESK rodando na porta ${PORT}`);
  });
}).catch((error) => {
  console.error('Erro ao inicializar banco de dados:', error);
  process.exit(1);
});
