import express, { Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, RESOURCES, ACTIONS } from '../middleware/permissions';
import { getOrdemServicoSigma, getOrdensPorConta, getInstaladoresSigma, buscarClientesSigma } from '../services/sigma-service';
import { createTicketRecord } from '../services/ticket-service';

const router = express.Router();

function formatDataHora(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function buildTicketDescription(os: NonNullable<Awaited<ReturnType<typeof getOrdemServicoSigma>>>): string {
  const linhas = [
    `OS-SIGMA nº ${os.ID_ORDEM}`,
    `Cliente: ${os.RAZAO || os.FANTASIA || '-'}${os.FANTASIA && os.RAZAO ? ` (${os.FANTASIA})` : ''}`,
    `Conta: ${os.CONTA || '-'}  |  Partição: ${os.PARTICAO || '-'}`,
    `Endereço: ${os.ENDERECO || '-'}`,
    `Contrato: ${os.CONTRATO || '-'}`,
    `Abertura: ${formatDataHora(os.ABERTURA)}`,
    `Fechamento: ${formatDataHora(os.FECHAMENTO)}`,
    `Instalador/Técnico: ${os.INSTALADOR_NOME || '-'}`,
    `Operador que abriu: ${os.OPERADOR_ABRIU || '-'}`,
    `Defeito: ${os.DESCRICAODEFEITO || '-'}`,
    `Causa do defeito: ${os.CAUSA_DEFEITO || '-'}`,
    `Solução: ${os.DESCRICAOSOLUCAO || '-'}`,
    '',
    'Detalhe informado:',
    os.DEFEITO || '-',
    '',
    'Executado:',
    os.EXECUTADO || '-'
  ];

  if (os.TX_OBSERVACOES_CLIENTE) {
    linhas.push('', `Observações do cliente: ${os.TX_OBSERVACOES_CLIENTE}`);
  }

  return linhas.join('\n');
}

router.get(
  '/conta/:cdCliente/os',
  authenticate,
  requirePermission(RESOURCES.SIGMA, ACTIONS.VIEW),
  [
    param('cdCliente').isInt({ min: 1 }).withMessage('Número de conta inválido'),
    query('instalador').optional().isInt({ min: 1 }).withMessage('Instalador inválido'),
    query('status').optional().isIn(['abertas', 'fechadas', 'todas']).withMessage('Status inválido')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const cdCliente = Number(req.params.cdCliente);
      const idInstalador = req.query.instalador ? Number(req.query.instalador) : undefined;
      const status = (req.query.status as 'abertas' | 'fechadas' | 'todas') || 'todas';
      const ordens = await getOrdensPorConta(cdCliente, idInstalador, status);

      res.json(ordens);
    } catch (error) {
      console.error('Erro ao consultar OS da conta no Sigma:', error);
      res.status(502).json({ error: 'Erro ao consultar o banco do Sigma' });
    }
  }
);

router.get(
  '/clientes',
  authenticate,
  requirePermission(RESOURCES.SIGMA, ACTIONS.VIEW),
  [query('q').trim().isLength({ min: 2, max: 100 }).withMessage('Digite entre 2 e 100 caracteres')],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const clientes = await buscarClientesSigma(String(req.query.q));
      res.json(clientes);
    } catch (error) {
      console.error('Erro ao buscar clientes no Sigma:', error);
      res.status(502).json({ error: 'Erro ao consultar o banco do Sigma' });
    }
  }
);

router.get(
  '/instaladores',
  authenticate,
  requirePermission(RESOURCES.SIGMA, ACTIONS.VIEW),
  async (_req: AuthRequest, res: Response) => {
    try {
      const instaladores = await getInstaladoresSigma();
      res.json(instaladores);
    } catch (error) {
      console.error('Erro ao consultar instaladores no Sigma:', error);
      res.status(502).json({ error: 'Erro ao consultar o banco do Sigma' });
    }
  }
);

router.post(
  '/os/:numero/gerar-ticket',
  authenticate,
  requirePermission(RESOURCES.SIGMA, ACTIONS.VIEW),
  requirePermission(RESOURCES.TICKETS, ACTIONS.CREATE),
  [
    param('numero').isInt({ min: 1 }).withMessage('Número de OS inválido'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Prioridade inválida')
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const numeroOS = Number(req.params.numero);
      const os = await getOrdemServicoSigma(numeroOS);

      if (!os) {
        return res.status(404).json({ error: 'OS não encontrada no Sigma' });
      }

      const clienteNome = os.RAZAO || os.FANTASIA || `Cliente ${os.CD_CLIENTE ?? '-'}`;
      const { category_id, priority } = req.body;

      const ticket = await createTicketRecord({
        title: `OS-SIGMA ${os.ID_ORDEM} - ${clienteNome}`,
        description: buildTicketDescription(os),
        priority: priority || 'medium',
        category_id: category_id || null,
        user_id: req.userId!
      });

      res.status(201).json(ticket);
    } catch (error) {
      console.error('Erro ao gerar ticket a partir da OS-SIGMA:', error);
      res.status(500).json({ error: 'Erro ao gerar ticket' });
    }
  }
);

export default router;
