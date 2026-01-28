import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { dbGet, dbAll, dbRun, getBrasiliaTimestamp } from '../database';
import { uploadMessage } from '../middleware/upload';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Função para converter ID completo formatado (ex: 20260122003) para ID numérico
async function getTicketIdFromFullId(fullId: string): Promise<number | null> {
  // Se for um número simples, retornar direto
  if (!isNaN(Number(fullId)) && fullId.length < 11) {
    return parseInt(fullId);
  }
  
  // Se for um ID completo formatado (11 dígitos: YYYYMMDDNNN)
  if (fullId.length >= 11 && !isNaN(Number(fullId))) {
    const year = parseInt(fullId.substring(0, 4));
    const month = parseInt(fullId.substring(4, 6));
    const day = parseInt(fullId.substring(6, 8));
    const ticketNumber = parseInt(fullId.substring(fullId.length - 3));
    
    // Buscar todos os tickets com esse número e verificar a data manualmente
    const allTickets = await dbAll(
      `SELECT id, ticket_number, created_at FROM tickets WHERE ticket_number = ? ORDER BY created_at DESC`,
      [ticketNumber]
    );
    
    if (allTickets && allTickets.length > 0) {
      for (const t of allTickets as any[]) {
        try {
          const ticketDate = new Date(t.created_at);
          const ticketYear = ticketDate.getFullYear();
          const ticketMonth = ticketDate.getMonth() + 1;
          const ticketDay = ticketDate.getDate();
          
          if (ticketYear === year && ticketMonth === month && ticketDay === day) {
            return t.id;
          }
        } catch (error) {
          console.error(`Erro ao processar ticket ID ${(t as any).id}:`, error);
        }
      }
      
      // Se não encontrou exato, retornar o primeiro ticket com esse número (fallback)
      if (allTickets.length === 1) {
        return (allTickets[0] as any).id;
      }
    }
  }
  
  return null;
}

// Todas as rotas requerem autenticação
router.use(authenticate);

// Listar mensagens de um ticket
router.get('/ticket/:ticketId', requirePermission(RESOURCES.TICKETS, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    // Converter ID completo para ID numérico se necessário
    let ticketId: number | null = null;
    
    if (!isNaN(Number(req.params.ticketId)) && req.params.ticketId.length < 11) {
      ticketId = parseInt(req.params.ticketId);
    } else {
      ticketId = await getTicketIdFromFullId(req.params.ticketId);
      if (!ticketId) {
        return res.status(404).json({ error: 'Ticket não encontrado' });
      }
    }
    
    // Verificar se o ticket existe e se o usuário tem permissão
    const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    // Verificar permissão (usuário só pode ver mensagens de seus próprios tickets)
    if (req.userRole === 'user' && (ticket as any).user_id !== req.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Buscar mensagens com anexos
    const messages = await dbAll(`
      SELECT tm.*, u.name as user_name, u.email as user_email
      FROM ticket_messages tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.ticket_id = ?
      ORDER BY tm.created_at ASC
    `, [ticketId]);

    // Buscar anexos para cada mensagem
    const messagesWithAttachments = await Promise.all(messages.map(async (message: any) => {
      const attachments = await dbAll(`
        SELECT * FROM message_attachments
        WHERE message_id = ?
        ORDER BY created_at ASC
      `, [message.id]);
      
      return {
        ...message,
        attachments: attachments || []
      };
    }));

    res.json(messagesWithAttachments);
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
});

// Criar mensagem em um ticket (com suporte a anexos)
router.post('/ticket/:ticketId', requirePermission(RESOURCES.TICKETS, ACTIONS.EDIT), uploadMessage.array('attachments', 5), async (req: AuthRequest, res) => {
  try {
    // Verificar se há mensagem ou arquivos
    const files = req.files as Express.Multer.File[] | undefined;
    const hasFiles = files && Array.isArray(files) && files.length > 0;
    const hasMessage = req.body.message && req.body.message.trim().length > 0;
    
    if (!hasMessage && !hasFiles) {
      return res.status(400).json({ error: 'Mensagem ou arquivo é obrigatório' });
    }

    // Converter ID completo para ID numérico se necessário
    let ticketId: number | null = null;
    
    if (!isNaN(Number(req.params.ticketId)) && req.params.ticketId.length < 11) {
      ticketId = parseInt(req.params.ticketId);
    } else {
      ticketId = await getTicketIdFromFullId(req.params.ticketId);
      if (!ticketId) {
        return res.status(404).json({ error: 'Ticket não encontrado' });
      }
    }

    // Verificar se o ticket existe e se o usuário tem permissão
    const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    // Verificar permissão (usuário só pode enviar mensagens em seus próprios tickets)
    if (req.userRole === 'user' && (ticket as any).user_id !== req.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Criar mensagem
    const brasiliaTimestamp = getBrasiliaTimestamp();
    const result = await dbRun(`
      INSERT INTO ticket_messages (ticket_id, user_id, message, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `, [ticketId, req.userId, req.body.message || '', brasiliaTimestamp, brasiliaTimestamp]);

    const messageId = (result as any).lastID || (result as any).id;

    // Processar anexos se houver
    const uploadsDirectory = path.join(process.cwd(), 'uploads', 'messages');
    
    if (files && Array.isArray(files) && files.length > 0) {
      for (const file of files) {
        try {
          // Verificar se o arquivo existe
          if (!fs.existsSync(file.path)) {
            console.error(`Arquivo não encontrado: ${file.path}`);
            continue;
          }
          
          // Usar caminho relativo ao diretório de uploads
          const relativePath = path.relative(uploadsDirectory, file.path);
          const filePath = relativePath.startsWith('..') 
            ? file.path 
            : path.join('uploads', 'messages', path.basename(file.path));
          
          await dbRun(`
            INSERT INTO message_attachments (message_id, file_name, file_path, file_size, mime_type)
            VALUES (?, ?, ?, ?, ?)
          `, [
            messageId,
            file.originalname,
            filePath,
            file.size,
            file.mimetype || 'application/octet-stream'
          ]);
        } catch (error) {
          console.error(`Erro ao salvar anexo da mensagem:`, error);
          // Continuar mesmo se houver erro ao salvar anexo
        }
      }
    }

    // Buscar mensagem criada com anexos
    const message = await dbGet(`
      SELECT tm.*, u.name as user_name, u.email as user_email
      FROM ticket_messages tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.id = ?
    `, [messageId]);

    // Buscar anexos da mensagem
    const attachments = await dbAll(`
      SELECT * FROM message_attachments
      WHERE message_id = ?
      ORDER BY created_at ASC
    `, [messageId]);

    // Atualizar timestamp do ticket
    await dbRun(`
      UPDATE tickets 
      SET updated_at = ? 
      WHERE id = ?
    `, [getBrasiliaTimestamp(), ticketId]);

    res.status(201).json({
      ...message,
      attachments: attachments || []
    });
  } catch (error) {
    console.error('Erro ao criar mensagem:', error);
    res.status(500).json({ error: 'Erro ao criar mensagem' });
  }
});

// Atualizar mensagem
router.put('/:id', [
  requirePermission(RESOURCES.TICKETS, ACTIONS.EDIT),
  body('message').notEmpty().withMessage('Mensagem é obrigatória')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Verificar se a mensagem existe e se pertence ao usuário
    const message = await dbGet('SELECT * FROM ticket_messages WHERE id = ?', [req.params.id]);
    if (!message) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    // Apenas o autor pode editar (ou admin/agent)
    if ((message as any).user_id !== req.userId && req.userRole !== 'admin' && req.userRole !== 'agent') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Atualizar mensagem
    await dbRun(`
      UPDATE ticket_messages
      SET message = ?, updated_at = ?
      WHERE id = ?
    `, [req.body.message, getBrasiliaTimestamp(), req.params.id]);

    // Buscar mensagem atualizada
    const updatedMessage = await dbGet(`
      SELECT tm.*, u.name as user_name, u.email as user_email
      FROM ticket_messages tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.id = ?
    `, [req.params.id]);

    res.json(updatedMessage);
  } catch (error) {
    console.error('Erro ao atualizar mensagem:', error);
    res.status(500).json({ error: 'Erro ao atualizar mensagem' });
  }
});

// Buscar anexos de uma mensagem
router.get('/:id/attachments', requirePermission(RESOURCES.TICKETS, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    const messageId = req.params.id;
    
    // Verificar se a mensagem existe e permissão
    const message = await dbGet('SELECT * FROM ticket_messages WHERE id = ?', [messageId]);
    if (!message) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    // Verificar permissão
    const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [(message as any).ticket_id]);
    if (req.userRole === 'user' && (ticket as any).user_id !== req.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Buscar anexos
    const attachments = await dbAll(`
      SELECT * FROM message_attachments
      WHERE message_id = ?
      ORDER BY created_at ASC
    `, [messageId]);

    res.json(attachments);
  } catch (error) {
    console.error('Erro ao buscar anexos:', error);
    res.status(500).json({ error: 'Erro ao buscar anexos' });
  }
});

