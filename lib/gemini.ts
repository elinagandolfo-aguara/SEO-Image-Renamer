import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildPrompt } from './prompt';
import type { AnalysisContext, ImageResult } from './types';

const RETRYABLE = [429, 503];
const RETRY_DELAYS = [5000, 15000]; // 5s, luego 15s

function isRetryable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return RETRYABLE.some((code) => msg.includes(`[${code}`));
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  context: AnalysisContext,
): Promise<ImageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const prompt = buildPrompt(context);

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const result = await model.generateContent([
        { text: prompt },
        { inlineData: { mimeType, data: imageBase64 } },
      ]);

      const text = result.response.text().trim();
      const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

      const parsed = JSON.parse(clean) as ImageResult;
      if (!parsed.filename || !parsed.alt) throw new Error('Respuesta inválida de Gemini');

      return parsed;
    } catch (err) {
      lastError = err;
      if (attempt < RETRY_DELAYS.length && isRetryable(err)) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}
