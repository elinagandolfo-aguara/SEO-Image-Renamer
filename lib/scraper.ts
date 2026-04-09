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
