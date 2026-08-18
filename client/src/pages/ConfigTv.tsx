import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Tv, Plus, Edit, Trash2, Save, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TvSlide {
  id: number;
  title: string;
  url: string;
  duration_seconds: number;
  sort_order: number;
  active: number;
}

interface SlideFormData {
  title: string;
  url: string;
  duration_seconds: string;
  sort_order: string;
  active: boolean;
}

const EMPTY_FORM: SlideFormData = { title: '', url: '', duration_seconds: '30', sort_order: '0', active: true };

export default function ConfigTv() {
  const confirm = useConfirm();
  const [slides, setSlides] = useState<TvSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardDuration, setDashboardDuration] = useState('60');
  const [savingDuration, setSavingDuration] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedSlide, setSelectedSlide] = useState<TvSlide | null>(null);
  const [formData, setFormData] = useState<SlideFormData>(EMPTY_FORM);

  useEffect(() => {
    fetchSlides();
    fetchTvConfig();
  }, []);

  const fetchSlides = async () => {
    try {
      const response = await axios.get('/api/tv-slides');
      setSlides(response.data);
    } catch (error) {
      console.error('Erro ao buscar slides do painel de TV:', error);
      toast.error('Erro ao buscar slides');
    } finally {
      setLoading(false);
    }
  };

  const fetchTvConfig = async () => {
    try {
      const response = await axios.get('/api/config/tv-config');
      setDashboardDuration(String(response.data.dashboardDurationSeconds));
    } catch (error) {
      console.error('Erro ao buscar configuração do painel de TV:', error);
    }
  };

  const handleSaveDuration = async () => {
    const value = parseInt(dashboardDuration, 10);
    if (!value || value < 5) {
      toast.error('Informe um tempo válido (mínimo 5 segundos)');
      return;
    }
    setSavingDuration(true);
    try {
      await axios.put('/api/config/tv-config', { dashboardDurationSeconds: value });
      toast.success('Tempo do painel de chamados atualizado!');
    } catch (error: any) {
      console.error('Erro ao salvar configuração do painel de TV:', error);
      toast.error(error.response?.data?.error || 'Erro ao salvar configuração');
    } finally {
      setSavingDuration(false);
    }
  };

  const handleCreate = () => {
    setFormData(EMPTY_FORM);
    setSelectedSlide(null);
    setShowModal(true);
  };

  const handleEdit = (slide: TvSlide) => {
    setFormData({
      title: slide.title,
      url: slide.url,
      duration_seconds: String(slide.duration_seconds),
      sort_order: String(slide.sort_order),
      active: slide.active === 1,
    });
    setSelectedSlide(slide);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.url.trim()) {
      toast.error('Título e URL são obrigatórios');
      return;
    }

    const payload = {
      title: formData.title.trim(),
      url: formData.url.trim(),
      duration_seconds: parseInt(formData.duration_seconds, 10) || 30,
      sort_order: parseInt(formData.sort_order, 10) || 0,
      active: formData.active,
    };

    try {
      if (selectedSlide) {
        await axios.put(`/api/tv-slides/${selectedSlide.id}`, payload);
        toast.success('Slide atualizado com sucesso!');
      } else {
        await axios.post('/api/tv-slides', payload);
        toast.success('Slide criado com sucesso!');
      }
      setShowModal(false);
      setSelectedSlide(null);
      fetchSlides();
    } catch (error: any) {
      console.error('Erro ao salvar slide do painel de TV:', error);
      toast.error(error.response?.data?.error || 'Erro ao salvar slide');
    }
  };

  const handleDelete = async (slide: TvSlide) => {
    const ok = await confirm({
      title: 'Excluir slide',
      description: `Tem certeza que deseja excluir "${slide.title}" do painel de TV?`,
      confirmLabel: 'Excluir',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await axios.delete(`/api/tv-slides/${slide.id}`);
      setSlides(slides.filter((s) => s.id !== slide.id));
      toast.success('Slide excluído com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir slide do painel de TV:', error);
      toast.error(error.response?.data?.error || 'Erro ao excluir slide');
    }
  };

  const handleToggleActive = async (slide: TvSlide) => {
    try {
      await axios.put(`/api/tv-slides/${slide.id}`, { active: slide.active ? 0 : 1 });
      fetchSlides();
    } catch (error: any) {
      console.error('Erro ao atualizar slide do painel de TV:', error);
      toast.error(error.response?.data?.error || 'Erro ao atualizar slide');
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Painel de TV</h1>
        <p className="mt-1 text-muted-foreground">
          Cadastre links externos para exibir em rotação na tela <code>/tv</code>, alternando com o painel de chamados
        </p>
      </div>

      <Card className="mb-6 p-5">
        <h2 className="mb-1 text-base font-semibold text-foreground">Tempo do painel de chamados</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Quanto tempo (em segundos) a tela de números de chamados fica visível antes de passar para os slides cadastrados
        </p>
        <div className="flex items-end gap-3">
          <div className="max-w-[200px]">
            <Label className="mb-1.5">Segundos</Label>
            <Input
              type="number"
              min={5}
              value={dashboardDuration}
              onChange={(e) => setDashboardDuration(e.target.value)}
            />
          </div>
          <Button onClick={handleSaveDuration} disabled={savingDuration}>
            <Save size={18} />
            Salvar
          </Button>
        </div>
      </Card>

      <Card className="mb-6 flex items-start gap-3 border-[var(--orange)] bg-[var(--orange-light)] p-4">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--orange)]" />
        <p className="text-sm text-foreground">
          Alguns sites bloqueiam a exibição incorporada (iframe) por política própria (X-Frame-Options/CSP). Se um
          slide não carregar na tela <code>/tv</code>, o link cadastrado provavelmente não permite esse tipo de embed.
        </p>
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Slides cadastrados</h2>
        <Button onClick={handleCreate}>
          <Plus size={18} />
          Novo Slide
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : slides.length === 0 ? (
        <Card className="items-center p-10 text-center">
          <Tv size={40} className="mx-auto mb-3 text-muted-foreground" />
          <p className="mb-3 text-muted-foreground">Nenhum slide cadastrado ainda</p>
          <Button onClick={handleCreate} className="mx-auto">
            <Plus size={18} />
            Criar Primeiro Slide
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {slides.map((slide) => (
            <Card key={slide.id} className="px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tv size={18} className={slide.active ? 'text-primary' : 'text-muted-foreground'} />
                    <h3 className="text-base font-semibold text-foreground">{slide.title}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        slide.active ? 'bg-[var(--green-light)] text-[var(--green)]' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {slide.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <a
                    href={slide.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 ml-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink size={13} />
                    {slide.url}
                  </a>
                  <div className="mt-1 ml-6 text-xs text-muted-foreground">
                    <strong className="text-foreground">Duração:</strong> {slide.duration_seconds}s •{' '}
                    <strong className="text-foreground">Ordem:</strong> {slide.sort_order}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleToggleActive(slide)}>
                    {slide.active ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleEdit(slide)}>
                    <Edit size={15} />
                    Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(slide)}>
                    <Trash2 size={15} />
                    Excluir
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowModal(false);
            setSelectedSlide(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedSlide ? 'Editar Slide' : 'Novo Slide'}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5">Título *</Label>
              <Input
                placeholder="Ex: Dashboard de Rede"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div>
              <Label className="mb-1.5">URL *</Label>
              <Input
                placeholder="https://..."
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <Label className="mb-1.5">Duração (segundos)</Label>
                <Input
                  type="number"
                  min={5}
                  value={formData.duration_seconds}
                  onChange={(e) => setFormData({ ...formData, duration_seconds: e.target.value })}
                />
              </div>
              <div className="flex-1">
                <Label className="mb-1.5">Ordem</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setShowModal(false);
                setSelectedSlide(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!formData.title.trim() || !formData.url.trim()}>
              <Save size={18} />
              {selectedSlide ? 'Atualizar' : 'Criar'} Slide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
