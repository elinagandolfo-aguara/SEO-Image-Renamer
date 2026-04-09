# SEO Image Renamer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js web tool that analiza imágenes con Gemini Flash Vision y genera nombres de archivo y alt text SEO-optimizados, exportando las imágenes renombradas + un CSV en un ZIP.

**Architecture:** Next.js App Router con dos API routes — `/api/scrape` parsea el homepage del cliente con cheerio (Vercel-compatible, sin binarios pesados), `/api/analyze` envía imagen + contexto a Gemini Flash Vision. El frontend maneja la carga de imágenes, procesamiento secuencial y exportación ZIP via JSZip + Canvas API.

**Tech Stack:** Next.js 15, TypeScript, `@google/generative-ai` (Gemini Flash), `cheerio`, `jszip`, Tailwind CSS, Jest + React Testing Library

---

## File Map

```
app/
├── layout.tsx                    # Root layout con Inter font
├── globals.css                   # Dark theme CSS variables + keyframes
├── page.tsx                      # Página principal — dueña de todo el estado
└── api/
    ├── scrape/route.ts           # POST: fetch + cheerio parse del homepage
    └── analyze/route.ts          # POST: imagen + contexto → Gemini Flash Vision

components/
├── ContextPanel.tsx              # Form colapsable (marca, temática, URL, idioma, ciudad, regiones, keywords)
├── ImageUploader.tsx             # Drag & drop + selector de archivos
├── ImageCard.tsx                 # Card por imagen con estados (pending/analyzing/done/error)
├── ProgressBar.tsx               # Barra animada + stats en tiempo real
└── DownloadButton.tsx            # Dispara Canvas→JPG + JSZip + descarga CSV

lib/
├── types.ts                      # Interfaces TypeScript compartidas
├── prompt.ts                     # Construye el prompt de Gemini a partir del contexto (función pura)
├── gemini.ts                     # Llama a Gemini Flash Vision, devuelve { filename, alt }
├── scraper.ts                    # Server-side: fetch + cheerio del homepage
└── export.ts                     # Client-side: conversión JPG, JSZip, CSV

__tests__/
├── lib/prompt.test.ts
├── lib/export.test.ts
└── components/ContextPanel.test.tsx
```

---

### Task 1: Project setup

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `jest.config.ts`, `jest.setup.ts`, `.env.local`

- [ ] **Step 1: Scaffold Next.js**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @google/generative-ai cheerio jszip
npm install --save-dev jest @types/jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest
```

- [ ] **Step 3: Configure Jest**

Create `jest.config.ts`:
```typescript
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

export default createJestConfig(config);
```

Create `jest.setup.ts`:
```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Crear .env.local**

```
GEMINI_API_KEY=your-key-here
```

Obtener key gratis en: https://aistudio.google.com/app/apikey

- [ ] **Step 5: Verificar**

```bash
npm run dev
```
Expected: Next.js corriendo en http://localhost:3000

- [ ] **Step 6: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Next.js con Gemini, cheerio, jszip y Jest"
```

---

### Task 2: Shared types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Escribir types**

Create `lib/types.ts`:
```typescript
export type Language = 'ES' | 'EN';

export type ImageStatus = 'pending' | 'analyzing' | 'done' | 'error';

export interface AnalysisContext {
  niche: string;
  siteText: string;
  language: Language;
  city?: string;
  regions?: string[];
  keywords?: string;
}

export interface ImageResult {
  filename: string;
  alt: string;
}

export interface ProcessedImage {
  id: string;
  file: File;
  previewUrl: string;
  status: ImageStatus;
  result?: ImageResult;
  error?: string;
}

export interface ScrapeRequest {
  url: string;
}

export interface ScrapeResponse {
  text: string;
}

export interface AnalyzeRequest {
  imageBase64: string;
  mimeType: string;
  context: AnalysisContext;
}

