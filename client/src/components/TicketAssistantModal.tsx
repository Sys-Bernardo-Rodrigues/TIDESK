import { useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Sparkles, Upload, FileText, AlertCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Category {
  id: number;
  name: string;
}

interface MatchedCategory extends Category {
  score: number;
}

interface AnalyzeResponse {
  extraction: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    suggestedCategory: string | null;
  };
  matchedCategory: MatchedCategory | null;
  categories: Category[];
  providerUsed: string;
  tempFile: {
    path: string;
    originalName: string;
    size: number;
  };
}

interface TicketAssistantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const NO_CATEGORY = 'none';

export default function TicketAssistantModal({ open, onOpenChange, onCreated }: TicketAssistantModalProps) {
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [tempFile, setTempFile] = useState<AnalyzeResponse['tempFile'] | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [matchedCategory, setMatchedCategory] = useState<MatchedCategory | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY);

  const reset = () => {
    setStep('upload');
    setAnalyzing(false);
    setCreating(false);
    setError(null);
    setCategories([]);
    setTempFile(null);
    setProviderUsed(null);
    setMatchedCategory(null);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setCategoryId(NO_CATEGORY);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFileChange = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await axios.post<AnalyzeResponse>('/api/ticket-assistant/analyze', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { extraction, matchedCategory: matched, categories: cats, providerUsed: provider, tempFile: temp } = response.data;
      setTitle(extraction.title);
      setDescription(extraction.description);
      setPriority(extraction.priority);
      setCategories(cats);
      setMatchedCategory(matched);
      setCategoryId(matched ? String(matched.id) : NO_CATEGORY);
      setProviderUsed(provider);
      setTempFile(temp);
      setStep('review');
    } catch (err: unknown) {
      let msg = 'Erro ao analisar PDF';
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 422) {
          msg = err.response.data?.error || 'Não foi possível extrair texto do PDF (pode ser um PDF escaneado/imagem).';
        } else if (err.response?.status === 503) {
          msg = err.response.data?.error || 'Todos os provedores de IA configurados falharam ou estão sem quota.';
        } else {
          msg = err.response?.data?.error || msg;
        }
      }
      setError(msg);
      toast.error(msg);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirm = async () => {
    if (!tempFile) return;
    if (!title.trim() || !description.trim()) {
      setError('Título e descrição são obrigatórios');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await axios.post('/api/ticket-assistant/confirm', {
        title: title.trim(),
        description: description.trim(),
        priority,
        category_id: categoryId === NO_CATEGORY ? null : Number(categoryId),
        tempFilePath: tempFile.path,
        originalFileName: tempFile.originalName,
      });
      toast.success('Ticket criado com sucesso!');
      handleOpenChange(false);
      onCreated();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error || 'Erro ao criar ticket' : 'Erro ao criar ticket';
      setError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={20} />
            Assistente de IA — Ordem de Serviço
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'upload' && (
          <div className="flex flex-col items-center gap-4 py-6">
            {analyzing ? (
              <>
                <Loader2 size={32} className="animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analisando PDF e extraindo dados do ticket...</p>
              </>
            ) : (
              <>
                <FileText size={32} className="text-muted-foreground" />
                <p className="text-center text-sm text-muted-foreground">
                  Envie o PDF da ordem de serviço. A IA vai sugerir título, descrição, prioridade e categoria do ticket para você revisar.
                </p>
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload size={16} />
                  Selecionar PDF
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={(e) => handleFileChange(e.target.files)}
                />
              </>
            )}
          </div>
        )}

        {step === 'review' && (
          <div className="flex flex-col gap-4">
            {providerUsed && (
              <p className="text-xs text-muted-foreground">
                Extraído via {providerUsed}. Revise os campos abaixo antes de criar o ticket.
              </p>
            )}

            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={creating} />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={creating}
                rows={5}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                  <SelectTrigger disabled={creating} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">
                  Categoria
                  {matchedCategory && categoryId === String(matchedCategory.id) && (
                    <span className="ml-1 text-primary">(sugerida pela IA)</span>
                  )}
                </Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger disabled={creating} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {tempFile && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText size={14} />
                {tempFile.originalName} será anexado ao ticket
              </p>
            )}
          </div>
        )}

        {step === 'review' && (
          <DialogFooter>
            <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={creating}>
              {creating ? 'Criando...' : 'Criar Ticket'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
