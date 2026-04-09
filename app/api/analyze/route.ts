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
