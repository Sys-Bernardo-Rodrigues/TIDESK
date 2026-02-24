/** Tipos e dados mock para o sistema de Docs (repositórios estilo GitHub) */

import type { LucideIcon } from 'lucide-react';
import { FileText, Link as LinkIcon, Video, KeyRound } from 'lucide-react';

export type DocType = 'documento' | 'link' | 'video' | 'credencial';

export type DocItem = {
  id: string;
  repoId: string;
  tipo: DocType;
  titulo: string;
  descricao?: string;
  tags: string[];
  conteudoSensivel?: string;
  url?: string;
  usuario?: string;
  criadoEm: string;
  atualizadoEm?: string;
};

export type DocRepo = {
  id: string;
  name: string;
  slug: string;
  description: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  documento: 'Documento',
  link: 'Link',
  video: 'Vídeo',
  credencial: 'Credencial / Senha',
};

export const DOC_TYPE_ICON: Record<DocType, LucideIcon> = {
  documento: FileText,
  link: LinkIcon,
  video: Video,
  credencial: KeyRound,
};

/** Mock: repositórios disponíveis */
export const MOCK_REPOS: DocRepo[] = [
  {
    id: '1',
    name: 'Procedimentos de rede',
    slug: 'procedimentos-rede',
    description: 'Documentação de rede, VPN, firewall e acessos.',
    itemCount: 3,
    createdAt: '2025-01-15T10:00:00',
    updatedAt: '2025-02-20T14:30:00',
  },
  {
    id: '2',
    name: 'Credenciais e acessos',
    slug: 'credenciais-acessos',
    description: 'Logins, senhas e tokens de sistemas (criptografados).',
    itemCount: 0,
    createdAt: '2025-02-01T09:00:00',
    updatedAt: '2025-02-01T09:00:00',
  },
  {
    id: '3',
    name: 'Tutoriais e vídeos',
    slug: 'tutoriais-videos',
    description: 'Links para tutoriais, vídeos e materiais de treinamento.',
    itemCount: 1,
    createdAt: '2025-02-10T11:00:00',
    updatedAt: '2025-02-18T16:00:00',
  },
];

/** Mock: itens (documentos) por repositório */
export const MOCK_ITEMS: DocItem[] = [
  {
    id: 'i1',
    repoId: '1',
    tipo: 'documento',
    titulo: 'Checklist de backup diário',
    descricao: 'Passo a passo para verificação do backup.',
    tags: ['backup', 'procedimento'],
    criadoEm: '2025-02-01T10:00:00',
    atualizadoEm: '2025-02-20T14:30:00',
  },
  {
    id: 'i2',
    repoId: '1',
    tipo: 'link',
    titulo: 'Portal da VPN',
    descricao: 'Acesso ao painel da VPN corporativa.',
    tags: ['vpn', 'acesso'],
    url: 'https://vpn.empresa.com',
    criadoEm: '2025-02-05T09:00:00',
  },
  {
    id: 'i3',
    repoId: '1',
    tipo: 'credencial',
    titulo: 'Firewall – admin',
    descricao: 'Conta de administração do firewall.',
    tags: ['firewall', 'admin'],
    criadoEm: '2025-02-10T11:00:00',
  },
  {
    id: 'i4',
    repoId: '3',
    tipo: 'video',
    titulo: 'Treinamento TIDESK – novos usuários',
    descricao: 'Vídeo de onboarding no sistema de tickets.',
    tags: ['treinamento', 'tidesk'],
    url: 'https://example.com/video-tidesk',
    criadoEm: '2025-02-18T16:00:00',
  },
];

export function getItemsByRepo(repoId: string): DocItem[] {
  return MOCK_ITEMS.filter((i) => i.repoId === repoId);
}

export function getRepoById(id: string): DocRepo | undefined {
  return MOCK_REPOS.find((r) => r.id === id);
}
