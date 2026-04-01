import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { transaction_id } = await request.json();
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    // Mark buyer as confirmed — triggers actual fund release to seller
    const { data: txn, error } = await supabase
      .from('escrow_transactions')
      .update({ buyer_confirmed: true, status: 'released', released_at: new Date().toISOString() })
      .eq('id', transaction_id)
      .select('seller_id, amount')
      .single();

    if (error) throw error;

    // Award seller: update total_sales + trust score
    await supabase.rpc('calculate_trust_score', { p_user_id: txn.seller_id });
    await supabase
      .from('profiles')
      .update({ total_sales: supabase.rpc('total_sales', {}) as any })
      .eq('id', txn.seller_id);

    // Notify seller
    await supabase.from('notifications').insert({
      user_id: txn.seller_id,
      type: 'sale',
      title: '💰 Escrow Released!',
      body: `₹${txn.amount} has been released to you. Great deal!`,
      link: '/dashboard/orders'
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
