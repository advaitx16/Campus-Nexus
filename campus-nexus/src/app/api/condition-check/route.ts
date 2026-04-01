import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const handoverImage = data.get('handoverImage');
    const returnImage = data.get('returnImage');

    if (!handoverImage || !returnImage || !(handoverImage instanceof Blob) || !(returnImage instanceof Blob)) {
      return NextResponse.json({ error: 'Both handover and return images are required' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' }); // Pro is better for complex vision comparisons

    // Convert both images to buffer then base64
    const hoBuffer = Buffer.from(await handoverImage.arrayBuffer());
    const retBuffer = Buffer.from(await returnImage.arrayBuffer());

    const prompt = `You are a strict Campus Escrow Integrity Bot. I am providing you with two images of a rental item.
Image 1 is the item BEFORE the rental (Handover).
Image 2 is the item AFTER the rental (Return).
Analyze the structural condition. Look for new deep scratches, broken screens, missing pieces, or significant degradation.
You MUST output exactly a JSON object, no markdown, no other words. Keys:
{
  "damage_detected": boolean,
  "severity": "NONE" | "MINOR" | "MODERATE" | "SEVERE",
  "ai_observations": "Short 2 sentence explanation",
  "recommended_action": "RELEASE_DEPOSIT" | "HOLD_FOR_DISPUTE"
}`;

    const imageParts = [
      { inlineData: { data: hoBuffer.toString('base64'), mimeType: handoverImage.type } },
      { inlineData: { data: retBuffer.toString('base64'), mimeType: returnImage.type } }
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();

    console.log("Raw Damage Check AI Response:", responseText);

    let parsedData = {};
    try {
        const cleanedStr = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
        parsedData = JSON.parse(cleanedStr);
    } catch(e) {
        return NextResponse.json({ error: 'Failed to parse AI output', raw: responseText }, { status: 500 });
    }

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('Error in AI Condition Check:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
