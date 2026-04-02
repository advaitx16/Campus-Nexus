'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldAlert, Users, AlertTriangle, CheckCircle2, XCircle, Search, Trash2, TrendingUp, DollarSign, Package, Ban, RefreshCcw, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const BLACKLIST_WORDS = ['alcohol', 'drugs', 'illegal', 'weapon', 'fake id'];

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('revenue');
  const [searchUser, setSearchUser] = useState('');
  const [userList, setUserList] = useState<any[]>([]);
  const [blacklist, setBlacklist] = useState(BLACKLIST_WORDS);
  const [newKeyword, setNewKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeListings, setActiveListings] = useState<any[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [safetyLoading, setSafetyLoading] = useState(false);

  // Dynamic Stats
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [pendingListings, setPendingListings] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [pulseMsgs, setPulseMsgs] = useState<any[]>([]);

  const supabase = createClient();

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Fetch Users
    const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (users) {
      setUserList(users.map((p: any) => ({
        id: p.id,
        name: p.full_name || p.email?.split('@')[0] || 'Unknown',
        email: p.email || 'demo@campus.edu',
        trust: p.trust_score,
        cc: p.cc_points,
        sales: Math.floor(p.cc_points / 5),
        is_shadow_banned: p.is_shadow_banned
      })));
    }

    // 2. Fetch Pending Listings
    const { data: pending } = await supabase
      .from('listings')
      .select('*')
      .eq('admin_status', 'PENDING');
    if (pending) {
      const sellerIds = Array.from(new Set(pending.map((listing: any) => listing.seller_id).filter(Boolean)));
      let sellerMap = new Map<string, any>();

      if (sellerIds.length > 0) {
        const { data: sellerProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, department, trust_score')
          .in('id', sellerIds);

        sellerMap = new Map((sellerProfiles || []).map((profile: any) => [profile.id, profile]));
      }

      setPendingListings(
        pending.map((listing: any) => ({
          ...listing,
          seller_profile: sellerMap.get(listing.seller_id) ?? null,
        })),
      );
    }

    const { data: active } = await supabase.from('listings').select('*').eq('admin_status', 'APPROVED').eq('is_active', true);
    if (active) setActiveListings(active);

    // 3. Fetch Revenue (Platform Fees from all paid/complete orders)
    const { data: orders } = await supabase.from('orders').select('amount, platform_fee, created_at');
    if (orders) {
      const monthly = orders.reduce((acc: any, ord: any) => {
        const month = new Date(ord.created_at).toLocaleString('default', { month: 'short' });
        if (!acc[month]) acc[month] = { month, revenue: 0, transactions: 0 };
        acc[month].revenue += ord.platform_fee;
        acc[month].transactions += 1;
        return acc;
      }, {});
      setRevenueData(Object.values(monthly));
    }

    // 4. Fetch Category Breakdown
    const { data: listings } = await supabase.from('listings').select('category');
    if (listings) {
      const counts = listings.reduce((acc: any, l: any) => {
        acc[l.category] = (acc[l.category] || 0) + 1;
        return acc;
      }, {});
      const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
      setCategoryData(Object.entries(counts).map(([name, value], i) => ({
        name,
        value: Math.round(((value as number) / listings.length) * 100),
        color: colors[i % colors.length]
      })));
    }

    // 5. Fetch Disputes if the schema supports them
    const { data: disp, error: dispError } = await supabase
      .from('orders')
      .select('id, amount, created_at, buyer_id, seller_id, listings(title)');
    if (!dispError && disp) {
      setDisputes([]);
    }

    // 6. Fetch Pulse Messages
    const { data: pulse } = await supabase.from('community_feed').select('*').order('created_at', { ascending: false }).limit(20);
    if (pulse) setPulseMsgs(pulse);

    // 7. Safety keywords (dynamic)
    try {
      const { data: safetyRows } = await supabase.from('safety_keywords').select('keyword');
      if (safetyRows && safetyRows.length > 0) {
        setBlacklist(safetyRows.map((row: any) => row.keyword));
      } else {
        setBlacklist(BLACKLIST_WORDS);
      }
    } catch {
      setBlacklist(BLACKLIST_WORDS);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('admin_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleApprove = async (listingId: string, sellerId: string) => {
    const { error } = await supabase.from('listings').update({ admin_status: 'APPROVED' }).eq('id', listingId);
    if (error) { alert('Error: ' + error.message); return; }
    const { data: profile } = await supabase.from('profiles').select('cc_points').eq('id', sellerId).single();
    if (profile) {
      await supabase.from('profiles').update({ cc_points: (profile.cc_points || 0) + 5 }).eq('id', sellerId);
    }
    fetchData();
  };

  const handleReject = async (listingId: string) => {
    const { error } = await supabase.from('listings').update({ admin_status: 'REJECTED' }).eq('id', listingId);
    if (error) { alert('Error: ' + error.message); return; }
    fetchData();
  };

  const handleDeactivate = async (listingId: string) => {
    setErrMsg(null);
    const previous = activeListings;
    setActiveListings((prev) => prev.filter((l) => l.id !== listingId));
    try {
      const res = await fetch('/api/admin/take-down', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || 'Failed to deactivate listing.');
      }
    } catch (deactivateErr: any) {
      setErrMsg(deactivateErr?.message || 'Failed to deactivate listing.');
      setActiveListings(previous);
      alert(deactivateErr?.message || 'Failed to deactivate listing.');
    }
  };

  const toggleShadowBan = async (userId: string, currentState: boolean) => {
    await supabase.from('profiles').update({ is_shadow_banned: !currentState }).eq('id', userId);
    fetchData();
  };

  const handlePulseDelete = async (id: string) => {
    await supabase.from('community_feed').delete().eq('id', id);
    setPulseMsgs((prev) => prev.filter((m) => m.id !== id));
  };

  const addSafetyKeyword = async (keyword: string) => {
    const clean = keyword.trim().toLowerCase();
    if (!clean) return;
    setSafetyLoading(true);
    try {
      setBlacklist((prev) => Array.from(new Set([...prev, clean])));
      await supabase.from('safety_keywords').upsert({ keyword: clean });
    } finally {
      setSafetyLoading(false);
    }
  };

  const removeSafetyKeyword = async (keyword: string) => {
    setBlacklist((prev) => prev.filter((w) => w !== keyword));
    await supabase.from('safety_keywords').delete().eq('keyword', keyword);
  };

  const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);
  const totalTxns = revenueData.reduce((sum, d) => sum + d.transactions, 0);

  const tabs = [
    { id: 'revenue', label: '📊 Insights', color: 'indigo' },
    { id: 'review', label: `🔍 Mods Queue (${pendingListings.length})`, color: 'emerald' },
    { id: 'escrow', label: `⚖️ Disputes (${disputes.length})`, color: 'rose' },
    { id: 'users', label: '👥 User Base', color: 'blue' },
    { id: 'pulse', label: '👻 Pulse Monitor', color: 'amber' },
    { id: 'active', label: `🛑 Live Listings (${activeListings.length})`, color: 'rose' },
    { id: 'blacklist', label: '🚫 Safety Net', color: 'zinc' },
  ];

  if (loading && revenueData.length === 0) return <div className="h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
    <Loader2 className="h-10 w-10 animate-spin text-rose-500"/>
    <p className="text-zinc-500 font-mono text-sm animate-pulse tracking-widest uppercase">Initializing God Core...</p>
  </div>;

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-8 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-rose-600/10 blur-[150px] pointer-events-none rounded-full"/>

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-rose-500 animate-pulse"/> God-Mode Dashboard
            </h1>
            <p className="text-zinc-400 mt-1 font-mono text-sm uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"/> Real-time Campus Governance Engine
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchData} variant="outline" className="border-zinc-800 text-zinc-400 hover:text-white bg-transparent">
              <RefreshCcw className="h-4 w-4 mr-2"/> Refresh
            </Button>
            <Link href="/dashboard">
              <Button variant="outline" className="border-rose-900/50 hover:bg-rose-900/30 text-rose-400 font-bold bg-transparent">← End Session</Button>
            </Link>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Platform Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'indigo' },
            { label: 'Completed Deals', value: totalTxns.toString(), icon: Package, color: 'emerald' },
            { label: 'Active Disputes', value: disputes.length.toString(), icon: AlertTriangle, color: 'amber' },
            { label: 'Shadow Banned', value: userList.filter(u => u.is_shadow_banned).length.toString(), icon: Ban, color: 'rose' },
          ].map(kpi => (
            <Card key={kpi.label} className="bg-zinc-900/50 backdrop-blur-xl border-zinc-800 shadow-2xl">
              <CardContent className="p-5">
                <div className={`h-10 w-10 rounded-xl bg-${kpi.color}-500/10 flex items-center justify-center mb-3`}>
                   <kpi.icon className={`h-5 w-5 text-${kpi.color}-400`}/>
                </div>
                <p className="text-2xl font-black text-white">{kpi.value}</p>
                <p className="text-zinc-500 text-xs font-semibold mt-1 uppercase tracking-tight">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tab Bar */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-tighter transition-all border-2 ${activeTab === tab.id ? 'bg-white text-zinc-900 border-white shadow-lg shadow-white/10' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Insights Tab */}
        {activeTab === 'revenue' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm font-black uppercase tracking-widest flex items-center gap-2"><TrendingUp className="h-4 w-4 text-indigo-400"/> Revenue Stream (Platform Fee)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={revenueData.length ? revenueData : [{month: 'None', revenue: 0}]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false}/>
                      <XAxis dataKey="month" stroke="#71717a" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false}/>
                      <YAxis stroke="#71717a" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false}/>
                      <Tooltip cursor={{fill: '#27272a'}} contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}/>
                      <Bar dataKey="revenue" fill="#6366f1" radius={[6,6,0,0]} barSize={40}/>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm font-black uppercase tracking-widest">📦 Marketplace Mix</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-center gap-8">
                  <PieChart width={160} height={160}>
                    <Pie data={categoryData.length ? categoryData : [{name: 'Empty', value: 100, color: '#27272a'}]} cx={80} cy={80} innerRadius={45} outerRadius={70} dataKey="value">
                      {categoryData.map((entry, index) => (
                        <Cell key={index} fill={entry.color}/>
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}/>
                  </PieChart>
                  <div className="flex-1 space-y-3 w-full">
                    {categoryData.map(cat => (
                      <div key={cat.name} className="flex items-center gap-3 w-full">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }}/>
                        <span className="text-zinc-500 text-xs font-bold uppercase tracking-tighter">{cat.name}</span>
                        <div className="h-px flex-1 bg-zinc-800 mx-2"/>
                        <span className="text-white font-black text-sm">{cat.value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Review Queue Tab */}
        {activeTab === 'review' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            {pendingListings.length === 0 ? (
              <div className="p-20 text-center text-zinc-500 border-2 border-zinc-900 border-dashed rounded-3xl bg-zinc-900/20">
                <CheckCircle2 className="h-16 w-16 text-emerald-500/30 mx-auto mb-4" />
                <h3 className="font-black text-white text-xl">Inbox Cleared</h3>
                <p className="text-sm mt-1 max-w-sm mx-auto">No pending items. The marketplace is running autonomously and safely.</p>
              </div>
            ) : (
              pendingListings.map((listing: any) => (
                <Card key={listing.id} className="bg-zinc-900 border-zinc-800 hover:border-emerald-500/30 transition-all group shadow-xl">
                  <CardContent className="p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                    <div className="flex gap-6 items-center">
                      <div className="h-20 w-20 bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex items-center justify-center text-4xl font-black shrink-0 shadow-inner">
                        {listing.image_url ? (listing.image_url.startsWith('http') ? <img src={listing.image_url} alt="" className="object-cover w-full h-full"/> : listing.image_url) : '📦'}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-white text-xl tracking-tight">{listing.title}</span>
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-0.5">₹{listing.price.toLocaleString()}</Badge>
                        </div>
                        <p className="text-zinc-500 text-sm font-medium">Seller ID: <span className="text-zinc-400 font-mono">{listing.seller_id.slice(0,8)}...</span> · {listing.category}</p>
                        <p className="text-zinc-600 text-xs italic line-clamp-1 max-w-[400px]">{listing.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 w-full xl:w-auto">
                      <Button onClick={() => handleApprove(listing.id, listing.seller_id)} className="flex-1 xl:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-black h-12 px-6 rounded-2xl shadow-lg shadow-emerald-900/20 transition-all active:scale-95"><CheckCircle2 className="h-4 w-4 mr-2"/> APPROVE & REWARD</Button>
                      <Button onClick={() => handleReject(listing.id)} variant="outline" className="flex-1 xl:flex-none border-rose-900/50 hover:bg-rose-900/30 text-rose-500 h-12 px-6 rounded-2xl transition-all active:scale-95"><XCircle className="h-4 w-4 mr-2"/> BLACKLIST</Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Disputes Tab */}
        {activeTab === 'escrow' && (
          <div className="space-y-4 animate-in fade-in duration-500">
            {disputes.length === 0 ? (
               <div className="p-20 text-center text-zinc-500 border border-zinc-900 border-dashed rounded-3xl">
                 <ShieldAlert className="h-12 w-12 text-zinc-800 mx-auto mb-4"/>
                 <p className="font-bold text-white uppercase tracking-widest text-sm">Quiet on the escrow front</p>
               </div>
            ) : disputes.map(d => (
              <Card key={d.id} className="bg-zinc-900 border-zinc-800 border-l-4 border-l-rose-500">
                <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-rose-500 uppercase text-xs tracking-widest">CRITICAL DISPUTE</span>
                      <span className="text-zinc-400 text-xs font-mono">{d.id}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white">{d.listings?.title || 'Unknown Product'}</h3>
                    <p className="text-zinc-500 text-sm">Buyer: {d.buyer_id.slice(0,8)} vs Seller: {d.seller_id.slice(0,8)}</p>
                    <p className="text-rose-400 text-xs font-bold mt-2">Reason: Manual review required</p>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <Button className="flex-1 md:flex-none bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl h-10 px-6">介入 Manual Review</Button>
                    <Button variant="outline" className="flex-1 md:flex-none border-zinc-800 text-zinc-400 rounded-xl h-10">Freeze Funds</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* User Management */}
        {activeTab === 'users' && (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div className="relative">
              <Search className="absolute left-4 top-4 h-5 w-5 text-zinc-600"/>
              <Input value={searchUser} onChange={e => setSearchUser(e.target.value)} placeholder="Search the Nexus Citizen Database..." className="pl-12 bg-zinc-900 border-zinc-800 text-white rounded-2xl h-14 focus:ring-rose-500 text-lg font-medium"/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userList.filter(u => !searchUser || u.name.toLowerCase().includes(searchUser.toLowerCase()) || u.email.toLowerCase().includes(searchUser.toLowerCase())).map(user => (
                <Card key={user.id} className={`bg-zinc-900/50 border-zinc-800 transition-all ${user.is_shadow_banned ? 'border-rose-900/50 opacity-60 grayscale' : 'hover:border-zinc-700'}`}>
                  <CardContent className="p-5 flex gap-4">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-xl shrink-0">
                      {user.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white truncate leading-tight">{user.name}</p>
                      <p className="text-zinc-600 text-[10px] uppercase font-bold tracking-tighter truncate">{user.email}</p>
                      <div className="mt-3 flex gap-2">
                         <div className="px-2 py-1 bg-zinc-800 rounded-lg text-[10px] font-black text-white border border-zinc-700">TRUST {user.trust}</div>
                         <div className="px-2 py-1 bg-amber-500/10 rounded-lg text-[10px] font-black text-amber-500 border border-amber-500/20">{user.cc} CC</div>
                      </div>
                      <div className="mt-4">
                        <Button onClick={() => toggleShadowBan(user.id, user.is_shadow_banned)} size="sm" variant="ghost"
                          className={`w-full rounded-xl text-[10px] font-black tracking-widest uppercase ${user.is_shadow_banned ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-rose-500 hover:bg-rose-500/10'}`}>
                          {user.is_shadow_banned ? '✓ RESCIND BAN' : '⚠ SHADOW BAN'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Pulse monitor */}
        {activeTab === 'pulse' && (
          <div className="space-y-4 animate-in fade-in duration-500">
             <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>
                <span className="text-zinc-400 text-xs font-black uppercase tracking-widest">Live Traffic Monitor</span>
             </div>
            {pulseMsgs.map(msg => (
               <div key={msg.id} className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl flex flex-col md:flex-row justify-between gap-6 transition-all hover:bg-zinc-900">
                 <div className="flex-1 space-y-3">
                   <div className="flex items-center gap-3">
                      <Badge className={msg.is_anon ? 'bg-zinc-800 text-zinc-400' : 'bg-indigo-500/20 text-indigo-400'}>{msg.is_anon ? 'ANONYMOUS' : 'VERIFIED ID'}</Badge>
                      <span className="text-zinc-700 font-mono text-[10px]">{msg.id}</span>
                   </div>
                   <p className="text-zinc-200 text-sm leading-relaxed max-w-3xl italic font-serif">"{msg.content}"</p>
                   <p className="text-zinc-600 text-[10px] uppercase font-medium">{new Date(msg.created_at).toLocaleString()}</p>
                 </div>
                 <div className="flex gap-2">
                   <Button size="icon" className="bg-rose-600 hover:bg-rose-500 h-10 w-10 rounded-xl" title="Nuclear Delete" onClick={() => handlePulseDelete(msg.id)}><Trash2 className="h-4 w-4"/></Button>
                   <Button size="icon" variant="outline" className="border-zinc-800 text-zinc-500 hover:text-white h-10 w-10 rounded-xl"><Users className="h-4 w-4"/></Button>
                 </div>
              </div>
            ))}
         </div>
        )}

        {activeTab === 'active' && (
          <div className="space-y-4 animate-in fade-in duration-500">
            {errMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-200 text-sm">
                {errMsg}
              </div>
            )}
            {activeListings.length === 0 ? (
              <div className="p-16 text-center text-zinc-500 border border-zinc-900 rounded-3xl bg-zinc-900/30">
                <p className="font-bold text-white">No active listings to moderate.</p>
              </div>
            ) : activeListings.map((listing: any) => (
              <Card key={listing.id} className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-6 flex flex-col md:flex-row justify-between gap-4">
                  <div>
                    <p className="text-xs text-emerald-400 uppercase font-black tracking-widest">Live</p>
                    <p className="text-lg font-bold text-white">{listing.title}</p>
                    <p className="text-zinc-500 text-sm">Price ₹{listing.price} · Seller {listing.seller_id.slice(0,8)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="border-rose-900/50 text-rose-400 hover:bg-rose-900/30" onClick={() => handleDeactivate(listing.id)}>
                      Take Down
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Blacklist Tab */}
        {activeTab === 'blacklist' && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <Card className="bg-zinc-900/50 border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
               <CardHeader className="bg-rose-500/5 border-b border-rose-500/10 p-8">
                 <div className="flex items-center gap-4">
                   <div className="h-14 w-14 bg-rose-500/10 rounded-2xl flex items-center justify-center">
                     <ShieldAlert className="h-8 w-8 text-rose-500"/>
                   </div>
                   <div>
                     <CardTitle className="text-white text-2xl font-black italic">The Safety Net</CardTitle>
                     <CardDescription className="text-rose-400/60 font-mono text-xs uppercase tracking-widest mt-1">Linguistic Pattern Overrides</CardDescription>
                   </div>
                 </div>
               </CardHeader>
               <CardContent className="p-8">
                 <div className="flex gap-4 mb-8">
                   <Input value={newKeyword} onChange={e => setNewKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSafetyKeyword(newKeyword)} placeholder="Enter high-risk keyword..." className="bg-zinc-950 border-zinc-800 text-white rounded-2xl h-14 text-lg focus:ring-rose-500"/>
                   <Button disabled={safetyLoading} onClick={() => addSafetyKeyword(newKeyword)} className="bg-rose-600 hover:bg-rose-500 text-white font-black rounded-2xl h-14 px-8 shadow-lg shadow-rose-900/20">
                     {safetyLoading ? 'Saving...' : 'FORBID'}
                   </Button>
                 </div>
                 <div className="flex flex-wrap gap-3">
                   {blacklist.map(word => (
                     <div key={word} className="flex items-center gap-3 px-4 py-2 bg-rose-950/20 border border-rose-500/30 rounded-2xl group transition-all hover:bg-rose-950/40">
                       <span className="text-rose-400 text-sm font-black tracking-wider uppercase">{word}</span>
                       <button onClick={() => removeSafetyKeyword(word)} className="text-rose-700 hover:text-rose-400 transition-colors">
                         <XCircle className="h-4 w-4"/>
                       </button>
                     </div>
                   ))}
                 </div>
               </CardContent>
             </Card>
          </div>
        )}
      </div>
    </div>
  );
}
