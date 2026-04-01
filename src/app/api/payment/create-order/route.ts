import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { amount, productId, buyerId, sellerId } = await request.json();

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';

    // Use real Razorpay if keys exist and aren't demo keys
    const hasRealKeys = razorpayKeyId && 
                        razorpayKeyId !== 'rzp_test_demo' && 
                        razorpayKeyId.startsWith('rzp_');

    if (hasRealKeys) {
      const credentials = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');
      const platformFee = Math.round(amount * 0.02);
      
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: (amount + platformFee) * 100, // paise
          currency: 'INR',
          receipt: `order_${productId}_${Date.now()}`,
          notes: { productId, buyerId, sellerId, platform_fee: platformFee },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.description || 'Razorpay API error');
      }

      const order = await response.json();
      return NextResponse.json({
        ...order,
        razorpay_key: razorpayKeyId,
        platform_fee: platformFee,
        is_demo: false,
      });
    }

    // Demo mode — realistic simulation
    const platformFee = Math.round(amount * 0.02);
    const orderId = `order_DEMO_${Date.now()}`;
    
    return NextResponse.json({
      id: orderId,
      amount: (amount + platformFee) * 100,
      currency: 'INR',
      platform_fee: platformFee,
      razorpay_key: razorpayKeyId,
      is_demo: true,
      demo_payment_id: `pay_DEMO_${Date.now()}`,
      status: 'created',
    });
  } catch (error: any) {
    console.error('Payment order error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment order' },
      { status: 500 }
    );
  }
}
