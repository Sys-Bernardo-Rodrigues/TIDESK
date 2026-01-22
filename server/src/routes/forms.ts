import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { dbGet, dbAll, dbRun } from '../database';
import crypto from 'crypto';
import { uploadMultiple } from '../middleware/upload';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Gerar URL pública única
const generatePublicUrl = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

// Listar formulários (requer autenticação)
router.get('/', authenticate, requirePermission(RESOURCES.FORMS, ACTIONS.VIEW), async (req: AuthRequest, res) => {
  try {
    const forms = await dbAll(`
      SELECT f.*,
             u.name as created_by_name,
             lu.name as linked_user_name,
             (SELECT COUNT(*) FROM form_submissions fs WHERE fs.form_id = f.id) as submissions_count
      FROM forms f
      LEFT JOIN users u ON f.created_by = u.id
      LEFT JOIN users lu ON f.linked_user_id = lu.id
      WHERE f.created_by = ?
      ORDER BY f.created_at DESC
    `, [req.userId]);

    // Buscar campos de cada formulário
    const formsWithFields = await Promise.all(forms.map(async (form: any) => {
      const fields = await dbAll(`
        SELECT * FROM form_fields
        WHERE form_id = ?
        ORDER BY order_index ASC
      `, [form.id]);

      return {
        ...form,
        fields: fields.map((field: any) => ({
          id: field.id.toString(),
          type: field.type,
          label: field.label,
          placeholder: field.placeholder,
          required: field.required === 1,
          options: field.options ? JSON.parse(field.options) : undefined,
          validation: field.validation ? JSON.parse(field.validation) : undefined
        }))
      };
    }));

    res.json(formsWithFields);
  } catch (error) {
    console.error('Erro ao listar formulários:', error);
    res.status(500).json({ error: 'Erro ao buscar formulários' });
  }
});

// Obter formulário específico (requer autenticação)
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const form = await dbGet(`
      SELECT f.*,
             u.name as created_by_name,
             lu.name as linked_user_name
      FROM forms f
      LEFT JOIN users u ON f.created_by = u.id
      LEFT JOIN users lu ON f.linked_user_id = lu.id
      WHERE f.id = ? AND f.created_by = ?
    `, [req.params.id, req.userId]);

    if (!form) {
      return res.status(404).json({ error: 'Formulário não encontrado' });
    }

    const fields = await dbAll(`
      SELECT * FROM form_fields
      WHERE form_id = ?
      ORDER BY order_index ASC
    `, [form.id]);

    res.json({
      ...form,
      fields: fields.map((field: any) => ({
        id: field.id.toString(),
        type: field.type,
        label: field.label,
        placeholder: field.placeholder,
        required: field.required === 1,
        options: field.options ? JSON.parse(field.options) : undefined,
        validation: field.validation ? JSON.parse(field.validation) : undefined
      }))
    });
  } catch (error) {
    console.error('Erro ao buscar formulário:', error);
    res.status(500).json({ error: 'Erro ao buscar formulário' });
  }
});

// Buscar formulário público por URL ou ID (NÃO requer autenticação)
router.get('/public/:url', async (req, res) => {
  try {
    // Tentar buscar por public_url primeiro, depois por ID
    let form = await dbGet(`
      SELECT f.*
      FROM forms f
      WHERE f.public_url = ?
    `, [req.params.url]);
    
    // Se não encontrar por URL, tentar por ID
    if (!form && !isNaN(Number(req.params.url))) {
      form = await dbGet(`
        SELECT f.*
        FROM forms f
        WHERE f.id = ?
      `, [req.params.url]);
    }

    if (!form) {
      return res.status(404).json({ error: 'Formulário não encontrado' });
    }

    const fields = await dbAll(`
      SELECT * FROM form_fields
      WHERE form_id = ?
      ORDER BY order_index ASC
    `, [form.id]);

    res.json({
      id: form.id,
      name: form.name,
      description: form.description,
      publicUrl: form.public_url, // Incluir public_url na resposta
      fields: fields.map((field: any) => ({
        id: field.id.toString(),
        type: field.type,
        label: field.label,
        placeholder: field.placeholder,
        required: field.required === 1,
        options: field.options ? JSON.parse(field.options) : undefined,
        validation: field.validation ? JSON.parse(field.validation) : undefined
      })),
      linkedUserId: form.linked_user_id,
      linkedGroupId: form.linked_group_id
    });
  } catch (error) {
    console.error('Erro ao buscar formulário público:', error);
    res.status(500).json({ error: 'Erro ao buscar formulário' });
  }
});

