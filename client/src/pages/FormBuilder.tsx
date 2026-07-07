import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Plus, GripVertical, X, Settings, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/ui/confirm-dialog';

interface FormField {
  id: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'file' | 'image';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    accept?: string; // Para file/image: tipos aceitos (ex: "image/*", ".pdf,.doc")
    maxSize?: number; // Tamanho máximo em MB
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

const FIELD_TYPES: { value: FormField['type']; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Número' },
  { value: 'textarea', label: 'Área de Texto' },
  { value: 'select', label: 'Seleção' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio' },
  { value: 'date', label: 'Data' },
  { value: 'file', label: 'Arquivo' },
  { value: 'image', label: 'Imagem/Foto' },
];

export default function FormBuilder() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const confirm = useConfirm();
  const [currentForm, setCurrentForm] = useState<Partial<Form>>({
    name: '',
    description: '',
    fields: [],
    linkedUserId: undefined,
    linkedGroupId: undefined,
  });
  const [selectedField, setSelectedField] = useState<FormField | null>(null);
  const [optionsText, setOptionsText] = useState<string>('');
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [availableGroups, setAvailableGroups] = useState<Array<{ id: number; name: string }>>([]);

  const addField = () => {
    const newField: FormField = { id: Date.now().toString(), type: 'text', label: 'Novo Campo', required: false };
    setCurrentForm({ ...currentForm, fields: [...(currentForm.fields || []), newField] });
    setSelectedField(newField);
    setOptionsText('');
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setCurrentForm({
      ...currentForm,
      fields: currentForm.fields?.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)),
    });
    if (selectedField?.id === fieldId) {
      const updatedField = { ...selectedField, ...updates };
      setSelectedField(updatedField);
      if (updates.options !== undefined) {
        const newText = updates.options.join('\n');
        if (optionsText !== newText) setOptionsText(newText);
      }
    }
  };

  const removeField = (fieldId: string) => {
    setCurrentForm({ ...currentForm, fields: currentForm.fields?.filter((f) => f.id !== fieldId) });
    if (selectedField?.id === fieldId) setSelectedField(null);
  };

  const handleSave = async () => {
    if (!currentForm.name || !currentForm.fields || currentForm.fields.length === 0) {
      toast.error('Preencha o nome e adicione pelo menos um campo ao formulário');
      return;
    }

    try {
      const formData = {
        name: currentForm.name,
        description: currentForm.description || '',
        fields: currentForm.fields?.map((field) => ({
          type: field.type,
          label: field.label,
          placeholder: field.placeholder,
          required: field.required,
          options: field.options,
          validation: field.validation,
        })),
        linkedUserId: currentForm.linkedUserId,
        linkedGroupId: currentForm.linkedGroupId,
      };

      if (id) {
        await axios.put(`/api/forms/${id}`, formData);
        toast.success('Formulário atualizado com sucesso!');
      } else {
        await axios.post('/api/forms', formData);
        toast.success('Formulário criado com sucesso!');
      }

      navigate('/create/forms');
    } catch (error: any) {
      console.error('Erro ao salvar formulário:', error);
      toast.error(error.response?.data?.error || 'Erro ao salvar formulário. Tente novamente.');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersResponse, groupsResponse] = await Promise.all([axios.get('/api/users'), axios.get('/api/groups')]);
        setAvailableUsers(usersResponse.data.map((u: any) => ({ id: u.id, name: u.name, email: u.email })));
        setAvailableGroups(groupsResponse.data.map((g: any) => ({ id: g.id, name: g.name })));
      } catch (error) {
        console.error('Erro ao buscar usuários/grupos:', error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const loadForm = async () => {
      if (!id) return;
      try {
        const response = await axios.get(`/api/forms/${id}`);
        const formData = response.data;
        setCurrentForm({
          name: formData.name,
          description: formData.description || '',
          fields: formData.fields.map((field: any) => ({
            id: field.id,
            type: field.type,
            label: field.label,
            placeholder: field.placeholder,
            required: field.required,
            options: field.options,
            validation: field.validation,
          })),
          linkedUserId: formData.linked_user_id,
          linkedGroupId: formData.linked_group_id,
        });
      } catch (error: any) {
        console.error('Erro ao carregar formulário:', error);
        toast.error('Erro ao carregar formulário');
        navigate('/create/forms');
      }
    };
    loadForm();
  }, [id, navigate]);

  const handleBack = async () => {
    if (currentForm.name || (currentForm.fields && currentForm.fields.length > 0)) {
      const ok = await confirm({
        title: 'Sair sem salvar',
        description: 'Tem certeza que deseja sair? As alterações não salvas serão perdidas.',
        confirmLabel: 'Sair',
        variant: 'destructive',
      });
      if (!ok) return;
    }
    navigate('/create/forms');
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="secondary" size="icon" onClick={handleBack}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-[1.75rem] font-bold text-foreground">Construtor de Formulários</h1>
          <p className="text-sm text-muted-foreground">{id ? 'Editando formulário' : 'Criando novo formulário'}</p>
        </div>
      </div>

      <div className="flex h-[calc(100vh-200px)] min-h-[600px] flex-col gap-4 lg:flex-row">
        {/* Painel esquerdo — configurações e campos */}
        <div className="flex w-full flex-col gap-3 overflow-hidden lg:w-[360px] lg:shrink-0">
          <Card className="overflow-auto px-4 py-4">
            <h3 className="mb-3 text-[0.9375rem] font-semibold text-foreground">Informações Básicas</h3>
            <div className="mb-3">
              <Label className="mb-1.5">Nome do Formulário *</Label>
              <Input placeholder="Digite o nome" value={currentForm.name || ''} onChange={(e) => setCurrentForm({ ...currentForm, name: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1.5">Descrição</Label>
              <Textarea
                placeholder="Digite uma descrição"
                value={currentForm.description || ''}
                onChange={(e) => setCurrentForm({ ...currentForm, description: e.target.value })}
                className="min-h-[80px]"
              />
            </div>
          </Card>

          <Card className="overflow-auto px-4 py-4">
            <h3 className="mb-1 flex items-center gap-1.5 text-[0.9375rem] font-semibold text-foreground">
              <Settings size={16} /> Vinculação (Opcional)
            </h3>
            <p className="mb-3 text-[0.8125rem] text-muted-foreground">Vincule um usuário ou grupo para ativar o fluxo de aprovação obrigatória</p>

            <div className="mb-3">
              <Label className="mb-1.5">Vincular Usuário</Label>
              <Select
                value={currentForm.linkedUserId ? String(currentForm.linkedUserId) : '__none'}
                onValueChange={(v) => setCurrentForm({ ...currentForm, linkedUserId: v === '__none' ? undefined : parseInt(v), linkedGroupId: undefined })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Nenhum</SelectItem>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5">Vincular Grupo</Label>
              <Select
                value={currentForm.linkedGroupId ? String(currentForm.linkedGroupId) : '__none'}
                onValueChange={(v) => setCurrentForm({ ...currentForm, linkedGroupId: v === '__none' ? undefined : parseInt(v), linkedUserId: undefined })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Nenhum</SelectItem>
                  {availableGroups.map((group) => (
                    <SelectItem key={group.id} value={String(group.id)}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="flex min-h-[200px] flex-1 flex-col overflow-auto px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[0.9375rem] font-semibold text-foreground">Campos ({currentForm.fields?.length || 0})</h3>
              <Button size="sm" onClick={addField}>
                <Plus size={15} /> Adicionar
              </Button>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 overflow-auto">
              {currentForm.fields?.map((field) => (
                <div
                  key={field.id}
                  onClick={() => {
                    setSelectedField(field);
                    setOptionsText(field.options?.join('\n') || '');
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2',
                    selectedField?.id === field.id ? 'border-[var(--purple)] bg-[var(--purple-light)]' : 'border-border bg-muted/40'
                  )}
                >
                  <GripVertical size={16} className="shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{field.label || 'Campo sem nome'}</div>
                    <div className="text-xs text-muted-foreground">
                      {FIELD_TYPES.find((t) => t.value === field.type)?.label}
                      {field.required && ' • Obrigatório'}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeField(field.id);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X size={15} />
                  </Button>
                </div>
              ))}
              {(!currentForm.fields || currentForm.fields.length === 0) && (
                <div className="py-5 text-center text-sm text-muted-foreground">Nenhum campo adicionado ainda</div>
              )}
            </div>
          </Card>
        </div>

        {/* Painel central — editor de campo */}
        <div className="min-w-0 flex-1 overflow-auto">
          {selectedField ? (
            <Card className="px-5 py-5">
              <h3 className="mb-5 text-lg font-semibold text-foreground">Editar Campo</h3>

              <div className="mb-4">
                <Label className="mb-1.5">Tipo de Campo</Label>
                <Select
                  value={selectedField.type}
                  onValueChange={(v) => {
                    const newType = v as FormField['type'];
                    const newOptions = newType === 'select' || newType === 'radio' ? ['Opção 1', 'Opção 2'] : undefined;
                    updateField(selectedField.id, { type: newType, options: newOptions });
                    setOptionsText(newOptions?.join('\n') || '');
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mb-4">
                <Label className="mb-1.5">Rótulo *</Label>
                <Input
                  placeholder="Digite o rótulo do campo"
                  value={selectedField.label}
                  onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                />
              </div>

              {(selectedField.type === 'text' || selectedField.type === 'email' || selectedField.type === 'number') && (
                <div className="mb-4">
                  <Label className="mb-1.5">Placeholder</Label>
                  <Input
                    placeholder="Digite o placeholder"
                    value={selectedField.placeholder || ''}
                    onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                  />
                </div>
              )}

              {(selectedField.type === 'select' || selectedField.type === 'radio') && (
                <div className="mb-4">
                  <Label className="mb-1.5">Opções (uma por linha)</Label>
                  <Textarea
                    placeholder={'Opção 1\nOpção 2\nOpção 3'}
                    value={optionsText}
                    onChange={(e) => {
                      const value = e.target.value;
                      setOptionsText(value);
                      const validOptions = value.split('\n').filter((l) => l.trim() !== '');
                      updateField(selectedField.id, { options: validOptions.length > 0 ? validOptions : undefined });
                    }}
                    className="min-h-[100px] font-mono text-sm leading-relaxed"
                  />
                </div>
              )}

              <label htmlFor={`required-${selectedField.id}`} className="mt-4 flex cursor-pointer items-center gap-2.5">
                <Checkbox
                  id={`required-${selectedField.id}`}
                  checked={selectedField.required}
                  onCheckedChange={(checked) => updateField(selectedField.id, { required: checked === true })}
                />
                <span className="text-sm text-muted-foreground">Campo obrigatório</span>
              </label>
            </Card>
          ) : (
            <Card className="flex min-h-[300px] flex-col items-center justify-center px-6 py-10 text-center">
              <Settings size={48} strokeWidth={1.5} className="mb-4 text-muted-foreground opacity-50" />
              <p className="text-base text-muted-foreground">Selecione um campo para editar ou adicione um novo campo</p>
            </Card>
          )}
        </div>

        {/* Painel direito — preview */}
        <div className="flex w-full flex-col gap-3 overflow-hidden lg:w-[420px] lg:shrink-0">
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-5">
            <h3 className="mb-3 shrink-0 text-[0.9375rem] font-semibold text-foreground">Preview</h3>
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/40 p-5">
              <h4 className="mb-1 text-lg font-semibold text-foreground">{currentForm.name || 'Nome do Formulário'}</h4>
              {currentForm.description && <p className="mb-5 text-sm text-muted-foreground">{currentForm.description}</p>}
              <div className="flex flex-col gap-4">
                {currentForm.fields?.map((field) => (
                  <div key={field.id}>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      {field.label}
                      {field.required && <span className="text-destructive"> *</span>}
                    </label>
                    {field.type === 'text' && <Input placeholder={field.placeholder || 'Digite...'} disabled />}
                    {field.type === 'email' && <Input type="email" placeholder={field.placeholder || 'email@exemplo.com'} disabled />}
                    {field.type === 'number' && <Input type="number" placeholder={field.placeholder || '0'} disabled />}
                    {field.type === 'textarea' && <Textarea placeholder={field.placeholder || 'Digite...'} disabled className="min-h-[100px]" />}
                    {field.type === 'select' && (
                      <Select disabled>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione uma opção" />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((opt, idx) => (
                            <SelectItem key={idx} value={opt || `opt-${idx}`}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {field.type === 'radio' && (
                      <div className="flex flex-col gap-1.5">
                        {field.options?.map((opt, idx) => (
                          <label key={idx} className="flex items-center gap-2">
                            <input type="radio" name={`preview-${field.id}`} disabled />
                            <span className="text-sm text-foreground">{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {field.type === 'checkbox' && (
                      <label className="flex items-center gap-2">
                        <Checkbox disabled />
                        <span className="text-sm text-foreground">Marcar</span>
                      </label>
                    )}
                    {field.type === 'date' && <Input type="date" disabled />}
                    {(field.type === 'file' || field.type === 'image') && <Input type="file" disabled accept={field.validation?.accept} />}
                  </div>
                ))}
                {(!currentForm.fields || currentForm.fields.length === 0) && (
                  <div className="py-5 text-center text-sm text-muted-foreground">Adicione campos para ver o preview</div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Rodapé com botões */}
      <div className="mt-5 flex items-center justify-between border-t border-border pt-5">
        <Button variant="secondary" onClick={handleBack}>
          <ArrowLeft size={18} /> Voltar
        </Button>
        <Button onClick={handleSave} disabled={!currentForm.name || !currentForm.fields || currentForm.fields.length === 0}>
          <Save size={18} /> Salvar Formulário
        </Button>
      </div>
    </div>
  );
}
