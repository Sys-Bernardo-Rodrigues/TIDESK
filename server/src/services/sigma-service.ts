import sql from 'mssql';

/**
 * Consulta ao Sigma90 (SQL Server, somente leitura).
 * Logica de busca de cliente/conta portada do modulo customer-lookup do
 * repositorio iFlow (github.com/Sys-Bernardo-Rodrigues/iFlow), que ja
 * resolve corretamente a numeracao de conta usada no Sigma.
 *
 * Ponto chave: o "numero da conta" que aparece pro operador no Sigma e
 * dbCENTRAL.ID_CENTRAL (varchar, geralmente zero-padded, ex. "0027"), NAO
 * dbCENTRAL.CD_CLIENTE (PK interna). Um mesmo ID_CENTRAL pode ter mais de
 * uma particao (mais de uma linha CD_CLIENTE) — por isso a busca retorna
 * candidatos e o consumo por OS usa sempre o CD_CLIENTE escolhido.
 */

let pool: sql.ConnectionPool | null = null;

function getConfig(): sql.config {
  return {
    server: process.env.SIGMA_MSSQL_HOST || '',
    port: Number(process.env.SIGMA_MSSQL_PORT) || 1433,
    user: process.env.SIGMA_MSSQL_USER,
    password: process.env.SIGMA_MSSQL_PASSWORD,
    database: process.env.SIGMA_MSSQL_DATABASE,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      readOnlyIntent: true,
      // Sigma grava datetime em hora local (America/Sao_Paulo), sem fuso.
      // useUTC:true (padrao do driver) interpreta como UTC e atrasa tudo em 3h.
      useUTC: false
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 10000,
    requestTimeout: 45000
  };
}

async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }
  pool = await new sql.ConnectionPool(getConfig()).connect();
  return pool;
}

