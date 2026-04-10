'use client';

import { useState } from 'react';
import type { Language } from '@/lib/types';

interface Props {
  brand: string; niche: string; url: string; language: Language;
  city: string; regions: string[]; keywords: string; isScraping: boolean;
  onBrandChange: (v: string) => void; onNicheChange: (v: string) => void;
  onUrlChange: (v: string) => void; onLanguageChange: (v: Language) => void;
  onCityChange: (v: string) => void; onRegionsChange: (v: string[]) => void;
  onKeywordsChange: (v: string) => void;
}

const input: React.CSSProperties = {
  width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14,
  outline: 'none',
};

export default function ContextPanel({
  brand, niche, url, language, city, regions, keywords, isScraping,
  onBrandChange, onNicheChange, onUrlChange, onLanguageChange,
  onCityChange, onRegionsChange, onKeywordsChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [regionInput, setRegionInput] = useState('');

  const filledCount = [city, regions.length > 0, keywords].filter(Boolean).length;

  function handleRegionKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && regionInput.trim()) {
      e.preventDefault();
      onRegionsChange([...regions, regionInput.trim()]);
      setRegionInput('');
    }
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, border: '1px solid var(--border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <input style={input} placeholder="Nombre de la marca" value={brand} onChange={e => onBrandChange(e.target.value)} />
        <input style={input} placeholder="Temática del sitio (ej: cercos de piscina)" value={niche} onChange={e => onNicheChange(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            style={{ ...input, paddingRight: isScraping ? 140 : 12 }}
            placeholder="https://www.tusitio.com"
            value={url}
            onChange={e => onUrlChange(e.target.value)}
          />
          {isScraping && (
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--accent)' }}>
              Analizando sitio...
            </span>
          )}
        </div>
        <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
          {(['ES', 'EN'] as Language[]).map(lang => (
            <button
              key={lang}
              onClick={() => onLanguageChange(lang)}
              style={{
                padding: '10px 20px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
                background: language === lang ? 'linear-gradient(135deg, var(--accent), var(--accent-end))' : 'transparent',
                color: language === lang ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      <button
        role="button"
        aria-label="Contexto adicional"
        onClick={() => setExpanded(!expanded)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▶</span>
        Contexto adicional
        {filledCount > 0 && (
          <span style={{ background: 'var(--accent)', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
            {filledCount}
          </span>
        )}
      </button>

      {expanded && (
        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          <input style={input} placeholder="Ciudad" value={city} onChange={e => onCityChange(e.target.value)} />
          <div>
            <input
              style={input}
              placeholder="Regiones (Enter para agregar)"
              value={regionInput}
              onChange={e => setRegionInput(e.target.value)}
              onKeyDown={handleRegionKey}
            />
            {regions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {regions.map((r, i) => (
                  <span key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, padding: '3px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {r}
                    <button onClick={() => onRegionsChange(regions.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <input style={input} placeholder="Keywords específicas (opcional)" value={keywords} onChange={e => onKeywordsChange(e.target.value)} />
        </div>
      )}
    </div>
  );
}
