'use client';
import { useState } from 'react';
import { createClient } from '@/lib/client';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Loader2, Building2, ArrowRight, Zap } from 'lucide-react';

type Mode = 'login' | 'signup' | 'magic';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const reset = () => { setError(''); setSuccess(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); reset(); setLoading(true);
    const sb = createClient();
    try {
      if (mode === 'magic') {
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
        if (error) throw error;
        setSuccess('Magic link sent. Check your inbox.');
      } else if (mode === 'signup') {
        const { error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
        if (error) throw error;
        setSuccess('Account created. Check your email to confirm.');
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard'); router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally { setLoading(false); }
  };

  const TABS: { k: Mode; label: string }[] = [
    { k: 'login', label: 'Sign In' },
    { k: 'signup', label: 'Create Account' },
    { k: 'magic', label: 'Magic Link' },
  ];

  return (
    <div className="min-h-screen bg-[#0F0F10] flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col w-[440px] bg-[#141416] border-r border-white/[0.06] p-10 shrink-0">
        <div className="flex items-center gap-3 mb-12">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-white"/>
          </div>
          <div>
            <p className="text-white font-bold text-sm">Campus Nexus</p>
            <p className="text-indigo-400 text-[10px] font-semibold uppercase tracking-widest">University Commerce</p>
          </div>
        </div>

        <div className="flex-1">
          <h2 className="text-3xl font-bold text-white leading-tight">
            The trusted marketplace<br/>for campus students
          </h2>
          <p className="text-zinc-400 mt-4 leading-relaxed text-sm">
            Buy, sell, and rent textbooks, electronics, and services with escrow-protected payments and AI-powered trust scoring.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { label: 'Escrow payments', desc: 'Funds held until delivery confirmed' },
              { label: 'AI ID verification', desc: 'Only verified students on the platform' },
              { label: 'Trust scoring', desc: 'Transparent seller reputation system' },
              { label: 'Safe exchange zones', desc: 'On-campus verified handover points' },
            ].map(f => (
              <div key={f.label} className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-indigo-400"/>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{f.label}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-zinc-700 text-xs">Secured by Supabase · Razorpay Escrow · Gemini AI</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Building2 className="h-4.5 w-4.5 text-white h-[18px] w-[18px]"/>
            </div>
            <p className="text-white font-bold">Campus Nexus</p>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-zinc-500 text-sm mb-6">Sign in to your campus account</p>

          {/* Mode tabs */}
          <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-xl mb-6">
            {TABS.map(t => (
              <button key={t.k} onClick={() => { setMode(t.k); reset(); }}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${mode === t.k ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-200'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none"/>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="you@college.edu"
                  className="w-full h-11 pl-10 pr-4 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-all"/>
              </div>
            </div>

            {mode !== 'magic' && (
              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none"/>
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                    placeholder="Min. 6 characters"
                    className="w-full h-11 pl-10 pr-11 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-all"/>
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
                    {showPass ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                  </button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-rose-400 bg-rose-950/30 border border-rose-500/20 px-3 py-2.5 rounded-xl">{error}</p>}
            {success && <p className="text-sm text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 px-3 py-2.5 rounded-xl">{success}</p>}

            <button type="submit" disabled={loading}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin"/> :
                mode === 'magic' ? 'Send Magic Link' :
                mode === 'signup' ? 'Create Account' : 'Sign In'}
              {!loading && <ArrowRight className="h-4 w-4"/>}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/[0.06]"/>
            <span className="text-zinc-600 text-xs">or</span>
            <div className="flex-1 h-px bg-white/[0.06]"/>
          </div>

          <a href="/dashboard">
            <button className="w-full h-11 border border-white/[0.08] hover:border-white/[0.15] text-zinc-400 hover:text-white rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2">
              <Zap className="h-4 w-4"/> Browse in Demo Mode
            </button>
          </a>

          <p className="text-center text-xs text-zinc-700 mt-6">
            A secure, escrow-protected campus marketplace
          </p>
        </div>
      </div>
    </div>
  );
}
