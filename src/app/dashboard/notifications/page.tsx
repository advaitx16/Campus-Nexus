'use client';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, ArrowLeft, Package, Heart, ShieldCheck, Trophy, AlertTriangle, Clock } from 'lucide-react';
import Link from 'next/link';

const MOCK_NOTIFS: any[] = [];

const TYPE_COLORS: Record<string, string> = {
  sale: 'border-l-emerald-500',
  price_drop: 'border-l-rose-500',
  badge: 'border-l-amber-500',
  message: 'border-l-indigo-500',
  rental_due: 'border-l-blue-500',
  late_fee: 'border-l-rose-600',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(MOCK_NOTIFS);

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  const markRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard"><ArrowLeft className="h-5 w-5 text-zinc-500 hover:text-white transition-colors"/></Link>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Bell className="h-6 w-6 text-indigo-400"/> Notifications
              {unreadCount > 0 && <Badge className="bg-rose-600 text-white font-black">{unreadCount} new</Badge>}
            </h1>
            <p className="text-zinc-500 text-sm">Price drops, messages, badges, and rental reminders</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllRead} variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white rounded-xl h-9 text-sm">
            <CheckCheck className="h-4 w-4 mr-2"/> Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20 px-4 border border-zinc-800 border-dashed rounded-3xl bg-zinc-900/50">
          <Bell className="h-12 w-12 text-zinc-700 mx-auto mb-3"/>
          <h3 className="text-xl font-bold text-white mb-2">No Notifications</h3>
          <p className="text-zinc-500 max-w-sm mx-auto">You're all caught up! Updates about your orders, listings, and chats will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => (
            <Link key={notif.id} href={notif.link} onClick={() => markRead(notif.id)}>
              <div className={`flex gap-4 p-4 rounded-2xl border-l-4 transition-all cursor-pointer ${TYPE_COLORS[notif.type] || 'border-l-zinc-700'} ${notif.unread ? 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700' : 'bg-zinc-950 border border-zinc-900 hover:border-zinc-800 opacity-70'}`}>
                <div className="text-3xl shrink-0">{notif.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-bold text-sm ${notif.unread ? 'text-white' : 'text-zinc-400'}`}>{notif.title}</p>
                    {notif.unread && <div className="h-2 w-2 rounded-full bg-indigo-500 shrink-0"/>}
                  </div>
                  <p className="text-zinc-500 text-sm mt-0.5 line-clamp-2">{notif.body}</p>
                  <p className="text-zinc-700 text-xs mt-1 flex items-center gap-1"><Clock className="h-3 w-3"/> {notif.time}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