// Download de anexo de mensagem
router.get('/attachments/:id', requirePermission(RESOURCES.TICKETS, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    const attachment = await dbGet('SELECT * FROM message_attachments WHERE id = ?', [req.params.id]);
    
    if (!attachment) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    // Verificar permissão através da mensagem
    const message = await dbGet('SELECT * FROM ticket_messages WHERE id = ?', [(attachment as any).message_id]);
    if (!message) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [(message as any).ticket_id]);
    if (req.userRole === 'user' && (ticket as any).user_id !== req.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    let filePath = (attachment as any).file_path;
    
    // Se o caminho não for absoluto, resolver em relação ao diretório de trabalho
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(process.cwd(), filePath);
    }
    
    // Verificar se arquivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado no servidor' });
    }

    // Enviar arquivo
    res.setHeader('Content-Disposition', `attachment; filename="${(attachment as any).file_name}"`);
    res.setHeader('Content-Type', (attachment as any).mime_type || 'application/octet-stream');
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Erro ao buscar arquivo:', error);
    res.status(500).json({ error: 'Erro ao buscar arquivo' });
  }
});

// Deletar mensagem
router.delete('/:id', requirePermission(RESOURCES.TICKETS, ACTIONS.DELETE), async (req: AuthRequest, res) => {
  try {
    // Verificar se a mensagem existe e se pertence ao usuário
    const message = await dbGet('SELECT * FROM ticket_messages WHERE id = ?', [req.params.id]);
    if (!message) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    // Apenas o autor pode deletar (ou admin/agent)
    if ((message as any).user_id !== req.userId && req.userRole !== 'admin' && req.userRole !== 'agent') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Deletar mensagem (anexos serão deletados em cascata)
    await dbRun('DELETE FROM ticket_messages WHERE id = ?', [req.params.id]);

    res.json({ message: 'Mensagem excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar mensagem:', error);
    res.status(500).json({ error: 'Erro ao deletar mensagem' });
  }
});

export default router;