// Criar formulário
router.post('/', [
  authenticate,
  requirePermission(RESOURCES.FORMS, ACTIONS.CREATE),
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('fields').isArray().withMessage('Campos são obrigatórios'),
  body('fields.*.type').notEmpty().withMessage('Tipo do campo é obrigatório'),
  body('fields.*.label').notEmpty().withMessage('Rótulo do campo é obrigatório')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, fields, linkedUserId, linkedGroupId } = req.body;

    // Gerar URL pública única
    let publicUrl = generatePublicUrl();
    let urlExists = await dbGet('SELECT id FROM forms WHERE public_url = ?', [publicUrl]);
    while (urlExists) {
      publicUrl = generatePublicUrl();
      urlExists = await dbGet('SELECT id FROM forms WHERE public_url = ?', [publicUrl]);
    }

    // Criar formulário
    const formResult = await dbRun(`
      INSERT INTO forms (name, description, public_url, linked_user_id, linked_group_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      name,
      description || null,
      publicUrl,
      linkedUserId || null,
      linkedGroupId || null,
      req.userId
    ]);

    const formId = (formResult as any).lastID || (formResult as any).id;

    // Criar campos
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      await dbRun(`
        INSERT INTO form_fields (form_id, type, label, placeholder, required, options, validation, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        formId,
        field.type,
        field.label,
        field.placeholder || null,
        field.required ? 1 : 0,
        field.options ? JSON.stringify(field.options) : null,
        field.validation ? JSON.stringify(field.validation) : null,
        i
      ]);
    }

    // Buscar formulário criado
    const form = await dbGet('SELECT * FROM forms WHERE id = ?', [formId]);
    const createdFields = await dbAll('SELECT * FROM form_fields WHERE form_id = ? ORDER BY order_index ASC', [formId]);

    res.status(201).json({
      ...form,
      fields: createdFields.map((field: any) => ({
        id: field.id.toString(),
        type: field.type,
        label: field.label,
        placeholder: field.placeholder,
        required: field.required === 1,
        options: field.options ? JSON.parse(field.options) : undefined,
        validation: field.validation ? JSON.parse(field.validation) : undefined
      }))
    });
  } catch (error) {
    console.error('Erro ao criar formulário:', error);
    res.status(500).json({ error: 'Erro ao criar formulário' });
  }
});

// Atualizar formulário
router.put('/:id', [
  authenticate,
  requirePermission(RESOURCES.FORMS, ACTIONS.EDIT),
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('fields').isArray().withMessage('Campos são obrigatórios')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, fields, linkedUserId, linkedGroupId } = req.body;

    // Verificar se o formulário pertence ao usuário
    const existingForm = await dbGet('SELECT id FROM forms WHERE id = ? AND created_by = ?', [req.params.id, req.userId]);
    if (!existingForm) {
      return res.status(404).json({ error: 'Formulário não encontrado' });
    }

    // Atualizar formulário
    await dbRun(`
      UPDATE forms
      SET name = ?, description = ?, linked_user_id = ?, linked_group_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, description || null, linkedUserId || null, linkedGroupId || null, req.params.id]);

    // Remover campos antigos
    await dbRun('DELETE FROM form_fields WHERE form_id = ?', [req.params.id]);

    // Criar novos campos
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      await dbRun(`
        INSERT INTO form_fields (form_id, type, label, placeholder, required, options, validation, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        req.params.id,
        field.type,
        field.label,
        field.placeholder || null,
        field.required ? 1 : 0,
        field.options ? JSON.stringify(field.options) : null,
        field.validation ? JSON.stringify(field.validation) : null,
        i
      ]);
    }

    // Buscar formulário atualizado
    const form = await dbGet('SELECT * FROM forms WHERE id = ?', [req.params.id]);
    const updatedFields = await dbAll('SELECT * FROM form_fields WHERE form_id = ? ORDER BY order_index ASC', [req.params.id]);

    res.json({
      ...form,
      fields: updatedFields.map((field: any) => ({
        id: field.id.toString(),
        type: field.type,
        label: field.label,
        placeholder: field.placeholder,
        required: field.required === 1,
        options: field.options ? JSON.parse(field.options) : undefined,
        validation: field.validation ? JSON.parse(field.validation) : undefined
      }))
    });
  } catch (error) {
    console.error('Erro ao atualizar formulário:', error);
    res.status(500).json({ error: 'Erro ao atualizar formulário' });
  }
});

