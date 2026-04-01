'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, MapPin, CheckCircle2, Clock, ArrowLeft, Plus, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/client';

export default function LostFoundPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'lost' | 'found'>('all');
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'lost' | 'found'>('lost');
  
  const [newPost, setNewPost] = useState({ title: '', location: '', description: '' });

  useEffect(() => {
    async function fetchItems() {
      const supabase = createClient();
      const { data } = await supabase.from('lost_items').select('*, profiles(full_name)').order('created_at', { ascending: false });
      if (data) setItems(data);
      setLoading(false);
    }
    fetchItems();
    
    const supabase = createClient();
    const ch = supabase.channel('lost_items_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'lost_items' }, fetchItems).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = items.filter(i => filter === 'all' || i.status.toLowerCase() === filter);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert('Please log in to post items.');
      return;
    }

    const { error } = await supabase.from('lost_items').insert({
      reporter_id: user.id,
      item_name: newPost.title,
      location: newPost.location,
      description: newPost.description,
      status: formType.toUpperCase()
    });

    if (error) {
      alert('Error creating post: ' + error.message);
    } else {
      setShowForm(false);
      setNewPost({ title: '', location: '', description: '' });
    }
  };

  const markResolved = async (id: string) => {
    const supabase = createClient();
    await supabase.from('lost_items').update({ status: 'RESOLVED' }).eq('id', id);
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto font-sans">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard"><ArrowLeft className="h-5 w-5 text-zinc-500 hover:text-white transition-colors"/></Link>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">🔍 Lost & Found</h1>
            <p className="text-zinc-500 text-sm">Help your campus community — post what you lost or found</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl sm:ml-auto w-full sm:w-auto h-11">
          <Plus className="h-4 w-4 mr-2"/> Post Item
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6 bg-zinc-900 border-zinc-800 animate-in slide-in-from-top-4 fade-in overflow-hidden">
          <div className="flex bg-zinc-800/50">
            <button onClick={() => setFormType('lost')} className={`flex-1 py-3 font-black text-sm transition-all ${formType === 'lost' ? 'bg-rose-600 text-white border-b-2 border-rose-400' : 'text-zinc-500 hover:text-zinc-300'}`}>I LOST SOMETHING</button>
            <button onClick={() => setFormType('found')} className={`flex-1 py-3 font-black text-sm transition-all ${formType === 'found' ? 'bg-emerald-600 text-white border-b-2 border-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}>I FOUND SOMETHING</button>
          </div>
          <CardContent className="p-5 md:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <input required value={newPost.title} onChange={e => setNewPost(p => ({...p, title: e.target.value}))}
                placeholder="What did you lose/find? (e.g., Blue water bottle)" 
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white text-sm focus:outline-none focus:border-indigo-500"/>
              <input required value={newPost.location} onChange={e => setNewPost(p => ({...p, location: e.target.value}))}
                placeholder="Last known location (e.g., Lab 302, Row 2)"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white text-sm focus:outline-none focus:border-indigo-500"/>
              <textarea value={newPost.description} onChange={e => setNewPost(p => ({...p, description: e.target.value}))}
                placeholder="Additional description (optional)..." rows={3}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"/>
              <div className="flex gap-3 pt-2">
                <Button type="button" onClick={() => setShowForm(false)} variant="outline" className="flex-1 rounded-xl h-12 border-zinc-800 text-zinc-400 hover:text-white">Cancel</Button>
                <Button type="submit" className={`flex-[2] font-black rounded-xl h-12 ${formType === 'lost' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white`}>
                  Publish {formType === 'lost' ? 'Lost' : 'Found'} Alert
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {(['all', 'lost', 'found'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-5 py-2.5 rounded-full font-bold text-sm capitalize transition-all shrink-0 ${filter === f ? 'bg-white text-zinc-900 border-white' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'}`}>
            {f === 'all' ? '📋 All Items' : f === 'lost' ? '❓ Missing Items' : '✅ Found Items'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {loading ? (
             <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 px-4 border border-zinc-800 border-dashed rounded-3xl bg-zinc-900/50">
            <Search className="h-12 w-12 text-zinc-700 mx-auto mb-3"/>
            <h3 className="text-xl font-bold text-white mb-2">Clear Campus</h3>
            <p className="text-zinc-500 max-w-sm mx-auto">No items match your filter. Looks like everything is exactly where it should be.</p>
          </div>
        ) : filtered.map(item => (
          <Card key={item.id} className={`bg-zinc-900 border-zinc-800 ${item.status === 'RESOLVED' ? 'opacity-50 grayscale' : ''} hover:border-zinc-700 transition-colors`}>
            <CardContent className="p-4 md:p-5">
              <div className="flex gap-4 md:gap-5 items-start">
                <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-center text-3xl md:text-4xl shadow-inner shadow-black">
                  {item.status === 'LOST' ? '❓' : item.status === 'FOUND' ? '🔍' : '✅'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-black text-white text-base md:text-lg truncate">{item.item_name}</h3>
                    <Badge className={`${item.status === 'LOST' ? 'bg-rose-600/20 text-rose-400 border-rose-500/30' : item.status === 'FOUND' ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800 text-zinc-400'} shrink-0 tracking-widest text-[10px] font-bold uppercase`}>
                      {item.status}
                    </Badge>
                  </div>
                  {item.description && <p className="text-zinc-400 text-xs md:text-sm mt-1 line-clamp-2">{item.description}</p>}
                  <p className="text-indigo-400 font-semibold text-xs md:text-sm flex items-center gap-1.5 mt-2 bg-indigo-500/10 w-fit px-2.5 py-1 rounded-lg">
                    <MapPin className="h-3.5 w-3.5"/> {item.location}
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 md:mt-5 gap-3">
                    <div className="flex items-center gap-2 text-xs text-zinc-600 font-medium">
                      <span>Posted by <span className="text-zinc-400">{item.profiles?.full_name || 'Anonymous'}</span></span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> {new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                    {item.status === 'RESOLVED' ? (
                      <Badge className="bg-emerald-600/10 text-emerald-400 text-xs border border-emerald-500/20 sm:ml-auto w-fit"><CheckCircle2 className="h-3.5 w-3.5 mr-1.5"/> Returned to Owner</Badge>
                    ) : (
                      <div className="flex gap-2 sm:ml-auto">
                        <Button size="sm" onClick={() => markResolved(item.id)} variant="outline" className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-emerald-600 hover:border-emerald-600 rounded-xl h-8 text-xs font-bold transition-all">
                          Mark Resolved
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
