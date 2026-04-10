'use client';

import { useState, useCallback, useRef } from 'react';
import ContextPanel from '@/components/ContextPanel';
import ImageUploader from '@/components/ImageUploader';
import ImageCard from '@/components/ImageCard';
import ProgressBar from '@/components/ProgressBar';
import DownloadButton from '@/components/DownloadButton';
import type { Language, ProcessedImage, AnalysisContext } from '@/lib/types';

export default function Home() {
  const [brand, setBrand] = useState('');
  const [niche, setNiche] = useState('');
  const [url, setUrl] = useState('');
  const [language, setLanguage] = useState<Language>('ES');
  const [city, setCity] = useState('');
  const [regions, setRegions] = useState<string[]>([]);
  const [keywords, setKeywords] = useState('');
  const [siteText, setSiteText] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const scrapeAbortRef = useRef<AbortController | null>(null);
  const scrapeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const done = images.filter(i => i.status === 'done').length;
  const errors = images.filter(i => i.status === 'error').length;
  const allFinished = images.length > 0 && done + errors === images.length;

  async function handleUrlChange(value: string) {
    setUrl(value);
    setSiteText('');

    // Cancel prior timer and in-flight request
    if (scrapeTimerRef.current) clearTimeout(scrapeTimerRef.current);
    scrapeAbortRef.current?.abort();

    if (!value.trim()) return;
    try { new URL(value); } catch { return; }

    scrapeTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      scrapeAbortRef.current = controller;
      setIsScraping(true);
      try {
        const res = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: value }),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setSiteText(data.text || '');
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
      } finally {
        setIsScraping(false);
      }
    }, 800);
  }

  const handleFilesAdded = useCallback((files: File[]) => {
    const next: ProcessedImage[] = files.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending',
    }));
    setImages(prev => [...prev, ...next].slice(0, 20));
  }, []);

  async function analyzeOne(image: ProcessedImage, context: AnalysisContext) {
    setImages(prev => prev.map(i => i.id === image.id ? { ...i, status: 'analyzing', error: undefined } : i));
    try {
      const base64 = await fileToBase64(image.file);
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: image.file.type, context }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      setImages(prev => prev.map(i => i.id === image.id ? { ...i, status: 'done', result } : i));
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Error desconocido';
      setImages(prev => prev.map(i => i.id === image.id ? { ...i, status: 'error', error } : i));
    }
  }

  function buildContext(): AnalysisContext {
    return {
      niche, siteText, language,
      ...(city && { city }),
      ...(regions.length && { regions }),
      ...(keywords && { keywords }),
    };
  }

  async function handleAnalyze() {
    if (!niche.trim()) { alert('Completá la temática del sitio.'); return; }
    if (images.length === 0) { alert('Subí al menos una imagen.'); return; }

    setIsAnalyzing(true);
    const context = buildContext();
    const pending = images.filter(i => i.status === 'pending');

    try {
      for (let idx = 0; idx < pending.length; idx++) {
        if (idx > 0) await new Promise(r => setTimeout(r, 3000));
        await analyzeOne(pending[idx], context);
      }
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleRetry(id: string) {
    const image = images.find(i => i.id === id);
    if (!image) return;
    await analyzeOne(image, buildContext());
  }

  function handleReset() {
    images.forEach(i => URL.revokeObjectURL(i.previewUrl));
    setBrand(''); setNiche(''); setUrl(''); setLanguage('ES');
    setCity(''); setRegions([]); setKeywords(''); setSiteText('');
    setImages([]);
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px' }}>
          <span className="gradient-text">SEO Image Renamer</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 15 }}>
          Generá nombres y alt text optimizados para posicionamiento orgánico
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <ContextPanel
          brand={brand} niche={niche} url={url} language={language}
          city={city} regions={regions} keywords={keywords} isScraping={isScraping}
          onBrandChange={setBrand} onNicheChange={setNiche} onUrlChange={handleUrlChange}
          onLanguageChange={setLanguage} onCityChange={setCity}
          onRegionsChange={setRegions} onKeywordsChange={setKeywords}
        />

        <ImageUploader onFilesAdded={handleFilesAdded} disabled={isAnalyzing} />

        {images.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {images.map(img => <ImageCard key={img.id} image={img} onRetry={() => handleRetry(img.id)} />)}
          </div>
        )}

        {isAnalyzing && <ProgressBar total={images.length} done={done} errors={errors} />}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          {allFinished ? (
            <>
              <DownloadButton images={images} brand={brand} />
              <button
                onClick={handleReset}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 20px', color: 'var(--text)', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
              >
                Nueva consulta
              </button>
            </>
          ) : (
            <button className="btn-primary" onClick={handleAnalyze} disabled={isAnalyzing || images.length === 0} style={{ fontSize: 15, padding: '12px 28px' }}>
              {isAnalyzing ? 'Analizando...' : 'Analizar'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
