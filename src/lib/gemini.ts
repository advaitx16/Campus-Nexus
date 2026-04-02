import { GoogleGenerativeAI } from '@google/generative-ai';

const FLASH_MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-001',
].filter(Boolean) as string[];

const VISION_MODEL_CANDIDATES = [
  process.env.GEMINI_VISION_MODEL,
  ...FLASH_MODEL_CANDIDATES,
].filter(Boolean) as string[];

export function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  return new GoogleGenerativeAI(apiKey);
}

export async function generateContentWithFallback(
  client: GoogleGenerativeAI,
  contents: any,
  modelCandidates: string[] = FLASH_MODEL_CANDIDATES,
) {
  let lastError: unknown = null;

  for (const modelName of modelCandidates) {
    try {
      const model = client.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(contents);
      return result;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Gemini request failed');
}

export function getFlashModelCandidates() {
  return [...FLASH_MODEL_CANDIDATES];
}

export function getVisionModelCandidates() {
  return [...VISION_MODEL_CANDIDATES];
}
