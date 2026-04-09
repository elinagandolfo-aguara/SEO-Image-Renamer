import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildPrompt } from './prompt';
import type { AnalysisContext, ImageResult } from './types';

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  context: AnalysisContext,
): Promise<ImageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = buildPrompt(context);

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType, data: imageBase64 } },
  ]);

  const text = result.response.text().trim();
  // Gemini a veces envuelve el JSON en ```json ... ```
  const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  const parsed = JSON.parse(clean) as ImageResult;
  if (!parsed.filename || !parsed.alt) throw new Error('Respuesta inválida de Gemini');

  return parsed;
}
