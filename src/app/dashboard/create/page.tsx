'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, Sparkles, Loader2, ArrowLeft, Tag, Upload, CheckCircle2, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/client';

const CONDITIONS  = ['Excellent', 'Like New', 'Good', 'Acceptable', 'For Parts'];
const CATEGORIES  = ['Electronics', 'Textbooks', 'Clothing', 'Sports', 'Services', 'Rentals', 'Wanted', 'Other'];

export default function CreateListingPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const [image, setImage]       = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [isTagging, setIsTagging] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [savedTitle, setSavedTitle] = useState('');
  const [error, setError]       = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [sessionMissing, setSessionMissing] = useState(false);
  const [form, setForm]         = useState({
    title: '', description: '', price: '', original_price: '',
    category: '', condition: '', tags: '', course_tags: '',
    allows_rental: false,
    rental_daily: '', rental_weekly: '', rental_semester: '',
    security_deposit: '',
  });

  const f = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }));

  useEffect(() => {
    let mounted = true;

    const syncSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSessionMissing(!session?.user);
      setAuthReady(true);
    };

    syncSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (!mounted) return;
      setSessionMissing(!session?.user);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleAITag = async () => {
    if (!image) return;
    setIsTagging(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', image);

      const res = await fetch('/api/generate-listing', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'AI analysis failed');
      }

      const data = await res.json();
      if (data.title) {
        setForm(p => ({
          ...p,
          title:       data.title       || p.title,
          description: data.description || p.description,
          price:       data.suggested_price?.toString() || p.price,
          category:    data.category    || p.category,
          condition:   data.condition_rating ? 
                       (data.condition_rating >= 5 ? 'Excellent' : 
                        data.condition_rating >= 4 ? 'Like New' : 
                        data.condition_rating >= 3 ? 'Good' : 'Acceptable') : p.condition,
          tags:        (data.tags || []).join(', '),
        }));
      }
    } catch (err: any) {
      console.error('AI Tagging Error:', err);
      setError('AI tagging failed — ' + (err.message || 'please fill in details manually.'));
    } finally {
      setIsTagging(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title || !form.price) {
      setError('Title and price are required.');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;

      if (!user) {
        throw new Error('Sign in again to list items. Your session expired or is unavailable.');
      }

      // Convert image to data URL and store directly in DB
      let image_url: string | null = null;
      if (image) {
        image_url = await fileToDataUrl(image);
      }

      const payload: any = {
        seller_id: user.id,
        seller_email: user.email,
        seller_name: user.email?.split('@')[0] || 'Student',
        title: form.title.trim(),
        description: form.description.trim() || null,
        price: parseFloat(form.price),
        original_price: form.original_price ? parseFloat(form.original_price) : null,
        category: form.category || 'Other',
        condition: form.condition || 'Good',
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        allows_rental: form.allows_rental,
        rental_daily: form.rental_daily ? parseFloat(form.rental_daily) : null,
        rental_weekly: form.rental_weekly ? parseFloat(form.rental_weekly) : null,
        rental_semester: form.rental_semester ? parseFloat(form.rental_semester) : null,
        security_deposit: form.security_deposit ? parseFloat(form.security_deposit) : null,
        image_url,
        is_active: true,
      };

      // Auto-heal missing profiles from older accounts
      await supabase.from('profiles').upsert(
        { id: user.id, email: user.email },
        { onConflict: 'id' }
      );

      const { error: insertErr } = await supabase.from('listings').insert(payload);
      if (insertErr) {
        throw new Error(insertErr.message);
      }

      setSavedTitle(form.title);
      setSaved(true);
    } catch (err: any) {
      setError(err.message || 'Failed to publish. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  // ── Success Screen ────────────────────────────────────────────────────────
  if (saved) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400"/>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Submitted for Review</h1>
          <p className="text-gray-500 dark:text-zinc-400">"{savedTitle}" has been sent to our moderators. It will go live and you'll earn +5 CC points upon approval.</p>
          <div className="flex gap-3 justify-center mt-6">
            <Link href="/dashboard"><button className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all">View Marketplace</button></Link>
            <button onClick={() => { setSaved(false); setForm({ title:'', description:'', price:'', original_price:'', category:'', condition:'', tags:'', course_tags:'', allows_rental:false, rental_daily:'', rental_weekly:'', rental_semester:'', security_deposit:'' }); setImage(null); setPreview(null); }}
              className="px-5 py-2.5 border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-zinc-400 font-semibold rounded-xl text-sm hover:text-gray-900 dark:hover:text-white transition-all">
              List Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard"><ArrowLeft className="h-5 w-5 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white transition-colors"/></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Camera className="h-5 w-5 text-indigo-600 dark:text-indigo-400"/> List an Item</h1>
          <p className="text-gray-400 dark:text-zinc-500 text-sm">Upload a photo — Gemini AI fills in details automatically</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {!authReady ? (
          <div className="flex items-start gap-2.5 p-3 bg-gray-100 dark:bg-zinc-900/60 border border-gray-200 dark:border-white/[0.08] rounded-xl">
            <Loader2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5 animate-spin"/>
            <p className="text-xs text-gray-600 dark:text-zinc-300">Checking your session before publishing...</p>
          </div>
        ) : sessionMissing ? (
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/20 rounded-xl">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"/>
            <div className="space-y-2">
              <p className="text-xs text-amber-700 dark:text-amber-300">Your login session is missing, so this page cannot publish a real listing yet.</p>
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Sign in again
              </button>
            </div>
          </div>
        ) : null}

        {/* Photo Upload */}
        <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/[0.07] rounded-xl p-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500"/> Product Photo (AI auto-fill)</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Gemini AI will suggest title, price, and category from your photo</p>
          </div>
          <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleFile}/>
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-all group overflow-hidden">
            {preview
              ? <img src={preview} alt="Product" className="w-full h-full object-contain p-2"/>
              : <>
                  <Upload className="h-9 w-9 text-gray-300 dark:text-zinc-600 group-hover:text-indigo-400 mb-2 transition-colors"/>
                  <p className="text-gray-500 dark:text-zinc-500 text-sm font-medium">Click to upload</p>
                  <p className="text-gray-300 dark:text-zinc-700 text-xs mt-1">JPG, PNG, HEIC up to 10MB</p>
                </>
            }
          </div>
          {image && (
            <button type="button" onClick={handleAITag} disabled={isTagging}
              className="w-full h-10 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 transition-all">
              {isTagging ? <><Loader2 className="h-4 w-4 animate-spin"/> Gemini AI scanning...</> : <><Sparkles className="h-4 w-4"/> Auto-fill with AI</>}
            </button>
          )}
        </div>

        {/* Core Details */}
        <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/[0.07] rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Product Details</p>

          <div>
            <label className="text-xs text-gray-500 dark:text-zinc-400 font-medium block mb-1.5">Title *</label>
            <input value={form.title} onChange={e => f('title', e.target.value)} required placeholder="e.g. MacBook Pro M1 (Lightly Used)"
              className="w-full h-10 px-3.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-all"/>
          </div>

          <div>
            <label className="text-xs text-gray-500 dark:text-zinc-400 font-medium block mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => f('description', e.target.value)} rows={3} placeholder="Describe condition, what's included, reason for selling..."
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-all resize-none"/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-zinc-400 font-medium block mb-1.5">Selling Price (₹) *</label>
              <input type="number" min="0" value={form.price} onChange={e => f('price', e.target.value)} required placeholder="0"
                className="w-full h-10 px-3.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-all"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-zinc-400 font-medium block mb-1.5">Original Price (₹)</label>
              <input type="number" min="0" value={form.original_price} onChange={e => f('original_price', e.target.value)} placeholder="Optional, shows discount"
                className="w-full h-10 px-3.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-all"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-zinc-400 font-medium block mb-1.5">Condition</label>
              <select value={form.condition} onChange={e => f('condition', e.target.value)}
                className="w-full h-10 px-3.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 transition-all">
                <option value="">Select...</option>
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-zinc-400 font-medium block mb-1.5">Category</label>
              <select value={form.category} onChange={e => f('category', e.target.value)}
                className="w-full h-10 px-3.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 transition-all">
                <option value="">Select...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 dark:text-zinc-400 font-medium block mb-1.5 flex items-center gap-1"><Tag className="h-3 w-3"/> Tags (comma-separated)</label>
            <input value={form.tags} onChange={e => f('tags', e.target.value)} placeholder="laptop, cs-dept, apple, tech"
              className="w-full h-10 px-3.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-all"/>
          </div>
        </div>

        {/* Rental Options */}
        <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/[0.07] rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Rental Options <span className="text-gray-400 dark:text-zinc-500 font-normal text-xs">(optional)</span></p>

          <button type="button" onClick={() => f('allows_rental', !form.allows_rental)}
            className={`flex items-center gap-3 w-full p-3 rounded-xl border transition-colors ${form.allows_rental ? 'border-emerald-400 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-900/10' : 'border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600'}`}>
            {form.allows_rental ? <ToggleRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400"/> : <ToggleLeft className="h-5 w-5 text-gray-400 dark:text-zinc-500"/>}
            <span className={`font-semibold text-sm ${form.allows_rental ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500 dark:text-zinc-500'}`}>
              {form.allows_rental ? 'Rentals enabled' : 'Enable rentals'}
            </span>
          </button>

          {form.allows_rental && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[{ k: 'rental_daily', l: 'Daily (₹)' }, { k: 'rental_weekly', l: 'Weekly (₹)' }, { k: 'rental_semester', l: 'Semester (₹)' }].map(({ k, l }) => (
                  <div key={k}>
                    <label className="text-xs text-gray-500 dark:text-zinc-500 font-medium block mb-1">{l}</label>
                    <input type="number" min="0" value={(form as any)[k]} onChange={e => f(k, e.target.value)} placeholder="0"
                      className="w-full h-9 px-3 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"/>
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-zinc-500 font-medium block mb-1">Security Deposit (₹)</label>
                <input type="number" min="0" value={form.security_deposit} onChange={e => f('security_deposit', e.target.value)} placeholder="Held by platform, returned after check-in"
                  className="w-full h-9 px-3 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"/>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/20 rounded-xl">
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5"/>
            <p className="text-xs text-rose-700 dark:text-rose-300">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button type="submit" disabled={saving || !authReady || sessionMissing}
          className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin"/> Submitting...</> : 'Submit for Admin Review'}
        </button>
        <p className="text-center text-xs text-gray-400 dark:text-zinc-600">Your listing will go live and earn +5 CC Points after moderator approval</p>
      </form>
    </div>
  );
}

