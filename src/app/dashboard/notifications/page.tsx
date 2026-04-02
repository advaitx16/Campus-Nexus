'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, ArrowLeft, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/client';
import { AppNotification, formatNotificationTime, getNotificationBorderClass } from '@/lib/notifications';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const loadNotifications = async (targetUserId: string) => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      setNotifications((data || []) as AppNotification[]);
      setLoading(false);
    };

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.id);
      await loadNotifications(user.id);
    };

    init().catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const refreshNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      setNotifications((data || []) as AppNotification[]);
    };

    const channel = supabase
      .channel(`notifications_page_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          refreshNotifications().catch(() => {});
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const markAllRead = async () => {
    if (!userId) return;

    setNotifications(prev => prev.map(notification => ({ ...notification, is_read: true })));
    await createClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
  };

  const markRead = async (id: string) => {
    if (!userId) return;

    setNotifications(prev => prev.map(notification => (
      notification.id === id
        ? { ...notification, is_read: true }
        : notification
    )));

    await createClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId);
  };

  const unreadCount = notifications.filter(notification => !notification.is_read).length;

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
            <p className="text-zinc-500 text-sm">Boosts, buyer interest, reviews, and order updates</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button onClick={() => markAllRead().catch(() => {})} variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white rounded-xl h-9 text-sm">
            <CheckCheck className="h-4 w-4 mr-2"/> Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 px-4 border border-zinc-800 border-dashed rounded-3xl bg-zinc-900/50">
          <Loader2 className="h-12 w-12 text-zinc-700 mx-auto mb-3 animate-spin"/>
          <h3 className="text-xl font-bold text-white mb-2">Loading Notifications</h3>
          <p className="text-zinc-500 max-w-sm mx-auto">Pulling your latest realtime activity from Supabase.</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 px-4 border border-zinc-800 border-dashed rounded-3xl bg-zinc-900/50">
          <Bell className="h-12 w-12 text-zinc-700 mx-auto mb-3"/>
          <h3 className="text-xl font-bold text-white mb-2">No Notifications</h3>
          <p className="text-zinc-500 max-w-sm mx-auto">You're all caught up. Boosts, orders, and feedback will appear here live.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notification => (
            <Link
              key={notification.id}
              href={notification.link || '/dashboard/notifications'}
              onClick={() => markRead(notification.id).catch(() => {})}
            >
              <Card className={`border-l-4 ${getNotificationBorderClass(notification.type)} ${!notification.is_read ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-zinc-950 border-zinc-900 hover:border-zinc-800 opacity-70'} transition-all cursor-pointer`}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-bold text-sm ${!notification.is_read ? 'text-white' : 'text-zinc-400'}`}>{notification.title}</p>
                        {!notification.is_read && <div className="h-2 w-2 rounded-full bg-indigo-500 shrink-0"/>}
                      </div>
                      {notification.body && <p className="text-zinc-500 text-sm mt-0.5 line-clamp-2">{notification.body}</p>}
                      <p className="text-zinc-700 text-xs mt-1 flex items-center gap-1"><Clock className="h-3 w-3"/> {formatNotificationTime(notification.created_at)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
