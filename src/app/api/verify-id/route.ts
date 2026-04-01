import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType } = await request.json();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are a student ID card scanner for a university marketplace. Analyze this ID card image and extract:
1. Student name
2. Student roll number / ID number  
3. Department / Course
4. Year of study (if visible)
5. Institution name

Respond ONLY with a JSON object: { "name": "...", "roll_number": "...", "department": "...", "year": "...", "institution": "...", "verified": true/false }
If this is NOT a valid student ID card, set "verified": false and other fields to null.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
    ]);

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse AI response');
    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.verified) {
      await supabase
        .from('profiles')
        .update({
          student_id_verified: true,
          student_name: parsed.name,
          department: parsed.department,
          roll_number: parsed.roll_number,
        })
        .eq('id', user.id);
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error('ID verification error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
