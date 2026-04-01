'use client';
import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Upload, Loader2, ShieldCheck, User, BookOpen, GraduationCap, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function VerifyIDPage() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  };

  const handleScan = async () => {
    if (!image) return;
    setIsScanning(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', image);
      const res = await fetch('/api/verify-id', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-zinc-950 to-zinc-900 flex items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="w-full max-w-2xl relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-600/30 mb-4">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-black text-white">Student ID Verification</h1>
          <p className="text-zinc-400 max-w-md mx-auto">Our Gemini AI scans your student ID card. Only verified students can list products on Campus Nexus.</p>
        </div>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2"><GraduationCap className="h-5 w-5 text-indigo-400"/> Upload Student ID Card</CardTitle>
            <CardDescription className="text-zinc-400">Your photo is processed locally by AI and never stored permanently.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handleFile} />
            
            {/* Upload Zone */}
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-white/20 rounded-2xl h-64 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500/50 hover:bg-white/5 transition-all group relative overflow-hidden"
            >
              {preview ? (
                <img src={preview} alt="ID Preview" className="w-full h-full object-contain p-2 rounded-2xl" />
              ) : (
                <>
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-600/20 transition-colors">
                    <Upload className="h-8 w-8 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <p className="text-zinc-400 font-medium">Click to upload or drag & drop</p>
                  <p className="text-zinc-600 text-sm mt-1">JPG, PNG up to 10MB</p>
                </>
              )}
            </div>

            {image && (
              <Button
                className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg rounded-xl shadow-xl shadow-indigo-900/30"
                onClick={handleScan}
                disabled={isScanning}
              >
                {isScanning ? <><Loader2 className="h-5 w-5 mr-3 animate-spin"/> Gemini AI Scanning...</> : <><ShieldCheck className="h-5 w-5 mr-3"/> Verify My ID</>}
              </Button>
            )}

            {error && (
              <div className="flex items-center gap-3 p-4 bg-rose-900/20 border border-rose-500/30 rounded-xl text-rose-400">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* OCR Result Card */}
        {result && (
          <Card className={`border-2 ${result.is_valid_id ? 'border-emerald-500/50 bg-emerald-900/10' : 'border-amber-500/50 bg-amber-900/10'} backdrop-blur-xl animate-in slide-in-from-bottom-4 fade-in duration-500`}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-3 ${result.is_valid_id ? 'text-emerald-400' : 'text-amber-400'}`}>
                {result.is_valid_id ? <CheckCircle2 className="h-6 w-6"/> : <AlertTriangle className="h-6 w-6"/>}
                {result.is_valid_id ? 'Student Identity Verified ✓' : 'Could Not Fully Verify — Review Manually'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Full Name', value: result.student_name, icon: User },
                  { label: 'Roll Number', value: result.roll_number, icon: BookOpen },
                  { label: 'Department', value: result.department, icon: GraduationCap },
                  { label: 'Year of Study', value: result.year ? `Year ${result.year}` : null, icon: GraduationCap },
                  { label: 'University', value: result.university, icon: ShieldCheck },
                  { label: 'Valid Until', value: result.valid_until, icon: ShieldCheck },
                ].map(({ label, value, icon: Icon }) => value && (
                  <div key={label} className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                      <Icon className="h-3 w-3"/> {label}
                    </Label>
                    <p className="text-white font-semibold">{value}</p>
                  </div>
                ))}
              </div>

              {result.is_valid_id && (
                <div className="mt-6 flex gap-3">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl h-12">
                    <CheckCircle2 className="h-4 w-4 mr-2"/> Confirm & Activate My Account
                  </Button>
                  <Badge className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold">+5 CC Points Bonus</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            Skip for now (limited access)
          </Link>
        </div>
      </div>
    </div>
  );
}