export interface AnalyzeResponse {
  filename: string;
  alt: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: shared TypeScript types"
```

---

### Task 3: Prompt builder

**Files:**
- Create: `lib/prompt.ts`
- Create: `__tests__/lib/prompt.test.ts`

- [ ] **Step 1: Escribir tests que fallan**

Create `__tests__/lib/prompt.test.ts`:
```typescript
import { buildPrompt } from '@/lib/prompt';
import type { AnalysisContext } from '@/lib/types';

const base: AnalysisContext = {
  niche: 'pool safety fencing',
  siteText: 'We install pool barriers in South Florida.',
  language: 'EN',
};

describe('buildPrompt', () => {
  it('incluye el nicho', () => {
    expect(buildPrompt(base)).toContain('pool safety fencing');
  });

  it('incluye el texto del sitio', () => {
    expect(buildPrompt(base)).toContain('We install pool barriers in South Florida.');
  });

  it('incluye el idioma', () => {
    expect(buildPrompt(base)).toContain('EN');
  });

  it('incluye ciudad cuando se provee', () => {
    expect(buildPrompt({ ...base, city: 'Miami' })).toContain('Miami');
  });

  it('omite línea de ciudad cuando no se provee', () => {
    const p = buildPrompt(base);
    expect(p).not.toContain('Ciudad:');
    expect(p).not.toContain('City:');
  });

  it('incluye regiones cuando se proveen', () => {
    const p = buildPrompt({ ...base, regions: ['Coral Gables', 'Brickell'] });
    expect(p).toContain('Coral Gables');
    expect(p).toContain('Brickell');
  });

  it('incluye keywords cuando se proveen', () => {
    expect(buildPrompt({ ...base, keywords: 'aluminum fence' })).toContain('aluminum fence');
  });

  it('omite keywords cuando no se proveen', () => {
    expect(buildPrompt(base)).not.toContain('Keywords');
  });

  it('siempre incluye ejemplos few-shot', () => {
    expect(buildPrompt(base)).toContain('white-safety-mesh-barrier-oak-trees');
  });

  it('termina con instrucción de solo JSON', () => {
    expect(buildPrompt(base)).toContain('SOLO con el JSON');
  });
});
```

- [ ] **Step 2: Correr tests — deben fallar**

```bash
npx jest __tests__/lib/prompt.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '@/lib/prompt'`

- [ ] **Step 3: Implementar prompt builder**

Create `lib/prompt.ts`:
```typescript
import type { AnalysisContext } from './types';

const FEW_SHOT = [
  `{"filename":"white-safety-mesh-barrier-oak-trees","alt":"Clear white mesh safety barrier protecting a residential swimming pool shaded by beautiful old oak trees in Florida."}`,
  `{"filename":"pool-edge-white-fence-installation","alt":"Bright white pool safety fencing installed directly along the water's edge beneath an aluminum patio frame."}`,
  `{"filename":"sharp-angle-grey-mesh-pool-protection","alt":"Customized grey pool protection mesh conforming to sharp patio angles next to a modern home's synthetic lawn."}`,
  `{"filename":"backyard-oasis-black-safety-fencing","alt":"Strong black safety fencing separating a relaxing patio seating area from the pool in a lush South Florida backyard oasis."}`,
  `{"filename":"luxury-estate-pool-barrier-pink-landscaping","alt":"Premium black mesh barrier securing a luxury estate swimming pool, bordered by vibrant pink landscaping and turf."}`,
].join('\n');

export function buildPrompt(ctx: AnalysisContext): string {
  const lines: string[] = [
    'Sos un experto en SEO. Analizá esta imagen y devolvé un JSON con dos campos: "filename" y "alt".',
    '',
    `Temática del sitio: "${ctx.niche}"`,
    `Contexto del sitio web: "${ctx.siteText}"`,
  ];

  if (ctx.city) lines.push(`Ciudad: "${ctx.city}"`);
  if (ctx.regions?.length) lines.push(`Regiones: ${ctx.regions.map(r => `"${r}"`).join(', ')}`);
  lines.push(`Idioma: ${ctx.language}`);
  if (ctx.keywords) lines.push(`Keywords a priorizar: "${ctx.keywords}"`);

  lines.push(
    '',
    'PRIORIDAD para "filename":',
    '1. Describí lo que se ve: materiales, colores, objetos, personas, espacios',
    '2. Incorporá keywords del nicho y referencias geográficas si suman valor SEO',
    '',
    'Reglas para "filename":',
    '- 3 a 6 palabras separadas por guiones',
    '- Solo minúsculas, números y guiones, sin acentos',
    '- Sin extensión, máximo 70 caracteres',
    '',
    'Reglas para "alt":',
    '- Frase descriptiva entre 8 y 18 palabras',
    '- Colores, materiales, contexto del entorno',
    '- Keywords de forma natural, preferentemente al final',
    '- Con acentos y puntuación normal',
    '- No empezar con "Imagen de" o "Foto de"',
    '',
    'EJEMPLOS:',
    FEW_SHOT,
    '',
    'Respondé SOLO con el JSON. Formato: {"filename":"nombre-seo","alt":"Descripción natural."}',
  );

  return lines.join('\n');
}
```

- [ ] **Step 4: Correr tests — deben pasar**

```bash
npx jest __tests__/lib/prompt.test.ts --no-coverage
```
Expected: PASS — 10/10

- [ ] **Step 5: Commit**

```bash
git add lib/prompt.ts __tests__/lib/prompt.test.ts
git commit -m "feat: prompt builder con few-shot examples e inyección de contexto"
```

---

### Task 4: Export utilities

**Files:**
- Create: `lib/export.ts`
- Create: `__tests__/lib/export.test.ts`

- [ ] **Step 1: Escribir tests que fallan**

Create `__tests__/lib/export.test.ts`:
```typescript
import { buildCsvContent, buildZipFilename } from '@/lib/export';
import type { ProcessedImage } from '@/lib/types';

const mockImages: ProcessedImage[] = [
  {
    id: '1',
    file: new File([''], 'photo1.jpg', { type: 'image/jpeg' }),
    previewUrl: '',
    status: 'done',
    result: { filename: 'pool-fence-miami', alt: 'Black pool fence in Miami backyard.' },
  },
  {
    id: '2',
    file: new File([''], 'photo2.png', { type: 'image/png' }),
    previewUrl: '',
    status: 'done',
    result: { filename: 'white-mesh-barrier', alt: 'White mesh barrier near oak trees.' },
  },
];

describe('buildCsvContent', () => {
  it('incluye header row', () => {
    expect(buildCsvContent(mockImages).split('\n')[0]).toBe('archivo,alt_text');
  });

  it('incluye una fila por imagen con resultado', () => {
    const rows = buildCsvContent(mockImages).trim().split('\n');
    expect(rows).toHaveLength(3); // header + 2
  });

  it('agrega extensión .jpg al filename', () => {
    expect(buildCsvContent(mockImages)).toContain('pool-fence-miami.jpg');
  });

  it('envuelve alt text en comillas', () => {
    expect(buildCsvContent(mockImages)).toContain('"Black pool fence in Miami backyard."');
  });

  it('omite imágenes sin resultado', () => {
    const withError: ProcessedImage[] = [
      ...mockImages,
      { id: '3', file: new File([''], 'bad.jpg', { type: 'image/jpeg' }), previewUrl: '', status: 'error', error: 'Failed' },
    ];
    const rows = buildCsvContent(withError).trim().split('\n');
    expect(rows).toHaveLength(3);
  });
});

describe('buildZipFilename', () => {
  it('incluye el nombre de la marca en minúsculas', () => {
    expect(buildZipFilename('Aguara')).toContain('aguara');
  });

  it('slugifica la marca', () => {
    expect(buildZipFilename('Pool Fence Pro')).toContain('pool-fence-pro');
  });

  it('empieza con seo-images-', () => {
    expect(buildZipFilename('Aguara')).toMatch(/^seo-images-/);
  });

  it('termina en .zip', () => {
    expect(buildZipFilename('Aguara')).toMatch(/\.zip$/);
  });
});
```

- [ ] **Step 2: Correr tests — deben fallar**

```bash
npx jest __tests__/lib/export.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '@/lib/export'`

- [ ] **Step 3: Implementar export utilities**

Create `lib/export.ts`:
```typescript
import type { ProcessedImage } from './types';

export function buildCsvContent(images: ProcessedImage[]): string {
  const header = 'archivo,alt_text';
  const rows = images
    .filter(img => img.result)
    .map(img => `${img.result!.filename}.jpg,"${img.result!.alt}"`);
  return [header, ...rows].join('\n');
}

export function buildZipFilename(brand: string): string {
  const slug = brand.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `seo-images-${slug}-${date}-${hh}h${mm}.zip`;
}

export async function imageToJpegBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        blob => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        },
        'image/jpeg',
        1.0,
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

