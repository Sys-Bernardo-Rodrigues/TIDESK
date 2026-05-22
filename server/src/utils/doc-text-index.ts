import fs from 'fs';
import path from 'path';

const MAX_INDEX_BYTES = 512 * 1024;
const MAX_INDEX_CHARS = 120_000;

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
  '.xml',
  '.html',
  '.htm',
  '.css',
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.log',
  '.yml',
  '.yaml',
  '.env',
  '.ini',
  '.cfg',
  '.conf',
  '.sql',
  '.sh',
  '.bat',
  '.rtf',
]);

function truncate(s: string, max = MAX_INDEX_CHARS): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function isTextLike(mime: string | null | undefined, fileName: string): boolean {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('text/')) return true;
  if (m.includes('json') || m.includes('xml') || m.includes('javascript')) return true;
  const ext = path.extname(fileName).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

async function readUtf8File(filePath: string): Promise<string> {
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_INDEX_BYTES) {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(MAX_INDEX_BYTES);
    fs.readSync(fd, buf, 0, MAX_INDEX_BYTES, 0);
    fs.closeSync(fd);
    return buf.toString('utf8');
  }
  return fs.readFileSync(filePath, 'utf8');
}

async function extractPdfText(filePath: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text?: string }>;
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text || '';
  } catch {
    return '';
  }
}

async function extractDocxText(filePath: string): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  } catch {
    return '';
  }
}

/** Extrai texto pesquisável de um arquivo no disco */
export async function extractFileSearchText(
  filePath: string,
  mimeType: string | null | undefined,
  fileName: string
): Promise<string> {
  if (!fs.existsSync(filePath)) return '';

  const mime = (mimeType || '').toLowerCase();
  const ext = path.extname(fileName).toLowerCase();

  try {
    if (mime === 'application/pdf' || ext === '.pdf') {
      return truncate(await extractPdfText(filePath));
    }
    if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === '.docx'
    ) {
      return truncate(await extractDocxText(filePath));
    }
    if (isTextLike(mime, fileName)) {
      return truncate(await readUtf8File(filePath));
    }
  } catch {
    return '';
  }
  return '';
}

export function buildEntrySearchText(parts: (string | null | undefined)[]): string {
  return truncate(
    parts
      .filter(Boolean)
      .map((p) => String(p).trim())
      .join('\n')
  );
}

/** HTML para pré-visualização de DOCX no navegador */
export async function extractDocxPreviewHtml(filePath: string): Promise<string | null> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml({ path: filePath });
    return result.value || null;
  } catch {
    return null;
  }
}

/** Termos de busca (palavras com 2+ caracteres) */
export function splitSearchTerms(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

export function countTermMatches(text: string, term: string): number {
  if (!text || !term.trim()) return 0;
  const lower = text.toLowerCase();
  const t = term.toLowerCase();
  let count = 0;
  let pos = 0;
  while (true) {
    const i = lower.indexOf(t, pos);
    if (i < 0) break;
    count++;
    pos = i + t.length;
  }
  return count;
}

export function makeSearchSnippet(text: string, term: string, radius = 60): string {
  const lower = text.toLowerCase();
  const t = term.toLowerCase();
  const idx = lower.indexOf(t);
  if (idx < 0) return text.slice(0, radius * 2).trim();
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + term.length + radius);
  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = '…' + snippet;
  if (end < text.length) snippet = snippet + '…';
  return snippet;
}
