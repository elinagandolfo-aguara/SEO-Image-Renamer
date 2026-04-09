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
    '2. Incorporá términos del nicho y referencias geográficas si suman valor SEO',
    '',
    'Reglas para "filename":',
    '- 3 a 6 palabras separadas por guiones',
    '- Solo minúsculas, números y guiones, sin acentos',
    '- Sin extensión, máximo 70 caracteres',
    '',
    'Reglas para "alt":',
    '- Frase descriptiva entre 8 y 18 palabras',
    '- Colores, materiales, contexto del entorno',
    '- Términos clave de forma natural, preferentemente al final',
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
