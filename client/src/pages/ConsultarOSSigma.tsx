import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, Loader2, Ticket as TicketIcon, MapPin, User, Wrench, Calendar, X, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface OrdemServicoSigma {
  ID_ORDEM: number;
  ABERTURA: string | null;
  FECHAMENTO: string | null;
  DEFEITO: string | null;
  EXECUTADO: string | null;
  FECHADO: number;
  DATAAGENDADA: string | null;
  DATAEXECUTADA: string | null;
  TX_OBSERVACOES_CLIENTE: string | null;
  CD_CLIENTE: number | null;
  CONTA: string | null;
  PARTICAO: string | null;
  RAZAO: string | null;
  FANTASIA: string | null;
  ENDERECO: string | null;
  CONTRATO: string | null;
  INSTALADOR_NOME: string | null;
  OPERADOR_ABRIU: string | null;
  OPERADOR_FECHOU: string | null;
  DESCRICAODEFEITO: string | null;
  DESCRICAOSOLUCAO: string | null;
  CAUSA_DEFEITO: string | null;
}

interface InstaladorSigma {
  CD_COLABORADOR: number;
  NM_COLABORADOR: string;
}

interface ClienteSigma {
  cdCliente: number;
  conta: string;
  particao: string;
  fantasia: string | null;
  razao: string | null;
  empresa: string | null;
  ativo: boolean;
}

