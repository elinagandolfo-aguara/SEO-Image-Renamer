# City & Regions Autocomplete — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the city text input and regions tag input with a city autocomplete (Nominatim) and a neighborhood multi-select that loads automatically when a city is picked.

**Architecture:** Two thin Next.js API routes proxy Nominatim requests (to set required User-Agent). Pure parsing logic lives in `lib/geo.ts` (tested). `CityAutocomplete` debounces at 1000ms and shows a suggestion dropdown. `RegionsSelector` fetches neighborhoods when city is selected and renders a searchable checkbox list with custom-entry fallback. `page.tsx` adds `cityMeta` state to pass `{city, state}` to `RegionsSelector`. All Task 16 auto-detection code is removed first.

**Tech Stack:** Next.js 16 App Router, TypeScript, Nominatim/OpenStreetMap (free), React Testing Library, Jest

---

## File Map

```
New:
  app/api/geo/cities/route.ts          GET ?q=miami → CityOption[]
  app/api/geo/regions/route.ts         GET ?city=Miami&state=FL → string[]
  lib/geo.ts                           parseCityOptions, parseRegionNames, NominatimItem
  components/CityAutocomplete.tsx      Debounced city search with dropdown
  components/RegionsSelector.tsx       Searchable checkbox list + custom entry
  __tests__/lib/geo.test.ts
  __tests__/components/CityAutocomplete.test.tsx
  __tests__/components/RegionsSelector.test.tsx

Modified:
  lib/types.ts                         Revert ScrapeResponse; add CityOption
  app/api/scrape/route.ts              Remove detectContext, revert to original
  app/page.tsx                         Remove autoDetected; add cityMeta state
  components/ContextPanel.tsx          Remove badges/autoDetected; wire new components
```

---

### Task 1: Revert Task 16

**Files:**
- Modify: `lib/types.ts`
- Modify: `app/api/scrape/route.ts`
- Modify: `app/page.tsx`
- Modify: `components/ContextPanel.tsx`

- [ ] **Step 1: Revertir `lib/types.ts`**

Dejar `ScrapeResponse` como estaba antes del Task 16:

```typescript
export interface ScrapeResponse {
  text: string;
}
```

- [ ] **Step 2: Revertir `app/api/scrape/route.ts`**

