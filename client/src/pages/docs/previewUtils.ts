import type { DocEntry } from './docsData';

export type FilePreviewKind = 'pdf' | 'image' | 'text' | 'html' | 'none';

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];

const TEXT_EXT = [
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
  '.sql',
  '.sh',
  '.rtf',
];

export function isImageEntry(entry: DocEntry): boolean {
  if (entry.entry_type !== 'file') return false;
  const mime = (entry.mime_type || '').toLowerCase();
  if (IMAGE_MIMES.some((m) => mime === m || mime.startsWith('image/'))) return true;
  const ext = entry.name.toLowerCase().slice(entry.name.lastIndexOf('.'));
  return IMAGE_EXT.includes(ext);
}

export function isTextFileEntry(entry: DocEntry): boolean {
  if (entry.entry_type !== 'file') return false;
  const mime = (entry.mime_type || '').toLowerCase();
  if (mime.startsWith('text/')) return true;
  if (mime.includes('json') || mime.includes('xml') || mime.includes('javascript')) return true;
  const dot = entry.name.lastIndexOf('.');
  if (dot < 0) return false;
  return TEXT_EXT.includes(entry.name.slice(dot).toLowerCase());
}

export function isDocxEntry(entry: DocEntry): boolean {
  if (entry.entry_type !== 'file') return false;
  const mime = (entry.mime_type || '').toLowerCase();
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return true;
  return entry.name.toLowerCase().endsWith('.docx');
}

export function isPdfEntry(entry: DocEntry): boolean {
  if (entry.entry_type !== 'file') return false;
  const mime = (entry.mime_type || '').toLowerCase();
  if (mime === 'application/pdf') return true;
  return entry.name.toLowerCase().endsWith('.pdf');
}

export function getFilePreviewKind(entry: DocEntry): FilePreviewKind {
  if (entry.entry_type === 'note') return 'text';
  if (isPdfEntry(entry)) return 'pdf';
  if (isImageEntry(entry)) return 'image';
  if (isDocxEntry(entry)) return 'html';
  if (isTextFileEntry(entry)) return 'text';
  return 'none';
}

export function canPreviewInBrowser(entry: DocEntry): boolean {
  return getFilePreviewKind(entry) !== 'none';
}
