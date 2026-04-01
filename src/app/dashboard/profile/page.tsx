'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/client';
import {
  User,
  Package,
  Star,
  ShieldCheck,
  MapPin,
  Loader2,
  Edit3,
  ArrowUpRight,
  Zap,
  Info,
  Shield,
  Phone,
  Mail,
  Building2,
  BadgeCheck,
  TrendingUp,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=60';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [boostingId, setBoostingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const { data: listingsData } = await supabase.from('listings').select('*').eq('seller_id', user.id).order('created_at', { ascending: false });
      
      if (profileData) setProfile(profileData);
      if (listingsData) {
        const resolveImageUrl = async (url?: string | null) => {
          if (!url) return FALLBACK_IMAGE;
          if (url.startsWith('data:')) return url;
          if (url.startsWith('http')) return url;
          const { data: signed } = await supabase.storage.from('listing-images').createSignedUrl(url, 60 * 60 * 24 * 7);
          return signed?.signedUrl || FALLBACK_IMAGE;
        };
        const resolved = await Promise.all(
          listingsData.map(async (l: any) => ({
            ...l,
            image_url: await resolveImageUrl(l.image_url),
          })),
        );
        setMyListings(resolved);
      }
      setLoading(false);
    }
    
    fetchProfile();

    const channel = supabase.channel('user_profile_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => fetchProfile())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchProfile())
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleBoost = async (e: React.MouseEvent, listingId: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!profile) return;
    const cost = 20;
    if ((profile?.cc_points || 0) < cost) { alert('Not enough CC Points! You need 20 CC to boost your ad.'); return; }
    
    setBoostingId(listingId);
    const supabase = createClient();
    const { data, error } = await supabase
      .rpc('boost_listing_with_cc', { p_user: profile.id, p_listing: listingId, p_cost: cost })
      .single();

    if (!error && data?.success) {
      setBoostingId(null);
      setProfile((prev: any) => prev ? { ...prev, cc_points: data.remaining_cc } : prev);
      setMyListings((prev) => prev.map((l) => l.id === listingId ? { ...l, is_featured: true, is_bumped: true } : l));
      alert('🚀 Ad Boosted! Your listing will now appear at the top of the marketplace.');
      return;
    }

    // Fallback if RPC is missing in the schema cache
    const { data: freshProfile } = await supabase.from('profiles').select('cc_points').eq('id', profile.id).single();
    if ((freshProfile?.cc_points || 0) < cost) {
      setBoostingId(null);
      alert('Not enough CC Points after refresh.');
      return;
    }

    const { error: listError } = await supabase
      .from('listings')
      .update({ is_featured: true, is_bumped: true })
      .eq('id', listingId)
      .eq('seller_id', profile.id);

    const { error: debitError } = await supabase
      .from('profiles')
      .update({ cc_points: (freshProfile?.cc_points || 0) - cost })
      .eq('id', profile.id);

    setBoostingId(null);

    if (listError || debitError) {
      alert(error?.message || listError?.message || debitError?.message || 'Boost failed. Please run cc_boost_function.sql on Supabase for atomic boosts.');
      return;
    }

    setProfile((prev: any) => prev ? { ...prev, cc_points: (freshProfile?.cc_points || 0) - cost } : prev);
    setMyListings((prev) => prev.map((l) => l.id === listingId ? { ...l, is_featured: true, is_bumped: true } : l));
    alert('🚀 Ad Boosted! Your listing will now appear at the top of the marketplace.');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0f17] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#141416] p-4 flex items-center justify-center flex-col gap-4">
        <User className="h-16 w-16 text-gray-400"/>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Profile Not Found</h1>
        <p className="text-gray-500 dark:text-zinc-400">Please sign in to view your profile</p>
        <Link href="/login"><button className="px-6 py-2 bg-indigo-600 text-white rounded-xl">Sign In</button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0f17] p-4 md:p-8 font-sans text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Banner Section */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 md:p-8 border border-gray-200 dark:border-white/[0.07] flex flex-col md:flex-row gap-6 items-center md:items-start relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl pointer-events-none rounded-full"/>
          
          {/* Avatar */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-xl shadow-indigo-500/20">
              {profile.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <button className="absolute bottom-0 right-0 p-2 bg-white dark:bg-zinc-800 rounded-full border border-gray-200 dark:border-zinc-700 shadow-sm text-gray-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <Edit3 className="h-4 w-4"/>
            </button>
          </div>

          {/* Details */}
          <div className="flex-1 text-center md:text-left space-y-2 relative z-10 w-full">
            <div className="flex flex-col md:flex-row gap-2 md:items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">{profile.email.split('@')[0]}</h1>
                <p className="text-gray-500 dark:text-zinc-400 text-sm">{profile.email}</p>
              </div>
              <div className="flex justify-center md:justify-end gap-2 mt-2 md:mt-0">
                <div className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-bold flex items-center gap-1.5">
                  ⭐ <span className="mr-0.5">Trust:</span> {profile.trust_score}
                </div>
                <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-bold flex items-center gap-1.5">
                  🪙 <span className="mr-0.5">CC:</span> {profile.cc_points}
                </div>
              </div>
            </div>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-semibold text-gray-400 dark:text-zinc-500 pt-2">
                  <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-emerald-500"/> Verified Student ({profile.department || 'Undecided'})</span>
                  <span className="flex items-center gap-1"><MapPin className="h-4 w-4"/> Joined {new Date(profile.created_at).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1"><Info className="h-4 w-4 text-indigo-400"/> ID {profile.id}</span>
                </div>
            
            <div className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-gray-100 dark:border-white/[0.05] mt-4">
              <div className="text-left">
                <p className="text-gray-400 dark:text-zinc-500 text-[11px] uppercase tracking-wider font-semibold">Student Name</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{profile.student_name || 'Not set'}</p>
              </div>
              <div className="text-left">
                <p className="text-gray-400 dark:text-zinc-500 text-[11px] uppercase tracking-wider font-semibold">Full Name</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{profile.full_name || 'Not set'}</p>
              </div>
              <div className="text-left">
                <p className="text-gray-400 dark:text-zinc-500 text-[11px] uppercase tracking-wider font-semibold">Department</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{profile.department || 'Undecided'}</p>
              </div>
              <div className="text-left">
                <p className="text-gray-400 dark:text-zinc-500 text-[11px] uppercase tracking-wider font-semibold">Listings</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{myListings.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* My Listings Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-500"/> My Listings
            </h2>
            <Link href="/dashboard/create">
              <button className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:opacity-80 transition-opacity">
                + New Listing
              </button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myListings.length === 0 ? (
              <div className="col-span-full p-8 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/[0.07] rounded-3xl text-center flex flex-col items-center">
                <Package className="h-10 w-10 text-gray-300 dark:text-zinc-600 mb-2"/>
                <p className="text-gray-500 dark:text-zinc-400 font-medium">You haven't listed any items yet</p>
                <Link href="/dashboard/create">
                  <button className="mt-4 px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20 hover:bg-indigo-500">
                    Sell Your First Item
                  </button>
                </Link>
              </div>
            ) : (
              myListings.map(l => (
                <Link key={l.id} href={`/dashboard/product/${l.id}`}>
                  <Card className="bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 border-gray-200 dark:border-zinc-800 transition-all cursor-pointer rounded-2xl overflow-hidden group h-full flex flex-col">
                    <CardContent className="p-0 flex flex-col h-full">
                      <div className="aspect-[4/3] bg-gray-100 dark:bg-zinc-950 flex items-center justify-center text-4xl relative">
                        {l.image_url ? (
                          <img src={l.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=60'} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=60' }} />
                        ) : (
                          <img src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=60" className="w-full h-full object-cover" />
                        )}
                        
                        {/* Status Badge */}
                        <div className="absolute top-2 right-2">
                          {l.admin_status === 'APPROVED' ? (
                            <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-black tracking-widest uppercase rounded-lg shadow-sm border border-emerald-200 dark:border-emerald-500/30 backdrop-blur-md">LIVE</span>
                          ) : l.admin_status === 'REJECTED' ? (
                            <span className="px-2.5 py-1 bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-[10px] font-black tracking-widest uppercase rounded-lg shadow-sm border border-rose-200 dark:border-rose-500/30 backdrop-blur-md">REJECTED</span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-black tracking-widest uppercase rounded-lg shadow-sm border border-amber-200 dark:border-amber-500/30 backdrop-blur-md animate-pulse">PENDING REVIEW</span>
                          )}
                        </div>
                      </div>
                        <div className="p-4 flex flex-col flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <p className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1">{l.title}</p>
                            <ArrowUpRight className="h-4 w-4 text-gray-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"/>
                          </div>
                          
                          <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                            <p className="font-black text-indigo-600 dark:text-indigo-400 text-sm">₹{l.price}</p>
                            {l.admin_status === 'APPROVED' && !l.is_featured && (
                              <button onClick={(e) => handleBoost(e, l.id)}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white font-black text-[10px] rounded-lg shadow-lg shadow-amber-500/10 transition-all flex items-center gap-1">
                                <Zap className="h-3 w-3"/> BOOST
                              </button>
                            )}
                            {l.is_featured && (
                               <span className="text-[10px] font-black text-amber-500 uppercase tracking-tighter flex items-center gap-1">🚀 BOOSTED</span>
                            )}
                          </div>
                        </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