Reemplazar el contenido completo del archivo con la versión original (sin `detectContext` ni `GoogleGenerativeAI`):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { scrapeHomepage } from '@/lib/scraper';
import type { ScrapeRequest, ScrapeResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ScrapeRequest;
    if (!body.url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

    let parsed: URL;
    try {
      parsed = new URL(body.url);
    } catch {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'La URL debe usar http o https' }, { status: 400 });
    }

    const text = await scrapeHomepage(body.url);
    return NextResponse.json({ text } satisfies ScrapeResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scrape fallido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Revertir `app/page.tsx`**

Remover:
- El import de `ScrapeResponse` en la línea de imports de types
- El estado `autoDetected` y su tipo
- El bloque que seteaba `autoDetected` dentro de `handleUrlChange` (reemplazar con la versión simple)
- El `setAutoDetected({})` en `handleReset`
- La prop `autoDetected={autoDetected}` del JSX de `<ContextPanel>`

La función `handleUrlChange` debe quedar así (sin referencias a autoDetected ni ScrapeResponse):

```typescript
async function handleUrlChange(value: string) {
  setUrl(value);
  setSiteText('');

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
```

Y `handleReset` sin `setAutoDetected({})`:

```typescript
function handleReset() {
  images.forEach(i => URL.revokeObjectURL(i.previewUrl));
  setBrand(''); setNiche(''); setUrl(''); setLanguage('ES');
  setCity(''); setRegions([]); setKeywords(''); setSiteText('');
  setImages([]);
}
```

- [ ] **Step 4: Revertir `components/ContextPanel.tsx`**

Reemplazar el contenido completo con la versión limpia (sin `autoDetected`, sin `autoBadge`, sin badges `Auto`). El campo ciudad vuelve a ser input simple:

```typescript
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
```

- [ ] **Step 5: Correr tests para verificar que todo sigue pasando**

```bash
npm test
```

Expected: todos los tests pasan (no debería haber cambios en comportamiento)

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts app/api/scrape/route.ts app/page.tsx components/ContextPanel.tsx
git commit -m "revert: remove Task 16 auto-detection"
```

---

### Task 2: Tipos y utilidades de parsing de Nominatim

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/geo.ts`
- Create: `__tests__/lib/geo.test.ts`

- [ ] **Step 1: Agregar `CityOption` a `lib/types.ts`**

Agregar al final del archivo:

```typescript
export interface CityOption {
  label: string;  // "Miami, FL"
  city: string;   // "Miami"
  state: string;  // "FL"
}
```

- [ ] **Step 2: Escribir los tests que fallarán en `__tests__/lib/geo.test.ts`**

```typescript
import { parseCityOptions, parseRegionNames } from '@/lib/geo';
import type { NominatimItem } from '@/lib/geo';

const miamiItem: NominatimItem = {
  type: 'city',
  address: {
    city: 'Miami',
    state: 'Florida',
    'ISO3166-2-lvl4': 'US-FL',
  },
};

const townItem: NominatimItem = {
  type: 'town',
  address: {
    town: 'Homestead',
    state: 'Florida',
    'ISO3166-2-lvl4': 'US-FL',
  },
};

const suburbItem: NominatimItem = {
  type: 'suburb',
  address: {
    suburb: 'Coral Gables',
    city: 'Miami',
    state: 'Florida',
  },
};

const neighbourhoodItem: NominatimItem = {
  type: 'neighbourhood',
  address: {
    neighbourhood: 'Brickell',
    city: 'Miami',
    state: 'Florida',
  },
};

const countryItem: NominatimItem = {
  type: 'country',
  address: { state: 'Florida' },
};

describe('parseCityOptions', () => {
  it('extrae ciudad con código de estado desde ISO3166-2-lvl4', () => {
    const result = parseCityOptions([miamiItem]);
    expect(result).toEqual([{ label: 'Miami, FL', city: 'Miami', state: 'FL' }]);
  });

  it('extrae town', () => {
    const result = parseCityOptions([townItem]);
    expect(result[0].city).toBe('Homestead');
    expect(result[0].state).toBe('FL');
  });

  it('ignora items que no son city/town/village/municipality', () => {
    expect(parseCityOptions([suburbItem, countryItem])).toHaveLength(0);
  });

  it('filtra resultados sin nombre de ciudad', () => {
    const noCity: NominatimItem = { type: 'city', address: {} };
    expect(parseCityOptions([noCity])).toHaveLength(0);
  });
});

describe('parseRegionNames', () => {
  it('extrae nombres de suburb y neighbourhood', () => {
    const result = parseRegionNames([suburbItem, neighbourhoodItem]);
    expect(result).toContain('Coral Gables');
    expect(result).toContain('Brickell');
  });

  it('ignora items que no son suburb/neighbourhood/quarter/borough', () => {
    expect(parseRegionNames([miamiItem, countryItem])).toHaveLength(0);
  });

  it('deduplica nombres repetidos', () => {
    const result = parseRegionNames([suburbItem, suburbItem]);
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Correr los tests para verificar que fallan**

```bash
npm test -- --testPathPattern="geo"
```

Expected: FAIL — "Cannot find module '@/lib/geo'"

- [ ] **Step 4: Crear `lib/geo.ts`**

```typescript
export interface NominatimItem {
  type: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
    neighbourhood?: string;
    quarter?: string;
    borough?: string;
    state?: string;
    'ISO3166-2-lvl4'?: string;
  };
}

import type { CityOption } from './types';

const CITY_TYPES = ['city', 'town', 'municipality', 'village'];
const REGION_TYPES = ['suburb', 'neighbourhood', 'quarter', 'borough'];

export function parseCityOptions(items: NominatimItem[]): CityOption[] {
  return items
    .filter(item => CITY_TYPES.includes(item.type))
    .map(item => {
      const city = item.address.city || item.address.town || item.address.village || item.address.municipality || '';
      const stateCode = item.address['ISO3166-2-lvl4']?.split('-')[1] || item.address.state || '';
      return city ? { label: `${city}, ${stateCode}`, city, state: stateCode } : null;
    })
    .filter((opt): opt is CityOption => opt !== null);
}

export function parseRegionNames(items: NominatimItem[]): string[] {
  const names = items
    .filter(item => REGION_TYPES.includes(item.type))
    .map(item => {
      const a = item.address;
      return a.suburb || a.neighbourhood || a.quarter || a.borough || '';
    })
    .filter(Boolean);
  return [...new Set(names)];
}
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

```bash
npm test -- --testPathPattern="geo"
```

