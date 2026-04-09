import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage } from '@/lib/gemini';
import type { AnalyzeRequest, AnalyzeResponse } from '@/lib/types';

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzeRequest;
    if (!body.imageBase64 || !body.mimeType || !body.context) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    if (!ACCEPTED_MIME_TYPES.includes(body.mimeType)) {
      return NextResponse.json({ error: 'Tipo de imagen no soportado' }, { status: 400 });
    }

    // Rough size check: base64 of 10MB = ~13.3M chars
    if (body.imageBase64.length > 14_000_000) {
      return NextResponse.json({ error: 'Imagen demasiado grande (máx 10MB)' }, { status: 400 });
    }

    const result = await analyzeImage(body.imageBase64, body.mimeType, body.context);
    return NextResponse.json(result satisfies AnalyzeResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Análisis fallido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
