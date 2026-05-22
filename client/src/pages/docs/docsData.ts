/** Repositório de arquivos TIDESK (estilo drive / Nextcloud) */

export type DocVisibility = 'private' | 'team';
export type DocAccess = 'owner' | 'edit' | 'view';
export type DocEntryType = 'folder' | 'file' | 'note';
export type SharePermission = 'view' | 'edit';

export type DocRepositoryShare = {
  id?: number;
  user_id: number;
  user_name: string;
  user_email: string;
  permission: SharePermission;
};

export type DocRepository = {
  id: number;
  name: string;
  slug: string;
  description: string;
  owner_id: number;
  owner_name?: string;
  visibility: DocVisibility;
  item_count: number;
  created_at: string;
  updated_at: string;
  access?: DocAccess;
  shared_with?: DocRepositoryShare[];
};

export type DocEntry = {
  id: number;
  repository_id: number;
  parent_id: number | null;
  name: string;
  entry_type: DocEntryType;
  mime_type?: string | null;
  size_bytes: number;
  description?: string | null;
  tags: string[];
  content?: string;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
};

export type DocShare = {
  id: number;
  repository_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  permission: SharePermission;
  created_by: number;
  created_at: string;
};

export type DocSearchResult = DocEntry & {
  path: string[];
  snippet?: string;
};

export { isPdfEntry, canPreviewInBrowser, getFilePreviewKind } from './previewUtils';

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
}
