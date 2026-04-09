import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildPrompt } from './prompt';
import type { AnalysisContext, ImageResult } from './types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  context: AnalysisContext,
): Promise<ImageResult> {
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
