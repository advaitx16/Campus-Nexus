'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Star, Sparkles, GitCompare } from 'lucide-react';
import Link from 'next/link';

const ALL_LISTINGS: Record<string, any> = {
  '1': { id:'1', title:'MacBook Pro M1', price:75000, condition:'Excellent', category:'Electronics', image:'💻', rating:4.9, reviews:42, seller:'Tech Wizard', trust:98.5, tags:['laptop','tech'], specs:{ Display:'13.3" Retina', CPU:'Apple M1 8-core', RAM:'8GB Unified', Storage:'256GB SSD', Battery:'Up to 18hrs', Weight:'1.29 kg' } },
  '2': { id:'2', title:'Calculus Textbook 8e', price:400, condition:'Acceptable', category:'Textbooks', image:'📘', rating:4.5, reviews:18, seller:'Senior Dev', trust:91.0, tags:['book','math'], specs:{ Author:'James Stewart', Edition:'8th', Pages:'1341', Condition:'Minor highlighting', Format:'Hardcover', Includes:'CD-ROM access' } },
  '3': { id:'3', title:'Sony WH-1000XM4', price:800, condition:'Like New', category:'Electronics', image:'🎧', rating:5.0, reviews:31, seller:'Audio Junkie', trust:95.2, tags:['audio','music'], specs:{ 'Battery Life':'30 hours', Connectivity:'Bluetooth 5.0', 'Noise Cancelling':'Yes (Industry Best)', Weight:'254g', 'Foldable':'Yes', 'Voice Assistant':'Alexa / Google' } },
  '4': { id:'4', title:'Arduino Starter Kit', price:1200, condition:'Like New', category:'Electronics', image:'⚙️', rating:4.7, reviews:9, seller:'Maker Space', trust:88.4, tags:['electronics','robotics'], specs:{ Components:'200+', 'Compatible IDE':'Arduino IDE', Microcontroller:'ATmega328P', 'Voltage':'5V', Connectivity:'USB', 'Projects Included':'15' } },
};

function ComparePageContent() {
  const searchParams = useSearchParams();
  const ids = (searchParams.get('ids') || '1,3').split(',').slice(0, 2);
  const items = ids.map(id => ALL_LISTINGS[id] || ALL_LISTINGS['1']);

  const allSpecKeys = [...new Set(items.flatMap(i => Object.keys(i.specs || {})))];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard"><ArrowLeft className="h-5 w-5 text-zinc-500 hover:text-white transition-colors"/></Link>
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><GitCompare className="h-6 w-6 text-indigo-400"/> Side-by-Side Compare</h1>
          <p className="text-zinc-500 text-sm">Comparing {items.length} products</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {items.map(item => (
          <Card key={item.id} className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-5 text-center">
              <div className="text-6xl mb-3">{item.image}</div>
              <h2 className="font-black text-white text-lg mb-1">{item.title}</h2>
              <p className="text-3xl font-black text-emerald-400 mb-2">₹{item.price.toLocaleString()}</p>
              <div className="flex items-center justify-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => <Star key={i} className={`h-4 w-4 ${i < Math.floor(item.rating) ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}`}/>)}
                <span className="text-zinc-500 text-xs ml-1">({item.reviews})</span>
              </div>
              <Badge className={`${item.condition === 'Excellent' || item.condition === 'Like New' ? 'bg-emerald-600' : 'bg-amber-600'} text-white mb-3`}>{item.condition}</Badge>
              <div className="text-xs text-zinc-500 mb-1">Trust {item.trust} · {item.seller}</div>
              <Link href={`/dashboard/product/${item.id}`}>
                <Button className="w-full mt-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl h-10 text-sm">Buy This →</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Spec Comparison Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-3 gap-0 p-4 border-b border-zinc-800 bg-zinc-950">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Specification</div>
          {items.map(item => (
            <div key={item.id} className="text-xs font-bold text-white text-center truncate">{item.title}</div>
          ))}
        </div>

        {/* Price row */}
        <div className="grid grid-cols-3 gap-0 p-4 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
          <div className="text-sm text-zinc-500 font-medium">Price</div>
          {items.map((item, i) => (
            <div key={i} className={`text-sm font-black text-center ${item.price === Math.min(...items.map(x => x.price)) ? 'text-emerald-400' : 'text-white'}`}>
              ₹{item.price.toLocaleString()}
              {item.price === Math.min(...items.map(x => x.price)) && <span className="ml-1 text-[10px] bg-emerald-600/20 text-emerald-400 px-1.5 py-0.5 rounded-full">BEST</span>}
            </div>
          ))}
        </div>

        {/* Rating row */}
        <div className="grid grid-cols-3 gap-0 p-4 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
          <div className="text-sm text-zinc-500 font-medium">Rating</div>
          {items.map((item, i) => (
            <div key={i} className={`text-sm font-black text-center ${item.rating === Math.max(...items.map(x => x.rating)) ? 'text-amber-400' : 'text-white'}`}>
              ⭐ {item.rating}/5 ({item.reviews} reviews)
            </div>
          ))}
        </div>

        {/* Specs rows */}
        {allSpecKeys.map((key, idx) => (
          <div key={key} className={`grid grid-cols-3 gap-0 p-4 ${idx < allSpecKeys.length - 1 ? 'border-b border-zinc-800/50' : ''} hover:bg-zinc-800/30 transition-colors`}>
            <div className="text-sm text-zinc-500 font-medium">{key}</div>
            {items.map((item, i) => (
              <div key={i} className="text-sm text-zinc-300 text-center">{item.specs?.[key] || '—'}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-4 md:p-8 max-w-5xl mx-auto text-sm text-zinc-500">Loading comparison...</div>}>
      <ComparePageContent />
    </Suspense>
  );
}
