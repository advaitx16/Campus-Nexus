'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/client'
import {
  buildLastMessageMap,
  getOtherParticipantId,
  getOtherParticipantProfile,
  getProfileDisplayName,
  type ChatProfile,
  type ChatMessageRow,
  type ChatThreadRow,
} from '@/lib/chat'
import { MessageSquare, ShieldCheck, Loader2, ArrowRight, AlertCircle } from 'lucide-react'

const CHAT_SELECT = `
  id,
  buyer_id,
  seller_id,
  listing_id,
  created_at,
  listing:listings(id, title, image_url),
  buyer_profile:profiles!chats_buyer_id_fkey(id, full_name, student_name, department, trust_score),
  seller_profile:profiles!chats_seller_id_fkey(id, full_name, student_name, department, trust_score)
`

type InboxThread = {
  id: string
  otherId: string
  otherName: string
  listingId: string | null
  listingTitle: string
  lastMessagePreview: string
  lastMessageAt: string
}

export default function MessagesInboxPage() {
  const [supabase] = useState(() => createClient())
  const [threads, setThreads] = useState<InboxThread[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadThreads = useEffectEvent(async () => {
    setError(null)

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      setError(authError.message)
      setThreads([])
      setLoading(false)
      return
    }

    if (!user) {
      setThreads([])
      setLoading(false)
      return
    }

    const { data: chatRows, error: chatError } = await supabase
      .from('chats')
      .select(CHAT_SELECT)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)

    if (chatError) {
      setError(chatError.message)
      setThreads([])
      setLoading(false)
      return
    }

    const chats = (chatRows ?? []) as ChatThreadRow[]
    const chatIds = chats.map((chat) => chat.id)
    let lastMessageByChatId = new Map<string, ChatMessageRow>()

    if (chatIds.length > 0) {
      const { data: messageRows, error: messageError } = await supabase
        .from('chat_messages')
        .select('id, chat_id, sender_id, content, created_at')
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false })

      if (messageError) {
        console.error('Inbox message lookup failed:', messageError)
      } else {
        lastMessageByChatId = buildLastMessageMap((messageRows ?? []) as ChatMessageRow[])
      }
    }

    const fallbackProfileIds = new Set<string>()
    chats.forEach((chat) => {
      const otherId = getOtherParticipantId(chat, user.id)
      const otherProfile = getOtherParticipantProfile(chat, user.id)

      if (
        otherId &&
        (!otherProfile || (!otherProfile.student_name?.trim() && !otherProfile.full_name?.trim()))
      ) {
        fallbackProfileIds.add(otherId)
      }
    })

    const fallbackProfiles = new Map<string, ChatProfile>()
    if (fallbackProfileIds.size > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, full_name, student_name, department, trust_score')
        .in('id', Array.from(fallbackProfileIds))

      for (const profile of profileRows ?? []) {
        if (profile?.id) {
          fallbackProfiles.set(profile.id, profile as ChatProfile)
        }
      }
    }

    const nextThreads = chats
      .map((chat) => {
        const otherId = getOtherParticipantId(chat, user.id)

        if (!otherId) {
          return null
        }

        const otherProfile =
          getOtherParticipantProfile(chat, user.id) ??
          (otherId ? fallbackProfiles.get(otherId) ?? null : null)
        const lastMessage = lastMessageByChatId.get(chat.id)

        return {
          id: chat.id,
          otherId,
          otherName: getProfileDisplayName(otherProfile),
          listingId: chat.listing_id,
          listingTitle: chat.listing?.title?.trim() || 'Direct conversation',
          lastMessagePreview: lastMessage?.content?.trim() || 'Start the conversation',
          lastMessageAt: lastMessage?.created_at || chat.created_at,
        }
      })
      .filter((thread): thread is InboxThread => thread !== null)
      .sort((left, right) => {
        return new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime()
      })

    setThreads(nextThreads)
    setLoading(false)
  })

  useEffect(() => {
    let isMounted = true
    let inboxChannel: ReturnType<typeof supabase.channel> | null = null

    async function setupInbox() {
      await loadThreads()

      if (!isMounted) {
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || !isMounted) {
        return
      }

      inboxChannel = supabase
        .channel(`chat_inbox_${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => {
          void loadThreads()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
          void loadThreads()
        })
        .subscribe()
    }

    void setupInbox()

    return () => {
      isMounted = false

      if (inboxChannel) {
        void supabase.removeChannel(inboxChannel)
      }
    }
  }, [supabase])

  if (loading) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-indigo-600 dark:text-indigo-400" /> Messages Inbox
        </h1>
        <Badge className="bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border-indigo-600/20">
          {threads.length} active threads
        </Badge>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-rose-500">Inbox unavailable</p>
            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">{error}</p>
          </div>
        </div>
      )}

      {threads.length === 0 ? (
        <div className="p-20 text-center border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-3xl bg-gray-50 dark:bg-zinc-900/20">
          <MessageSquare className="h-16 w-16 text-gray-300 dark:text-zinc-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">No active chats</h3>
          <p className="text-gray-500 dark:text-zinc-500 mt-2 max-w-sm mx-auto">
            Start a conversation from any product page to negotiate or ask questions.
          </p>
          <Link href="/dashboard">
            <button className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20">
              Browse Marketplace
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => {
            const params = new URLSearchParams({ chat: thread.id })

            if (thread.listingId) {
              params.set('listing', thread.listingId)
            }

            return (
              <Link key={thread.id} href={`/dashboard/chat/${thread.otherId}?${params.toString()}`}>
                <div className="p-4 bg-white dark:bg-[#141416] border border-gray-200 dark:border-white/[0.06] rounded-2xl flex items-center gap-4 hover:border-indigo-500/50 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-all group shadow-sm">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-black text-white text-xl shadow-lg shrink-0">
                    {thread.otherName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-gray-900 dark:text-white truncate">{thread.otherName}</p>
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </div>
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate">
                      @{thread.listingTitle}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 truncate">
                      {thread.lastMessagePreview}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-300 dark:text-zinc-800 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div className="mt-8 p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-start gap-4">
        <ShieldCheck className="h-6 w-6 text-emerald-500 shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Safe Negotiation Protocol</p>
          <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1 leading-relaxed">
            Always keep conversations within Campus Nexus. This keeps realtime updates, AI safety checks,
            and escrow protection attached to the same transaction thread.
          </p>
        </div>
      </div>
    </div>
  )
}
