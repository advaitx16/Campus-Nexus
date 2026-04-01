'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, ShieldCheck, ArrowLeft, Calendar, AlertTriangle, CheckCircle2, RotateCcw, Package, Zap } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/client';



const TIER_COLORS: Record<string, string> = {
  daily: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
  weekly: 'bg-indigo-600/20 text-indigo-400 border-indigo-600/30',
  semester: 'bg-purple-600/20 text-purple-400 border-purple-600/30',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: 'Active', color: 'bg-emerald-600', icon: CheckCircle2 },
  returned: { label: 'Returned', color: 'bg-zinc-600', icon: RotateCcw },
  overdue: { label: '⚠️ OVERDUE', color: 'bg-rose-600', icon: AlertTriangle },
  disputed: { label: 'In Dispute', color: 'bg-amber-600', icon: AlertTriangle },
};

export default function RentalDashboardPage() {
  const [activeFilter, setActiveFilter] = useState<'all'|'active'|'returned'|'overdue'>('all');
  const [exercisingRTO, setExercisingRTO] = useState<string | null>(null);
  const [rentals, setRentals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRentals() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Fetch rentals (try to join listings or products if needed, but the schema FK points to products).
      // If products join fails, fallback to bare rentals
      let { data, error } = await supabase
        .from('rentals')
        .select(`
          id, start_date, expected_return_date, actual_return_date,
          status, deposit_amount, escrow_status,
          product:products ( title ),
          listing:listings ( title, seller_name, image_url )
        `)
        .eq('renter_id', user.id);

      // We handle the case where listings might not be joined due to strict FK by just parsing
      if (error) {
         // Fallback bare fetch
         const res = await supabase.from('rentals').select('*').eq('renter_id', user.id);
         data = res.data;
      }

      if (data) {
        setRentals(data.map((r: any) => {
          const title = r.product?.title || r.listing?.title || 'Unknown Product';
          const owner = r.listing?.seller_name || 'Unknown';
          const img = r.listing?.image_url ? '📦' : '📦'; // simplify visual
          const sDate = new Date(r.start_date || new Date());
          const eDate = new Date(r.expected_return_date || new Date());
          const daysRem = Math.ceil((eDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
          return {
            id: r.id, product: title, image: img, owner,
            tier: 'daily', start: sDate.toLocaleDateString(), end: eDate.toLocaleDateString(),
            total: 0, deposit: r.deposit_amount || 0, deposit_status: r.escrow_status?.toLowerCase() || 'held',
            status: r.status?.toLowerCase() || 'active',
            rent_to_own: false, rent_to_own_price: null, days_remaining: daysRem
          };
        }));
      }
      setLoading(false);
    }
    fetchRentals();
  }, []);

  const filtered = rentals.filter(r => activeFilter === 'all' || r.status === activeFilter);

  const handleLateFeeAck = (rental: any) => {
    alert(`⚠️ Late Return Fee Applied!\n\nRental: ${rental.product}\nDays Overdue: ${Math.abs(rental.days_remaining)}\nFee Deducted: ${Math.abs(rental.days_remaining) * 100} CC Points\n\nPlease return the item ASAP to stop accruing penalties.`);
  };

  const handleRentToOwn = async (rental: any) => {
    setExercisingRTO(rental.id);
    setTimeout(() => {
      alert(`✅ Rent-to-Own Activated!\n\nYou have chosen to buy ${rental.product} permanently.\nFinal Price: ₹${rental.rent_to_own_price?.toLocaleString()}\n\nRazorpay payment will initiate now (demo mode).`);
      setExercisingRTO(null);
    }, 1500);
  };

  const totalActive = rentals.filter(r => r.status === 'active').length;
  const totalDepositsHeld = rentals.filter(r => r.deposit_status === 'held').reduce((s, r) => s + r.deposit, 0);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard"><ArrowLeft className="h-5 w-5 text-zinc-500 hover:text-white transition-colors"/></Link>
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Package className="h-6 w-6 text-indigo-400"/> My Rentals</h1>
          <p className="text-zinc-500 text-sm">Manage your active rentals, deposits, and return conditions</p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-center">
          <p className="text-2xl font-black text-emerald-400">{totalActive}</p>
          <p className="text-zinc-500 text-xs mt-1 font-medium">Active Rentals</p>
        </div>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-center">
          <p className="text-2xl font-black text-amber-400">₹{totalDepositsHeld.toLocaleString()}</p>
          <p className="text-zinc-500 text-xs mt-1 font-medium">Deposits in Escrow</p>
        </div>
        <div className="p-4 bg-zinc-900 border border-rose-900/30 rounded-2xl text-center">
          <p className="text-2xl font-black text-rose-400">{rentals.filter(r => r.status === 'overdue').length}</p>
          <p className="text-zinc-500 text-xs mt-1 font-medium">Overdue Items</p>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex gap-2 mb-6">
        {(['all', 'active', 'returned', 'overdue'] as const).map(f => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={`px-4 py-2 rounded-xl font-bold text-sm capitalize transition-all ${activeFilter === f ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'}`}>
            {f === 'all' ? '📋 All' : f === 'active' ? '✅ Active' : f === 'returned' ? '↩️ Returned' : '⚠️ Overdue'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"/></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 px-4 border border-zinc-800 border-dashed rounded-3xl bg-zinc-900/50">
            <Package className="h-12 w-12 text-zinc-700 mx-auto mb-3"/>
            <p className="text-zinc-500">No rentals found for this filter.</p>
          </div>
        ) : filtered.map(rental => {
          const statusCfg = STATUS_CONFIG[rental.status] || STATUS_CONFIG['active'];
          const StatusIcon = statusCfg.icon;

          return (
            <Card key={rental.id} className="bg-zinc-900 border-zinc-800 overflow-hidden hover:border-zinc-700 transition-colors">
              <div className={`${statusCfg.color} px-5 py-2 flex items-center gap-2 text-white text-sm font-bold`}>
                <StatusIcon className="h-4 w-4"/>
                {statusCfg.label}
                {rental.status === 'overdue' && <span className="ml-2 text-white/80 font-normal text-xs">({Math.abs(rental.days_remaining)} days overdue)</span>}
                <span className="ml-auto text-white/70 text-xs font-mono">{rental.id}</span>
              </div>

              <CardContent className="p-5">
                <div className="flex gap-4 items-start">
                  <div className="text-4xl">{rental.image}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-black text-white text-lg">{rental.product}</h3>
                      <Badge variant="outline" className={`text-xs font-bold border ${TIER_COLORS[rental.tier]}`}>
                        {rental.tier.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-zinc-500 text-sm">Owner: {rental.owner}</p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      <div className="p-3 bg-zinc-800 rounded-xl">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Start</p>
                        <p className="text-white font-bold text-sm mt-0.5">{rental.start}</p>
                      </div>
                      <div className="p-3 bg-zinc-800 rounded-xl">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Due</p>
                        <p className={`font-bold text-sm mt-0.5 ${rental.status === 'overdue' ? 'text-rose-400' : 'text-white'}`}>{rental.end}</p>
                      </div>
                      <div className="p-3 bg-zinc-800 rounded-xl">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Total Paid</p>
                        <p className="text-emerald-400 font-black text-sm mt-0.5">₹{rental.total.toLocaleString()}</p>
                      </div>
                      <div className="p-3 bg-zinc-800 rounded-xl">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Deposit</p>
                        <p className={`font-black text-sm mt-0.5 flex items-center gap-1 ${rental.deposit_status === 'held' ? 'text-amber-400' : 'text-emerald-400'}`}>
                          <ShieldCheck className="h-3 w-3"/>
                          {rental.deposit_status === 'held' ? `₹${rental.deposit.toLocaleString()} held` : 'Returned ✓'}
                        </p>
                      </div>
                    </div>

                    {/* Days remaining progress */}
                    {rental.status === 'active' && (
                      <div className="mt-4">
                        <div className="flex justify-between text-xs font-medium mb-1">
                          <span className="text-zinc-500">Rental Progress</span>
                          <span className={rental.days_remaining <= 2 ? 'text-amber-400' : 'text-zinc-400'}>{rental.days_remaining} days remaining</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${Math.max(10, 100 - (rental.days_remaining / 7) * 100)}%` }}/>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {rental.status === 'active' && (
                        <Link href="/dashboard/rental/audit">
                          <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs h-9">
                            📷 Upload Return Photos
                          </Button>
                        </Link>
                      )}
                      {rental.status === 'overdue' && (
                        <Button size="sm" onClick={() => handleLateFeeAck(rental)} className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs h-9">
                          <AlertTriangle className="h-3 w-3 mr-1"/> Acknowledge Late Fee
                        </Button>
                      )}
                      {rental.rent_to_own && rental.status === 'active' && (
                        <Button size="sm" onClick={() => handleRentToOwn(rental)} disabled={exercisingRTO === rental.id}
                          className="bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs h-9">
                          <Zap className="h-3 w-3 mr-1"/>
                          {exercisingRTO === rental.id ? 'Processing...' : `Buy Permanently — ₹${rental.rent_to_own_price?.toLocaleString()}`}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
