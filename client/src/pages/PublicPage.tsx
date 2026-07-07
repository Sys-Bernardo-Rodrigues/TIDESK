import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { ExternalLink, FileText } from 'lucide-react';

interface PageButton {
  id: number;
  label: string;
  formId?: number;
  formUrl?: string;
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
  content: string | null;
  buttons: PageButton[];
}

export default function PublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPage = async () => {
      try {
        const response = await axios.get(`/api/pages/public/${slug}`);
        setPage(response.data);
      } catch (error: any) {
        console.error('Erro ao buscar página:', error);
        if (error.response?.status === 404) {
          setError('Página não encontrada');
        } else {
          setError('Erro ao carregar página');
        }
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchPage();
    }
  }, [slug]);

  const handleButtonClick = (button: PageButton) => {
    if (button.formUrl) {
      window.location.href = `/form/${button.formUrl}`;
    } else if (button.url) {
      window.open(button.url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-10">
        <div className="text-center">
          <FileText size={44} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Carregando página...</p>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-10">
        <div className="text-center">
          <FileText size={44} className="mx-auto mb-3 text-destructive" />
          <h1 className="mb-2 text-3xl font-bold text-foreground">{error || 'Página não encontrada'}</h1>
          <p className="text-muted-foreground">A página que você está procurando não existe ou foi removida.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-10">
      <div className="flex w-full max-w-3xl flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="mb-3 text-4xl leading-tight font-extrabold text-foreground sm:text-5xl">{page.title}</h1>
          {page.description && <p className="text-lg leading-relaxed text-muted-foreground">{page.description}</p>}
        </div>

        {/* Content */}
        {page.content && (
          <div className="leading-relaxed text-foreground" dangerouslySetInnerHTML={{ __html: page.content }} />
        )}

        {/* Buttons */}
        {page.buttons && page.buttons.length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            {page.buttons.map((button) => {
              const sizeClass = {
                small: 'px-4 py-2 text-sm',
                medium: 'px-6 py-3 text-base',
                large: 'px-8 py-4 text-lg',
              }[button.style?.size || 'medium'];

              return (
                <button
                  key={button.id}
                  className={`flex w-full items-center justify-center gap-1.5 rounded-lg font-semibold transition-all hover:-translate-y-0.5 hover:opacity-90 ${sizeClass}`}
                  style={{
                    backgroundColor: button.style?.backgroundColor || 'var(--purple)',
                    color: button.style?.color || '#FFFFFF',
                  }}
                  onClick={() => handleButtonClick(button)}
                >
                  {button.label}
                  {button.formUrl && <ExternalLink size={17} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
