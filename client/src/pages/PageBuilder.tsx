import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Plus, X, Save, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/ui/confirm-dialog';

interface PageButton {
  id: string;
  label: string;
  formId?: number;
  url?: string;
  style?: {
    backgroundColor?: string;
    color?: string;
    size?: 'small' | 'medium' | 'large';
  };
}

interface Page {
  id: number;
  title: string;
  description: string | null;
  slug: string;
  content: string | null;
  buttons: PageButton[];
}

interface Form {
  id: number;
  name: string;
  public_url: string;
}

const PREVIEW_SIZE: Record<'small' | 'medium' | 'large', string> = {
  small: 'px-3 py-1.5 text-sm',
  medium: 'px-5 py-2.5 text-base',
  large: 'px-6 py-3.5 text-lg',
};

export default function PageBuilder() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const confirm = useConfirm();
  const [currentPage, setCurrentPage] = useState<Partial<Page>>({
    title: '',
    description: '',
    slug: '',
    content: '',
    buttons: [],
  });
  const [availableForms, setAvailableForms] = useState<Form[]>([]);
  const [selectedButton, setSelectedButton] = useState<PageButton | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchForms();
    if (id) loadPage();
  }, [id]);

  const fetchForms = async () => {
    try {
      const response = await axios.get('/api/forms');
      setAvailableForms(response.data.map((form: any) => ({ id: form.id, name: form.name, public_url: form.public_url || form.publicUrl })));
    } catch (error) {
      console.error('Erro ao buscar formulários:', error);
    }
  };

  const loadPage = async () => {
    try {
      const response = await axios.get(`/api/pages/${id}`);
      const pageData = response.data;
      setCurrentPage({
        title: pageData.title,
        description: pageData.description || '',
        slug: pageData.slug,
        content: pageData.content || '',
        buttons:
          pageData.buttons?.map((btn: any) => ({
            id: btn.id.toString(),
            label: btn.label,
            formId: btn.formId,
            url: btn.url,
            style: btn.style || {},
          })) || [],
      });
    } catch (error: any) {
      console.error('Erro ao carregar página:', error);
      toast.error('Erro ao carregar página');
      navigate('/create/pages');
    }
  };

  const generateSlug = (title: string) =>
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const handleTitleChange = (title: string) => {
    setCurrentPage({ ...currentPage, title, slug: currentPage.slug || generateSlug(title) });
  };

  const addButton = () => {
    const newButton: PageButton = {
      id: Date.now().toString(),
      label: 'Novo Botão',
      style: { backgroundColor: 'var(--purple)', color: '#FFFFFF', size: 'medium' },
    };
    setCurrentPage({ ...currentPage, buttons: [...(currentPage.buttons || []), newButton] });
    setSelectedButton(newButton);
  };

  const updateButton = (buttonId: string, updates: Partial<PageButton>) => {
    setCurrentPage({
      ...currentPage,
      buttons: currentPage.buttons?.map((btn) => (btn.id === buttonId ? { ...btn, ...updates } : btn)),
    });
    if (selectedButton?.id === buttonId) {
      setSelectedButton({ ...selectedButton, ...updates });
    }
  };

  const removeButton = (buttonId: string) => {
    setCurrentPage({ ...currentPage, buttons: currentPage.buttons?.filter((btn) => btn.id !== buttonId) });
    if (selectedButton?.id === buttonId) setSelectedButton(null);
  };

  const handleSave = async () => {
    if (!currentPage.title || !currentPage.slug) {
      toast.error('Preencha o título e o slug da página');
      return;
    }

    setLoading(true);
    try {
      const pageData = {
        title: currentPage.title,
        description: currentPage.description || null,
        slug: currentPage.slug,
        content: currentPage.content || null,
        buttons: currentPage.buttons?.map((btn) => ({ label: btn.label, formId: btn.formId, url: btn.url, style: btn.style })) || [],
      };

      if (id) {
        await axios.put(`/api/pages/${id}`, pageData);
        toast.success('Página atualizada com sucesso!');
      } else {
        await axios.post('/api/pages', pageData);
        toast.success('Página criada com sucesso!');
      }

      navigate('/create/pages');
    } catch (error: any) {
      console.error('Erro ao salvar página:', error);
      toast.error(error.response?.data?.error || 'Erro ao salvar página. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = async () => {
    if (currentPage.title || (currentPage.buttons && currentPage.buttons.length > 0)) {
      const ok = await confirm({
        title: 'Sair sem salvar',
        description: 'Tem certeza que deseja sair? As alterações não salvas serão perdidas.',
        confirmLabel: 'Sair',
        variant: 'destructive',
      });
      if (!ok) return;
    }
    navigate('/create/pages');
  };

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mb-1.5 bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-[2.5rem] font-extrabold tracking-tight text-transparent">
            {id ? 'Editar Página' : 'Nova Página'}
          </h1>
          <p className="text-base text-muted-foreground">Crie páginas públicas com botões que redirecionam para formulários</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleBack}>
            <ArrowLeft size={18} /> Voltar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save size={18} /> {loading ? 'Salvando...' : 'Salvar Página'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Painel esquerdo — configurações */}
        <Card className="px-6 py-6">
          <h2 className="mb-5 text-2xl font-bold text-foreground">Configurações da Página</h2>

          <div className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5">Título *</Label>
              <Input value={currentPage.title || ''} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Ex: Página Inicial" />
            </div>

            <div>
              <Label className="mb-1.5">Slug *</Label>
              <Input value={currentPage.slug || ''} onChange={(e) => setCurrentPage({ ...currentPage, slug: e.target.value })} placeholder="ex: pagina-inicial" />
              <small className="mt-1 block text-xs text-muted-foreground">URL: /page/{currentPage.slug || 'slug'}</small>
            </div>

            <div>
              <Label className="mb-1.5">Descrição</Label>
              <Textarea
                value={currentPage.description || ''}
                onChange={(e) => setCurrentPage({ ...currentPage, description: e.target.value })}
                placeholder="Descrição da página..."
                rows={3}
              />
            </div>

            <div>
              <Label className="mb-1.5">Conteúdo (HTML opcional)</Label>
              <Textarea
                value={currentPage.content || ''}
                onChange={(e) => setCurrentPage({ ...currentPage, content: e.target.value })}
                placeholder="Conteúdo HTML da página..."
                rows={6}
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Lista de botões */}
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Botões</h3>
              <Button size="sm" onClick={addButton}>
                <Plus size={15} /> Adicionar Botão
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {currentPage.buttons?.length === 0 ? (
                <p className="py-5 text-center text-sm text-muted-foreground">Nenhum botão adicionado ainda</p>
              ) : (
                currentPage.buttons?.map((button) => (
                  <Card
                    key={button.id}
                    onClick={() => setSelectedButton(button)}
                    className={cn(
                      'cursor-pointer gap-0 px-4 py-3 transition-colors',
                      selectedButton?.id === button.id ? 'bg-[var(--purple-light)] ring-2 ring-[var(--purple)]' : 'bg-muted/40'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-foreground">{button.label}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {button.formId
                            ? `Formulário: ${availableForms.find((f) => f.id === button.formId)?.name || 'N/A'}`
                            : button.url
                              ? `URL: ${button.url}`
                              : 'Sem destino'}
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeButton(button.id);
                        }}
                      >
                        <X size={15} />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Painel direito — editor de botão / preview */}
        <div className="flex flex-col gap-6">
          {selectedButton ? (
            <Card className="px-6 py-6">
              <h2 className="mb-5 text-2xl font-bold text-foreground">Editar Botão</h2>

              <div className="flex flex-col gap-4">
                <div>
                  <Label className="mb-1.5">Rótulo do Botão *</Label>
                  <Input
                    value={selectedButton.label}
                    onChange={(e) => updateButton(selectedButton.id, { label: e.target.value })}
                    placeholder="Ex: Preencher Formulário"
                  />
                </div>

                <div>
                  <Label className="mb-1.5">Tipo de Destino</Label>
                  <Select
                    value={selectedButton.formId ? 'form' : 'url'}
                    onValueChange={(v) => {
                      if (v === 'form') updateButton(selectedButton.id, { formId: undefined, url: undefined });
                      else updateButton(selectedButton.id, { formId: undefined, url: '' });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="form">Formulário</SelectItem>
                      <SelectItem value="url">URL Externa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedButton.formId !== undefined || !selectedButton.url ? (
                  <div>
                    <Label className="mb-1.5">Formulário</Label>
                    <Select
                      value={selectedButton.formId ? String(selectedButton.formId) : '__none'}
                      onValueChange={(v) => updateButton(selectedButton.id, { formId: v === '__none' ? undefined : parseInt(v), url: undefined })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione um formulário" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Selecione um formulário</SelectItem>
                        {availableForms.map((form) => (
                          <SelectItem key={form.id} value={String(form.id)}>
                            {form.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label className="mb-1.5">URL Externa</Label>
                    <Input
                      value={selectedButton.url || ''}
                      onChange={(e) => updateButton(selectedButton.id, { url: e.target.value, formId: undefined })}
                      placeholder="https://exemplo.com"
                    />
                  </div>
                )}

                <div>
                  <Label className="mb-1.5">Tamanho</Label>
                  <Select
                    value={selectedButton.style?.size || 'medium'}
                    onValueChange={(v) => updateButton(selectedButton.id, { style: { ...selectedButton.style, size: v as 'small' | 'medium' | 'large' } })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Pequeno</SelectItem>
                      <SelectItem value="medium">Médio</SelectItem>
                      <SelectItem value="large">Grande</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1.5">Cor de Fundo</Label>
                  <input
                    type="color"
                    value={selectedButton.style?.backgroundColor || '#9147FF'}
                    onChange={(e) => updateButton(selectedButton.id, { style: { ...selectedButton.style, backgroundColor: e.target.value } })}
                    className="h-10 w-full cursor-pointer rounded-lg border border-input bg-transparent p-0.5"
                  />
                </div>

                <div>
                  <Label className="mb-1.5">Cor do Texto</Label>
                  <input
                    type="color"
                    value={selectedButton.style?.color || '#FFFFFF'}
                    onChange={(e) => updateButton(selectedButton.id, { style: { ...selectedButton.style, color: e.target.value } })}
                    className="h-10 w-full cursor-pointer rounded-lg border border-input bg-transparent p-0.5"
                  />
                </div>
              </div>
            </Card>
          ) : (
            <Card className="px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">Selecione um botão para editar ou adicione um novo botão</p>
            </Card>
          )}

          {/* Preview */}
          <Card className="px-6 py-6">
            <h2 className="mb-5 text-2xl font-bold text-foreground">Preview</h2>

            <div className="min-h-[400px] rounded-lg border border-border bg-background p-6">
              {currentPage.title && <h1 className="mb-3 text-3xl font-bold text-foreground">{currentPage.title}</h1>}
              {currentPage.description && <p className="mb-5 text-muted-foreground">{currentPage.description}</p>}
              {currentPage.content && <div className="mb-5 text-foreground" dangerouslySetInnerHTML={{ __html: currentPage.content }} />}
              <div className="mt-6 flex flex-col gap-3">
                {currentPage.buttons?.map((button) => (
                  <button
                    key={button.id}
                    className={cn('w-full rounded-lg text-center font-semibold transition-opacity hover:opacity-90', PREVIEW_SIZE[button.style?.size || 'medium'])}
                    style={{ backgroundColor: button.style?.backgroundColor || 'var(--purple)', color: button.style?.color || '#FFFFFF' }}
                    onClick={() => {
                      if (button.formId) {
                        const form = availableForms.find((f) => f.id === button.formId);
                        if (form) window.open(`/form/${form.public_url}`, '_blank');
                      } else if (button.url) {
                        window.open(button.url, '_blank');
                      }
                    }}
                  >
                    {button.label}
                    {button.formId && <ExternalLink size={16} className="ml-1.5 inline align-[-3px]" />}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
