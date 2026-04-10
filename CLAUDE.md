@AGENTS.md

# SEO Image Renamer — Contexto técnico del proyecto

Herramienta interna para el equipo SEO de Aguara. Analiza imágenes con Gemini Vision y genera nombres de archivo y alt text optimizados para SEO. Exporta las imágenes renombradas + CSV en un ZIP.

**Producción:** https://seo-image-renamer.vercel.app
**Stack:** Next.js 16 App Router, TypeScript, Tailwind, `@google/generative-ai`, `cheerio`, `jszip`
**Modelo IA:** `gemini-2.5-flash-lite` (free tier)
**Variable de entorno:** `GEMINI_API_KEY` (configurada en Vercel)

---

## Flujo principal

```
URL del cliente → /api/scrape → texto del homepage
Imágenes + contexto → /api/analyze → { filename, alt }
Frontend → procesa secuencialmente con 3s de delay
DownloadButton → Canvas API → JPG + JSZip + CSV
```

---

## Archivos clave

### `lib/types.ts`
Todas las interfaces TypeScript del proyecto:
- `AnalysisContext` — contexto que se pasa a Gemini: `niche`, `siteText`, `language`, `city?`, `regions?`, `keywords?`
- `ProcessedImage` — estado de cada imagen en el frontend: `id`, `file`, `previewUrl`, `status` (pending/analyzing/done/error), `result?`, `error?`
- `ScrapeRequest / ScrapeResponse` — `{ url }` → `{ text }`
- `AnalyzeRequest / AnalyzeResponse` — `{ imageBase64, mimeType, context }` → `{ filename, alt }`

### `lib/prompt.ts`
Función pura `buildPrompt(ctx: AnalysisContext): string`. Construye el prompt para Gemini con few-shot examples. Reglas: filename 3-6 palabras con guiones sin acentos, alt 8-18 palabras descriptivas.

### `lib/gemini.ts`
`analyzeImage(imageBase64, mimeType, context)` — llama a `gemini-2.5-flash-lite` con imagen + prompt. Tiene retry automático para errores 429/503: espera 5s, luego 15s.

### `lib/scraper.ts`
`scrapeHomepage(url)` — fetch del homepage con 10s timeout + cheerio para extraer título, headings (h1-h3) y párrafos. Devuelve texto limpio truncado a 2000 chars.

### `app/api/scrape/route.ts`
POST handler. Valida URL, llama a `scrapeHomepage`, devuelve `ScrapeResponse`.

### `app/api/analyze/route.ts`
POST handler. Valida campos, acepta jpeg/png/webp/gif, límite 10MB, llama a `analyzeImage`.

### `app/page.tsx`
Dueño de todo el estado: imágenes, contexto del formulario, progreso. Orquesta el procesamiento secuencial con 3s de delay entre imágenes.

### `components/ContextPanel.tsx`
Formulario colapsable con campos: marca, temática (niche), URL del sitio, idioma, ciudad, regiones, keywords.

### `components/ImageCard.tsx`
Card por imagen con estados visuales (pending/analyzing/done/error) y botón ↻ retry para re-analizar solo esa imagen.

### `components/DownloadButton.tsx`
Exportación: Canvas API para convertir a JPG, JSZip para empaquetar imágenes + CSV.

---

## Convenciones importantes

- El procesamiento es **siempre secuencial** (no paralelo) — 3s de delay entre llamadas para respetar el rate limit del free tier
- El frontend convierte imágenes a base64 antes de enviar a `/api/analyze`
- Gemini devuelve JSON puro; el código limpia markdown fences antes de `JSON.parse`
- Los campos opcionales de `AnalysisContext` (`city`, `regions`, `keywords`) solo se agregan al prompt si tienen valor
