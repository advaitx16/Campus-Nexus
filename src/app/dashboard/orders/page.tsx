'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Clock, CheckCircle2, Download, QrCode, Star, Truck, AlertTriangle, ArrowLeft, Loader2, Shield } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/client';

const STATUS_CONFIG = {
  'HELD': { label: 'Escrow Held', color: 'bg-amber-600', icon: Clock, desc: 'Payment held safely in escrow.' },
  'RELEASED': { label: 'Completed', color: 'bg-emerald-600', icon: CheckCircle2, desc: 'Item received. Escrow payment released to seller.' },
  'REFUNDED': { label: 'Refunded', color: 'bg-rose-600', icon: AlertTriangle, desc: 'Order cancelled, funds returned.' },
} as any;

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedQR, setSelectedQR] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [reviewOrder, setReviewOrder] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  useEffect(() => {
    const supabase = createClient();
    
    async function fetchOrders() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUser(user);
      
      const { data } = await supabase
        .from('orders')
        .select(`*, listings(title, image_url, category, seller_name)`)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
        
      if (data) setOrders(data);
      setLoading(false);
    }
    fetchOrders();

    const channel = supabase.channel('realtime_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleReleaseEscrow = async (orderId: string, sellerId: string) => {
    setReleasingId(orderId);
    try {
      const supabase = createClient();
      
      // Update Order Status
      const { error } = await supabase
        .from('orders')
        .update({ escrow_status: 'RELEASED', order_status: 'COMPLETE' })
        .eq('id', orderId);
      
      if (error) throw error;
      
      // Notify Admin via community pulse
      await supabase.from('community_feed').insert({
        author_id: user.id,
        channel: 'global',
        content: `SYSTEM ALERT: Escrow successfully released for order ${orderId.slice(0,8)}. Transaction marked complete.`
      });

      // Award +10 CC Points to seller
      const { data: prof } = await supabase.from('profiles').select('cc_points').eq('id', sellerId).single();
      await supabase.from('profiles').update({ cc_points: (prof?.cc_points || 0) + 10 }).eq('id', sellerId);

      const { data: listingData } = await supabase.from('orders').select('listings(title)').eq('id', orderId).single();
      setReviewOrder({ id: orderId, sellerId, itemTitle: (listingData?.listings as any)?.title || 'Item' });
    } catch (err: any) {
      alert('Error releasing escrow: ' + err.message);
    } finally {
      setReleasingId(null);
    }
  };

  const submitReview = async () => {
    if (!reviewOrder) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('seller_reviews').insert({
        order_id: reviewOrder.id,
        buyer_id: user.id,
        seller_id: reviewOrder.sellerId,
        rating,
        comment
      });
      if (error) throw error;

      // Calculate Trust Score based on the rule: Trust = (Sales × 0.4) + (Rating × 10 × 0.3) + (Days_Active × 0.01 × 0.3)
      const { data: profile } = await supabase.from('profiles').select('created_at').eq('id', reviewOrder.sellerId).single();
      const { data: salesData } = await supabase.from('orders').select('id').eq('seller_id', reviewOrder.sellerId).eq('order_status', 'COMPLETE');
      const { data: reviewsData } = await supabase.from('seller_reviews').select('rating').eq('seller_id', reviewOrder.sellerId);
      
      const sales = salesData?.length || 0;
      const daysActive = profile ? Math.max(1, Math.floor((new Date().getTime() - new Date(profile.created_at).getTime()) / (1000 * 3600 * 24))) : 1;
      const avgRating = reviewsData && reviewsData.length > 0 ? (reviewsData.reduce((s, r) => s + r.rating, 0) / reviewsData.length) : rating;
      const newTrustScore = Math.min(100, (sales * 0.4) + (avgRating * 10 * 0.3) + (daysActive * 0.01 * 0.3));
      
      await supabase.from('profiles').update({ trust_score: Math.round(newTrustScore * 10) / 10 }).eq('id', reviewOrder.sellerId);

      alert("🌟 Thank you! Your feedback helps calculate the seller's Trust Score.");
    } catch (err: any) {
      alert('Error submitting review: ' + err.message);
    } finally {
      setReviewOrder(null);
      setRating(5);
      setComment('');
    }
  };

  const downloadReceipt = (order: any) => {
    const list = order.listings || {};
    const receiptContent = `
CAMPUS NEXUS — DIGITAL RECEIPT
================================
Order ID: ${order.id}
Date: ${new Date(order.created_at).toLocaleString()}

Product: ${list.title || 'Unknown Item'}
Seller: ${list.seller_name || 'Unknown'}

Amount: ₹${Number(order.amount).toLocaleString()}
Platform Fee (2%): ₹${Number(order.platform_fee).toLocaleString()}
Total Charged: ₹${(Number(order.amount) + Number(order.platform_fee)).toLocaleString()}

Status: ${STATUS_CONFIG[order.escrow_status]?.label || order.escrow_status}

Thank you for trusting Campus Nexus.
Zero-Trust Campus Economy.
================================
    `.trim();

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Campus_Nexus_Receipt_${order.id.slice(0,8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="min-h-screen bg-[#0F0F10] flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-indigo-500"/></div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto font-sans">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard"><ArrowLeft className="h-5 w-5 text-zinc-500 hover:text-white transition-colors"/></Link>
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Package className="h-6 w-6 text-indigo-400"/> My Orders</h1>
          <p className="text-zinc-500 text-sm">Escrow contracts, receipts, and order statuses</p>
        </div>
      </div>

      {/* QR Code Modal */}
      {selectedQR && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in" onClick={() => setSelectedQR(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center space-y-4 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-black text-white flex items-center justify-center gap-2"><QrCode className="h-6 w-6 text-indigo-400"/> Transaction QR</h2>
            <p className="text-zinc-500 text-sm">Show this to the seller to verify the transaction</p>
            <div className="bg-white p-4 rounded-2xl mx-auto w-fit">
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=CMPNXS-${selectedQR}`} alt="QR" className="rounded-lg"/>
            </div>
            <Button onClick={() => setSelectedQR(null)} variant="outline" className="border-zinc-700 text-zinc-400 w-full rounded-xl hover:bg-zinc-800">Close</Button>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in" onClick={() => setReviewOrder(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-400"/>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Escrow Released!</h2>
              <p className="text-zinc-400 text-sm mt-1">Leave a review for <strong className="text-white">{reviewOrder.itemTitle}</strong> to help calculate their Trust Score.</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-center gap-2">
                {[1,2,3,4,5].map(star => (
                  <button key={star} onClick={() => setRating(star)} className="transition-transform hover:scale-125 focus:outline-none">
                    <Star className={`h-10 w-10 ${rating >= star ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}`}/>
                  </button>
                ))}
              </div>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Write an optional review..." className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-indigo-500 h-24 resize-none"/>
              <Button onClick={submitReview} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl h-12">Submit Review</Button>
              <Button onClick={() => setReviewOrder(null)} variant="outline" className="w-full border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl h-12">Skip</Button>
            </div>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-20 px-4 border border-zinc-800 border-dashed rounded-3xl bg-zinc-900/50">
          <Package className="h-12 w-12 text-zinc-700 mx-auto mb-3"/>
          <h3 className="text-xl font-bold text-white mb-2">No Contracts Found</h3>
          <p className="text-zinc-500 mb-6 max-w-sm mx-auto">You haven't bought, sold, or rented anything using Campus Nexus Escrow yet.</p>
          <Link href="/dashboard"><Button className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold">Explore Marketplace</Button></Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map(order => {
            const isBuyer = order.buyer_id === user?.id;
            const statusCfg = STATUS_CONFIG[order.escrow_status] || { label: order.escrow_status, color: 'bg-zinc-600', icon: Clock, desc: '' };
            const StatusIcon = statusCfg.icon;
            const listing = order.listings || {};

            return (
              <Card key={order.id} className="bg-zinc-900 border-zinc-800 overflow-hidden relative group">
                {/* Sale / Purchase Badge */}
                <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[10px] uppercase font-black tracking-widest ${isBuyer ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  {isBuyer ? 'Your Purchase' : 'Your Sale'}
                </div>

                <CardContent className="p-0">
                  <div className={`${statusCfg.color} px-5 py-2.5 flex items-center gap-2 mt-7 sm:mt-0`}>
                    <StatusIcon className="h-4 w-4 text-white"/>
                    <span className="text-white font-bold text-sm tracking-wide">{statusCfg.label}</span>
                    <span className="text-white/70 text-xs ml-auto font-medium">{new Date(order.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="p-5 md:p-6">
                    <div className="flex flex-col sm:flex-row gap-5 items-start">
                      <div className="h-24 w-24 bg-zinc-950 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border border-zinc-800">
                        {listing.image_url ? (listing.image_url.startsWith('http') ? <img src={listing.image_url} alt="" className="object-cover w-full h-full"/> : <span className="text-5xl">{listing.image_url}</span>) : <span className="text-5xl">📦</span>}
                      </div>
                      
                      <div className="flex-1 w-full space-y-2">
                        <h3 className="font-black text-white text-lg md:text-xl leading-tight pr-4">{listing.title || 'Unknown Product'}</h3>
                        <p className="text-zinc-500 text-sm font-medium">{isBuyer ? `Seller: ${listing.seller_name}` : `Buyer ID: ${order.buyer_id.slice(0,6)}`}</p>
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <span className="text-xl font-black text-emerald-400 group-hover:scale-105 transition-transform">₹{Number(order.amount).toLocaleString()}</span>
                          <span className="text-zinc-600 text-xs font-semibold">+ ₹{Number(order.platform_fee).toLocaleString()} platform fee</span>
                        </div>
                        <div className="pt-1">
                           <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10 text-[10px] font-mono tracking-widest">{order.id}</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl flex items-start gap-3">
                      <Shield className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-indigo-400 font-bold text-sm">{isBuyer ? 'Escrow Protection Active' : 'Funds Secured in Escrow'}</p>
                        <p className="text-zinc-500 text-xs mt-0.5">{isBuyer ? 'Your funds are held securely. Release them only after inspecting the product.' : 'The buyer has paid. Hand over the product to receive the funds.'}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-5">
                      <Button onClick={() => setSelectedQR(order.id)} variant="outline" className="border-zinc-700 bg-zinc-800/30 text-zinc-300 hover:text-white rounded-xl h-10 text-sm transition-all hover:bg-zinc-800">
                        <QrCode className="h-4 w-4 mr-2 text-indigo-400"/> Security QR
                      </Button>
                      <Button onClick={() => downloadReceipt(order)} variant="outline" className="border-zinc-700 bg-zinc-800/30 text-zinc-300 hover:text-white rounded-xl h-10 text-sm transition-all hover:bg-zinc-800">
                        <Download className="h-4 w-4 mr-2"/> Save Receipt
                      </Button>
                      
                      {isBuyer && order.escrow_status === 'HELD' && (
                        <div className="w-full sm:w-auto mt-2 sm:mt-0 ml-auto">
                          <Button 
                            onClick={() => handleReleaseEscrow(order.id, order.seller_id)} 
                            disabled={releasingId === order.id}
                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black rounded-xl h-10 text-sm shadow-lg shadow-emerald-900/40 border border-emerald-400/20"
                          >
                            <CheckCircle2 className="h-5 w-5 mr-2"/>
                            {releasingId === order.id ? 'Releasing Funds...' : 'Confirm Item Received'}
                          </Button>
                        </div>
                      )}
                      
                      {!isBuyer && order.escrow_status === 'HELD' && (
                        <div className="w-full sm:w-auto mt-2 sm:mt-0 ml-auto flex items-center px-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-500 text-xs font-bold">
                          <Clock className="h-4 w-4 mr-2"/> Awaiting Buyer Confirmation
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