function formatData(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function getTicketFullId(ticket: any): string {
  if (!ticket.ticket_number || !ticket.created_at) {
    return ticket.id.toString();
  }
  const date = new Date(ticket.created_at);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const number = String(ticket.ticket_number).padStart(3, '0');
  return `${year}${month}${day}${number}`;
}

function nomeCliente(c: ClienteSigma): string {
  if (c.razao && c.fantasia) return `${c.razao} (${c.fantasia})`;
  return c.razao || c.fantasia || `Conta ${c.conta}`;
}

function OrdemCard({ os }: { os: OrdemServicoSigma }) {
  const navigate = useNavigate();
  const [priority, setPriority] = useState('medium');
  const [gerando, setGerando] = useState(false);
  const clienteNome = os.RAZAO || os.FANTASIA || '-';
  const fechada = os.FECHADO === 1;

  const handleGerarTicket = async () => {
    setGerando(true);
    try {
      const response = await axios.post(`/api/sigma/os/${os.ID_ORDEM}/gerar-ticket`, { priority });
      toast.success('Ticket gerado com sucesso!');
      navigate(`/tickets/${getTicketFullId(response.data)}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao gerar ticket');
    } finally {
      setGerando(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">OS #{os.ID_ORDEM}</h2>
            <Badge variant={fechada ? 'secondary' : 'default'}>
              {fechada ? 'Fechada' : 'Aberta'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {clienteNome} — conta {os.CONTA || '-'}/{os.PARTICAO || '-'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger size="sm" className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleGerarTicket} disabled={gerando}>
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <TicketIcon className="h-4 w-4" />}
            Gerar Ticket
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <div className="text-muted-foreground">Endereço</div>
            <div className="text-foreground">{os.ENDERECO || '-'}</div>
            <div className="text-xs text-muted-foreground">Contrato: {os.CONTRATO || '-'}</div>
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm">
          <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <div className="text-muted-foreground">Instalador / Técnico</div>
            <div className="text-foreground">{os.INSTALADOR_NOME || '-'}</div>
            <div className="text-xs text-muted-foreground">
              Abriu: {os.OPERADOR_ABRIU || '-'} · Fechou: {os.OPERADOR_FECHOU || '-'}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <div className="text-muted-foreground">Abertura / Fechamento</div>
            <div className="text-foreground">{formatData(os.ABERTURA)}</div>
            <div className="text-xs text-muted-foreground">{formatData(os.FECHAMENTO)}</div>
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm">
          <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <div className="text-muted-foreground">Defeito / Causa / Solução</div>
            <div className="text-foreground">{os.DESCRICAODEFEITO || '-'}</div>
            <div className="text-xs text-muted-foreground">
              {os.CAUSA_DEFEITO || '-'} {os.DESCRICAOSOLUCAO ? `· ${os.DESCRICAOSOLUCAO}` : ''}
            </div>
          </div>
        </div>
      </div>

      {os.DEFEITO && (
        <div className="rounded-lg border border-border p-3 text-sm">
          <div className="mb-1 font-medium text-foreground">Detalhe informado</div>
          <div className="whitespace-pre-wrap text-muted-foreground">{os.DEFEITO}</div>
        </div>
      )}

      {os.EXECUTADO && (
        <div className="rounded-lg border border-border p-3 text-sm">
          <div className="mb-1 font-medium text-foreground">Executado</div>
          <div className="whitespace-pre-wrap text-muted-foreground">{os.EXECUTADO}</div>
        </div>
      )}

      {os.TX_OBSERVACOES_CLIENTE && (
        <div className="rounded-lg border border-border p-3 text-sm">
          <div className="mb-1 font-medium text-foreground">Observações do cliente</div>
          <div className="whitespace-pre-wrap text-muted-foreground">{os.TX_OBSERVACOES_CLIENTE}</div>
        </div>
      )}
    </Card>
  );
}

export default function ConsultarOSSigma() {
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteSigma | null>(null);
  const [sugestoes, setSugestoes] = useState<ClienteSigma[]>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [buscandoClientes, setBuscandoClientes] = useState(false);

  const [ordens, setOrdens] = useState<OrdemServicoSigma[] | null>(null);
  const [pagina, setPagina] = useState(1);
  const OS_POR_PAGINA = 5;

  const [instaladores, setInstaladores] = useState<InstaladorSigma[]>([]);
  const [instaladorId, setInstaladorId] = useState<string>('todos');
  const [status, setStatus] = useState<'abertas' | 'fechadas' | 'todas'>('todas');

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    axios.get('/api/sigma/instaladores')
      .then((response) => setInstaladores(response.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (clienteSelecionado || buscaCliente.trim().length < 2) {
      setSugestoes([]);
      return;
    }

    setBuscandoClientes(true);
    const timer = setTimeout(() => {
      axios.get('/api/sigma/clientes', { params: { q: buscaCliente.trim() } })
        .then((response) => setSugestoes(response.data))
        .catch(() => setSugestoes([]))
        .finally(() => setBuscandoClientes(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [buscaCliente, clienteSelecionado]);

  const buscarOrdens = async (cdCliente: number) => {
    setLoading(true);
    setErro(null);
    setOrdens(null);
    setPagina(1);

    try {
      const params: Record<string, string> = { status };
      if (instaladorId !== 'todos') params.instalador = instaladorId;
      const response = await axios.get(`/api/sigma/conta/${cdCliente}/os`, { params });
      setOrdens(response.data);
      if (response.data.length === 0) {
        setErro('Nenhuma OS encontrada para essa conta nos últimos 180 dias.');
      }
    } catch (error: any) {
      setErro(error.response?.data?.error || 'Erro ao consultar conta no Sigma.');
    } finally {
      setLoading(false);
    }
  };

  const selecionarCliente = (c: ClienteSigma) => {
    setClienteSelecionado(c);
    setBuscaCliente('');
    setSugestoes([]);
    setMostrarSugestoes(false);
    buscarOrdens(c.cdCliente);
  };

  const limparCliente = () => {
    setClienteSelecionado(null);
    setBuscaCliente('');
    setOrdens(null);
    setErro(null);
  };

  const handleConsultarConta = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clienteSelecionado) {
      setErro('Selecione um cliente da lista de sugestões.');
      return;
    }

    buscarOrdens(clienteSelecionado.cdCliente);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Consultar OS-SIGMA</h1>
        <p className="text-sm text-muted-foreground">
          Busque as OS de uma conta dos últimos 180 dias diretamente no Sigma e gere tickets a partir delas.
        </p>
      </div>

      <Card className="overflow-visible p-4">
        <form onSubmit={handleConsultarConta} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="relative flex-1">
            <Label className="mb-1.5">Conta / Razão Social / Fantasia</Label>

            {clienteSelecionado ? (
              <div className="flex h-9 items-center justify-between gap-2 rounded-md border border-border bg-muted/40 pl-3 pr-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm text-foreground">{nomeCliente(clienteSelecionado)}</span>
                  <Badge variant="outline" className="shrink-0 text-xs font-normal">
                    {clienteSelecionado.conta}/{clienteSelecionado.particao}
                  </Badge>
                  {!clienteSelecionado.ativo && (
                    <Badge variant="secondary" className="shrink-0 text-xs font-normal">Inativa</Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={limparCliente}
                  aria-label="Trocar cliente"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  onFocus={() => setMostrarSugestoes(true)}
                  onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
                  placeholder="Digite a conta, razão social ou nome fantasia"
                  autoFocus
                  autoComplete="off"
                />
                {mostrarSugestoes && buscaCliente.trim().length >= 2 && (
                  <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                    {buscandoClientes && (
                      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando...
                      </div>
                    )}
                    {!buscandoClientes && sugestoes.length === 0 && (
                      <div className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
                    )}
                    {!buscandoClientes && sugestoes.map((c) => (
                      <button
                        type="button"
                        key={c.cdCliente}
                        onMouseDown={() => selecionarCliente(c)}
                        className="flex w-full flex-col items-start gap-0.5 border-b border-border/60 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                      >
                        <span className="flex w-full items-center justify-between gap-2 text-foreground">
                          <span className="truncate">{nomeCliente(c)}</span>
                          <span className="flex shrink-0 items-center gap-1">
                            <Badge variant="outline" className="text-xs font-normal">
                              {c.conta}/{c.particao}
                            </Badge>
                            {!c.ativo && <Badge variant="secondary" className="text-xs font-normal">Inativa</Badge>}
                          </span>
                        </span>
                        {c.empresa && <span className="text-xs text-muted-foreground">{c.empresa}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="w-full sm:w-[220px]">
            <Label className="mb-1.5">Instalador</Label>
            <Select value={instaladorId} onValueChange={setInstaladorId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {instaladores.map((i) => (
                  <SelectItem key={i.CD_COLABORADOR} value={String(i.CD_COLABORADOR)}>
                    {i.NM_COLABORADOR}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-[160px]">
            <Label className="mb-1.5">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as 'abertas' | 'fechadas' | 'todas')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="abertas">Abertas</SelectItem>
                <SelectItem value="fechadas">Fechadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={loading || !clienteSelecionado}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar OS
          </Button>
        </form>
      </Card>

      {erro && (
        <Card className="border-[var(--red)]/30 bg-[var(--red-light)] p-4 text-sm text-[var(--red)]">
          {erro}
        </Card>
      )}

      {ordens && ordens.length > 0 && (
        <div className="flex flex-col gap-4">
          {ordens
            .slice((pagina - 1) * OS_POR_PAGINA, pagina * OS_POR_PAGINA)
            .map((o) => (
              <OrdemCard key={o.ID_ORDEM} os={o} />
            ))}

          {ordens.length > OS_POR_PAGINA && (
            <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
              <span>
                {(pagina - 1) * OS_POR_PAGINA + 1}–{Math.min(pagina * OS_POR_PAGINA, ordens.length)} de {ordens.length} OS
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={pagina === 1}
                  onClick={() => setPagina((p) => p - 1)}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span>
                  {pagina} / {Math.ceil(ordens.length / OS_POR_PAGINA)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={pagina >= Math.ceil(ordens.length / OS_POR_PAGINA)}
                  onClick={() => setPagina((p) => p + 1)}
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