Expected: PASS — 7 tests pasando

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/geo.ts __tests__/lib/geo.test.ts
git commit -m "feat: add CityOption type and Nominatim parsing utilities"
```

---

### Task 3: API route `/api/geo/cities`

**Files:**
- Create: `app/api/geo/cities/route.ts`

- [ ] **Step 1: Crear `app/api/geo/cities/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { parseCityOptions } from '@/lib/geo';
import type { CityOption } from '@/lib/types';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'SEO-Image-Renamer/1.0 (internal tool)';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json([]);

  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&countrycodes=us&featureclass=P&format=json&addressdetails=1&limit=7`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return NextResponse.json([]);

    const items = await res.json();
    const options: CityOption[] = parseCityOptions(items);
    return NextResponse.json(options);
  } catch {
    return NextResponse.json([]);
  }
}
```

- [ ] **Step 2: Verificar manualmente en dev**

```bash
npm run dev
# En otra terminal:
curl "http://localhost:3000/api/geo/cities?q=miami"
```

Expected: array JSON con objetos `{ label, city, state }`. Ejemplo:
```json
[{"label":"Miami, FL","city":"Miami","state":"FL"},...]
```

- [ ] **Step 3: Commit**

```bash
git add app/api/geo/cities/route.ts
git commit -m "feat: add /api/geo/cities Nominatim proxy"
```

---

### Task 4: API route `/api/geo/regions`

**Files:**
- Create: `app/api/geo/regions/route.ts`

- [ ] **Step 1: Crear `app/api/geo/regions/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { parseRegionNames } from '@/lib/geo';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'SEO-Image-Renamer/1.0 (internal tool)';

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get('city')?.trim() ?? '';
  const state = req.nextUrl.searchParams.get('state')?.trim() ?? '';
  if (!city) return NextResponse.json([]);

  try {
    const url = `${NOMINATIM_URL}?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&countrycodes=us&featureclass=P&format=json&addressdetails=1&limit=50`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return NextResponse.json([]);

    const items = await res.json();
    const regions = parseRegionNames(items);
    return NextResponse.json(regions);
  } catch {
    return NextResponse.json([]);
  }
}
```

- [ ] **Step 2: Verificar manualmente en dev**

```bash
curl "http://localhost:3000/api/geo/regions?city=Miami&state=FL"
```

Expected: array de strings con nombres de barrios. Si Nominatim no devuelve neighborhoods para esa ciudad, devuelve `[]` (comportamiento correcto — el usuario puede agregar manualmente).

- [ ] **Step 3: Commit**

```bash
git add app/api/geo/regions/route.ts
git commit -m "feat: add /api/geo/regions Nominatim proxy"
```

---

### Task 5: Componente `CityAutocomplete`

**Files:**
- Create: `components/CityAutocomplete.tsx`
- Create: `__tests__/components/CityAutocomplete.test.tsx`

- [ ] **Step 1: Escribir los tests que fallarán**

Crear `__tests__/components/CityAutocomplete.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CityAutocomplete from '@/components/CityAutocomplete';
import type { CityOption } from '@/lib/types';

const mockOptions: CityOption[] = [
  { label: 'Miami, FL', city: 'Miami', state: 'FL' },
  { label: 'Miami Gardens, FL', city: 'Miami Gardens', state: 'FL' },
];

beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('CityAutocomplete', () => {
  // El componente es controlado: el useEffect depende del prop `value`.
  // Los tests renderizan directamente con el valor deseado en lugar de simular tipeo.

  it('no llama a la API si el texto tiene menos de 2 caracteres', () => {
    render(<CityAutocomplete value="M" onChange={jest.fn()} onSelect={jest.fn()} />);
    act(() => jest.advanceTimersByTime(1100));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('no llama a la API antes de 1000ms', () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    render(<CityAutocomplete value="mi" onChange={jest.fn()} onSelect={jest.fn()} />);
    act(() => jest.advanceTimersByTime(999));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('llama a /api/geo/cities después de 1000ms de debounce', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockOptions,
    });

    render(<CityAutocomplete value="mi" onChange={jest.fn()} onSelect={jest.fn()} />);

    await act(async () => { jest.advanceTimersByTime(1000); });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/geo/cities?q=mi'),
        expect.anything(),
      );
    });
  });

  it('muestra sugerencias después de recibir resultados', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockOptions,
    });

    render(<CityAutocomplete value="mi" onChange={jest.fn()} onSelect={jest.fn()} />);

    await act(async () => { jest.advanceTimersByTime(1000); });

    await waitFor(() => {
      expect(screen.getByText('Miami, FL')).toBeInTheDocument();
      expect(screen.getByText('Miami Gardens, FL')).toBeInTheDocument();
    });
  });

  it('llama a onSelect con la opción correcta al hacer click', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockOptions,
    });

    const onSelect = jest.fn();
    render(<CityAutocomplete value="mi" onChange={jest.fn()} onSelect={onSelect} />);

    await act(async () => { jest.advanceTimersByTime(1000); });
    await waitFor(() => screen.getByText('Miami, FL'));

    fireEvent.mouseDown(screen.getByText('Miami, FL'));
    expect(onSelect).toHaveBeenCalledWith(mockOptions[0]);
  });

  it('llama a onSelect(null) cuando se borra el campo', () => {
    const onSelect = jest.fn();
    render(<CityAutocomplete value="Miami" onChange={jest.fn()} onSelect={onSelect} />);
    const input = screen.getByPlaceholderText('Ciudad');
    fireEvent.change(input, { target: { value: '' } });
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
npm test -- --testPathPattern="CityAutocomplete"
```

