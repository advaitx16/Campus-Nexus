'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Camera, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function RentalEscrowPage() {
  const [handoverImg, setHandoverImg] = useState<File | null>(null);
  const [returnImg, setReturnImg] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = async () => {
    if (!handoverImg || !returnImg) return;
    setIsAnalyzing(true);
    setResult(null);

    const formData = new FormData();
    formData.append('handoverImage', handoverImg);
    formData.append('returnImage', returnImg);

    try {
      const res = await fetch('/api/condition-check', { method: 'POST', body: formData });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 md:p-12 font-sans relative">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
           <h1 className="text-3xl font-bold text-zinc-900 dark:text-锌-100">Escrow Condition Auditor</h1>
           <p className="text-zinc-500">Automated AI damage verification for releasing Security Deposits.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle>1. Handover (Before)</CardTitle>
              <CardDescription>Photo taken before item was given to the renter.</CardDescription>
            </CardHeader>
            <CardContent>
               <input type="file" id="ho-img" className="hidden" accept="image/*" onChange={(e) => setHandoverImg(e.target.files?.[0] || null)} />
               <label htmlFor="ho-img" className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 h-48 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  {handoverImg ? <span className="font-semibold text-emerald-600">{handoverImg.name}</span> : <><Camera className="h-8 w-8 mb-2 text-zinc-400"/><span className="text-zinc-500 font-medium">Upload Condition</span></>}
               </label>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md">
            <CardHeader>
              <CardTitle>2. Return (After)</CardTitle>
              <CardDescription>Photo taken upon receiving the item back.</CardDescription>
            </CardHeader>
            <CardContent>
               <input type="file" id="ret-img" className="hidden" accept="image/*" onChange={(e) => setReturnImg(e.target.files?.[0] || null)} />
               <label htmlFor="ret-img" className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 h-48 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  {returnImg ? <span className="font-semibold text-emerald-600">{returnImg.name}</span> : <><Camera className="h-8 w-8 mb-2 text-zinc-400"/><span className="text-zinc-500 font-medium">Upload Condition</span></>}
               </label>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center">
            <Button 
              size="lg" 
              className="bg-indigo-600 hover:bg-indigo-700 text-white w-full md:w-auto px-12 py-6 text-lg rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-indigo-900/20"
              disabled={!handoverImg || !returnImg || isAnalyzing}
              onClick={handleAnalyze}
            >
              {isAnalyzing ? <><Loader2 className="h-5 w-5 mr-3 animate-spin"/> Running Gemini AI Diagnosis...</> : 'Audit Condition & Release Deposit'}
            </Button>
        </div>

        {result && !result.error && (
            <Card className={`border-2 ${result.recommended_action === 'RELEASE_DEPOSIT' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-rose-500 bg-rose-50 dark:bg-rose-950/30'} backdrop-blur-md mt-8 scale-100 transition-transform`}>
              <CardHeader className="flex flex-row items-center gap-4 border-b border-black/5 dark:border-white/5 pb-4">
                 {result.recommended_action === 'RELEASE_DEPOSIT' ? <CheckCircle2 className="h-10 w-10 text-emerald-600"/> : <AlertTriangle className="h-10 w-10 text-rose-600"/>}
                 <div>
                    <CardTitle className={result.recommended_action === 'RELEASE_DEPOSIT' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                       {result.recommended_action === 'RELEASE_DEPOSIT' ? 'Deposit Approved for Release' : 'Escrow Hold: Dispute Auto-Opened'}
                    </CardTitle>
                 </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/50 dark:bg-black/20 rounded-xl">
                      <Label className="uppercase text-xs font-bold text-zinc-500 tracking-wider">Damage Detected</Label>
                      <p className="text-lg font-medium">{String(result.damage_detected).toUpperCase()}</p>
                    </div>
                    <div className="p-4 bg-white/50 dark:bg-black/20 rounded-xl">
                      <Label className="uppercase text-xs font-bold text-zinc-500 tracking-wider">Severity Tracker</Label>
                      <p className="text-lg font-medium">{result.severity}</p>
                    </div>
                 </div>
                 <div className="p-5 bg-white/80 dark:bg-black/40 rounded-xl border border-black/5 dark:border-white/10">
                    <Label className="uppercase text-xs font-bold text-zinc-500 tracking-wider mb-2 block">AI System Observations</Label>
                    <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed font-serif text-lg">{result.ai_observations}</p>
                 </div>
              </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
}
