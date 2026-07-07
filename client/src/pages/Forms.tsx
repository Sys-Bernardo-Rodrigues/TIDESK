import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { FileEdit, Plus, Search, Edit, Trash2, Eye, Copy, Link as LinkIcon, Users, User } from 'lucide-react';
import { formatDateBR } from '../utils/dateUtils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';

interface FormField {
  id: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // Para select, radio
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface Form {
  id: number;
  name: string;
  description: string;
  fields: FormField[];
  publicUrl: string;
  linkedUserId?: number;
  linkedGroupId?: number;
  linkedUserName?: string;
  linkedGroupName?: string;
  submissions: number;
  created: string;
}

function FormRowSkeleton() {
  return (
    <Card className="flex-row items-center justify-between gap-4 px-4 py-4">
      <div className="min-w-0 flex-1">
        <Skeleton className="mb-2 h-5 w-1/3" />
        <Skeleton className="mb-3 h-3.5 w-2/3" />
        <div className="flex gap-4">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      </div>
      <Skeleton className="h-8 w-[300px] shrink-0" />
    </Card>
  );
}

export default function Forms() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      const response = await axios.get('/api/forms');
      const formsData = response.data.map((form: any) => ({
        id: form.id,
        name: form.name,
        description: form.description || '',
        fields: form.fields || [],
        publicUrl: `/form/${form.public_url}`,
        linkedUserId: form.linked_user_id,
        linkedGroupId: form.linked_group_id,
        linkedUserName: form.linked_user_name,
        linkedGroupName: form.linked_group_name,
        submissions: form.submissions_count || 0,
        created: form.created_at,
      }));
      setForms(formsData);
    } catch (error) {
      console.error('Erro ao buscar formulários:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (formId: number) => {
    const ok = await confirm({
      title: 'Excluir formulário',
      description: 'Tem certeza que deseja excluir este formulário?',
      confirmLabel: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await axios.delete(`/api/forms/${formId}`);
      setForms(forms.filter((f) => f.id !== formId));
      toast.success('Formulário excluído com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir formulário:', error);
      toast.error(error.response?.data?.error || 'Erro ao excluir formulário');
    }
  };

  const filteredForms = forms.filter(
    (form) =>
      form.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      form.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const copyUrl = async (url: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast.success('URL copiada para a área de transferência!');
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = fullUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const ok = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (ok) toast.success('URL copiada para a área de transferência!');
        else toast.error('Não foi possível copiar. Copie manualmente: ' + fullUrl);
      } catch {
        document.body.removeChild(textArea);
        toast.error('Não foi possível copiar. Copie manualmente: ' + fullUrl);
      }
    }
  };

  const startCreatingForm = () => navigate('/create/forms/builder');
  const handleEdit = (formId: number) => navigate(`/create/forms/builder/${formId}`);

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-1.5 bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-[2.5rem] font-extrabold tracking-tight text-transparent">
          Formulários
        </h1>
        <p className="text-base text-muted-foreground">
          Crie formulários públicos e gerencie submissões que geram tickets automaticamente
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[300px] max-w-[500px] flex-1">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar formulários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={startCreatingForm}>
          <Plus size={18} /> Novo Formulário
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <FormRowSkeleton key={i} />
          ))}
        </div>
      ) : filteredForms.length === 0 ? (
        <Card className="flex flex-col items-center px-4 py-16 text-center">
          <FileEdit size={48} strokeWidth={1.5} className="mb-4 text-muted-foreground opacity-50" />
          <p className="mb-4 text-base text-muted-foreground">
            {searchTerm ? 'Nenhum formulário encontrado' : 'Nenhum formulário criado ainda'}
          </p>
          {!searchTerm && (
            <Button onClick={startCreatingForm}>
              <Plus size={18} /> Criar Primeiro Formulário
            </Button>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredForms.map((form) => (
            <Card
              key={form.id}
              className="flex-row flex-wrap items-center justify-between gap-4 px-4 py-4 transition-shadow hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2.5">
                  <FileEdit size={20} className="shrink-0 text-[var(--blue)]" />
                  <h3 className="text-[1.0625rem] font-semibold text-foreground">{form.name}</h3>
                  {form.linkedUserId && (
                    <Badge className="border-0 bg-[var(--purple-light)] text-[var(--purple)]">
                      <User size={12} /> {form.linkedUserName}
                    </Badge>
                  )}
                  {form.linkedGroupId && (
                    <Badge className="border-0 bg-[var(--blue-light)] text-[var(--blue)]">
                      <Users size={12} /> {form.linkedGroupName}
                    </Badge>
                  )}
                </div>
                <p className="mb-1.5 ml-9 text-sm text-muted-foreground">{form.description}</p>
                <div className="ml-9 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    <strong className="text-foreground">{form.fields.length}</strong> campos
                  </span>
                  <span>
                    <strong className="text-foreground">{form.submissions}</strong> submissões
                  </span>
                  <span>
                    <strong className="text-foreground">Criado:</strong> {formatDateBR(form.created)}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyUrl(form.publicUrl)}
                    className="flex items-center gap-1 text-[var(--purple)] underline-offset-2 hover:underline"
                  >
                    <LinkIcon size={14} /> {form.publicUrl}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => window.open(form.publicUrl, '_blank')}>
                  <Eye size={15} /> Visualizar
                </Button>
                <Button variant="secondary" size="sm" onClick={() => copyUrl(form.publicUrl)}>
                  <Copy size={15} /> Copiar URL
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleEdit(form.id)}>
                  <Edit size={15} /> Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(form.id)}>
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
