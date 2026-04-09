# CLAUDE.md — SEO Image Renamer

## Descripción del proyecto

Herramienta web que analiza imágenes con IA y genera automáticamente nombres de archivo y alt text optimizados para SEO. El objetivo es mejorar el posicionamiento orgánico de sitios web a través de la correcta nomenclatura de sus assets visuales.

---

## Stack técnico

- **Framework:** Next.js (App Router)
- **IA de visión:** Google Gemini Flash (gratis, hasta 1.500 requests/día)
- **Scraping:** Playwright — navega el homepage del cliente en el servidor
- **API Routes:** Next.js API routes para Gemini y Playwright (la API key nunca toca el cliente)
- **Empaquetado:** JSZip + Canvas API (conversión a JPG en el cliente)
- **Deploy:** Vercel + GitHub

### Variables de entorno

```
GEMINI_API_KEY=...
```

---

## Arquitectura

```
Browser (Next.js frontend)
    │
    ├── /api/scrape     ← recibe URL del sitio del cliente, navega el homepage
    │                      con Playwright, devuelve texto limpio del sitio
    │
    └── /api/analyze    ← recibe imagen (base64) + contexto combinado,
                           llama a Gemini Flash Vision,
                           devuelve { filename, alt }
```

---

## Funcionalidades del MVP

### Campos de entrada

- **Nombre de la marca** — se usa únicamente para nombrar el ZIP de descarga. No aparece en nombres de archivo ni en alt text.
- **Temática del sitio** — describe el nicho o industria del cliente.
- **URL del sitio web** — Playwright navega el homepage y extrae texto de contexto (servicios, ubicación, keywords naturales del copy). Solo homepage.
- **Toggle de idioma** — Español / Inglés. Determina el idioma de todas las keywords generadas.
- **Contexto del cliente** (panel colapsable):
  - Ciudad
  - Regiones múltiples (input con tags, se agregan con Enter y son removibles)
  - Keywords específicas (opcional)

### Flujo principal

1. El usuario completa los campos de contexto (marca, temática, URL, idioma)
2. Al ingresar la URL → `/api/scrape` extrae texto del homepage en segundo plano
3. Sube imágenes (JPG, PNG, WEBP, GIF) por drag & drop o selector
4. Hace clic en "Analizar" — se procesan las imágenes una por una
5. Cada imagen muestra el nombre SEO generado y el alt text debajo
6. Al terminar, aparece el botón "Descargar ZIP" y "Nueva consulta"

### Exportación

- Las imágenes se convierten a JPG (calidad 100%) usando Canvas antes de entrar al ZIP
- El ZIP contiene:
  - Todas las imágenes renombradas en una carpeta `seo-images/`
  - Un archivo `alt-text.csv` con dos columnas: `archivo` y `alt_text`
- El ZIP se nombra: `seo-images-[marca]-[YYYY-MM-DD-HHhMM].zip`

### Nueva consulta

El botón "Nueva consulta" aparece cuando todas las imágenes están procesadas. Resetea todos los campos (marca, temática, contexto, imágenes) y limpia el input de archivo para permitir subir nuevos archivos.

---

## Lógica de la API

Una sola llamada por imagen a Gemini Flash Vision que devuelve un JSON con `filename` y `alt`. El prompt incluye:
- Texto extraído del homepage (via Playwright) + temática, ciudad, regiones, idioma y keywords del contexto
- Prioridad explícita: primero descripción visual, después keywords
- 5 ejemplos few-shot para calibrar el estilo de output

### Prompt base

```
Sos un experto en SEO. Analizá esta imagen y devolvé un JSON con dos campos: "filename" y "alt".

Temática del sitio: "[niche]"
Ciudad: "[city]"          ← solo si está completado
Regiones: "[r1]", "[r2]"  ← solo si hay regiones
Idioma: [lang]
Keywords a priorizar: "[keywords]"  ← solo si está completado

PRIORIDAD para el "filename" (en este orden):
1. PRIMERO describí lo que se ve en la imagen de forma específica y concreta: materiales, colores, objetos, personas, espacios, acciones.
2. DESPUÉS incorporá keywords del nicho y referencias geográficas si suman valor SEO.
El nombre debe ser descriptivo antes que keyword-heavy.

Reglas para "filename":
- Entre 3 y 6 palabras separadas por guiones
- Solo minúsculas, números y guiones, sin acentos
- Sin extensión, máximo 70 caracteres

Reglas para "alt":
- Frase descriptiva entre 8 y 18 palabras
- Mencioná colores, materiales, contexto del entorno y ubicación si es relevante
- Incorporá keywords de forma natural al final si encajan
- Puede tener acentos y espacios normales
- No empezar con "Imagen de" o "Foto de"

EJEMPLOS del estilo esperado:
{"filename":"white-safety-mesh-barrier-oak-trees","alt":"Clear white mesh safety barrier protecting a residential swimming pool shaded by beautiful old oak trees in Florida."}
{"filename":"pool-edge-white-fence-installation","alt":"Bright white pool safety fencing installed directly along the water's edge beneath an aluminum patio frame."}
{"filename":"sharp-angle-grey-mesh-pool-protection","alt":"Customized grey pool protection mesh conforming to sharp patio angles next to a modern home's synthetic lawn."}
{"filename":"backyard-oasis-black-safety-fencing","alt":"Strong black safety fencing separating a relaxing patio seating area from the pool in a lush South Florida backyard oasis."}
{"filename":"luxury-estate-pool-barrier-pink-landscaping","alt":"Premium black mesh barrier securing a luxury estate swimming pool, bordered by vibrant pink landscaping and turf."}

Respondé SOLO con el JSON de la imagen analizada, sin explicaciones.
Ejemplo de formato: {"filename":"nombre-seo","alt":"Descripción natural de la imagen."}
```