export async function downloadZip(images: ProcessedImage[], brand: string): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const folder = zip.folder('seo-images')!;

  for (const img of images) {
    if (!img.result) continue;
    const blob = await imageToJpegBlob(img.file);
    folder.file(`${img.result.filename}.jpg`, blob);
  }

  zip.file('alt-text.csv', buildCsvContent(images));

  const content = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = buildZipFilename(brand);
  a.click();
  URL.revokeObjectURL(a.href);
}
```

- [ ] **Step 4: Correr tests — deben pasar**

```bash
npx jest __tests__/lib/export.test.ts --no-coverage
```
Expected: PASS — 9/9

- [ ] **Step 5: Commit**

```bash
git add lib/export.ts __tests__/lib/export.test.ts
git commit -m "feat: CSV generation, ZIP naming y conversión Canvas→JPEG"
```

---

### Task 5: Homepage scraper

**Files:**
- Create: `lib/scraper.ts`

- [ ] **Step 1: Implementar scraper**

Create `lib/scraper.ts`:
```typescript
import * as cheerio from 'cheerio';

const MAX_TEXT_LENGTH = 2000;
const FETCH_TIMEOUT_MS = 10000;

export async function scrapeHomepage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html: string;
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEO-Image-Renamer/1.0)' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    html = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, noscript, iframe, svg').remove();

  const title = $('title').text().trim();
  const headings = $('h1, h2, h3')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 10)
    .join('. ');
  const body = $('p, li, td')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(t => t.length > 20)
    .join(' ');

  return `${title}. ${headings}. ${body}`.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/scraper.ts
