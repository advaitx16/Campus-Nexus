import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, transaction_id } = await request.json();

    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'demo_secret';
    
    // Skip verification for demo mode
    if (!razorpay_order_id.startsWith('order_demo_')) {
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(body)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
      }
    }

    // Update escrow transaction status in database
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    await supabase
      .from('escrow_transactions')
      .update({ 
        status: 'paid', 
        razorpay_payment_id,
        razorpay_order_id 
      })
      .eq('id', transaction_id);

    return NextResponse.json({ success: true, message: 'Payment verified. Escrow active — awaiting buyer confirmation.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
