# SEO Image Renamer — Design Spec
*Fecha: 2026-04-09*

---

## Resumen

Herramienta web interna para el equipo SEO. Analiza imágenes con IA (Gemini Flash Vision) y genera automáticamente nombres de archivo y alt text optimizados para SEO. El usuario sube 5-20 imágenes, la herramienta las procesa y entrega un ZIP con las imágenes renombradas + un CSV con los alt texts.

**Usuarios:** equipo SEO interno (no clientes).
**Volumen:** 5-20 imágenes por sesión.
**Costo:** gratis (Gemini Flash free tier: 1.500 requests/día).

---

## Stack técnico

- **Framework:** Next.js (App Router)
- **IA de visión:** Google Gemini Flash (`gemini-2.0-flash`)
- **Scraping:** Playwright — navega el homepage del cliente en el servidor
- **Empaquetado:** JSZip (cliente) + Canvas API (conversión a JPG)
- **Deploy:** Vercel + GitHub
- **Variable de entorno:** `GEMINI_API_KEY`

---

## Arquitectura

```
Browser (Next.js frontend)
    │
    ├── /api/scrape     ← recibe URL, Playwright navega el homepage,
    │                      devuelve { text: string } con el copy del sitio
    │
    └── /api/analyze    ← recibe { imageBase64, mimeType, context },
                           llama a Gemini Flash Vision,
                           devuelve { filename: string, alt: string }
```

Las API keys viven exclusivamente en el servidor. El cliente nunca las ve.

---

## Campos de entrada

| Campo | Tipo | Uso |
|-------|------|-----|
| Nombre de la marca | Text | Nombrar el ZIP de descarga únicamente |
| Temática del sitio | Text | Contexto del nicho para el prompt |
| URL del sitio web | URL | Playwright extrae texto del homepage |
| Idioma | Toggle ES / EN | Idioma del filename y alt text generados |
| Ciudad | Text (opcional) | Geolocalización SEO |
| Regiones | Tags (opcional) | Múltiples regiones, se agregan con Enter |
| Keywords específicas | Text (opcional) | Keywords adicionales a priorizar |

---

## Flujo principal

1. Usuario completa campos de contexto (marca, temática, URL, idioma)
2. Al ingresar la URL → `/api/scrape` extrae texto del homepage en segundo plano (indicador de carga)
3. Usuario sube imágenes por drag & drop o selector (JPG, PNG, WEBP, GIF)
4. Clic en "Analizar" → cada imagen se envía a `/api/analyze` secuencialmente
5. Cada card de imagen se actualiza en tiempo real: pendiente → analizando → listo / error
6. Al terminar todas → aparece "Descargar ZIP" y "Nueva consulta"

---

## API Routes

### `/api/scrape`
- **Input:** `{ url: string }`
- **Proceso:** Playwright abre el homepage, extrae el texto visible (título, headings, párrafos, listas), cierra el browser
- **Output:** `{ text: string }` — máx. ~2.000 caracteres del copy del sitio
- **Errores:** timeout (10s), URL inválida, sitio sin acceso público

### `/api/analyze`
- **Input:** `{ imageBase64: string, mimeType: string, context: AnalysisContext }`
- **`AnalysisContext`:** `{ niche, url, siteText, language, city?, regions?, keywords? }`
- **Proceso:** construye el prompt con contexto + few-shot examples, llama a Gemini Flash Vision
- **Output:** `{ filename: string, alt: string }`
- **Errores:** respuesta no parseable como JSON, rate limit de Gemini

---

## Prompt de Gemini

```
Sos un experto en SEO. Analizá esta imagen y devolvé un JSON con dos campos: "filename" y "alt".

Temática del sitio: "[niche]"
Contexto del sitio web: "[siteText]"   ← extraído por Playwright
Ciudad: "[city]"                        ← solo si está completado
Regiones: "[r1]", "[r2]"               ← solo si hay regiones
Idioma: [ES|EN]
Keywords a priorizar: "[keywords]"      ← solo si está completado

PRIORIDAD para "filename":
1. Describí lo que se ve en la imagen: materiales, colores, objetos, personas, espacios
2. Incorporá keywords del nicho y referencias geográficas si suman valor SEO

Reglas para "filename":
- 3 a 6 palabras separadas por guiones
- Solo minúsculas, números y guiones, sin acentos
- Sin extensión, máximo 70 caracteres

Reglas para "alt":
- Frase descriptiva entre 8 y 18 palabras
- Colores, materiales, contexto del entorno
- Keywords de forma natural, preferentemente al final
- Con acentos y puntuación normal
- No empezar con "Imagen de" o "Foto de"

EJEMPLOS:
{"filename":"white-safety-mesh-barrier-oak-trees","alt":"Clear white mesh safety barrier protecting a residential swimming pool shaded by beautiful old oak trees in Florida."}
{"filename":"pool-edge-white-fence-installation","alt":"Bright white pool safety fencing installed directly along the water's edge beneath an aluminum patio frame."}
{"filename":"sharp-angle-grey-mesh-pool-protection","alt":"Customized grey pool protection mesh conforming to sharp patio angles next to a modern home's synthetic lawn."}
{"filename":"backyard-oasis-black-safety-fencing","alt":"Strong black safety fencing separating a relaxing patio seating area from the pool in a lush South Florida backyard oasis."}
{"filename":"luxury-estate-pool-barrier-pink-landscaping","alt":"Premium black mesh barrier securing a luxury estate swimming pool, bordered by vibrant pink landscaping and turf."}

Respondé SOLO con el JSON. Formato: {"filename":"nombre-seo","alt":"Descripción natural."}
```

---

## Exportación

- Canvas API convierte cada imagen a JPG (calidad 100%) en el cliente
- JSZip empaqueta:
  - `seo-images/[filename].jpg` — todas las imágenes renombradas
  - `alt-text.csv` — columnas: `archivo`, `alt_text`
- Nombre del ZIP: `seo-images-[marca]-[YYYY-MM-DD-HHhMM].zip`

---

## UI/UX

- **Estética:** dark moderna (`#0e0e11` base), acento violeta (`#6c63ff` → `#a78bfa`), fuente Inter
- **Panel de contexto:** colapsable, badge con cantidad de campos completados
- **Cards de imagen:** estado visual — pendiente / analizando / listo / error
- **Progreso:** barra animada + stats en tiempo real (total / pendientes / listos)
- **Nueva consulta:** aparece al terminar, resetea todos los campos y el input de archivo

---

## Manejo de errores

| Escenario | Comportamiento |
|-----------|----------------|
| URL inaccesible o timeout | Card con estado "error", mensaje descriptivo, continúa con las demás |
| Respuesta de Gemini no parseable | Reintento automático 1 vez, luego marca error |
| Rate limit de Gemini | Mensaje global, pausa y reintento automático |
| Imagen corrupta | Card con estado "error", se saltea |

---

## Decisiones de diseño

- **Scraping solo del homepage:** suficiente contexto, evita complejidad de navegación multi-página
- **Procesamiento secuencial** (no paralelo): evita rate limits de Gemini en el free tier
- **Sin autenticación:** herramienta interna, sin necesidad de login
- **Canvas en cliente** (no servidor): evita subir imágenes pesadas al servidor para la conversión