/** Escapa curingas do LIKE ('%', '_', '[') pra busca literal por nome. */
function escapeLike(term: string) {
  return term.replace(/[[%_]/g, (c) => `[${c}]`);
}

export interface ClienteSigma {
  cdCliente: number;
  conta: string;
  particao: string;
  fantasia: string | null;
  razao: string | null;
  empresa: string | null;
  ativo: boolean;
}

const SEARCH_SELECT = `
  SELECT TOP 20
    c.CD_CLIENTE AS cdCliente,
    c.ID_CENTRAL AS conta,
    c.PARTICAO AS particao,
    c.FANTASIA AS fantasia,
    c.RAZAO AS razao,
    e.NM_FANTASIA AS empresa,
    c.FG_ATIVO AS ativo
  FROM dbCENTRAL c
  LEFT JOIN EMPRESA e ON e.CD_EMPRESA = c.ID_EMPRESA
`;

const ACCOUNT_CONDITION = `c.ID_CENTRAL IN (@account, @accountPadded)`;
const NAME_CONDITION = `(c.RAZAO LIKE @namePattern OR c.FANTASIA LIKE @namePattern)`;
const SEARCH_ORDER = `ORDER BY c.FG_ATIVO DESC, c.ID_CENTRAL, c.PARTICAO`;

export async function buscarClientesSigma(termo: string): Promise<ClienteSigma[]> {
  const conn = await getPool();
  const request = conn.request();
  const trimmed = termo.trim();

  const conditions: string[] = [];
  if (trimmed.length <= 6) {
    conditions.push(ACCOUNT_CONDITION);
    request.input('account', sql.NVarChar(6), trimmed);
    // Sigma costuma zero-preencher a conta (ex.: "27" e gravado como "0027")
    request.input('accountPadded', sql.NVarChar(6), trimmed.padStart(4, '0'));
  }
  if (trimmed.length >= 3) {
    conditions.push(NAME_CONDITION);
    request.input('namePattern', sql.VarChar(120), `%${escapeLike(trimmed)}%`);
  }

  if (conditions.length === 0) {
    return [];
  }

  const result = await request.query<ClienteSigma>(
    `${SEARCH_SELECT} WHERE ${conditions.join(' OR ')} ${SEARCH_ORDER}`
  );

  return result.recordset;
}

export interface OrdemServicoSigma {
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

// Nomes de operador/instalador via VIEW_OPERADOR/VIEW_INSTALADOR (views
// nativas do Sigma) — repetem linha por empresa, por isso OUTER APPLY TOP 1.
const SELECT_ORDEM = `
  SELECT
    o.ID_ORDEM, o.ABERTURA, o.FECHAMENTO, o.DEFEITO, o.EXECUTADO, o.FECHADO,
    o.DATAAGENDADA, o.DATAEXECUTADA, o.TX_OBSERVACOES_CLIENTE,
    c.CD_CLIENTE, c.ID_CENTRAL AS CONTA, c.PARTICAO, c.RAZAO, c.FANTASIA, c.ENDERECO, c.CONTRATO,
    tec.NM_COLABORADOR AS INSTALADOR_NOME,
    abriu.NM_COLABORADOR AS OPERADOR_ABRIU,
    fechou.NM_COLABORADOR AS OPERADOR_FECHOU,
    def.DESCRICAODEFEITO,
    sol.DESCRICAOSOLUCAO,
    cau.DESCRICAO AS CAUSA_DEFEITO
  FROM dbORDEM o
  LEFT JOIN dbCENTRAL c ON c.CD_CLIENTE = o.CD_CLIENTE
  LEFT JOIN OSDEFEITO def ON def.IDOSDEFEITO = o.IDOSDEFEITO
  LEFT JOIN OSSOLUCAO sol ON sol.IDOSSOLUCAO = o.IDOSSOLUCAO
  LEFT JOIN OSCAUSADEFEITO cau ON cau.IDOSCAUSADEFEITO = o.IDOSCAUSADEFEITO
  OUTER APPLY (SELECT TOP 1 v.NM_COLABORADOR FROM VIEW_INSTALADOR v WHERE v.CD_COLABORADOR = o.ID_INSTALADOR) tec
  OUTER APPLY (SELECT TOP 1 v.NM_COLABORADOR FROM VIEW_OPERADOR v WHERE v.CD_USUARIO = o.OPABRIU) abriu
  OUTER APPLY (SELECT TOP 1 v.NM_COLABORADOR FROM VIEW_OPERADOR v WHERE v.CD_USUARIO = o.OPFECHOU) fechou
`;

export async function getOrdemServicoSigma(numeroOS: number): Promise<OrdemServicoSigma | null> {
  const conn = await getPool();

  const result = await conn.request()
    .input('idOrdem', sql.Int, numeroOS)
    .query(`${SELECT_ORDEM} WHERE o.ID_ORDEM = @idOrdem`);

  return (result.recordset[0] as OrdemServicoSigma) || null;
}

export type StatusOrdemFiltro = 'abertas' | 'fechadas' | 'todas';

const DIAS_HISTORICO_PADRAO = 180;

export async function getOrdensPorConta(
  cdCliente: number,
  idInstalador?: number,
  status: StatusOrdemFiltro = 'todas'
): Promise<OrdemServicoSigma[]> {
  const conn = await getPool();

  const dataLimite = new Date(Date.now() - DIAS_HISTORICO_PADRAO * 24 * 60 * 60 * 1000);

  const request = conn.request()
    .input('cdCliente', sql.Int, cdCliente)
    .input('dataLimite', sql.DateTime, dataLimite);
  let where = 'WHERE o.CD_CLIENTE = @cdCliente AND o.ABERTURA >= @dataLimite';

  // FECHADO e um tinyint com varios codigos (0,2,3,4 = nao fechada; 1 = fechada de fato)
  if (status === 'abertas') {
    where += ' AND o.FECHADO <> 1';
  } else if (status === 'fechadas') {
    where += ' AND o.FECHADO = 1';
  }

  if (idInstalador) {
    request.input('idInstalador', sql.Int, idInstalador);
    where += ' AND o.ID_INSTALADOR = @idInstalador';
  }

  const result = await request.query(`${SELECT_ORDEM} ${where} ORDER BY o.ABERTURA DESC`);

  return result.recordset as OrdemServicoSigma[];
}

export interface InstaladorSigma {
  CD_COLABORADOR: number;
  NM_COLABORADOR: string;
}

export async function getInstaladoresSigma(): Promise<InstaladorSigma[]> {
  const conn = await getPool();

  const result = await conn.request().query(`
    SELECT DISTINCT CD_COLABORADOR, NM_COLABORADOR
    FROM VIEW_INSTALADOR
    WHERE FG_INSTALADOR = 1 AND FG_EXECUTA_OS = 1 AND FG_ATIVO_COLABORADOR = 1
    ORDER BY NM_COLABORADOR
  `);

  return result.recordset as InstaladorSigma[];
}