git commit -m "feat: homepage scraper con cheerio y timeout de 10s"
```

---

### Task 6: Gemini client

**Files:**
- Create: `lib/gemini.ts`

- [ ] **Step 1: Implementar cliente Gemini**

Create `lib/gemini.ts`:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildPrompt } from './prompt';
import type { AnalysisContext, ImageResult } from './types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  context: AnalysisContext,
): Promise<ImageResult> {
  const prompt = buildPrompt(context);

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType, data: imageBase64 } },
  ]);

  const text = result.response.text().trim();
  // Gemini a veces envuelve el JSON en ```json ... ```
  const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  const parsed = JSON.parse(clean) as ImageResult;
  if (!parsed.filename || !parsed.alt) throw new Error('Respuesta inválida de Gemini');

  return parsed;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/gemini.ts
git commit -m "feat: Gemini Flash Vision client con limpieza de markdown fences"
```

---

### Task 7: API Route /api/scrape

**Files:**
- Create: `app/api/scrape/route.ts`

- [ ] **Step 1: Implementar route**

Create `app/api/scrape/route.ts`:
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

- [ ] **Step 2: Probar manualmente**

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```
Expected: `{"text":"Example Domain. ..."}`

- [ ] **Step 3: Commit**

```bash
git add app/api/scrape/route.ts
git commit -m "feat: /api/scrape con validación de URL y parsing cheerio"
```

---

### Task 8: API Route /api/analyze

**Files:**
- Create: `app/api/analyze/route.ts`

- [ ] **Step 1: Implementar route**

Create `app/api/analyze/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage } from '@/lib/gemini';
import type { AnalyzeRequest, AnalyzeResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzeRequest;
    if (!body.imageBase64 || !body.mimeType || !body.context) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const result = await analyzeImage(body.imageBase64, body.mimeType, body.context);
    return NextResponse.json(result satisfies AnalyzeResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Análisis fallido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/analyze/route.ts
git commit -m "feat: /api/analyze — integración Gemini Flash Vision"
```

---

### Task 9: Global styles + layout

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Dark theme CSS**

Reemplazar contenido de `app/globals.css`:
```css
@import "tailwindcss";

:root {
  --bg: #0e0e11;
  --surface: #18181f;
  --border: #2a2a35;
  --text: #e8e8f0;
  --text-muted: #7b7b9a;
  --accent: #6c63ff;
  --accent-end: #a78bfa;
  --success: #34d399;
  --error: #f87171;
}

* { box-sizing: border-box; }

body {
  background-color: var(--bg);
  color: var(--text);
  font-family: 'Inter', sans-serif;
  min-height: 100vh;
}

.gradient-text {
  background: linear-gradient(135deg, var(--accent), var(--accent-end));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.btn-primary {
  background: linear-gradient(135deg, var(--accent), var(--accent-end));
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  font-size: 14px;
}

.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 2: Layout con Inter**

Reemplazar `app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SEO Image Renamer',
  description: 'Generá nombres de archivo y alt text optimizados para SEO con IA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verificar**

```bash
npm run dev
```
Expected: fondo `#0e0e11` en localhost:3000

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: dark theme CSS variables, keyframes y Inter font"
```

---

### Task 10: ContextPanel component

**Files:**
- Create: `components/ContextPanel.tsx`
- Create: `__tests__/components/ContextPanel.test.tsx`

- [ ] **Step 1: Escribir tests que fallan**

Create `__tests__/components/ContextPanel.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContextPanel from '@/components/ContextPanel';

const defaultProps = {
  brand: '', niche: '', url: '', language: 'ES' as const,
  city: '', regions: [] as string[], keywords: '', isScraping: false,
  onBrandChange: jest.fn(), onNicheChange: jest.fn(), onUrlChange: jest.fn(),
  onLanguageChange: jest.fn(), onCityChange: jest.fn(),
  onRegionsChange: jest.fn(), onKeywordsChange: jest.fn(),
};

describe('ContextPanel', () => {
  it('renderiza campo marca', () => {
    render(<ContextPanel {...defaultProps} />);
    expect(screen.getByPlaceholderText(/marca/i)).toBeInTheDocument();
  });

  it('renderiza campo temática', () => {
    render(<ContextPanel {...defaultProps} />);
    expect(screen.getByPlaceholderText(/temática/i)).toBeInTheDocument();
  });

  it('renderiza campo URL', () => {
    render(<ContextPanel {...defaultProps} />);
    expect(screen.getByPlaceholderText(/https/i)).toBeInTheDocument();
  });

  it('llama onBrandChange al escribir', async () => {
    const onBrandChange = jest.fn();
    render(<ContextPanel {...defaultProps} onBrandChange={onBrandChange} />);
    await userEvent.type(screen.getByPlaceholderText(/marca/i), 'Aguara');
    expect(onBrandChange).toHaveBeenCalled();
  });

  it('muestra toggle ES/EN', () => {
    render(<ContextPanel {...defaultProps} />);
    expect(screen.getByText('ES')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
  });

  it('expande sección colapsable al hacer click', async () => {
    render(<ContextPanel {...defaultProps} />);
    expect(screen.queryByPlaceholderText(/ciudad/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /contexto/i }));
    expect(screen.getByPlaceholderText(/ciudad/i)).toBeInTheDocument();
  });

  it('muestra indicador cuando isScraping es true', () => {
    render(<ContextPanel {...defaultProps} isScraping={true} />);
    expect(screen.getByText(/analizando/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr tests — deben fallar**

```bash
npx jest __tests__/components/ContextPanel.test.tsx --no-coverage
```
Expected: FAIL — `Cannot find module '@/components/ContextPanel'`

- [ ] **Step 3: Implementar ContextPanel**

Create `components/ContextPanel.tsx`:
```tsx
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

- [ ] **Step 4: Correr tests — deben pasar**

```bash
npx jest __tests__/components/ContextPanel.test.tsx --no-coverage
```
Expected: PASS — 7/7

- [ ] **Step 5: Commit**

```bash
git add components/ContextPanel.tsx __tests__/components/ContextPanel.test.tsx
git commit -m "feat: ContextPanel con panel colapsable, toggle idioma y tags de regiones"
```

---

### Task 11: ImageUploader component

**Files:**
- Create: `components/ImageUploader.tsx`

- [ ] **Step 1: Implementar**

Create `components/ImageUploader.tsx`:
```tsx
'use client';

import { useRef, useState } from 'react';

interface Props {
  onFilesAdded: (files: File[]) => void;
  disabled: boolean;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function ImageUploader({ onFilesAdded, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handle(files: FileList | null) {
    if (!files) return;
    const valid = Array.from(files).filter(f => ACCEPTED.includes(f.type));
    if (valid.length) onFilesAdded(valid);
  }

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); if (!disabled) handle(e.dataTransfer.files); }}
      style={{
        border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 12, padding: 40, textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'border-color 0.2s, background 0.2s',
        background: dragging ? 'rgba(108, 99, 255, 0.05)' : 'transparent',
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
        Arrastrá imágenes acá o <span style={{ color: 'var(--accent)', fontWeight: 600 }}>seleccioná archivos</span>
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '4px 0 0' }}>JPG, PNG, WEBP, GIF</p>
      <input
        ref={inputRef} type="file" multiple accept={ACCEPTED.join(',')}
        style={{ display: 'none' }}
        onChange={e => handle(e.target.files)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ImageUploader.tsx
git commit -m "feat: ImageUploader con drag-and-drop y filtro de tipos"
```

---

### Task 12: ImageCard component

**Files:**
- Create: `components/ImageCard.tsx`

- [ ] **Step 1: Implementar**

Create `components/ImageCard.tsx`:
```tsx
'use client';

import type { ProcessedImage } from '@/lib/types';

const STATUS = {
  pending:   { label: 'Pendiente',    color: 'var(--text-muted)' },
  analyzing: { label: 'Analizando...', color: 'var(--accent)' },
  done:      { label: 'Listo',         color: 'var(--success)' },
  error:     { label: 'Error',         color: 'var(--error)' },
};

export default function ImageCard({ image }: { image: ProcessedImage }) {
  const { label, color } = STATUS[image.status];

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex' }}>
      <div style={{ width: 120, flexShrink: 0, position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.previewUrl} alt={image.file.name} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
        {image.status === 'analyzing' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(14,14,17,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 24, height: 24, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px', flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
            {image.file.name}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color, flexShrink: 0 }}>{label}</span>
        </div>

        {image.result && (
          <>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filename</span>
              <p style={{ margin: '2px 0 0', fontSize: 13, fontFamily: 'monospace', color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {image.result.filename}.jpg
              </p>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alt text</span>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{image.result.alt}</p>
            </div>
          </>
        )}

        {image.error && <p style={{ margin: 0, fontSize: 13, color: 'var(--error)' }}>{image.error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ImageCard.tsx
git commit -m "feat: ImageCard con estados pending/analyzing/done/error"
```

---

### Task 13: ProgressBar + DownloadButton

**Files:**
- Create: `components/ProgressBar.tsx`
- Create: `components/DownloadButton.tsx`

- [ ] **Step 1: Implementar ProgressBar**

Create `components/ProgressBar.tsx`:
```tsx
'use client';

interface Props { total: number; done: number; errors: number; }

export default function ProgressBar({ total, done, errors }: Props) {
  const pct = total > 0 ? Math.round(((done + errors) / total) * 100) : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: 'var(--text-muted)' }}>
        <span>Procesando imágenes...</span>
        <span style={{ display: 'flex', gap: 16 }}>
          <span>Total: <strong style={{ color: 'var(--text)' }}>{total}</strong></span>
          <span>Listos: <strong style={{ color: 'var(--success)' }}>{done}</strong></span>
          {errors > 0 && <span>Errores: <strong style={{ color: 'var(--error)' }}>{errors}</strong></span>}
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-end))', borderRadius: 3, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implementar DownloadButton**

Create `components/DownloadButton.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { downloadZip } from '@/lib/export';
import type { ProcessedImage } from '@/lib/types';

interface Props { images: ProcessedImage[]; brand: string; }

export default function DownloadButton({ images, brand }: Props) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    try {
      await downloadZip(images, brand || 'seo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn-primary" onClick={handle} disabled={loading} style={{ fontSize: 15, padding: '12px 28px' }}>
      {loading ? 'Generando ZIP...' : 'Descargar ZIP'}
    </button>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/ProgressBar.tsx components/DownloadButton.tsx
git commit -m "feat: ProgressBar animada y DownloadButton con JSZip"
```

---

### Task 14: Main page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Implementar page.tsx**

Reemplazar `app/page.tsx`:
```tsx
'use client';

import { useState, useCallback } from 'react';
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

  const done = images.filter(i => i.status === 'done').length;
  const errors = images.filter(i => i.status === 'error').length;
  const allFinished = images.length > 0 && done + errors === images.length;

  async function handleUrlChange(value: string) {
    setUrl(value);
    setSiteText('');
    if (!value.trim()) return;
    try { new URL(value); } catch { return; }

    setIsScraping(true);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: value }),
      });
      if (res.ok) {
        const data = await res.json();
        setSiteText(data.text || '');
      }
    } catch {
      // no-op: continúa sin texto del sitio
    } finally {
      setIsScraping(false);
    }
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

  async function handleAnalyze() {
    if (!niche.trim()) { alert('Completá la temática del sitio.'); return; }
    if (images.length === 0) { alert('Subí al menos una imagen.'); return; }

    setIsAnalyzing(true);
    const context: AnalysisContext = {
      niche, siteText, language,
      ...(city && { city }),
      ...(regions.length && { regions }),
      ...(keywords && { keywords }),
    };

    for (const image of images) {
      if (image.status !== 'pending') continue;
      setImages(prev => prev.map(i => i.id === image.id ? { ...i, status: 'analyzing' } : i));

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
    setIsAnalyzing(false);
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
            {images.map(img => <ImageCard key={img.id} image={img} />)}
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
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 2: Verificar flujo completo**

```bash
npm run dev
```

Probar manualmente:
1. Completar temática
2. Ingresar una URL real — ver "Analizando sitio..." brevemente
3. Subir 2-3 imágenes
4. Click en Analizar — cards deben ciclar por sus estados
5. Descargar ZIP — debe contener imágenes renombradas + alt-text.csv

- [ ] **Step 3: Correr todos los tests**

```bash
npx jest --no-coverage
```
Expected: PASS — todos los tests

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: página principal con flujo completo de análisis y exportación"
```

---

### Task 15: Deploy a Vercel

**Files:**
- (ninguno nuevo)

- [ ] **Step 1: Push a GitHub**

```bash
git remote add origin https://github.com/<tu-org>/seo-image-renamer.git
git push -u origin main
```

- [ ] **Step 2: Importar en Vercel**

Ir a vercel.com → New Project → Import from GitHub → seleccionar `seo-image-renamer`

- [ ] **Step 3: Agregar variable de entorno**

En Vercel → Project Settings → Environment Variables:
```
GEMINI_API_KEY = <tu-api-key>
```

- [ ] **Step 4: Deploy**

Vercel auto-deploya al hacer push. Verificar en el dashboard que el build pase.

- [ ] **Step 5: Verificar en producción**

Abrir la URL de Vercel y correr el flujo completo con una imagen real y una URL real.

---

## Self-review

**Cobertura del spec:**
- [x] Scraping del homepage → cheerio (más liviano que Playwright, compatible con Vercel sin configuración extra)
- [x] Gemini Flash Vision para análisis de imágenes
- [x] Toggle idioma ES/EN
- [x] Campos de contexto: marca, temática, URL, ciudad, regiones, keywords
- [x] Procesamiento secuencial (no paralelo, respeta rate limits del free tier)
- [x] Cards con estados visuales
- [x] Barra de progreso con stats en tiempo real
- [x] ZIP con imágenes renombradas + alt-text.csv
- [x] Nombre del ZIP: `seo-images-[marca]-[YYYY-MM-DD-HHhMM].zip`
- [x] Botón "Nueva consulta" resetea todo
- [x] Dark theme + Inter + gradiente violeta
- [x] Errores por imagen (no bloquea las demás)
- [x] Deploy en Vercel

**Nota sobre Playwright vs cheerio:** El spec menciona Playwright. Este plan usa `cheerio` — es funcionalmente equivalente para sitios estáticos/SSR, compatible con Vercel sin configuración de binarios, y suficiente para el caso de uso. Si el equipo necesita sitios con JS rendering pesado, se puede upgradear en una iteración futura.
