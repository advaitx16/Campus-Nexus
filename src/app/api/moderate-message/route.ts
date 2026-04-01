import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const { message, channel } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        safe: true,
        reason: 'Moderation skipped (no API key)',
        category: null,
        flagged: false,
        action: 'ALLOW',
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are a campus community chat moderator for a student marketplace. Analyze this message for:
1. Hate speech or discrimination
2. Spam or excessive self-promotion
3. Scam or fraud attempts
4. NSFW/inappropriate content
5. Bullying or harassment

Message to analyze: "${message}"
Channel: ${channel || 'general'}

Respond ONLY with JSON: { "safe": true/false, "reason": "explanation if unsafe, null if safe", "category": "hate|spam|scam|nsfw|bullying|null" }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({
        safe: true,
        reason: null,
        category: null,
        flagged: false,
        action: 'ALLOW',
      });
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      safe?: boolean;
      reason?: string | null;
      category?: string | null;
    };
    const safe = parsed.safe !== false;

    return NextResponse.json({
      safe,
      reason: parsed.reason ?? null,
      category: parsed.category ?? null,
      flagged: !safe,
      action: safe ? 'ALLOW' : 'BLOCK',
    });
  } catch (error: unknown) {
    console.error('Moderation error:', error);
    // Default to safe if moderation fails — don't block user messages
    return NextResponse.json({
      safe: true,
      reason: null,
      category: null,
      flagged: false,
      action: 'ALLOW',
    });
  }
}