Expected: FAIL — "Cannot find module '@/components/CityAutocomplete'"

- [ ] **Step 3: Crear `components/CityAutocomplete.tsx`**

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import type { CityOption } from '@/lib/types';

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none',
};

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect: (opt: CityOption | null) => void;
}

export default function CityAutocomplete({ value, onChange, onSelect }: Props) {
  const [suggestions, setSuggestions] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSuggestions([]);
    setOpen(false);

    if (value.trim().length < 2) return;

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geo/cities?q=${encodeURIComponent(value.trim())}`);
        if (res.ok) {
          const data: CityOption[] = await res.json();
          setSuggestions(data);
          setOpen(data.length > 0);
        }
      } finally {
        setLoading(false);
      }
    }, 1000);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value]);

  function handleChange(v: string) {
    onChange(v);
    if (!v.trim()) onSelect(null);
  }

  function handleSelect(opt: CityOption) {
    onChange(opt.city);
    onSelect(opt);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        style={INPUT_STYLE}
        placeholder="Ciudad"
        value={value}
        onChange={e => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {loading && (
        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--accent)' }}>
          ...
        </span>
      )}
      {open && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, marginTop: 4, padding: 4, zIndex: 10, listStyle: 'none', margin: 0,
        }}>
          {suggestions.map((opt, i) => (
            <li
              key={i}
              onMouseDown={() => handleSelect(opt)}
              style={{ padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
npm test -- --testPathPattern="CityAutocomplete"
```

Expected: PASS — 5 tests pasando

- [ ] **Step 5: Commit**

```bash
git add components/CityAutocomplete.tsx __tests__/components/CityAutocomplete.test.tsx
git commit -m "feat: add CityAutocomplete component with 1s debounce"
```

---

### Task 6: Componente `RegionsSelector`

**Files:**
- Create: `components/RegionsSelector.tsx`
- Create: `__tests__/components/RegionsSelector.test.tsx`

- [ ] **Step 1: Escribir los tests que fallarán**

Crear `__tests__/components/RegionsSelector.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegionsSelector from '@/components/RegionsSelector';

const mockRegions = ['Coral Gables', 'Brickell', 'Wynwood'];

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('RegionsSelector', () => {
  it('muestra placeholder cuando no hay ciudad seleccionada', () => {
    render(<RegionsSelector city="" state="" value={[]} onChange={jest.fn()} />);
    expect(screen.getByText('Elegí una ciudad para ver sus zonas')).toBeInTheDocument();
  });

  it('carga regiones cuando se provee ciudad', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockRegions,
    });

    render(<RegionsSelector city="Miami" state="FL" value={[]} onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Coral Gables')).toBeInTheDocument();
      expect(screen.getByText('Brickell')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/geo/regions?city=Miami&state=FL'),
    );
  });

  it('agrega región al hacer click en checkbox', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockRegions,
    });

    const onChange = jest.fn();
    render(<RegionsSelector city="Miami" state="FL" value={[]} onChange={onChange} />);

    await waitFor(() => screen.getByText('Coral Gables'));
    fireEvent.click(screen.getByText('Coral Gables'));

    expect(onChange).toHaveBeenCalledWith(['Coral Gables']);
  });

  it('remueve región al hacer click en chip ×', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true, json: async () => mockRegions,
    });

    const onChange = jest.fn();
    render(<RegionsSelector city="Miami" state="FL" value={['Coral Gables']} onChange={onChange} />);

    await waitFor(() => screen.getByText('Coral Gables'));
    fireEvent.click(screen.getByText('×'));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('agrega zona custom al presionar Enter', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true, json: async () => [],
    });

    const onChange = jest.fn();
    render(<RegionsSelector city="Miami" state="FL" value={[]} onChange={onChange} />);

    await waitFor(() => screen.getByPlaceholderText('Agregar zona custom (Enter)'));
    const customInput = screen.getByPlaceholderText('Agregar zona custom (Enter)');
    fireEvent.change(customInput, { target: { value: 'Little Haiti' } });
    fireEvent.keyDown(customInput, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['Little Haiti']);
  });

  it('filtra opciones al escribir en el buscador', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true, json: async () => mockRegions,
    });

    render(<RegionsSelector city="Miami" state="FL" value={[]} onChange={jest.fn()} />);

    await waitFor(() => screen.getByText('Coral Gables'));
    fireEvent.change(screen.getByPlaceholderText('Buscar zona...'), { target: { value: 'brick' } });

    expect(screen.queryByText('Coral Gables')).not.toBeInTheDocument();
    expect(screen.getByText('Brickell')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
npm test -- --testPathPattern="RegionsSelector"
```

Expected: FAIL — "Cannot find module '@/components/RegionsSelector'"

- [ ] **Step 3: Crear `components/RegionsSelector.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';

interface Props {
  city: string;
  state: string;
  value: string[];
  onChange: (v: string[]) => void;
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 0, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none',
};

const PLACEHOLDER_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  borderRadius: 8, color: 'var(--text-muted)', cursor: 'default',
};

export default function RegionsSelector({ city, state, value, onChange }: Props) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    setOptions([]);
    setSearch('');
    if (!city) return;

    setLoading(true);
    fetch(`/api/geo/regions?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`)
      .then(res => res.ok ? res.json() : [])
      .then((data: string[]) => setOptions(data))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [city, state]);

  if (!city) {
    return <div style={PLACEHOLDER_STYLE}>Elegí una ciudad para ver sus zonas</div>;
  }

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  function toggle(region: string) {
    onChange(value.includes(region) ? value.filter(r => r !== region) : [...value, region]);
  }

  function handleCustomKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && customInput.trim()) {
      e.preventDefault();
      if (!value.includes(customInput.trim())) onChange([...value, customInput.trim()]);
      setCustomInput('');
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <input
        style={{ ...INPUT_STYLE, borderBottom: '1px solid var(--border)' }}
        placeholder={loading ? 'Cargando zonas...' : 'Buscar zona...'}
        value={search}
        onChange={e => setSearch(e.target.value)}
        disabled={loading}
      />
      {!loading && options.length === 0 && (
        <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-muted)' }}>
          No se encontraron zonas — agregá manualmente:
        </div>
      )}
      {!loading && filtered.length > 0 && (
        <ul style={{ maxHeight: 180, overflowY: 'auto', margin: 0, padding: '4px 0', listStyle: 'none' }}>
          {filtered.map(region => (
            <li
              key={region}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}
              onClick={() => toggle(region)}
            >
              <input
                type="checkbox"
                checked={value.includes(region)}
                onChange={() => toggle(region)}
                style={{ cursor: 'pointer' }}
              />
              {region}
            </li>
          ))}
        </ul>
      )}
      <input
        style={{ ...INPUT_STYLE, borderTop: '1px solid var(--border)' }}
        placeholder="Agregar zona custom (Enter)"
        value={customInput}
        onChange={e => setCustomInput(e.target.value)}
        onKeyDown={handleCustomKey}
      />
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
          {value.map((r, i) => (
            <span key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, padding: '3px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              {r}
              <button
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

```bash
npm test -- --testPathPattern="RegionsSelector"
```

Expected: PASS — 6 tests pasando

- [ ] **Step 5: Commit**

```bash
git add components/RegionsSelector.tsx __tests__/components/RegionsSelector.test.tsx
git commit -m "feat: add RegionsSelector component with Nominatim-backed checkbox list"
```

---

### Task 7: Conectar todo en `ContextPanel` y `page.tsx`

**Files:**
- Modify: `components/ContextPanel.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Actualizar `components/ContextPanel.tsx`**

Reemplazar el contenido completo con la versión que usa los nuevos componentes:

```typescript
'use client';

import { useState } from 'react';
import type { Language, CityOption } from '@/lib/types';
import CityAutocomplete from './CityAutocomplete';
import RegionsSelector from './RegionsSelector';

interface Props {
  brand: string; niche: string; url: string; language: Language;
  city: string; cityMeta: { city: string; state: string } | null;
  regions: string[]; keywords: string; isScraping: boolean;
  onBrandChange: (v: string) => void; onNicheChange: (v: string) => void;
  onUrlChange: (v: string) => void; onLanguageChange: (v: Language) => void;
  onCityChange: (v: string) => void;
  onCitySelect: (opt: CityOption | null) => void;
  onRegionsChange: (v: string[]) => void;
  onKeywordsChange: (v: string) => void;
}

const input: React.CSSProperties = {
  width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none',
};

export default function ContextPanel({
  brand, niche, url, language, city, cityMeta, regions, keywords, isScraping,
  onBrandChange, onNicheChange, onUrlChange, onLanguageChange,
  onCityChange, onCitySelect, onRegionsChange, onKeywordsChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const filledCount = [city, regions.length > 0, keywords].filter(Boolean).length;

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
          <CityAutocomplete value={city} onChange={onCityChange} onSelect={onCitySelect} />
          <RegionsSelector
            city={cityMeta?.city ?? ''}
            state={cityMeta?.state ?? ''}
            value={regions}
            onChange={onRegionsChange}
          />
          <input style={input} placeholder="Keywords específicas (opcional)" value={keywords} onChange={e => onKeywordsChange(e.target.value)} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Actualizar `app/page.tsx`**

Agregar el import de `CityOption`:
```typescript
import type { Language, ProcessedImage, AnalysisContext, CityOption } from '@/lib/types';
```

Agregar el estado `cityMeta` junto a los otros estados:
```typescript
const [cityMeta, setCityMeta] = useState<{ city: string; state: string } | null>(null);
```

Agregar las funciones `handleCityChange` y `handleCitySelect` antes de `handleFilesAdded`:
```typescript
function handleCityChange(v: string) {
  setCity(v);
  if (!v.trim()) { setCityMeta(null); setRegions([]); }
}

function handleCitySelect(opt: CityOption | null) {
  if (opt) {
    setCity(opt.city);
    setCityMeta({ city: opt.city, state: opt.state });
  } else {
    setCityMeta(null);
    setRegions([]);
  }
}
```

Actualizar `handleReset` para limpiar `cityMeta`:
```typescript
function handleReset() {
  images.forEach(i => URL.revokeObjectURL(i.previewUrl));
  setBrand(''); setNiche(''); setUrl(''); setLanguage('ES');
  setCity(''); setCityMeta(null); setRegions([]); setKeywords(''); setSiteText('');
  setImages([]);
}
```

Actualizar el JSX de `<ContextPanel>` para pasar las nuevas props (reemplazar el bloque `<ContextPanel ... />`):
```tsx
<ContextPanel
  brand={brand} niche={niche} url={url} language={language}
  city={city} cityMeta={cityMeta} regions={regions} keywords={keywords} isScraping={isScraping}
  onBrandChange={setBrand} onNicheChange={setNiche} onUrlChange={handleUrlChange}
  onLanguageChange={setLanguage}
  onCityChange={handleCityChange}
  onCitySelect={handleCitySelect}
  onRegionsChange={setRegions} onKeywordsChange={setKeywords}
/>
```

- [ ] **Step 3: Correr todos los tests**

```bash
npm test
```

Expected: todos los tests pasan

- [ ] **Step 4: Verificar manualmente en dev**

```bash
npm run dev
```

Probar el flujo completo:
1. Abrir "Contexto adicional"
2. Tipear "Miami" en Ciudad → esperar 1s → dropdown con sugerencias
3. Seleccionar "Miami, FL" → RegionsSelector carga barrios
4. Filtrar escribiendo "coral" → aparece "Coral Gables"
5. Tildar "Coral Gables" → chip aparece
6. Agregar zona custom "Test Zone" + Enter → chip aparece
7. Click × en chip → se remueve
8. Borrar ciudad → RegionsSelector vuelve a placeholder

- [ ] **Step 5: Commit y push**

```bash
git add components/ContextPanel.tsx app/page.tsx
git commit -m "feat: wire CityAutocomplete and RegionsSelector into ContextPanel"
git push
```
