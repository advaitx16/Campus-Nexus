import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];

    const { data: profile } = await supabase
      .from('profiles')
      .select('last_checkin, cc_points')
      .eq('id', user.id)
      .single();

    if (profile?.last_checkin === today) {
      return NextResponse.json({
        already_checked_in: true,
        cc_points: profile.cc_points,
        message: 'Already checked in today! Come back tomorrow.',
      });
    }

    const { data: updated } = await supabase
      .from('profiles')
      .update({
        last_checkin: today,
        cc_points: (profile?.cc_points || 0) + 1,
      })
      .eq('id', user.id)
      .select('cc_points')
      .single();

    return NextResponse.json({
      success: true,
      cc_points: updated?.cc_points,
      message: `+1 CC Point! Total: ${updated?.cc_points ?? 0}`,
    });
  } catch (error: any) {
    console.error('Check-in error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
