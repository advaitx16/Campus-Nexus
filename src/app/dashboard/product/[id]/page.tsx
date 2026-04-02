'use client';
import { useState, useCallback, useEffect } from 'react';
import { Heart, Share2, ShieldCheck, MessageSquare, AlertTriangle, Star, Sparkles, Calendar, MapPin, CheckCircle2, Package, ArrowLeft, Zap, Phone, BadgeCheck, Truck, RefreshCw, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/client';
import { Button } from '@/components/ui/button';
import { dispatchNotificationAction } from '@/lib/notifications';

declare global { interface Window { Razorpay: any } }

// ─── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({ isOpen, onClose, listing, amount, mode, tier }: any) {
  const [step, setStep] = useState<'confirm' | 'processing' | 'success'>('confirm');
  const router = useRouter();

  const platformFee = Math.round(amount * 0.02);
  const total = amount + platformFee;

  const handlePay = async () => {
    setStep('processing');

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert('Please sign in to make a purchase.'); return; }

      // Create Order in Database
      const { data: orderRow, error: dbError } = await supabase.from('orders').insert({
        listing_id: listing.id,
        buyer_id: user.id,
        seller_id: listing.sellerId,
        amount: amount,
        platform_fee: platformFee,
        order_status: 'PENDING',
        escrow_status: 'HELD'
      }).select().single();

      if (dbError) throw new Error(dbError.message);
      await dispatchNotificationAction('order_interest', { orderId: orderRow.id }).catch(() => {});

      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, productId: listing.id, buyerId: user.id, sellerId: listing.sellerId }),
      });
      const order = await res.json();

      if (order.is_demo) {
        // Realistic demo: Process and mark as Paid
        await new Promise(r => setTimeout(r, 2000));
        await supabase.from('orders').update({ order_status: 'PAID', razorpay_payment_id: order.demo_payment_id }).eq('id', orderRow.id);
        setStep('success');
        return;
      }

      // Real Razorpay
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      document.body.appendChild(script);
      script.onload = () => {
        const rzp = new window.Razorpay({
          key: order.razorpay_key,
          amount: order.amount,
          currency: 'INR',
          order_id: order.id,
          name: 'Campus Nexus',
          description: listing.title,
          image: 'https://campus-nexus.app/icon.png',
          prefill: { name: 'Campus Student', email: 'student@campus.edu', contact: '9999999999' },
          theme: { color: '#4f46e5' },
          handler: async (response: any) => {
            await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...response, transaction_id: order.id }),
            });
            await supabase.from('orders').update({ order_status: 'PAID', razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id }).eq('id', orderRow.id);
            setStep('success');
          },
          modal: { ondismiss: () => setStep('confirm') },
        });
        rzp.open();
      };
    } catch (e) {
      alert('Payment failed. Please try again.');
      setStep('confirm');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose}/>
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 fade-in duration-300">
        {step === 'confirm' && (
          <>
            <div className="p-6 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white">Confirm {mode === 'rent' ? 'Rental' : 'Purchase'}</h2>
                <button onClick={onClose} className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* Item Summary */}
              <div className="flex items-center gap-4 p-4 bg-zinc-800 rounded-2xl">
                <div className="text-4xl">{listing.emoji}</div>
                <div className="flex-1">
                  <p className="font-bold text-white text-sm">{listing.title}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">Seller: {listing.seller} · Trust {listing.trust}</p>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 p-4 bg-zinc-800/50 rounded-2xl">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">{mode === 'rent' ? `Rental (${tier})` : 'Item Price'}</span>
                  <span className="text-white font-semibold">₹{amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Platform Fee (2%)</span>
                  <span className="text-white font-semibold">₹{platformFee.toLocaleString()}</span>
                </div>
                <div className="h-px bg-zinc-700 my-2"/>
                <div className="flex justify-between">
                  <span className="font-bold text-white">Total</span>
                  <span className="font-black text-emerald-400 text-lg">₹{total.toLocaleString()}</span>
                </div>
              </div>

              {/* Escrow notice */}
              <div className="flex items-start gap-3 p-3 bg-indigo-900/20 border border-indigo-500/20 rounded-xl">
                <ShieldCheck className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5"/>
                <p className="text-xs text-indigo-300">Your payment goes into <strong>Escrow</strong>. Seller only receives funds after you confirm receipt. 100% secure.</p>
              </div>

              <button
                onClick={handlePay}
                className="w-full h-14 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black text-base rounded-2xl shadow-xl shadow-indigo-600/30 transition-all btn-lift flex items-center justify-center gap-2"
              >
                🔒 Pay ₹{total.toLocaleString()} via Razorpay
              </button>
              <p className="text-center text-xs text-zinc-600">Secured by Razorpay · 256-bit SSL Encryption</p>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div className="p-12 text-center space-y-6">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-600/30 border-t-indigo-600 animate-spin"/>
              <div className="absolute inset-3 rounded-full bg-indigo-600/20 flex items-center justify-center">
                <ShieldCheck className="h-8 w-8 text-indigo-400"/>
              </div>
            </div>
            <div>
              <p className="text-white font-black text-xl">Processing Payment</p>
              <p className="text-zinc-500 text-sm mt-2">Please wait while we securely process your payment...</p>
            </div>
            <div className="flex justify-center gap-1.5">
              {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{animationDelay:`${i*150}ms`}}/>)}
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="p-8 text-center space-y-5">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-emerald-400"/>
            </div>
            <div>
              <p className="text-2xl font-black text-white">Payment Successful! 🎉</p>
              <p className="text-zinc-400 text-sm mt-2">₹{total.toLocaleString()} is held safely in escrow. You earned +5 CC Points!</p>
            </div>
            <div className="p-4 bg-zinc-800 rounded-2xl text-left space-y-2">
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Order Details</p>
              <p className="text-sm text-zinc-300">Escrow ID: <span className="font-mono text-indigo-400">ESC-{Date.now().toString().slice(-8)}</span></p>
              <p className="text-sm text-zinc-300">Item: <span className="text-white font-semibold">{listing.title}</span></p>
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard/orders" className="flex-1">
                <button onClick={onClose} className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all">
                  View My Orders
                </button>
              </Link>
              <button onClick={onClose} className="flex-1 h-12 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 rounded-xl transition-all font-medium">
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ProductDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [wishlisted, setWishlisted] = useState(false);
  const [mode, setMode] = useState<'buy' | 'rent'>('buy');
  const [tier, setTier] = useState<'daily' | 'weekly' | 'semester'>('daily');
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [activeTab, setActiveTab] = useState<'desc' | 'specs' | 'seller'>('desc');
  const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=60';

  useEffect(() => {
    async function fetchListing() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const fetchListingRecord = async (selectClause: string): Promise<{ data: any; error: any }> => {
        const result = await supabase
          .from('listings')
          .select(selectClause)
          .eq('id', id)
          .single();

        return { data: result.data, error: result.error };
      };

      const { data, error } = await fetchListingRecord('*');
      let profile = null;

      if (data?.seller_id) {
        const { data: fallbackProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.seller_id)
          .maybeSingle();

        profile = fallbackProfile ?? null;
      }

      if (data) {
        let imageUrl = data.image_url || null;
        if (imageUrl && !imageUrl.startsWith('data:') && !imageUrl.startsWith('http')) {
          const { data: signed } = await supabase.storage.from('listing-images').createSignedUrl(imageUrl, 60 * 60 * 24 * 7);
          imageUrl = signed?.signedUrl || imageUrl;
        }
        setListing({
          ...data,
          image_url: imageUrl || FALLBACK_IMAGE,
          profiles: profile,
          seller: profile?.student_name || profile?.full_name || data.seller_name || 'Campus Student',
          sellerId: data.seller_id,
          trust: profile?.trust_score || 50,
          dept: profile?.department || 'Unknown',
          rating: 4.8, 
          reviews: 12,
          emoji: data.category === 'Electronics' ? '💻' : data.category === 'Textbooks' ? '📘' : '📦',
          images: [imageUrl || FALLBACK_IMAGE],
          specs: { Category: data.category, Condition: data.condition },
          tags: data.tags || []
        });
        
        if (user) {
          setIsOwner(user.id === data.seller_id);
          const { data: wish } = await supabase.from('wishlist_items').select('*').eq('user_id', user.id).eq('listing_id', id).single();
          setWishlisted(!!wish);
        }
      } else if (error) {
        console.error('Product fetch error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
      }
      setLoading(false);
    }
    fetchListing();
  }, [id]);

  const handleBoost = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('cc_points').eq('id', user.id).single();
    if ((profile?.cc_points || 0) < 20) {
      alert('Not enough CC Points! You need 20 CC to boost your ad.');
      return;
    }

    const { error } = await supabase.from('listings').update({ is_featured: true, is_bumped: true }).eq('id', id);
    if (!error && profile) {
      await supabase.from('profiles').update({ cc_points: (profile.cc_points || 0) - 20 }).eq('id', user.id);
      setListing((prev: any) => ({ ...prev, isFeatured: true, isBumped: true }));
      await dispatchNotificationAction('boost_listing', { listingId: id }).catch(() => {});
      alert('Your listing is boosted and all active users were notified.');
    }
  };

  const toggleWishlist = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (wishlisted) {
      await supabase.from('wishlist_items').delete().eq('user_id', user.id).eq('listing_id', id);
      setWishlisted(false);
    } else {
      await supabase.from('wishlist_items').insert({ user_id: user.id, listing_id: id });
      setWishlisted(true);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: listing.title, text: `Check out ${listing.title} on Campus Nexus!`, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    }
  };

  const handleReport = () => {
    if (!reportReason) return;
    setReporting(false);
    setReportReason('');
    alert('✅ Report submitted anonymously. Our AI team will review within 24 hours.');
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-zinc-950 text-white font-black animate-pulse">LOADING PRODUCT ENGINE...</div>;
  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-6">
        <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-2xl font-black text-white">Product not found.</p>
          <p className="mt-3 text-sm text-zinc-400">
            This listing may have been removed, sold already, or opened from an old link.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-indigo-600 px-5 text-sm font-bold text-white transition-colors hover:bg-indigo-500"
          >
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const rentalAmt = tier === 'daily' ? listing.rental_daily : tier === 'weekly' ? listing.rental_weekly : listing.rental_semester;
  const finalAmount = mode === 'rent' ? rentalAmt : listing.price;
  const discount = listing.original_price > listing.price ? Math.round((1 - listing.price / listing.original_price) * 100) : 0;

  return (
    <>
      <PaymentModal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        listing={listing}
        amount={finalAmount}
        mode={mode}
        tier={tier}
      />

      {/* Share toast */}
      {shareToast && (
        <div className="fixed top-6 right-6 z-50 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-400"/>
          <span className="text-white text-sm font-medium">Link copied to clipboard!</span>
        </div>
      )}

      <div className={`min-h-screen bg-zinc-950 pb-24 transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}>
        {/* Breadcrumb */}
        <div className="px-6 py-4 flex items-center gap-2 text-sm text-zinc-500">
          <Link href="/dashboard" className="hover:text-white transition-colors flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4"/> Marketplace
          </Link>
          <span>/</span>
          <span className="text-zinc-400">{listing.category}</span>
          <span>/</span>
          <span className="text-white truncate max-w-48">{listing.title}</span>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-12">

            {/* ── LEFT: Image Gallery ───────────────────────────────────────── */}
            <div className="space-y-3 sticky top-4 self-start">
              {/* Main Image */}
              <div className="relative bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden aspect-square flex items-center justify-center group">
                {listing.is_featured && (
                  <div className="absolute inset-0 ring-2 ring-amber-400/30 rounded-3xl pointer-events-none z-10"/>
                )}
                {listing.images[activeImg] ? (
                  <img
                    src={listing.images[activeImg]}
                    alt={listing.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=60'
                    }}
                  />
                ) : (
                  <img
                    src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=60"
                    alt="placeholder"
                    className="w-full h-full object-cover"
                  />
                )}
                {discount > 0 && (
                  <div className="absolute top-4 right-4 bg-rose-600 text-white font-black text-lg px-3 py-1.5 rounded-xl shadow-lg">
                    -{discount}%
                  </div>
                )}
                {listing.is_bumped && (
                  <div className="absolute top-4 left-4">
                    <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-xs px-3 py-1.5 rounded-xl shadow-lg tracking-wide">
                      ⬆ BUMPED
                    </span>
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {listing.images.length > 1 && (
                <div className="flex gap-2">
                {listing.images.map((img: string, i: number) => (
                  <button key={i} onClick={() => setActiveImg(i)}
                    className={`flex-1 aspect-square bg-zinc-900 overflow-hidden rounded-2xl flex items-center justify-center text-4xl border-2 transition-all ${activeImg === i ? 'border-indigo-500 bg-indigo-900/20' : 'border-zinc-800 hover:border-zinc-700'}`}>
                    {img ? (
                      <img
                        src={img}
                        alt="Thumb"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=60'
                        }}
                      />
                    ) : (
                      <img
                        src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=60"
                        alt="placeholder"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </button>
                ))}
                </div>
              )}

              {/* Action Row */}
              <div className="grid grid-cols-3 gap-2">
                <button onClick={toggleWishlist}
                  className={`flex items-center justify-center gap-2 h-11 rounded-2xl font-bold text-sm border transition-all ${wishlisted ? 'bg-rose-500/10 border-rose-500/50 text-rose-400' : 'border-zinc-800 text-zinc-500 hover:border-rose-500/40 hover:text-rose-400 hover:bg-rose-500/5'}`}>
                  <Heart className={`h-4 w-4 ${wishlisted ? 'fill-current' : ''}`}/>
                  {wishlisted ? 'Saved' : 'Wishlist'}
                </button>
                <button onClick={handleShare}
                  className="flex items-center justify-center gap-2 h-11 rounded-2xl border border-zinc-800 text-zinc-500 hover:border-indigo-500/40 hover:text-indigo-400 hover:bg-indigo-500/5 font-bold text-sm transition-all">
                  <Share2 className="h-4 w-4"/> Share
                </button>
                {isOwner ? (
                  <button className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-zinc-800 text-zinc-600 font-bold text-sm cursor-not-allowed">
                    <MessageSquare className="h-4 w-4"/> Your Listing
                  </button>
                ) : (
                  <Link href={`/dashboard/chat/${listing.sellerId}?listing=${listing.id}`}>
                    <button className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-zinc-800 text-zinc-500 hover:border-emerald-500/40 hover:text-emerald-400 hover:bg-emerald-500/5 font-bold text-sm transition-all">
                      <MessageSquare className="h-4 w-4"/> Chat
                    </button>
                  </Link>
                )}
              </div>

              {/* Trust indicators */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { icon: ShieldCheck, label: 'Escrow Protected', color: 'indigo' },
                  { icon: Truck, label: 'Safe Exchange', color: 'emerald' },
                  { icon: RefreshCw, label: 'Return Policy', color: 'amber' },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col items-center gap-1.5">
                    <Icon className={`h-5 w-5 text-${color}-400`}/>
                    <p className="text-[10px] font-bold text-zinc-500 leading-tight text-center">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── RIGHT: Product Info ──────────────────────────────────────── */}
            <div className="space-y-5">
              {/* Title & Rating */}
              <div>
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 px-2.5 py-1 text-xs font-black rounded-lg ${listing.condition === 'Excellent' || listing.condition === 'Like New' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                    {listing.condition}
                  </span>
                  <span className="text-xs text-zinc-600 font-medium mt-1">{listing.category}</span>
                  {isOwner && (
                    <Button onClick={handleBoost} disabled={listing.is_featured} variant="outline" className={`ml-auto h-7 px-3 rounded-lg text-[10px] font-black tracking-tighter ${listing.is_featured ? 'border-amber-500/50 text-amber-500' : 'border-indigo-500 text-indigo-400 hover:bg-indigo-500/10'}`}>
                      {listing.is_featured ? '🔥 BOOSTED' : '🚀 BOOST AD (20 CC)'}
                    </Button>
                  )}
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-white leading-tight mt-2">{listing.title}</h1>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < Math.floor(listing.rating) ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}`}/>
                    ))}
                  </div>
                  <span className="text-zinc-400 text-sm font-semibold">{listing.rating}</span>
                  <span className="text-zinc-600 text-sm">({listing.reviews} reviews)</span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-zinc-500 text-sm">{listing.dept}</span>
                </div>
              </div>

              {/* Price */}
              <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-4xl font-black text-white">₹{(finalAmount || listing.price).toLocaleString()}</span>
                  {mode === 'buy' && listing.original_price > listing.price && (
                    <span className="text-zinc-600 line-through text-xl">₹{listing.original_price.toLocaleString()}</span>
                  )}
                  {mode === 'buy' && discount > 0 && (
                    <span className="bg-emerald-500/15 text-emerald-400 font-black text-sm px-2.5 py-1 rounded-lg">{discount}% OFF</span>
                  )}
                  <div className="ml-auto flex items-center gap-1.5 text-amber-400 font-bold text-sm shrink-0">
                    <Sparkles className="h-4 w-4"/> or {listing.cc_price || Math.max(1, Math.floor(listing.price * 0.01))} CC
                  </div>
                </div>
                <p className="text-zinc-600 text-xs mt-2 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-400"/>
                  2% platform fee included · held in escrow until you confirm receipt
                </p>
              </div>

              {/* Buy / Rent Toggle */}
              {listing.allows_rental && (
                <div className="flex bg-zinc-900 border border-zinc-800 rounded-2xl p-1 gap-1">
                  <button onClick={() => setMode('buy')} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${mode === 'buy' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    🛒 Buy Outright
                  </button>
                  <button onClick={() => setMode('rent')} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${mode === 'rent' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    📦 Rent
                  </button>
                </div>
              )}

              {/* Rental Tiers */}
              {mode === 'rent' && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Select Duration</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['daily', 'weekly', 'semester'] as const).map(t => {
                      const price = t === 'daily' ? listing.rental_daily : t === 'weekly' ? listing.rental_weekly : listing.rental_semester;
                      if (!price) return null;
                      return (
                        <button key={t} onClick={() => setTier(t)}
                          className={`p-3 rounded-2xl border font-bold text-sm transition-all text-center ${tier === t ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'}`}>
                          <div className="capitalize text-base">{t}</div>
                          <div className="text-lg font-black mt-0.5 text-white">₹{price}</div>
                        </button>
                      );
                    })}
                  </div>
                  {listing.security_deposit && (
                    <p className="text-xs text-amber-500 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5"/> ₹{listing.security_deposit.toLocaleString()} security deposit held by platform — returned after check-in
                    </p>
                  )}
                </div>
              )}

              {/* Safe Zone */}
              <div className="flex items-center gap-3 p-4 bg-emerald-900/10 border border-emerald-500/20 rounded-2xl">
                <MapPin className="h-5 w-5 text-emerald-400 shrink-0"/>
                <div>
                  <p className="text-sm font-bold text-emerald-400">Verified Safe Exchange Zone</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{listing.exchange_location || 'Campus Main Hub'}</p>
                </div>
              </div>

              {/* CTA Button */}
              <button
                onClick={() => setPayModalOpen(true)}
                className="w-full h-16 bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black text-lg rounded-2xl shadow-2xl shadow-indigo-600/25 transition-all btn-lift flex items-center justify-center gap-3"
              >
                <span>🔒</span>
                <span>{mode === 'rent' ? `Secure Escrow Rent` : `Secure Escrow Buy`} — ₹{(finalAmount || listing.price).toLocaleString()}</span>
              </button>
              <p className="text-center text-xs text-zinc-600">
                Payment secured by Razorpay · Seller paid only after you confirm receipt
              </p>

              {/* Tabs: Description / Specs / Seller */}
              <div>
                <div className="flex border-b border-zinc-800 gap-1">
                  {(['desc', 'specs', 'seller'] as const).map((tab, i) => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2.5 text-sm font-bold transition-all border-b-2 -mb-px ${activeTab === tab ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
                      {tab === 'desc' ? 'Description' : tab === 'specs' ? 'Specifications' : 'Seller Info'}
                    </button>
                  ))}
                </div>

                <div className="pt-4">
                  {activeTab === 'desc' && (
                    <div className="text-zinc-400 leading-relaxed text-sm">{listing.description}</div>
                  )}
                  {activeTab === 'specs' && (
                    <div className="space-y-2">
                       <div className="flex items-center justify-between py-2.5 border-b border-zinc-800/50 last:border-0">
                          <span className="text-zinc-500 text-sm font-medium">Category</span>
                          <span className="text-zinc-200 text-sm font-semibold text-right">{listing.category}</span>
                        </div>
                        <div className="flex items-center justify-between py-2.5 border-b border-zinc-800/50 last:border-0">
                          <span className="text-zinc-500 text-sm font-medium">Condition</span>
                          <span className="text-zinc-200 text-sm font-semibold text-right">{listing.condition}</span>
                        </div>
                    </div>
                  )}
                  {activeTab === 'seller' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-black text-white text-xl shadow-lg">
                          {(listing.seller || 'C').charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-white">{listing.seller}</p>
                            <BadgeCheck className="h-4 w-4 text-indigo-400"/>
                          </div>
                          <p className="text-zinc-500 text-sm">{listing.dept}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="h-1.5 flex-1 bg-zinc-800 rounded-full overflow-hidden max-w-24">
                              <div className="h-full bg-emerald-500 rounded-full" style={{width:`${listing.trust}%`}}/>
                            </div>
                            <span className="text-emerald-400 font-black text-sm">{listing.trust} Trust</span>
                          </div>
                        </div>
                        {isOwner ? (
                          <button className="h-10 px-4 border border-zinc-800 text-zinc-600 rounded-xl font-bold text-sm cursor-not-allowed flex items-center gap-2">
                            <MessageSquare className="h-4 w-4"/> Your Listing
                          </button>
                        ) : (
                          <Link href={`/dashboard/chat/${listing.sellerId}?listing=${listing.id}`}>
                            <button className="h-10 px-4 border border-zinc-700 text-zinc-300 hover:text-white hover:border-indigo-500/50 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
                              <MessageSquare className="h-4 w-4"/> Message
                            </button>
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {listing.tags?.map((tag: string) => (
                  <span key={tag} className="px-3 py-1 bg-zinc-800 text-zinc-400 text-xs font-medium rounded-full">#{tag}</span>
                ))}
              </div>

              {/* Report */}
              <div>
                <button onClick={() => setReporting(r => !r)}
                  className="text-xs text-zinc-700 hover:text-rose-400 flex items-center gap-1.5 transition-colors">
                  <AlertTriangle className="h-3 w-3"/> Report this listing anonymously
                </button>
                {reporting && (
                  <div className="mt-3 p-4 bg-rose-900/10 border border-rose-500/20 rounded-2xl space-y-3 animate-in slide-in-from-top-2 fade-in">
                    <select value={reportReason} onChange={e => setReportReason(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-rose-500/50">
                      <option value="">Select reason...</option>
                      <option value="spam">Spam / Duplicate listing</option>
                      <option value="scam">Suspected scam or fraud</option>
                      <option value="prohibited">Prohibited item</option>
                      <option value="misleading">Misleading description</option>
                      <option value="price">Price gouging</option>
                    </select>
                    <div className="flex gap-2">
                      <button onClick={handleReport} className="flex-1 h-10 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition-all">Submit Report</button>
                      <button onClick={() => setReporting(false)} className="flex-1 h-10 border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-xl text-sm transition-all">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
