import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { FileText, Plus, Search, Edit, Trash2, Eye, Copy, Link as LinkIcon } from 'lucide-react';
import { formatDateBR } from '../utils/dateUtils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';

interface PageButton {
  id: number;
  label: string;
  formId?: number;
  formName?: string;
  formUrl?: string;
  url?: string;
  style?: any;
  orderIndex: number;
}

interface Page {
  id: number;
  title: string;
  description: string | null;
  slug: string;
  content: string | null;
  publicUrl: string;
  buttons: PageButton[];
  buttons_count: number;
  created_at: string;
  updated_at: string;
}

function PageRowSkeleton() {
  return (
    <Card className="flex-row items-center justify-between gap-4 px-4 py-4">
      <div className="min-w-0 flex-1">
        <Skeleton className="mb-2 h-5 w-1/3" />
        <div className="flex gap-4">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      </div>
      <Skeleton className="h-8 w-[300px] shrink-0" />
    </Card>
  );
}

export default function Pages() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      const response = await axios.get('/api/pages');
      const pagesData = response.data.map((page: any) => ({
        id: page.id,
        title: page.title,
        description: page.description || '',
        slug: page.slug,
        content: page.content || '',
        publicUrl: `/page/${page.slug}`,
        buttons: page.buttons || [],
        buttons_count: page.buttons_count || 0,
        created_at: page.created_at,
        updated_at: page.updated_at,
      }));
      setPages(pagesData);
    } catch (error) {
      console.error('Erro ao buscar páginas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (pageId: number) => {
    const ok = await confirm({
      title: 'Excluir página',
      description: 'Tem certeza que deseja excluir esta página?',
      confirmLabel: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await axios.delete(`/api/pages/${pageId}`);
      setPages(pages.filter((p) => p.id !== pageId));
      toast.success('Página excluída com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir página:', error);
      toast.error(error.response?.data?.error || 'Erro ao excluir página');
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(`${window.location.origin}${url}`);
    toast.success('URL copiada para a área de transferência!');
  };

  const startCreatingPage = () => navigate('/create/pages/builder');
  const handleEdit = (pageId: number) => navigate(`/create/pages/builder/${pageId}`);

  const filteredPages = pages.filter(
    (page) =>
      page.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      page.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (page.description && page.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-1.5 bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-[2.5rem] font-extrabold tracking-tight text-transparent">
          Páginas
        </h1>
        <p className="text-base text-muted-foreground">Gerencie as páginas do sistema</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[300px] max-w-[500px] flex-1">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar páginas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={startCreatingPage}>
          <Plus size={18} /> Nova Página
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <PageRowSkeleton key={i} />
          ))}
        </div>
      ) : filteredPages.length === 0 ? (
        <Card className="flex flex-col items-center px-4 py-16 text-center">
          <FileText size={48} strokeWidth={1.5} className="mb-4 text-muted-foreground opacity-50" />
          <p className="mb-4 text-base text-muted-foreground">
            {searchTerm ? 'Nenhuma página encontrada' : 'Nenhuma página criada ainda'}
          </p>
          {!searchTerm && (
            <Button onClick={startCreatingPage}>
              <Plus size={18} /> Criar Primeira Página
            </Button>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredPages.map((page) => (
            <Card
              key={page.id}
              className="flex-row flex-wrap items-center justify-between gap-4 px-4 py-4 transition-shadow hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2.5">
                  <FileText size={20} className="shrink-0 text-[var(--purple)]" />
                  <h3 className="text-[1.0625rem] font-semibold text-foreground">{page.title}</h3>
                </div>
                {page.description && <p className="mb-1.5 ml-9 text-sm text-muted-foreground">{page.description}</p>}
                <div className="ml-9 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    <strong className="text-foreground">Slug:</strong> /{page.slug}
                  </span>
                  <span>
                    <strong className="text-foreground">{page.buttons_count}</strong> botões
                  </span>
                  <span>
                    <strong className="text-foreground">Criado:</strong> {formatDateBR(page.created_at)}
                  </span>
                  <span>
                    <strong className="text-foreground">Atualizado:</strong> {formatDateBR(page.updated_at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyUrl(page.publicUrl)}
                    className="flex items-center gap-1 text-[var(--purple)] underline-offset-2 hover:underline"
                  >
                    <LinkIcon size={14} /> {page.publicUrl}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => window.open(page.publicUrl, '_blank')}>
                  <Eye size={15} /> Visualizar
                </Button>
                <Button variant="secondary" size="sm" onClick={() => copyUrl(page.publicUrl)}>
                  <Copy size={15} /> Copiar URL
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleEdit(page.id)}>
                  <Edit size={15} /> Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(page.id)}>
                  <Trash2 size={15} /> Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
