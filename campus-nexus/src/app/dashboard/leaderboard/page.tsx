'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Crown, Leaf, ShieldCheck, Star, Sparkles, Zap, Copy, Gift, Users, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/client';

const BADGES_DEF = [
  { name: 'Senior Seller', icon: '🌟', color: 'amber', desc: '20+ successful sales' },
  { name: 'Fast Responder', icon: '⚡', color: 'blue', desc: 'Replies within 1 hour' },
  { name: 'Eco-Warrior', icon: '🌿', color: 'emerald', desc: '5+ used books/eco items sold' },
  { name: 'Campus Legend', icon: '👑', color: 'purple', desc: 'Top seller of the month' },
  { name: 'Verified Student', icon: '✅', color: 'indigo', desc: 'AI-verified student ID' },
  { name: 'Deal Hunter', icon: '🎯', color: 'rose', desc: '10+ purchases completed' },
];

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'sellers' | 'badges' | 'gamification'>('sellers');
  const [referralCopied, setReferralCopied] = useState(false);
  const [topSellers, setTopSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myCc, setMyCc] = useState(0);
  const referralCode = 'CAMPUS-NEXUS-TST42';
  const supabase = createClient();

  const fetchLeaders = async () => {
    const { data } = await supabase.from('profiles').select('*').order('trust_score', { ascending: false }).limit(20);
    if (data) {
      setTopSellers(data.map((p, idx) => ({
        rank: idx + 1,
        id: p.id,
        alias: p.full_name || p.email?.split('@')[0] || 'Unknown User',
        trust_score: p.trust_score,
        cc_points: p.cc_points,
        dept: p.department || 'Campus',
        badges: p.trust_score > 90 ? ['Verified Student', 'Senior Seller'] : (p.cc_points > 100 ? ['Verified Student'] : []),
        isEco: p.trust_score > 95
      })));
    } else {
      setTopSellers([]);
    }
  };

  const fetchMyStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('cc_points').eq('id', user.id).single();
      if (data) setMyCc(data.cc_points);
    }
  };

  useEffect(() => {
    setLoading(true);
    const init = async () => {
      await Promise.all([fetchLeaders(), fetchMyStats()]);
      setLoading(false);
    };
    init();

    const ch = supabase.channel('leaderboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchLeaders();
        fetchMyStats();
      })
      .subscribe();
      
    return () => { supabase.removeChannel(ch); };
  }, []);

  const copyReferral = () => {
    navigator.clipboard.writeText(`Join Campus Nexus with my referral: ${referralCode} and we both get 5 CC Points! https://campus-nexus.app/join?ref=${referralCode}`);
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-5 rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-2xl shadow-amber-500/20 mb-6">
          <Trophy className="h-12 w-12 text-white"/>
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter">Campus Legends</h1>
        <p className="text-zinc-500 mt-3 max-w-xl mx-auto font-medium">Gamified trust scoring. Every deal earns you CC Points, honors, and algorithmic trust boosts.</p>
      </div>

      {/* Formula Banner */}
      <div className="mb-10 p-6 bg-zinc-900/50 backdrop-blur-md border border-indigo-500/10 rounded-3xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 bg-indigo-500/5 blur-3xl rounded-full"/>
        <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4"/> Trust Score 2.0 Algorithm
        </h3>
        <code className="text-emerald-400 text-sm md:text-base font-mono block bg-zinc-950 p-4 rounded-2xl border border-zinc-800/50">
          Trust = (Sales × 0.4) + (Rating × 10 × 0.3) + (Days_Active × 0.01 × 0.3)
        </code>
        <p className="text-zinc-600 text-xs mt-4 flex items-center gap-2">
           <Zap className="h-3 w-3 text-amber-500"/> AI-audited escrow completions grant an immediate +5 points boost.
        </p>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2 p-1.5 bg-zinc-900/80 rounded-2xl border border-zinc-800 mb-8 w-fit mx-auto md:mx-0">
        {(['sellers', 'badges', 'gamification'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-zinc-950 shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {tab === 'sellers' ? '🏆 Leaders' : tab === 'badges' ? '🎖 Honors' : '🪙 Coinage'}
          </button>
        ))}
      </div>

      {activeTab === 'sellers' && (
        <div className="space-y-6">
          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4">
               <Loader2 className="h-10 w-10 animate-spin text-amber-500"/>
               <p className="text-zinc-600 font-mono text-[10px] uppercase tracking-widest animate-pulse">Syncing Leaderboard...</p>
             </div>
          ) : (
            <>
              {/* Podium */}
              {topSellers.length >= 3 && (
                <div className="grid grid-cols-3 gap-3 md:gap-6 items-end mb-10 pt-6">
                  {/* Rank 2 */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 text-center h-fit group transition-all hover:border-zinc-700">
                    <div className="text-3xl mb-1">🥈</div>
                    <div className="h-12 w-12 rounded-2xl bg-zinc-800 mx-auto mb-3 flex items-center justify-center font-black text-zinc-400 group-hover:scale-110 transition-transform">
                      {topSellers[1].alias.charAt(0)}
                    </div>
                    <p className="font-bold text-white text-xs truncate mb-1">{topSellers[1].alias}</p>
                    <p className="text-emerald-500 text-[10px] font-black">{topSellers[1].trust_score} TRUST</p>
                  </div>
                  {/* Rank 1 */}
                  <div className="bg-gradient-to-b from-amber-500/20 to-zinc-900 border-2 border-amber-500/30 rounded-3xl p-6 text-center shadow-2xl shadow-amber-500/5 relative -top-6">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-zinc-950 px-3 py-1 rounded-full text-[10px] font-black tracking-widest">LEGEND</div>
                    <div className="text-5xl mb-2 animate-bounce">🥇</div>
                    <div className="h-16 w-16 rounded-3xl bg-amber-500 mx-auto mb-4 flex items-center justify-center font-black text-zinc-950 text-2xl shadow-lg shadow-amber-500/20">
                      {topSellers[0].alias.charAt(0)}
                    </div>
                    <p className="font-black text-white text-sm truncate mb-1">{topSellers[0].alias}</p>
                    <p className="text-amber-400 text-xs font-black">{topSellers[0].trust_score} TRUST</p>
                    <p className="text-zinc-500 text-[10px] font-bold mt-2 flex items-center justify-center gap-1"><Sparkles className="h-3 w-3"/> {topSellers[0].cc_points} CC</p>
                  </div>
                  {/* Rank 3 */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 text-center h-fit group transition-all hover:border-zinc-700">
                    <div className="text-3xl mb-1">🥉</div>
                    <div className="h-12 w-12 rounded-2xl bg-zinc-800 mx-auto mb-3 flex items-center justify-center font-black text-zinc-400 group-hover:scale-110 transition-transform">
                      {topSellers[2].alias.charAt(0)}
                    </div>
                    <p className="font-bold text-white text-xs truncate mb-1">{topSellers[2].alias}</p>
                    <p className="text-emerald-500 text-[10px] font-black">{topSellers[2].trust_score} TRUST</p>
                  </div>
                </div>
              )}

              {/* Remaining list */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
                {topSellers.map((seller) => (
                  <div key={seller.id} className={`flex items-center gap-5 p-5 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/40 transition-colors ${seller.rank === 1 ? 'bg-amber-500/5' : ''}`}>
                    <div className={`w-8 text-center font-black text-sm tracking-tighter ${seller.rank <= 3 ? 'text-amber-500' : 'text-zinc-700'}`}>
                      #{seller.rank}
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center font-black text-white text-sm shadow-lg shrink-0">
                      {seller.alias.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-white text-lg tracking-tight truncate">{seller.alias}</p>
                        {seller.rank === 1 && <Crown className="h-4 w-4 text-amber-500 fill-amber-500"/>}
                        {seller.isEco && <Leaf className="h-4 w-4 text-emerald-500"/>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {seller.badges?.map((b: string) => (
                          <Badge key={b} className="bg-zinc-950 text-zinc-500 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border border-zinc-800">{b}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className="font-black text-2xl text-white tracking-tight leading-none group-hover:text-emerald-400 transition-colors">{seller.trust_score}</p>
                      <p className="text-[10px] font-black text-amber-500 mt-1 uppercase tracking-widest flex items-center gap-1">
                        <Sparkles className="h-2 w-2"/> {seller.cc_points} CC
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'badges' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-300">
          {BADGES_DEF.map(badge => (
            <Card key={badge.name} className="bg-zinc-900/50 backdrop-blur-sm border-zinc-800 hover:border-indigo-500/30 transition-all group rounded-3xl overflow-hidden shadow-xl">
              <CardContent className="p-8 text-center space-y-4">
                <div className="text-6xl group-hover:scale-125 transition-transform duration-500 drop-shadow-2xl">{badge.icon}</div>
                <h3 className="font-black text-white text-xl tracking-tight">{badge.name}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{badge.desc}</p>
                <div className="pt-2">
                   <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                     <div className="h-full bg-indigo-500 rounded-full w-2/3 animate-pulse"/>
                   </div>
                   <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-2">66% Progress</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'gamification' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
          {/* Main Balance Card */}
          <div className="p-8 md:p-12 bg-gradient-to-br from-zinc-900 to-zinc-950 border-2 border-amber-500/20 rounded-[40px] text-center shadow-2xl relative overflow-hidden group">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-500/5 blur-[100px] rounded-full group-hover:bg-amber-500/10 transition-colors"/>
            <Sparkles className="h-12 w-12 text-amber-500 mx-auto mb-4 animate-pulse"/>
            <p className="text-7xl font-black text-white tracking-tighter drop-shadow-lg">{myCc}</p>
            <p className="text-amber-500 font-black uppercase tracking-[0.3em] text-xs mt-2">Campus Coinage (CC) Points</p>
            <div className="h-px w-24 bg-zinc-800 mx-auto my-6"/>
            <p className="text-zinc-500 text-sm max-w-sm mx-auto leading-relaxed">Your digital equity in the campus economy. Fuel your listings, redeem rewards, or climb the trust ranks.</p>
          </div>

          {/* Earning Matrix */}
          <div>
            <h3 className="text-xs font-black text-zinc-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-4">
              <span className="h-px flex-1 bg-zinc-900"/> Earnings Matrix <span className="h-px flex-1 bg-zinc-900"/>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { icon: '📅', action: 'Cycle Check-in', points: '+1 CC', color: 'emerald' },
                { icon: '🤝', action: 'Successful Deal', points: '+10 CC', color: 'indigo' },
                { icon: '🌿', action: 'Eco-Listing Bonus', points: '+3 CC', color: 'emerald' },
                { icon: '⭐', action: 'Top-Tier Review', points: '+2 CC', color: 'amber' },
              ].map(item => (
                <div key={item.action} className="flex items-center gap-5 p-5 bg-zinc-900/50 border border-zinc-800 rounded-3xl group hover:border-indigo-500/20 transition-all">
                  <div className="text-3xl group-hover:scale-110 transition-transform">{item.icon}</div>
                  <div className="flex-1">
                    <p className="font-black text-white text-sm uppercase tracking-tight">{item.action}</p>
                  </div>
                  <div className="px-4 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-emerald-400 font-black text-sm">
                    {item.points}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Referral Protocol */}
          <Card className="bg-indigo-600/5 border-2 border-indigo-500/20 rounded-[32px] overflow-hidden">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="h-24 w-24 bg-indigo-500 rounded-[28px] flex items-center justify-center shadow-xl shadow-indigo-500/20 rotate-3">
                  <Gift className="h-12 w-12 text-white"/>
                </div>
                <div className="flex-1 text-center md:text-left space-y-2">
                  <h3 className="font-black text-white text-2xl tracking-tighter italic">Propagation Protocol</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">Share your unique sequence. Both participants receive +10 CC upon the first successful transaction.</p>
                </div>
                <div className="w-full md:w-auto flex flex-col gap-3">
                  <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 p-2 rounded-2xl">
                     <code className="text-indigo-400 font-mono text-sm px-4 uppercase font-bold">{referralCode}</code>
                     <Button onClick={copyReferral} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl h-11 px-6 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">
                       {referralCopied ? 'COPIED' : 'SPREAD'}
                     </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
