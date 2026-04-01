import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/server';

export async function POST(request: NextRequest) {
  try {
    const { reason, points = 5 } = await request.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Not logged in — CC not saved (demo mode)' });

    const { data, error } = await supabase
      .from('profiles')
      .select('cc_points')
      .eq('id', user.id)
      .single();

    if (error) return NextResponse.json({ ok: false, message: error.message });

    const newPoints = (data?.cc_points ?? 0) + points;
    await supabase.from('profiles').update({ cc_points: newPoints }).eq('id', user.id);

    return NextResponse.json({ ok: true, cc_points: newPoints, reason, awarded: points });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message }, { status: 500 });
  }
}
