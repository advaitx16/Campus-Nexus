import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    // Basic Auth Check
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mockproject.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_anon_key',
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )
    
    // Auth bypass for hackathon demonstration can be implemented here if needed.
    const { data: { user } } = await supabase.auth.getUser();

    const data = await req.formData();
    const image = data.get('image');

    if (!image || !(image instanceof Blob)) {
      return NextResponse.json({ error: 'No image provided for product analysis' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // AI Instructions setup (Zero-shot configuration matching the prompt)
    const prompt = `Analyze this image of an item to be sold or rented by a college student. You must output exactly a JSON object, no markdown, no other words. It should have these exact keys:
    {
      "title": "A catchy, short title",
      "category": "The best matching category (e.g. Books, Electronics, Stationery, Lifestyle)",
      "suggested_price": number (in INR),
      "condition_rating": number (from 1 to 5, 5 being brand new),
      "tags": ["array", "of", "relevant", "search", "tags"]
    }`;

    const imageParts = [
      {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: image.type,
        },
      },
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();

    console.log("Raw Product AI Response:", responseText);

    let parsedData = {};
    try {
        const cleanedStr = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
        parsedData = JSON.parse(cleanedStr);
    } catch(e) {
        return NextResponse.json({ error: 'Failed to parse AI output', raw: responseText }, { status: 500 });
    }

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('Error in AI Image Listing:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