// Excluir formulário
router.delete('/:id', authenticate, requirePermission(RESOURCES.FORMS, ACTIONS.DELETE), async (req: AuthRequest, res) => {
  try {
    // Verificar se o formulário pertence ao usuário
    const form = await dbGet('SELECT id FROM forms WHERE id = ? AND created_by = ?', [req.params.id, req.userId]);
    if (!form) {
      return res.status(404).json({ error: 'Formulário não encontrado' });
    }

    // Excluir formulário (campos serão excluídos em cascata)
    await dbRun('DELETE FROM forms WHERE id = ?', [req.params.id]);

    res.json({ message: 'Formulário excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir formulário:', error);
    res.status(500).json({ error: 'Erro ao excluir formulário' });
  }
});

// Submeter formulário público (NÃO requer autenticação)
router.post('/public/:url/submit', uploadMultiple, async (req, res) => {
  try {
    console.log('Recebendo submissão de formulário:', req.params.url);
    console.log('Body:', Object.keys(req.body));
    console.log('Files:', req.files ? (Array.isArray(req.files) ? req.files.length : Object.keys(req.files).length) : 0);
    
    // Parse formData - pode vir como string JSON ou já como objeto
    let formData: Record<string, any> = {};
    
    // Tentar pegar do body primeiro
    if (req.body.formData) {
      try {
        formData = typeof req.body.formData === 'string' 
          ? JSON.parse(req.body.formData) 
          : req.body.formData;
      } catch (e) {
        console.error('Erro ao fazer parse do formData:', e);
        // Se não conseguir fazer parse, usar como está
        formData = req.body.formData || {};
      }
    } else {
      // Se não tiver formData, pegar todos os campos do body (exceto arquivos)
      formData = { ...req.body };
    }

    // Processar arquivos enviados
    // Quando usa upload.any(), req.files é um array
    const files = req.files as Express.Multer.File[] | undefined;
    const fileMap: Record<string, Express.Multer.File> = {};
    
    if (files && Array.isArray(files)) {
      console.log(`Processando ${files.length} arquivo(s)`);
      files.forEach(file => {
        console.log(`Arquivo recebido: ${file.fieldname}, ${file.originalname}, ${file.size} bytes`);
        // Extrair field_id do nome do campo (formato: file_123)
        if (file.fieldname && file.fieldname.startsWith('file_')) {
          const fieldId = file.fieldname.replace('file_', '');
          fileMap[fieldId] = file;
          // Adicionar nome do arquivo ao formData
          formData[fieldId] = file.originalname;
          console.log(`Arquivo mapeado para campo ${fieldId}`);
        }
      });
    } else if (files && !Array.isArray(files)) {
      // Se for um objeto (formato antigo do multer)
      console.log('Formato de arquivos é objeto, convertendo...');
      Object.keys(files).forEach(key => {
        const fileArray = files[key];
        if (Array.isArray(fileArray) && fileArray.length > 0) {
          const file = fileArray[0];
          if (key.startsWith('file_')) {
            const fieldId = key.replace('file_', '');
            fileMap[fieldId] = file;
            formData[fieldId] = file.originalname;
            console.log(`Arquivo mapeado para campo ${fieldId} (formato objeto)`);
          }
        }
      });
    }

    // Buscar formulário por public_url ou ID
    let form = await dbGet('SELECT * FROM forms WHERE public_url = ?', [req.params.url]);
    
    // Se não encontrar por URL, tentar por ID
    if (!form && !isNaN(Number(req.params.url))) {
      form = await dbGet('SELECT * FROM forms WHERE id = ?', [req.params.url]);
    }
    
    if (!form) {
      return res.status(404).json({ error: 'Formulário não encontrado' });
    }

    // Buscar campos para validação
    const fields = await dbAll('SELECT * FROM form_fields WHERE form_id = ?', [form.id]);

    // Validar campos obrigatórios
    for (const field of fields) {
      if (field.required === 1) {
        const fieldId = field.id.toString();
        const value = formData[fieldId];
        const hasFile = fileMap[fieldId] !== undefined;
        
        // Se for campo de arquivo, verificar se foi enviado
        if ((field.type === 'file' || field.type === 'image') && !hasFile) {
          return res.status(400).json({ 
            error: `Campo "${field.label}" é obrigatório`,
            fieldId: fieldId
          });
        }
        
        // Para outros campos, verificar se tem valor
        if ((field.type !== 'file' && field.type !== 'image') && (!value || (typeof value === 'string' && value.trim() === ''))) {
          return res.status(400).json({ 
            error: `Campo "${field.label}" é obrigatório`,
            fieldId: fieldId
          });
        }
      }
    }

    // Criar submissão
    const submissionResult = await dbRun(`
      INSERT INTO form_submissions (form_id, submission_data)
      VALUES (?, ?)
    `, [form.id, JSON.stringify(formData)]);

    const submissionId = (submissionResult as any).lastID || (submissionResult as any).id;

    // Salvar arquivos anexados
    console.log(`Salvando ${Object.keys(fileMap).length} anexo(s)`);
    
    // Definir diretório de uploads uma vez (fora do loop)
    const uploadsDirectory = path.join(process.cwd(), 'uploads', 'forms');
    
    for (const [fieldId, file] of Object.entries(fileMap)) {
      try {
        // Verificar se o arquivo existe
        if (!fs.existsSync(file.path)) {
          console.error(`Arquivo não encontrado: ${file.path}`);
          continue;
        }
        
        // Usar caminho relativo ao diretório de uploads
        const relativePath = path.relative(uploadsDirectory, file.path);
        // Se o arquivo estiver no diretório de uploads, usar apenas o nome
        const filePath = relativePath.startsWith('..') ? file.path : path.join('uploads', 'forms', path.basename(file.path));
        
        console.log(`Salvando anexo: campo ${fieldId}, arquivo ${file.originalname}, caminho ${filePath}`);
        
        await dbRun(`
          INSERT INTO form_attachments (form_submission_id, field_id, file_name, file_path, file_size, mime_type)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          submissionId,
          fieldId,
          file.originalname,
          filePath,
          file.size,
          file.mimetype || 'application/octet-stream'
        ]);
        console.log(`Anexo salvo com sucesso para campo ${fieldId}`);
      } catch (error) {
        console.error(`Erro ao salvar anexo do campo ${fieldId}:`, error);
        // Continuar mesmo se houver erro ao salvar anexo
      }
    }

    // Preparar dados do ticket
    const formValues: Record<string, any> = {};
    fields.forEach((field: any) => {
      const fieldId = field.id.toString();
      const value = formData[fieldId];
      
      // Se for arquivo, mostrar nome do arquivo
      if (fileMap[fieldId]) {
        formValues[field.label] = `[Arquivo] ${fileMap[fieldId].originalname} (${(fileMap[fieldId].size / 1024).toFixed(2)} KB)`;
      } else {
        formValues[field.label] = value;
      }
    });

    let ticketDescription = Object.entries(formValues)
      .map(([key, value]) => `**${key}:** ${value}`)
      .join('\n\n');
    
    // Adicionar lista de arquivos anexados se houver
    if (Object.keys(fileMap).length > 0) {
      const attachmentsList = Object.values(fileMap)
        .map(f => `- ${f.originalname}`)
        .join('\n');
      ticketDescription += `\n\n**Arquivos anexados:**\n${attachmentsList}`;
    }

    // Determinar status baseado na vinculação
    const needsApproval = !!(form.linked_user_id || form.linked_group_id);
    const ticketStatus = needsApproval ? 'pending_approval' : 'open';
    const ticketTitle = `Submissão: ${form.name}`;

    console.log(`[Form Submit] Criando ticket para formulário ${form.id}:`);
    console.log(`  - linked_user_id: ${form.linked_user_id}`);
    console.log(`  - linked_group_id: ${form.linked_group_id}`);
    console.log(`  - needsApproval: ${needsApproval}`);
    console.log(`  - ticketStatus: ${ticketStatus}`);

    // Gerar número do ticket do dia
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    // Contar quantos tickets foram criados hoje
    // Usar DATE() para garantir compatibilidade com SQLite e PostgreSQL
    const countResult = await dbGet(
      `SELECT COUNT(*) as count FROM tickets WHERE DATE(created_at) = ?`,
      [dateStr]
    );
    
    const count = (countResult as any)?.count || 0;
    const ticketNumber = count + 1;

    // Criar ticket
    const ticketResult = await dbRun(`
      INSERT INTO tickets (title, description, status, priority, form_id, form_submission_id, user_id, needs_approval, ticket_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      ticketTitle,
      ticketDescription,
      ticketStatus,
      'medium',
      form.id,
      submissionId,
      1, // Usuário anônimo (pode ser ajustado)
      needsApproval ? 1 : 0,
      ticketNumber
    ]);

    const ticketId = (ticketResult as any).lastID || (ticketResult as any).id;
    const createdAt = new Date().toISOString();

    // Buscar ticket criado para retornar informações completas (com fallback)
    let finalTicketNumber = ticketNumber;
    let finalCreatedAt = createdAt;
    
    try {
      const createdTicket = await dbGet('SELECT * FROM tickets WHERE id = ?', [ticketId]);
      if (createdTicket) {
        finalTicketNumber = (createdTicket as any).ticket_number || ticketNumber;
        finalCreatedAt = (createdTicket as any).created_at || createdAt;
      }
    } catch (error) {
      console.error('[Form Submit] Erro ao buscar ticket criado, usando valores calculados:', error);
    }
    
    console.log(`[Form Submit] Ticket criado - ID: ${ticketId}, ticket_number: ${finalTicketNumber}, created_at: ${finalCreatedAt}`);

    res.status(201).json({
      message: 'Formulário enviado com sucesso',
      ticketId,
      ticket_number: finalTicketNumber,
      created_at: finalCreatedAt,
      needsApproval,
      submissionId
    });
  } catch (error) {
    console.error('Erro ao submeter formulário:', error);
    res.status(500).json({ error: 'Erro ao enviar formulário' });
  }
});

// Endpoint para baixar arquivo anexado
router.get('/attachments/:id', async (req, res) => {
  try {
    const attachment = await dbGet('SELECT * FROM form_attachments WHERE id = ?', [req.params.id]);
    
    if (!attachment) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    let filePath = attachment.file_path;
    
    // Se o caminho não for absoluto, resolver em relação ao diretório de trabalho
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(process.cwd(), filePath);
    }
    
    // Verificar se arquivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado no servidor' });
    }

    // Enviar arquivo
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.file_name}"`);
    res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Erro ao buscar arquivo:', error);
    res.status(500).json({ error: 'Erro ao buscar arquivo' });
  }
});

export default router;
