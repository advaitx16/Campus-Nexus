'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/client';
import { ArrowUpRight, Edit3, Info, Loader2, MapPin, Package, ShieldCheck, User, Zap, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { dispatchNotificationAction } from '@/lib/notifications';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=60';

function getProfileName(profile?: any) {
  return profile?.student_name || profile?.full_name || 'Campus buyer';
}

function getOrderBadge(order: any) {
  if (order.order_status === 'COMPLETE' || order.escrow_status === 'RELEASED') {
    return { label: 'Completed', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' };
  }

  if (order.order_status === 'PAID' || order.escrow_status === 'HELD') {
    return { label: 'Buyer Interested', className: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25' };
  }

  return { label: order.order_status || 'Order Open', className: 'bg-amber-500/15 text-amber-400 border-amber-500/25' };
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [boostingId, setBoostingId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    student_name: '',
    department: '',
  });

  useEffect(() => {
    const supabase = createClient();

    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [{ data: profileData }, { data: listingsData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('listings').select('*').eq('seller_id', user.id).order('created_at', { ascending: false }),
      ]);

      if (profileData) {
        setProfile(profileData);
        setProfileForm({
          full_name: profileData.full_name || '',
          student_name: profileData.student_name || '',
          department: profileData.department || '',
        });
      }

      if (!listingsData || listingsData.length === 0) {
        setMyListings([]);
        setLoading(false);
        return;
      }

      const resolveImageUrl = async (url?: string | null) => {
        if (!url) return FALLBACK_IMAGE;
        if (url.startsWith('data:') || url.startsWith('http')) return url;
        const { data: signed } = await supabase.storage.from('listing-images').createSignedUrl(url, 60 * 60 * 24 * 7);
        return signed?.signedUrl || FALLBACK_IMAGE;
      };

      const resolvedListings = await Promise.all(
        listingsData.map(async (listing: any) => ({
          ...listing,
          image_url: await resolveImageUrl(listing.image_url),
        })),
      );

      const listingIds = resolvedListings.map((listing: any) => listing.id);
      const { data: orderRows } = await supabase
        .from('orders')
        .select('id, listing_id, buyer_id, seller_id, amount, order_status, escrow_status, created_at')
        .in('listing_id', listingIds)
        .order('created_at', { ascending: false });

      const orders = orderRows || [];
      const buyerIds = Array.from(new Set(orders.map((order: any) => order.buyer_id).filter(Boolean)));
      const orderIds = orders.map((order: any) => order.id);

      const [{ data: buyerProfiles }, { data: reviewRows }] = await Promise.all([
        buyerIds.length > 0
          ? supabase.from('profiles').select('id, full_name, student_name, department, trust_score').in('id', buyerIds)
          : Promise.resolve({ data: [] as any[] }),
        orderIds.length > 0
          ? supabase.from('seller_reviews').select('*').in('order_id', orderIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const buyerMap = new Map((buyerProfiles || []).map((buyer: any) => [buyer.id, buyer]));
      const reviewMap = new Map((reviewRows || []).map((review: any) => [review.order_id, review]));

      setMyListings(
        resolvedListings.map((listing: any) => ({
          ...listing,
          activity: orders
            .filter((order: any) => order.listing_id === listing.id)
            .map((order: any) => ({
              ...order,
              buyer_profile: buyerMap.get(order.buyer_id) || null,
              review: reviewMap.get(order.id) || null,
            })),
        })),
      );

      setLoading(false);
    }

    fetchProfile().catch(() => setLoading(false));

    const channel = supabase.channel('user_profile_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => fetchProfile())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchProfile())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchProfile())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seller_reviews' }, () => fetchProfile())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleBoost = async (e: React.MouseEvent, listingId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!profile) return;

    const cost = 20;
    if ((profile?.cc_points || 0) < cost) {
      alert('Not enough CC Points! You need 20 CC to boost your ad.');
      return;
    }

    setBoostingId(listingId);
    const supabase = createClient();
    const { data, error } = await supabase
      .rpc('boost_listing_with_cc', { p_user: profile.id, p_listing: listingId, p_cost: cost })
      .single();
    const boostResult = data as { success?: boolean; remaining_cc?: number } | null;

    if (!error && boostResult?.success) {
      setBoostingId(null);
      setProfile((prev: any) => prev ? { ...prev, cc_points: boostResult.remaining_cc } : prev);
      setMyListings((prev) => prev.map((listing) => listing.id === listingId ? { ...listing, is_featured: true, is_bumped: true } : listing));
      dispatchNotificationAction('boost_listing', { listingId }).catch(() => {});
      alert('Your listing is boosted and all active users were notified.');
      return;
    }

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
    setMyListings((prev) => prev.map((listing) => listing.id === listingId ? { ...listing, is_featured: true, is_bumped: true } : listing));
    dispatchNotificationAction('boost_listing', { listingId }).catch(() => {});
    alert('Your listing is boosted and all active users were notified.');
  };

  const handleProfileSave = async () => {
    if (!profile?.id) return;

    setSavingProfile(true);
    const supabase = createClient();
    const payload = {
      full_name: profileForm.full_name.trim(),
      student_name: profileForm.student_name.trim(),
      department: profileForm.department.trim(),
    };

    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', profile.id);

    setSavingProfile(false);

    if (error) {
      alert(error.message);
      return;
    }

    setProfile((prev: any) => prev ? { ...prev, ...payload } : prev);
    setEditingProfile(false);
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
        {editingProfile && (
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingProfile(false)}>
            <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-white">Edit Public Profile</h2>
                  <p className="text-sm text-zinc-500 mt-1">This info shows up in chat, listings, and live buyer activity.</p>
                </div>
                <button onClick={() => setEditingProfile(false)} className="text-zinc-500 hover:text-white transition-colors">Close</button>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Full Name</label>
                  <input
                    value={profileForm.full_name}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, full_name: event.target.value }))}
                    placeholder="Your real full name"
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Display Name</label>
                  <input
                    value={profileForm.student_name}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, student_name: event.target.value }))}
                    placeholder="Name visible to other students"
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Class / Division</label>
                  <input
                    value={profileForm.department}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, department: event.target.value }))}
                    placeholder="Example: Applied Mathematics - FY Diploma Sem 2 - A"
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleProfileSave}
                  disabled={savingProfile}
                  className="flex-1 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-4 py-3 text-sm font-bold text-white transition-colors"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
                <button
                  onClick={() => setEditingProfile(false)}
                  className="rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 md:p-8 border border-gray-200 dark:border-white/[0.07] flex flex-col md:flex-row gap-6 items-center md:items-start relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl pointer-events-none rounded-full"/>

          <div className="relative group shrink-0">
            <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-xl shadow-indigo-500/20">
              {profile.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <button onClick={() => setEditingProfile(true)} className="absolute bottom-0 right-0 p-2 bg-white dark:bg-zinc-800 rounded-full border border-gray-200 dark:border-zinc-700 shadow-sm text-gray-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <Edit3 className="h-4 w-4"/>
            </button>
          </div>

          <div className="flex-1 text-center md:text-left space-y-2 relative z-10 w-full">
            <div className="flex flex-col md:flex-row gap-2 md:items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">{profile.student_name || profile.full_name || profile.email.split('@')[0]}</h1>
                <p className="text-gray-500 dark:text-zinc-400 text-sm">{profile.email}</p>
              </div>
              <div className="flex justify-center md:justify-end gap-2 mt-2 md:mt-0">
                <div className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-bold flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5"/> Trust: {profile.trust_score}
                </div>
                <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-bold flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5"/> CC: {profile.cc_points}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-semibold text-gray-400 dark:text-zinc-500 pt-2">
              <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-emerald-500"/> Verified Student ({profile.department || 'Class not set'})</span>
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
                <p className="text-gray-400 dark:text-zinc-500 text-[11px] uppercase tracking-wider font-semibold">Class / Division</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{profile.department || 'Not set'}</p>
              </div>
              <div className="text-left">
                <p className="text-gray-400 dark:text-zinc-500 text-[11px] uppercase tracking-wider font-semibold">Listings</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{myListings.length}</p>
              </div>
            </div>
          </div>
        </div>

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
              myListings.map(listing => (
                <Link key={listing.id} href={`/dashboard/product/${listing.id}`}>
                  <Card className="bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 border-gray-200 dark:border-zinc-800 transition-all cursor-pointer rounded-2xl overflow-hidden group h-full flex flex-col">
                    <CardContent className="p-0 flex flex-col h-full">
                      <div className="aspect-[4/3] bg-gray-100 dark:bg-zinc-950 flex items-center justify-center text-4xl relative">
                        <img
                          src={listing.image_url || FALLBACK_IMAGE}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE; }}
                        />

                        <div className="absolute top-2 right-2">
                          {listing.admin_status === 'APPROVED' ? (
                            <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-black tracking-widest uppercase rounded-lg shadow-sm border border-emerald-200 dark:border-emerald-500/30 backdrop-blur-md">Live</span>
                          ) : listing.admin_status === 'REJECTED' ? (
                            <span className="px-2.5 py-1 bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-[10px] font-black tracking-widest uppercase rounded-lg shadow-sm border border-rose-200 dark:border-rose-500/30 backdrop-blur-md">Rejected</span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-black tracking-widest uppercase rounded-lg shadow-sm border border-amber-200 dark:border-amber-500/30 backdrop-blur-md animate-pulse">Pending</span>
                          )}
                        </div>
                      </div>

                      <div className="p-4 flex flex-col flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1">{listing.title}</p>
                          <ArrowUpRight className="h-4 w-4 text-gray-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"/>
                        </div>

                        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                          <p className="font-black text-indigo-600 dark:text-indigo-400 text-sm">Rs.{listing.price}</p>
                          {listing.admin_status === 'APPROVED' && !listing.is_featured && (
                            <button
                              onClick={(event) => handleBoost(event, listing.id)}
                              disabled={boostingId === listing.id}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-black text-[10px] rounded-lg shadow-lg shadow-amber-500/10 transition-all flex items-center gap-1"
                            >
                              <Zap className="h-3 w-3"/> {boostingId === listing.id ? 'BOOSTING' : 'BOOST'}
                            </button>
                          )}
                          {listing.is_featured && (
                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-tighter flex items-center gap-1">Boosted</span>
                          )}
                        </div>

                        <div className="mt-3 border-t border-gray-100 dark:border-white/[0.06] pt-3 space-y-2">
                          {listing.activity?.length ? listing.activity.slice(0, 3).map((activity: any) => {
                            const badge = getOrderBadge(activity);
                            const buyerName = getProfileName(activity.buyer_profile);
                            return (
                              <div key={activity.id} className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-bold text-white truncate">{buyerName}</p>
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${badge.className}`}>{badge.label}</span>
                                </div>
                                <p className="text-[11px] text-zinc-400 mt-1">
                                  {activity.order_status === 'COMPLETE' || activity.escrow_status === 'RELEASED'
                                    ? `Sold for Rs.${Number(activity.amount || 0).toLocaleString()}`
                                    : `Interested in buying for Rs.${Number(activity.amount || 0).toLocaleString()}`}
                                </p>
                                <p className="text-[10px] text-zinc-600 mt-1">{new Date(activity.created_at).toLocaleString()}</p>

                                {activity.review && (
                                  <div className="mt-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Buyer Feedback</p>
                                    <p className="text-xs text-white mt-1">{'★'.repeat(activity.review.rating)}{'☆'.repeat(5 - activity.review.rating)}</p>
                                    <p className="text-[11px] text-zinc-300 mt-1">{activity.review.comment || 'Buyer left a rating without a comment.'}</p>
                                  </div>
                                )}
                              </div>
                            );
                          }) : (
                            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-3">
                              <p className="text-[11px] text-zinc-500">Live buyer interest and reviews will appear under this item automatically.</p>
                            </div>
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
