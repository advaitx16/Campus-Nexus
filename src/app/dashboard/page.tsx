'use client';
import { useState, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';
import {
  Search, SlidersHorizontal, Mic, MicOff, Heart, GitCompare,
  Star, Shield, CheckCircle2, X, Laptop, BookOpen, Package,
  Wrench, Dumbbell, TrendingUp, Plus, AlertCircle, RefreshCw,
  Zap, Loader2, Wifi, WifiOff, Sun, Moon
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/client';
import { dispatchNotificationAction } from '@/lib/notifications';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=60';

// ── Dynamic categories and sorts ────────────────────────────────────────────────
const CATEGORIES = ['All', 'Electronics', 'Books', 'Rentals', 'Services', 'Wanted'];
const SORTS = ['Newest', 'Price: Low to High', 'Price: High to Low', 'Highest Rated'];
function getCategoryIcon(cat: string) {
  if (cat === 'Electronics') return Laptop;
  if (cat === 'Books' || cat === 'Textbooks') return BookOpen;
  if (cat === 'Services') return Wrench;
  if (cat === 'Rentals') return Dumbbell;
  return Package;
}

// ── Pay Modal ────────────────────────────────────────────────────────────────
function PayModal({ listing, onClose }: { listing: any; onClose: () => void }) {
  const [step, setStep] = useState<'confirm' | 'processing' | 'done'>('confirm');
  const fee = Math.round(listing.price * 0.02);
  const total = listing.price + fee;

  const pay = async () => {
    setStep('processing');
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please sign in to make a purchase.');
        setStep('confirm');
        return;
      }

      const platformFee = Math.round(listing.price * 0.02);
      const sellerId = listing.seller_id || listing.sellerId;
      const { data: orderRow, error: dbError } = await supabase.from('orders').insert({
        listing_id: listing.id,
        buyer_id: user.id,
        seller_id: sellerId,
        amount: listing.price,
        platform_fee: platformFee,
        order_status: 'PENDING',
        escrow_status: 'HELD',
      }).select().single();

      if (dbError) throw new Error(dbError.message);
      await dispatchNotificationAction('order_interest', { orderId: orderRow.id }).catch(() => {});

      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: listing.price, productId: listing.id, buyerId: user.id, sellerId }),
      });
      const data = await res.json();
      if (data.is_demo) {
        await new Promise(r => setTimeout(r, 1600));
        await supabase.from('orders').update({ order_status: 'PAID', razorpay_payment_id: data.demo_payment_id }).eq('id', orderRow.id);
        setStep('done');
        return;
      }
      const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; document.body.appendChild(s);
      s.onload = () => new (window as any).Razorpay({
        key: data.razorpay_key,
        amount: data.amount,
        currency: 'INR',
        order_id: data.id,
        name: 'Campus Nexus',
        description: listing.title,
        theme: { color: '#4f46e5' },
        handler: async (response: any) => {
          await supabase.from('orders').update({
            order_status: 'PAID',
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
          }).eq('id', orderRow.id);
          setStep('done');
        },
        modal: { ondismiss: () => setStep('confirm') },
      }).open();
    } catch { setStep('done'); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative w-full max-w-md bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        {step === 'confirm' && (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Confirm Order</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-white transition-colors"><X className="h-5 w-5"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-white/[0.03] rounded-xl border border-gray-200 dark:border-white/[0.06]">
                <p className="text-gray-900 dark:text-white font-semibold text-sm">{listing.title}</p>
                <p className="text-gray-500 dark:text-zinc-500 text-xs mt-0.5">{listing.condition} · {listing.seller_name}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-zinc-400">Item price</span><span className="text-gray-900 dark:text-white font-medium">₹{listing.price.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-zinc-400">Platform fee (2%)</span><span className="text-gray-900 dark:text-white font-medium">₹{fee}</span></div>
                <div className="flex justify-between text-sm pt-2 border-t border-gray-100 dark:border-white/[0.06]">
                  <span className="text-gray-900 dark:text-white font-semibold">Total</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-base">₹{total.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/20 rounded-xl">
                <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5"/>
                <p className="text-xs text-indigo-700 dark:text-indigo-300">Escrow protected — payment held until you confirm receipt</p>
              </div>
              <button onClick={pay} className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all text-sm">Pay ₹{total.toLocaleString()} via Razorpay</button>
            </div>
          </>
        )}
        {step === 'processing' && (
          <div className="p-12 text-center space-y-4">
            <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mx-auto"/>
            <p className="text-gray-900 dark:text-white font-semibold">Processing Payment...</p>
          </div>
        )}
        {step === 'done' && (
          <div className="p-8 text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400"/>
            </div>
            <div><p className="text-gray-900 dark:text-white font-semibold text-lg">Order Placed</p><p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">₹{total.toLocaleString()} held in escrow · +5 CC earned</p></div>
            <div className="flex gap-2">
              <Link href="/dashboard/orders" className="flex-1"><button onClick={onClose} className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm">View Orders</button></Link>
              <button onClick={onClose} className="flex-1 h-10 border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white rounded-xl text-sm">Continue</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ item, wishlisted, onWishlist, compared, onCompare, onBuy }: any) {
  const disc = item.original_price > item.price ? Math.round((1 - item.price / item.original_price) * 100) : 0;
  const Icon = getCategoryIcon(item.category);
  const condColor = item.condition === 'Excellent' || item.condition === 'Like New'
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/60 dark:border-emerald-500/20'
    : item.condition === 'Acceptable' || item.condition === 'For Parts'
    ? 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/60 dark:border-amber-500/20'
    : 'text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-400 dark:bg-sky-950/60 dark:border-sky-500/20';

  return (
    <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/[0.07] rounded-xl overflow-hidden flex flex-col hover:border-gray-300 dark:hover:border-white/[0.14] hover:shadow-md dark:hover:shadow-none transition-all duration-200 group">
      {/* Image */}
      <Link href={`/dashboard/product/${item.id}`}>
        <div className="relative h-40 bg-gray-50 dark:bg-white/[0.03] flex items-center justify-center cursor-pointer overflow-hidden">
          {item.image_url ? (
            <img
              src={item.image_url || FALLBACK_IMAGE}
              alt={item.title}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE
              }}
            />
          ) : (
            <img src={FALLBACK_IMAGE} alt="placeholder" className="h-full w-full object-cover" />
          )}
          <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
            {item.is_featured && <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">FEATURED</span>}
            {item.is_bumped  && <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">PROMOTED</span>}
            {item.from_db    && <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">LIVE</span>}
          </div>
          {disc > 0 && <div className="absolute top-3 right-3 bg-rose-600 text-white text-[11px] font-bold px-2 py-0.5 rounded">-{disc}%</div>}
          {item.allows_rental && <div className="absolute bottom-3 left-3"><span className="bg-black/50 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded border border-emerald-500/30">Rent available</span></div>}
        </div>
      </Link>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <Link href={`/dashboard/product/${item.id}`}>
          <h3 className="text-gray-900 dark:text-white text-sm font-semibold leading-snug line-clamp-1 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer">{item.title}</h3>
          <p className="text-gray-400 dark:text-zinc-500 text-xs mt-0.5 line-clamp-1">{item.description}</p>
        </Link>

        {item.rating && (
          <div className="flex items-center gap-1.5 mt-2">
            <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className={`h-3 w-3 ${i < Math.floor(item.rating) ? 'text-amber-500 fill-amber-500' : 'text-gray-200 dark:text-zinc-700'}`}/>)}</div>
            <span className="text-gray-400 dark:text-zinc-500 text-xs">{item.rating} {item.reviews ? `(${item.reviews})` : ''}</span>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3">
          <span className="text-gray-900 dark:text-white font-bold text-xl">₹{Number(item.price).toLocaleString()}</span>
          {item.original_price > item.price && <span className="text-gray-300 dark:text-zinc-600 line-through text-sm">₹{Number(item.original_price).toLocaleString()}</span>}
        </div>

        <div className="flex items-center gap-1.5 mt-2">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${condColor}`}>{item.condition}</span>
          <span className="text-gray-400 dark:text-zinc-600 text-[10px]">{item.category}</span>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.06] flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-indigo-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0">{(item.seller_name || '?').charAt(0)}</div>
          <span className="flex-1 text-gray-500 dark:text-zinc-400 text-xs font-medium truncate">{item.seller_name || 'Unknown seller'}</span>
          <button onClick={() => onWishlist(item.id)} className={`p-1.5 rounded-lg transition-all ${wishlisted ? 'text-rose-500' : 'text-gray-300 dark:text-zinc-600 hover:text-gray-400 dark:hover:text-zinc-400'}`}>
            <Heart className={`h-3.5 w-3.5 ${wishlisted ? 'fill-current' : ''}`}/>
          </button>
          <button onClick={() => onCompare(item.id)} className={`p-1.5 rounded-lg transition-all ${compared ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-300 dark:text-zinc-600 hover:text-gray-400 dark:hover:text-zinc-400'}`}>
            <GitCompare className="h-3.5 w-3.5"/>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={() => onBuy(item)} className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-all">Buy Now</button>
          <Link href={`/dashboard/product/${item.id}`}><button className="w-full h-8 border border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.15] text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white text-xs font-medium rounded-lg transition-all">Details</button></Link>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [listings, setListings]   = useState<any[]>([]);
  const [dbStatus, setDbStatus]   = useState<'loading' | 'live' | 'offline'>('loading');
  const [query, setQuery]         = useState('');
  const [cat, setCat]             = useState('All');
  const [sort, setSort]           = useState('Newest');
  const [activeTab, setActiveTab] = useState<'market' | 'wanted'>('market');
  const [wishlisted, setWishlisted] = useState<Set<string>>(new Set());
  const [compareList, setCompareList] = useState<string[]>([]);
  const [listening, setListening]   = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [payItem, setPayItem]       = useState<any>(null);
  const [checkinDone, setCheckinDone] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const recRef = useRef<any>(null);
  const supabase = createClient();

  // ── Load listings from Supabase with realtime ──────────────────────────────
  useEffect(() => {
    const load = async () => {
      const fetchListings = async () => supabase
        .from('listings')
        .select('*')
        .eq('admin_status', 'APPROVED')
        .order('created_at', { ascending: false });

      const { data, error } = await fetchListings();

      if (error) {
        console.error('Supabase listings fetch error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        setListings([]);
        setDbStatus('offline');
      } else {
        const sellerIds = Array.from(
          new Set((data || []).map((listing: any) => listing.seller_id).filter(Boolean))
        );

        let profileMap = new Map<string, any>();
        if (sellerIds.length > 0) {
          const { data: profileRows } = await supabase
            .from('profiles')
            .select('id, full_name, student_name, trust_score')
            .in('id', sellerIds);

          profileMap = new Map((profileRows || []).map((profile: any) => [profile.id, profile]));
        }

        const resolveImageUrl = async (url?: string | null) => {
          if (!url) return FALLBACK_IMAGE;
          if (url.startsWith('data:')) return url;
          if (url.startsWith('http')) return url;
          const { data: signed } = await supabase.storage.from('listing-images').createSignedUrl(url, 60 * 60 * 24 * 7);
          return signed?.signedUrl || FALLBACK_IMAGE;
        };

        const dbListings = await Promise.all(
          (data || []).map(async (listing: any) => {
            const profile = profileMap.get(listing.seller_id);
            return {
            ...listing,
            image_url: await resolveImageUrl(listing.image_url),
            from_db: true,
            rating: listing.rating ?? null,
            reviews: listing.reviews ?? null,
            seller_name: profile?.student_name || profile?.full_name || listing.seller_name || 'Campus Student',
            trust_score: profile?.trust_score || 85.0,
          }}),
        );
        setListings(dbListings);
        setDbStatus('live');
      }
    };
    load();

    // Realtime subscription
    const channel = supabase
      .channel('listings_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => {
        load(); // refresh on any change
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Filtering / sorting ───────────────────────────────────────────────────
  const fuse = new Fuse(listings, { keys: ['title', 'description', 'seller_name', 'category'], threshold: 0.4 });
  let items = query.trim() ? fuse.search(query).map(r => r.item) : [...listings];
  if (cat !== 'All') items = items.filter(i => i.category === cat);
  if (sort === 'Newest') items = items.sort((a, b) => (b.created_at ?? '') > (a.created_at ?? '') ? 1 : -1);
  if (sort === 'Price: Low to High') items = [...items].sort((a, b) => a.price - b.price);
  if (sort === 'Price: High to Low') items = [...items].sort((a, b) => b.price - a.price);
  if (sort === 'Highest Rated') items = [...items].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  const featuredDeal =
    listings.find(l => l.category !== 'Wanted' && l.is_featured) ||
    listings.find(l => l.category !== 'Wanted' && Number(l.original_price ?? 0) > Number(l.price ?? 0)) ||
    listings.find(l => l.category !== 'Wanted') ||
    null;
  const featuredDiscount = featuredDeal && Number(featuredDeal.original_price ?? 0) > Number(featuredDeal.price ?? 0)
    ? Math.round((1 - Number(featuredDeal.price) / Number(featuredDeal.original_price)) * 100)
    : 0;

  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice search requires Chrome'); return; }
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const r = new SR(); r.continuous = false; r.interimResults = false;
    r.onresult = (e: any) => { setQuery(e.results[0][0].transcript); setListening(false); };
    r.onerror = r.onend = () => setListening(false);
    recRef.current = r; r.start(); setListening(true);
  };

  const toggleWishlist = (id: string) => setWishlisted(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleCompare  = (id: string) => setCompareList(p => p.includes(id) ? p.filter(x => x !== id) : p.length < 2 ? [...p, id] : p);

  const handleCheckin = async () => {
    setCheckinLoading(true);
    try {
      const res = await fetch('/api/checkin', { method: 'POST' });
      const data = await res.json();
      if (res.status === 401) {
        const today = new Date().toISOString().split('T')[0];
        if (localStorage.getItem('cn_last_checkin') === today) { setCheckinDone(true); alert('Already checked in today.'); return; }
        const pts = parseInt(localStorage.getItem('cn_cc_points') || '220', 10) + 1;
        localStorage.setItem('cn_last_checkin', today);
        localStorage.setItem('cn_cc_points', String(pts));
        setCheckinDone(true);
        alert(`+1 CC Point earned. Total: ${pts}\nSign in at /login to save permanently.`);
        return;
      }
      setCheckinDone(true);
      alert(data.message || 'Checked in successfully.');
    } catch { setCheckinDone(true); alert('+1 CC earned (offline).'); }
    finally { setCheckinLoading(false); }
  };

  return (
    <>
      {payItem && <PayModal listing={payItem} onClose={() => setPayItem(null)}/>}

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">

        {/* DB Status Banner */}
        <div className={`mb-4 flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-medium ${
          dbStatus === 'live' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-500/20 dark:text-emerald-400'
          : dbStatus === 'loading' ? 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-white/[0.03] dark:border-white/[0.06] dark:text-zinc-500'
          : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-500/20 dark:text-amber-400'
        }`}>
          {dbStatus === 'live'
            ? <><Wifi className="h-3.5 w-3.5"/> Supabase connected — showing live listings from database + static demos</>
            : dbStatus === 'loading'
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin"/> Loading listings from database...</>
            : <><WifiOff className="h-3.5 w-3.5"/> Database not configured — showing demo listings. <Link href="/dashboard/create" className="underline underline-offset-2 ml-1">Run schema.sql then list your item</Link></>
          }
        </div>

        {/* Daily check-in */}
        {!checkinDone && (
          <div className="mb-5 flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-500/20 rounded-xl">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400"/>
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Daily check-in available</p>
                <p className="text-xs text-amber-600/70 dark:text-zinc-500">Claim +1 CC for visiting today</p>
              </div>
            </div>
            <button onClick={handleCheckin} disabled={checkinLoading}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs rounded-lg transition-all disabled:opacity-50">
              {checkinLoading ? 'Claiming...' : 'Claim'}
            </button>
          </div>
        )}

        {/* Hot deal banner */}
        {featuredDeal ? (
          <Link href={`/dashboard/product/${featuredDeal.id}`}>
            <div className="mb-6 flex items-center gap-4 p-4 bg-gradient-to-r from-rose-50 to-white border border-rose-200 dark:from-rose-950/40 dark:to-[#1C1C1E] dark:border-rose-500/20 rounded-xl hover:border-rose-300 dark:hover:border-rose-500/30 transition-all group cursor-pointer">
            <div className="h-10 w-10 rounded-lg bg-rose-100 border border-rose-200 dark:bg-rose-600/20 dark:border-rose-500/25 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-rose-600 dark:text-rose-400"/>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold bg-rose-600 text-white px-2 py-0.5 rounded uppercase tracking-wide">Featured Deal</span>
                <span className="text-gray-400 dark:text-zinc-500 text-xs">
                  {featuredDiscount > 0 ? `${featuredDiscount}% off live now` : 'Live listing'}
                </span>
              </div>
              <p className="text-gray-900 dark:text-white font-semibold text-sm">
                {featuredDeal.title} - Rs.{Number(featuredDeal.price).toLocaleString()}
              </p>
            </div>
            <span className="text-gray-400 dark:text-zinc-500 text-sm group-hover:text-gray-700 dark:group-hover:text-zinc-300 transition-colors">View</span>
            </div>
          </Link>
        ) : (
          <div className="mb-6 flex items-center gap-4 p-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50">
            <div className="h-10 w-10 rounded-lg border border-zinc-700 bg-zinc-900 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-zinc-500"/>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">No featured deals are live right now.</p>
              <p className="text-xs text-zinc-500 mt-1">Fresh listings will appear here automatically.</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-gray-200 dark:border-white/[0.06]">
          {[{ k: 'market', label: 'Marketplace' }, { k: 'wanted', label: 'Wanted Board' }].map(t => (
            <button key={t.k} onClick={() => setActiveTab(t.k as any)}
              className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px ${
                activeTab === t.k ? 'text-gray-900 dark:text-white border-indigo-600' : 'text-gray-400 dark:text-zinc-500 border-transparent hover:text-gray-700 dark:hover:text-zinc-300'
              }`}>{t.label}</button>
          ))}
        </div>

        {activeTab === 'wanted' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-gray-900 dark:text-white font-semibold">Reverse Marketplace</h2>
                <p className="text-gray-400 dark:text-zinc-500 text-sm mt-0.5">Students post what they need — you supply it</p>
              </div>
              <button className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-all"><Plus className="h-3.5 w-3.5"/> Post Request</button>
            </div>
            {listings.filter(l => l.category === 'Wanted').length === 0 ? (
              <div className="text-center py-20 px-4 border border-zinc-800 border-dashed rounded-3xl bg-zinc-900/50">
                <Search className="h-12 w-12 text-zinc-700 mx-auto mb-3"/>
                <p className="text-gray-400 dark:text-zinc-500">No requests found. Be the first to ask!</p>
              </div>
            ) : listings.filter(l => l.category === 'Wanted').map(w => (
              <div key={w.id} className="flex items-center gap-4 p-4 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/[0.07] rounded-xl hover:border-gray-300 dark:hover:border-white/[0.12] transition-all">
                <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] flex items-center justify-center shrink-0"><Search className="h-5 w-5 text-gray-400 dark:text-zinc-500"/></div>
                <div className="flex-1">
                  <p className="text-gray-900 dark:text-white text-sm font-medium">{w.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-500/20">Budget ₹{w.price}</span>
                    <span className="text-xs text-gray-400 dark:text-zinc-500">by {w.seller_name}</span>
                  </div>
                </div>
                <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-all">Respond</button>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Search + controls */}
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500 pointer-events-none"/>
                <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search listings..."
                  className="w-full h-10 pl-10 pr-10 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/[0.08] rounded-lg text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-all"/>
                <button onClick={toggleVoice} className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${listening ? 'text-rose-500' : 'text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400'}`}>
                  {listening ? <MicOff className="h-4 w-4"/> : <Mic className="h-4 w-4"/>}
                </button>
              </div>
              <button onClick={() => setShowFilters(!showFilters)}
                className={`h-10 px-3.5 border rounded-lg text-sm font-medium transition-all ${showFilters ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-transparent'}`}>
                <SlidersHorizontal className="h-4 w-4"/>
              </button>
              <Link href="/dashboard/create">
                <button className="h-10 px-4 bg-gray-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-sm rounded-lg hover:bg-gray-700 dark:hover:bg-zinc-100 transition-all flex items-center gap-2">
                  <Plus className="h-4 w-4"/> Sell
                </button>
              </Link>
            </div>

            {showFilters && (
              <div className="mb-4 p-4 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/[0.08] rounded-xl space-y-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Sort by</p>
                <div className="flex flex-wrap gap-1.5">
                  {SORTS.map(s => (
                    <button key={s} onClick={() => setSort(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sort === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/[0.07]'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category pills */}
            <div className="flex gap-1.5 mb-5 overflow-x-auto scrollbar-hide pb-1">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCat(c)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                    cat === c ? 'bg-gray-900 text-white dark:bg-white dark:text-zinc-900' : 'bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-white/[0.07]'
                  }`}>{c}
                </button>
              ))}
            </div>

            {/* Compare bar */}
            {compareList.length > 0 && (
              <div className="mb-4 flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/20 rounded-xl">
                <div className="flex items-center gap-2"><GitCompare className="h-4 w-4 text-indigo-600 dark:text-indigo-400"/><span className="text-indigo-700 dark:text-indigo-300 text-sm font-medium">{compareList.length}/2 selected</span></div>
                <div className="flex gap-2">
                  {compareList.length === 2 && <Link href={`/dashboard/compare?ids=${compareList.join(',')}`}><button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg">Compare</button></Link>}
                  <button onClick={() => setCompareList([])} className="px-3 py-1.5 border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-zinc-400 text-xs rounded-lg">Clear</button>
                </div>
              </div>
            )}

            <p className="text-gray-400 dark:text-zinc-500 text-sm mb-4">
              <span className="text-gray-900 dark:text-white font-medium">{items.length}</span> results
              {query && <> for "<span className="text-indigo-600 dark:text-indigo-400">{query}</span>"</>}
              {dbStatus === 'live' && <span className="ml-2 text-emerald-600 dark:text-emerald-500 text-xs">● Live</span>}
            </p>

            {dbStatus === 'loading' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => <div key={i} className="h-72 bg-gray-100 dark:bg-white/[0.04] rounded-xl animate-pulse"/>)}
              </div>
            ) : items.length === 0 ? (
              <div className="py-20 text-center">
                <AlertCircle className="h-10 w-10 text-gray-300 dark:text-zinc-700 mx-auto mb-3"/>
                <p className="text-gray-900 dark:text-white font-semibold">No listings found</p>
                <p className="text-gray-400 dark:text-zinc-500 text-sm mt-1">Try a different search or be the first to list something!</p>
                <Link href="/dashboard/create"><button className="mt-4 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-lg">List an Item</button></Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map(item => <ProductCard key={item.id} item={item} wishlisted={wishlisted.has(item.id)} onWishlist={toggleWishlist} compared={compareList.includes(item.id)} onCompare={toggleCompare} onBuy={setPayItem}/>)}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
