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
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        padding: 'var(--spacing-2xl)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <FileText size={48} color="var(--text-tertiary)" style={{ marginBottom: 'var(--spacing-md)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Carregando página...</p>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        padding: 'var(--spacing-2xl)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <FileText size={48} color="var(--red)" style={{ marginBottom: 'var(--spacing-md)' }} />
          <h1 style={{ 
            fontSize: '2rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-sm)'
          }}>
            {error || 'Página não encontrada'}
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            A página que você está procurando não existe ou foi removida.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      padding: 'var(--spacing-2xl)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ 
        maxWidth: '800px', 
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xl)'
      }}>
        {/* Header */}
        <div>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: '800',
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-md)',
            lineHeight: '1.2'
          }}>
            {page.title}
          </h1>
          {page.description && (
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '1.125rem',
              lineHeight: '1.6'
            }}>
              {page.description}
            </p>
          )}
        </div>

        {/* Content */}
        {page.content && (
          <div 
            style={{
              color: 'var(--text-primary)',
              lineHeight: '1.8',
              fontSize: '1rem'
            }}
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        )}

        {/* Buttons */}
        {page.buttons && page.buttons.length > 0 && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: 'var(--spacing-md)',
            marginTop: 'var(--spacing-lg)'
          }}>
            {page.buttons.map((button) => {
              const sizeMap = {
                small: { padding: 'var(--spacing-xs) var(--spacing-md)', fontSize: '0.875rem' },
                medium: { padding: 'var(--spacing-sm) var(--spacing-lg)', fontSize: '1rem' },
                large: { padding: 'var(--spacing-md) var(--spacing-xl)', fontSize: '1.125rem' }
              };
              const size = sizeMap[button.style?.size || 'medium'];
              
              return (
                <button
                  key={button.id}
                  className="btn"
                  style={{
                    backgroundColor: button.style?.backgroundColor || 'var(--purple)',
                    color: button.style?.color || '#FFFFFF',
                    ...size,
                    width: '100%',
                    justifyContent: 'center',
                    fontWeight: '600',
                    transition: 'all var(--transition-base)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  onClick={() => handleButtonClick(button)}
                >
                  {button.label}
                  {button.formUrl && <ExternalLink size={18} style={{ marginLeft: 'var(--spacing-xs)' }} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
