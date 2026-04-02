'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShoppingBag, MessageSquare, Shield, MapPin, Trophy, LogOut, Settings,
  Package, Search, Bell, Zap, Activity, Wifi, WifiOff,
  Plus, Building2, Sun, Moon, User
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/client';
import { useTheme } from '@/lib/theme';
import { AppNotification, formatNotificationTime } from '@/lib/notifications';

const NAV = [
  { name: 'Marketplace', href: '/dashboard', icon: ShoppingBag },
  { name: 'Messages', href: '/dashboard/chat', icon: MessageSquare },
  { name: 'Campus Pulse', href: '/dashboard/community', icon: MessageSquare },
  { name: 'Leaderboard', href: '/dashboard/leaderboard', icon: Trophy },
  { name: 'Escrow Audit', href: '/dashboard/rental/audit', icon: Shield },
  { name: 'Safe Zones', href: '/dashboard/safezones', icon: MapPin },
  { name: 'My Orders', href: '/dashboard/orders', icon: Package },
  { name: 'My Profile', href: '/dashboard/profile', icon: User },
  { name: 'Lost & Found', href: '/dashboard/lost-found', icon: Search },
  { name: 'Admin Panel', href: '/admin', icon: Settings, admin: true },
];

const MOBILE_NAV = [
  { name: 'Market', href: '/dashboard', icon: ShoppingBag },
  { name: 'Pulse', href: '/dashboard/community', icon: MessageSquare },
  { name: 'Orders', href: '/dashboard/orders', icon: Package },
  { name: 'Profile', href: '/dashboard/profile', icon: User },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [notifOpen, setNotifOpen] = useState(false);
  const [campus, setCampus] = useState('Main Campus');
  const [ccPoints, setCcPoints] = useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<'checking' | 'connected' | 'demo'>('checking');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  useEffect(() => {
    const v = localStorage.getItem('cn_cc_points');
    if (v) setCcPoints(parseInt(v, 10));

    const supabase = createClient();

    const loadNotifications = async (targetUserId: string) => {
      const [{ data }, { count }, { count: messageCount }] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', targetUserId)
          .eq('is_read', false),
        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', targetUserId)
          .eq('is_read', false)
          .eq('type', 'message'),
      ]);

      setNotifications((data || []) as AppNotification[]);
      setUnreadCount(count || 0);
      setUnreadMessageCount(messageCount || 0);
    };

    const updateSession = (session: any) => {
      const user = session?.user ?? null;
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email ?? null);
        setStatus('connected');
        supabase.from('profiles').select('cc_points').eq('id', user.id).single()
          .then(({ data }: any) => {
            if (data?.cc_points != null) {
              setCcPoints(data.cc_points);
              localStorage.setItem('cn_cc_points', String(data.cc_points));
            }
          })
          .catch(() => {});
        loadNotifications(user.id).catch(() => {});
      } else {
        setUserId(null);
        setUserEmail(null);
        setNotifications([]);
        setStatus('demo');
      }
    };

    supabase.auth.getSession().then(({ data: { session } }: any) => {
      updateSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      updateSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const refreshNotifications = async () => {
      const [{ data }, { count }, { count: messageCount }] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false),
        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false)
          .eq('type', 'message'),
      ]);

      setNotifications((data || []) as AppNotification[]);
      setUnreadCount(count || 0);
      setUnreadMessageCount(messageCount || 0);
    };

    refreshNotifications().catch(() => {});

    const channel = supabase
      .channel(`dashboard_notifications_${userId}`)
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

  useEffect(() => {
    const sync = () => {
      const v = localStorage.getItem('cn_cc_points');
      if (v) setCcPoints(parseInt(v, 10));
    };
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('storage', sync); };
  }, []);

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push('/login');
  };

  const markNotificationRead = async (notificationId: string) => {
    if (!userId) return;

    const target = notifications.find((notification) => notification.id === notificationId);
    setNotifications((prev) => prev.map((notification) => (
      notification.id === notificationId
        ? { ...notification, is_read: true }
        : notification
    )));
    if (target && !target.is_read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (target.type === 'message') {
        setUnreadMessageCount((prev) => Math.max(0, prev - 1));
      }
    }

    await createClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);
  };

  const displayName = status === 'checking'
    ? 'Loading...'
    : userEmail
      ? userEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : 'Guest User';
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F0F10] transition-colors flex flex-col md:flex-row font-sans">
      <aside className="hidden md:flex w-64 bg-white dark:bg-[#141416] border-r border-gray-200 dark:border-white/[0.06] flex-col sticky top-0 h-screen overflow-y-auto shrink-0 transition-colors">
        <div className="px-5 py-5 border-b border-gray-200 dark:border-white/[0.06]">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-white"/>
            </div>
            <div>
              <p className="text-gray-900 dark:text-white font-bold text-sm leading-none">Campus Nexus</p>
              <p className="text-indigo-600 dark:text-indigo-400 text-[10px] font-semibold mt-0.5 uppercase tracking-widest">University Market</p>
            </div>
          </Link>
        </div>

        <div className="px-4 py-3 border-b border-gray-200 dark:border-white/[0.06] space-y-2">
          <select value={campus} onChange={e => setCampus(e.target.value)}
            className="w-full bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg px-3 py-1.5 text-gray-700 dark:text-zinc-300 text-xs font-medium focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer">
            <option>Main Campus</option>
            <option>Thane Campus</option>
            <option>Mumbai Campus</option>
            <option>Navi Mumbai Campus</option>
          </select>

          <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
            status === 'connected' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
            : status === 'demo' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
            : 'bg-gray-100 text-gray-500 dark:bg-white/[0.03] dark:text-zinc-500'
          }`}>
            {status === 'connected' ? <Wifi className="h-3 w-3"/> : status === 'demo' ? <WifiOff className="h-3 w-3"/> : <Activity className="h-3 w-3 animate-pulse"/>}
            {status === 'connected' ? 'Live - Supabase' : status === 'demo' ? <><span className="opacity-70">Demo -</span> <Link href="/login" className="underline underline-offset-2">Sign in</Link></> : 'Connecting...'}
          </div>
        </div>

        <div className="px-4 py-3 border-b border-gray-200 dark:border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">CC Balance</p>
              <p className="text-gray-900 dark:text-white font-bold text-2xl mt-0.5" suppressHydrationWarning>{ccPoints.toLocaleString()}</p>
              <p className="text-gray-500 dark:text-zinc-600 text-xs">Campus Coins</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-600/15 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-indigo-600 dark:text-indigo-400"/>
            </div>
          </div>
          <Link href="/dashboard/leaderboard">
            <button className="mt-3 w-full h-7 bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.07] border border-gray-200 dark:border-white/[0.08] rounded-lg text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white text-xs font-semibold transition-all">
              Earn more coins
            </button>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5">
          <p className="text-[10px] font-bold text-gray-500 dark:text-zinc-600 uppercase tracking-widest px-2 mb-2">Navigation</p>
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  active ? 'bg-indigo-600 text-white' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.05]'
                }`}>
                  <Icon className="h-4 w-4 shrink-0"/>
                  <span className="flex-1">{item.name}</span>
                  {item.href === '/dashboard/chat' && unreadMessageCount > 0 && (
                    <span className="min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                    </span>
                  )}
                  {item.admin && <span className="text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Admin</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-gray-200 dark:border-white/[0.06] space-y-2">
          <Link href="/verify-id">
            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-500/15 rounded-lg dark:hover:border-indigo-500/30 transition-colors cursor-pointer">
              <Shield className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400"/>
              <span className="text-xs text-indigo-700 dark:text-indigo-300 font-semibold">Verify Student ID - Earn 5 CC</span>
            </div>
          </Link>
          <button onClick={(e) => toggleTheme(e)}
            className="flex items-center gap-2 w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-white/[0.03] dark:hover:bg-white/[0.05] border border-gray-200 dark:border-white/[0.06] rounded-lg text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors text-xs font-semibold">
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5"/> : <Moon className="h-3.5 w-3.5"/>}
            {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </button>
          <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-lg">
            <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{displayName}</p>
              <p className="text-xs text-gray-500 dark:text-zinc-500 truncate">
                {status === 'checking' ? 'checking session' : userEmail ?? 'demo mode'}
              </p>
            </div>
            <button onClick={handleSignOut} className="text-gray-400 dark:text-zinc-600 hover:text-rose-600 dark:hover:text-rose-400 transition-colors shrink-0">
              <LogOut className="h-4 w-4"/>
            </button>
          </div>
          <div className="text-center">
            <a href="/api/health" target="_blank" className="text-[10px] text-gray-400 dark:text-zinc-700 hover:text-gray-600 dark:hover:text-zinc-500 transition-colors">
              System status
            </a>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="hidden md:flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-white/[0.06] bg-white/80 dark:bg-[#141416]/80 backdrop-blur-md shrink-0 z-50 transition-colors">
          <div/>
          <div className="flex items-center gap-2">
            <button onClick={(e) => toggleTheme(e)}
              className="p-2 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-all" title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
              {theme === 'dark' ? <Sun className="h-[18px] w-[18px]"/> : <Moon className="h-[18px] w-[18px]"/>}
            </button>
            <div className="relative">
              <button onClick={() => setNotifOpen(o => !o)}
                className="relative p-2 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-all">
                <Bell className="h-[18px] w-[18px]"/>
                {unreadCount > 0 && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500"/>}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-xl dark:shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06] flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</p>
                    <span className="text-xs text-gray-500 dark:text-zinc-500">{unreadCount} new</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-zinc-500">
                        Your live notifications will show up here.
                      </div>
                    ) : notifications.map(notification => (
                      <Link
                        key={notification.id}
                        href={notification.link || '/dashboard/notifications'}
                        onClick={() => {
                          markNotificationRead(notification.id).catch(() => {});
                          setNotifOpen(false);
                        }}
                        className={`block px-4 py-3 border-b border-gray-50 dark:border-white/[0.04] last:border-0 ${!notification.is_read ? 'bg-indigo-50 dark:bg-indigo-950/20' : ''}`}
                      >
                        <p className="text-sm text-gray-800 dark:text-zinc-300 leading-snug">{notification.title}</p>
                        {notification.body && <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1 leading-relaxed">{notification.body}</p>}
                        <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">{formatNotificationTime(notification.created_at)}</p>
                      </Link>
                    ))}
                  </div>
                  <div className="px-4 py-2.5 border-t border-gray-100 dark:border-white/[0.06] text-center">
                    <Link href="/dashboard/notifications" onClick={() => setNotifOpen(false)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium">
                      View all
                    </Link>
                  </div>
                </div>
              )}
            </div>
            <Link href="/dashboard/create">
              <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm transition-all ml-1">
                <Plus className="h-4 w-4"/> List Item
              </button>
            </Link>
          </div>
        </header>

        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-[#141416] border-b border-gray-200 dark:border-white/[0.06] sticky top-0 z-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-white"/>
            </div>
            <span className="text-gray-900 dark:text-white font-bold text-sm">Campus Nexus</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold text-sm">{ccPoints} CC</span>
            <Link href="/dashboard/notifications" className="relative text-gray-500 dark:text-zinc-400">
              <Bell className="h-5 w-5"/>
              {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-rose-500"/>}
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </div>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#141416]/95 backdrop-blur-xl border-t border-gray-200 dark:border-white/[0.06] grid grid-cols-4 z-50 transition-colors">
          {MOBILE_NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 py-2.5">
                <Icon className={`h-5 w-5 transition-colors ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-zinc-600'}`}/>
                <span className={`text-[10px] font-semibold transition-colors ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-zinc-600'}`}>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