---

## Cerebro SEO — Buenas prácticas para imágenes

### Nombres de archivo

**Estructura:**
- Palabras separadas por guiones (`-`), nunca guiones bajos ni espacios
- Todo en minúsculas sin excepción
- Sin acentos, caracteres especiales ni símbolos
- Sin extensión en el nombre generado (se agrega después)
- Máximo 70 caracteres
- Entre 3 y 6 palabras por nombre

**Prioridad de descripción:**
1. Lo que se ve visualmente: materiales, colores, objetos, personas, espacios
2. Contexto del nicho: tipo de producto o servicio
3. Referencia geográfica: ciudad o región si aporta valor SEO

**Ejemplos correctos:**
```
white-safety-mesh-barrier-oak-trees.jpg
pool-edge-white-fence-installation.jpg
sharp-angle-grey-mesh-pool-protection.jpg
backyard-oasis-black-safety-fencing.jpg
luxury-estate-pool-barrier-pink-landscaping.jpg
```

**Ejemplos incorrectos:**
```
IMG_4521.jpg              ← sin descripción
foto-producto.jpg         ← demasiado genérico
pool_fence_miami.jpg      ← guión bajo
PoolFenceMiami.jpg        ← mayúsculas
```

---

### Alt Text

**Propósito dual:**
- Accesibilidad: describe la imagen para lectores de pantalla
- SEO: señal adicional de relevancia para Google Image Search

**Reglas:**
- Frase natural entre 8 y 18 palabras
- Mencionar colores, materiales y contexto del entorno
- Incorporar 1 o 2 keywords de forma orgánica, preferentemente al final
- Puede y debe tener acentos, espacios y puntuación normal
- No empezar con "Imagen de", "Foto de" o "Picture of"
- No repetir exactamente el nombre del archivo
- Si hay texto visible en la imagen, incluirlo

**Ejemplos correctos:**
```
Clear white mesh safety barrier protecting a residential swimming pool shaded by beautiful old oak trees in Florida.
Strong black safety fencing separating a relaxing patio seating area from the pool in a lush South Florida backyard oasis.
Premium black mesh barrier securing a luxury estate swimming pool, bordered by vibrant pink landscaping and turf.
```

**Ejemplos incorrectos:**
```
imagen de cerca                          ← demasiado genérico
white-safety-mesh-barrier-oak-trees      ← es el filename, no alt text
Photo of our pool safety fence product   ← sin detalle, sin keywords naturales
```

---

### Idioma

- **Español**: mercados de LATAM y España
- **Inglés**: mercados de EE.UU., UK, nichos técnicos internacionales
- No mezclar idiomas dentro del mismo nombre de archivo
- El alt text debe estar en el mismo idioma que el contenido de la página

---

### Geolocalización SEO

Incluir referencias geográficas cuando:
- El negocio tiene presencia física o cobertura local
- El cliente busca posicionar en búsquedas con intención local
- La competencia es principalmente local

Formato recomendado: `[descripción-elemento]-[ciudad o barrio]`

---

### Formatos de imagen recomendados

| Formato | Uso ideal | Ventaja SEO |
|--------|-----------|-------------|
| WebP | Fotos, productos, banners | 25-35% menos peso, mejor Core Web Vitals |
| JPG | Fotografías (máxima compatibilidad) | Amplio soporte |
| PNG | Logos, íconos, transparencias | Sin pérdida de calidad |
| SVG | Íconos, ilustraciones, logos | Escalable, peso mínimo |

> Esta herramienta exporta todas las imágenes a JPG calidad 100% para máxima fidelidad.

---

### Lo que Google indexa de las imágenes

1. Nombre del archivo ← esta herramienta lo optimiza
2. Alt text ← esta herramienta lo optimiza
3. Texto del caption (responsabilidad del CMS)
4. Texto circundante en la página (responsabilidad del CMS)
5. Structured data Schema.org `ImageObject` (responsabilidad del desarrollador)
6. Tamaño y formato del archivo (Core Web Vitals)
7. URL donde está alojada la imagen

---

## UI/UX

- Estética dark moderna (`#0e0e11` base)
- Acento violeta con gradiente (`#6c63ff` → `#a78bfa`)
- Fuente: Inter
- Panel de contexto colapsable con badge que indica campos completados
- Cards por imagen con estado visual (pendiente / analizando / listo / error)
- Barra de progreso animada durante el procesamiento
- Stats en tiempo real: total / pendientes / listos
- El botón "Nueva consulta" reemplaza "Limpiar todo" cuando todas las imágenes están procesadas
