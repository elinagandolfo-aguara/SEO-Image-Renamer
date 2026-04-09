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
