# SEO Best Practices para Imágenes
*Fuente: NotebookLM — SEO Image Optimization*
*Fecha: 2026-04-09*

---

## Nombres de Archivo (Filenames)

Los motores de búsqueda utilizan el nombre del archivo para entender el contexto de la imagen antes de analizar sus píxeles.

### Reglas

| Regla | Correcto | Incorrecto |
|-------|----------|------------|
| Descriptivo pero conciso (2-5 palabras, 30-70 caracteres) | `zapatos-rojos-correr.jpg` | `IMG_1234.jpg` |
| Guiones medios como separadores | `taza-cafe-ceramica-azul.jpg` | `taza_cafe_ceramica_azul.jpg` |
| Solo minúsculas | `vestido-floral-verano.jpg` | `Vestido-Floral-Verano.jpg` |
| Solo caracteres ASCII estándar | `silla-madera-roble.jpg` | `silla-madera-&-roble.jpg` |
| Keyword más relevante al principio | `cafe-espresso-taza-blanca.jpg` | `taza-blanca-de-cafe-espresso.jpg` |
| Sin keyword stuffing | `cafe-espresso.jpg` | `mejor-cafe-espresso-barato-madrid-cafe.jpg` |

### Puntos clave
- Renombrar **antes** de subir: en plataformas como WordPress, el nombre del archivo se vuelve permanente en el HTML.
- Los guiones bajos (`_`) fusionan palabras — Google las lee como una sola.
- Los espacios y símbolos especiales (`&`, `%`, `$`, `@`) causan problemas de codificación en URLs.

---

## Texto Alternativo (Alt Text)

Cumple dos propósitos: **accesibilidad** (lectores de pantalla) y **SEO semántico** (contexto rico para buscadores).

### Reglas

| Regla | Ejemplo |
|-------|---------|
| Descripción conversacional, como si se lo contaras a alguien que no puede ver | "Una taza de café de cerámica azul sobre un escritorio de madera junto a una laptop" |
| 5 a 15 palabras, máximo 125 caracteres | ✓ |
| No empezar con "imagen de" o "foto de" | Los lectores de pantalla ya anuncian que es una imagen |
| Keyword solo si encaja de forma natural | No forzar — Google lo detecta como spam |

---

## El Dúo: Filename + Alt Text

No compiten entre sí, se complementan:

- **Filename** → da el contexto base al buscador (nivel de sistema)
- **Alt text** → enriquece con descripción accesible y semántica (nivel de página)

### Ejemplo perfecto
```
Filename:  taza-cafe-ceramica-azul.jpg
Alt text:  "Una taza de café de cerámica azul posada sobre un escritorio de madera junto a una laptop"
```

---

## Otros temas del notebook

- **Formatos recomendados:** WebP y AVIF (mejor compresión, Core Web Vitals)
- **Imágenes responsivas:** atributos `srcset` y `<picture>` en HTML
- **Herramientas de renombrado masivo:** Bulk Rename Utility, Renamer.ai
- **Compresión:** TinyPNG, ToolPix
- **Plataformas:** guías específicas para Shopify, Wix y WordPress
