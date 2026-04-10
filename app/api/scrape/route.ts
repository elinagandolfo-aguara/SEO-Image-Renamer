import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { scrapeHomepage } from '@/lib/scraper';
import type { ScrapeRequest, ScrapeResponse } from '@/lib/types';

async function detectContext(text: string, apiKey: string): Promise<{
  niche?: string; city?: string; regions?: string[];
}> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const prompt = `Analizá este texto de un sitio web y extraé información del negocio.
Devolvé SOLO un JSON con estos campos (omitir si no hay información clara):
{
  "niche": "temática o industria del negocio en 2-5 palabras",
  "city": "ciudad o municipio específico donde opera el negocio (NO incluyas países ni estados)",
  "regions": ["barrio o zona específica dentro de la ciudad 1", "barrio o zona 2"]
}

Reglas estrictas:
- "city": debe ser una ciudad concreta (ej: "Miami", "Buenos Aires"). Si solo aparece el país o estado, omitir este campo.
- "regions": solo barrios, distritos o zonas dentro de una ciudad (ej: "Coral Gables", "Palermo"). Si no hay zonas específicas mencionadas, omitir este campo completamente. NUNCA incluir países, estados ni regiones geográficas amplias.

Texto del sitio:
${text.slice(0, 1500)}

Respondé SOLO con el JSON, sin explicaciones.`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim()
      .replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

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
    const apiKey = process.env.GEMINI_API_KEY;
    const detected = apiKey ? await detectContext(text, apiKey) : {};

    return NextResponse.json({
      text,
      detectedNiche: detected.niche,
      detectedCity: detected.city,
      detectedRegions: detected.regions,
    } satisfies ScrapeResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scrape fallido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
