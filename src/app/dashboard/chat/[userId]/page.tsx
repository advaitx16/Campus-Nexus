'use client'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/client'
import {
  buildParticipantFilter,
  getOtherParticipantId,
  getOtherParticipantProfile,
  getProfileDisplayName,
  normalizeChatThreadRow,
  sortMessagesChronologically,
  upsertMessage,
  type ChatListing,
  type ChatMessageRow,
  type ChatProfile,
} from '@/lib/chat'
import {
  Send,
  Image as ImageIcon,
  Loader2,
  ArrowLeft,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react'

const QUICK_REPLIES = [
  'Is this still available?',
  "Can we meet at the canteen?",
  "What's the final price?",
  'Can you share more photos?',
  'Is this negotiable?',
  'When can you hand it over?',
]

const CHAT_SELECT = `
  id,
  buyer_id,
  seller_id,
  listing_id,
  created_at,
  listing:listings(id, title, image_url, seller_id),
  buyer_profile:profiles!chats_buyer_id_fkey(id, full_name, student_name, department, trust_score),
  seller_profile:profiles!chats_seller_id_fkey(id, full_name, student_name, department, trust_score)
`

export default function DirectMessagePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const userId = params?.userId as string
  const listingIdFromUrl = searchParams?.get('listing')
  const chatIdFromUrl = searchParams?.get('chat')
  const [supabase] = useState(() => createClient())
  const [messages, setMessages] = useState<ChatMessageRow[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [chatId, setChatId] = useState<string | null>(null)
  const [me, setMe] = useState<{ id: string } | null>(null)
  const [them, setThem] = useState<ChatProfile | null>(null)
  const [listing, setListing] = useState<ChatListing | null>(null)
  const [isOnline, setIsOnline] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadMessages = useEffectEvent(async (targetChatId: string) => {
    const { data: messageRows, error: messageError } = await supabase
      .from('chat_messages')
      .select('id, chat_id, sender_id, content, created_at, is_flagged')
      .eq('chat_id', targetChatId)
      .order('created_at', { ascending: true })

    if (messageError) {
      setError(messageError.message)
      setMessages([])
      return
    }

    setMessages(sortMessagesChronologically((messageRows ?? []) as ChatMessageRow[]))
  })

  const resolveChat = useEffectEvent(async () => {
    setLoading(true)
    setError(null)

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!user) {
      setError('Sign in to access your messages.')
      setLoading(false)
      return
    }

    setMe({ id: user.id })

    if (!chatIdFromUrl && user.id === userId) {
      setError("You can't start a chat with yourself.")
      setLoading(false)
      return
    }

    let resolvedChat = null

    if (chatIdFromUrl) {
      const { data: chatRow, error: chatError } = await supabase
        .from('chats')
        .select(CHAT_SELECT)
        .eq('id', chatIdFromUrl)
        .single()

      if (chatError) {
        setError(chatError.message)
        setLoading(false)
        return
      }

      resolvedChat = normalizeChatThreadRow(chatRow)
    }

    if (!resolvedChat && listingIdFromUrl) {
      const { data: listingRow, error: listingError } = await supabase
        .from('listings')
        .select('id, title, image_url, seller_id')
        .eq('id', listingIdFromUrl)
        .single()

      if (listingError) {
        setError(listingError.message)
        setLoading(false)
        return
      }

      const listingRecord = listingRow as ChatListing
      setListing(listingRecord)

      if (user.id === listingRecord.seller_id && userId === listingRecord.seller_id) {
        setError("You can't start a chat on your own listing.")
        setLoading(false)
        return
      }

      const { data: chatRows, error: chatLookupError } = await supabase
        .from('chats')
        .select(CHAT_SELECT)
        .eq('listing_id', listingIdFromUrl)
        .or(buildParticipantFilter(user.id, userId))
        .order('created_at', { ascending: false })
        .limit(1)

      if (chatLookupError) {
        setError(chatLookupError.message)
        setLoading(false)
        return
      }

      resolvedChat = normalizeChatThreadRow(chatRows?.[0])

      if (!resolvedChat) {
        if (user.id === listingRecord.seller_id) {
          setError('Open this conversation from your inbox after a buyer messages you.')
          setLoading(false)
          return
        }

        const { data: insertedChat, error: insertError } = await supabase
          .from('chats')
          .insert({
            listing_id: listingIdFromUrl,
            buyer_id: user.id,
            seller_id: listingRecord.seller_id,
          })
          .select(CHAT_SELECT)
          .single()

        if (insertError) {
          setError(insertError.message)
          setLoading(false)
          return
        }

        resolvedChat = normalizeChatThreadRow(insertedChat)
      }
    }

    if (!resolvedChat) {
      const directChatQuery = supabase
        .from('chats')
        .select(CHAT_SELECT)
        .or(buildParticipantFilter(user.id, userId))
        .order('created_at', { ascending: false })
        .limit(1)

      const { data: directChatRows, error: directChatError } = listingIdFromUrl
        ? await directChatQuery
        : await directChatQuery.is('listing_id', null)

      if (directChatError) {
        setError(directChatError.message)
        setLoading(false)
        return
      }

      resolvedChat = normalizeChatThreadRow(directChatRows?.[0])

      if (!resolvedChat && !listingIdFromUrl) {
        const { data: insertedChat, error: insertError } = await supabase
          .from('chats')
          .insert({
            buyer_id: user.id,
            seller_id: userId,
          })
          .select(CHAT_SELECT)
          .single()

        if (insertError) {
          setError(insertError.message)
          setLoading(false)
          return
        }

        resolvedChat = normalizeChatThreadRow(insertedChat)
      }
    }

    if (!resolvedChat) {
      setError('Conversation not found.')
      setLoading(false)
      return
    }

    const otherId = getOtherParticipantId(resolvedChat, user.id)
    const otherProfile = getOtherParticipantProfile(resolvedChat, user.id)
    setChatId(resolvedChat.id)
    setThem(otherProfile)
    setListing((currentListing) => currentListing ?? resolvedChat.listing ?? null)

    if (
      otherId &&
      (!otherProfile || (!otherProfile.student_name?.trim() && !otherProfile.full_name?.trim()))
    ) {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('id, full_name, student_name, department, trust_score')
        .eq('id', otherId)
        .single()

      setThem((profileRow as ChatProfile | null) ?? null)
    }

    await loadMessages(resolvedChat.id)
    setLoading(false)
  })

  useEffect(() => {
    void resolveChat()
  }, [userId, listingIdFromUrl, chatIdFromUrl])

  useEffect(() => {
    if (!chatId || !me) {
      return
    }

    const presenceChannel = supabase.channel(`chat_presence_${chatId}`, {
      config: { presence: { key: me.id } },
    })

    const messageChannel = supabase
      .channel(`chat_messages_${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          setMessages((currentMessages) => {
            return upsertMessage(currentMessages, payload.new as ChatMessageRow)
          })
        }
      )
      .subscribe()

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        setIsOnline(Boolean(state[userId]))
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key === userId) {
          setIsOnline(true)
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key === userId) {
          setIsOnline(false)
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: me.id,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      void supabase.removeChannel(presenceChannel)
      void supabase.removeChannel(messageChannel)
    }
  }, [chatId, me, supabase, userId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(presetText?: string) {
    const content = (presetText ?? newMessage).trim()

    if (!content || !chatId || !me || sending) {
      return
    }

    setSending(true)
    setError(null)
    setNewMessage('')
    setShowQuickReplies(false)

    try {
      const moderationResponse = await fetch('/api/moderate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, channel: 'dm' }),
      })

      const moderationResult = (await moderationResponse.json().catch(() => ({ safe: true }))) as {
        safe?: boolean
        reason?: string | null
        flagged?: boolean
      }

      if (moderationResult.safe === false) {
        setError(moderationResult.reason || 'Message blocked by safety checks.')
        setNewMessage(content)
        return
      }

      const { data: insertedMessage, error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatId,
          sender_id: me.id,
          content,
          is_flagged: Boolean(moderationResult.flagged),
        })
        .select('id, chat_id, sender_id, content, created_at, is_flagged')
        .single()

      if (insertError) {
        throw insertError
      }

      setMessages((currentMessages) => {
        return upsertMessage(currentMessages, insertedMessage as ChatMessageRow)
      })
    } catch (sendError) {
      const messageText = sendError instanceof Error ? sendError.message : 'Unable to send message right now.'
      setError(messageText)
      setNewMessage(content)
    } finally {
      setSending(false)
    }
  }

  const otherName = getProfileDisplayName(them)
  const otherTrust = Number(them?.trust_score ?? 85)
  const otherDepartment = them?.department?.trim()

  if (loading) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (error && !chatId) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-950 p-6 text-center space-y-4">
        <div className="h-14 w-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <AlertCircle className="h-7 w-7 text-rose-400" />
        </div>
        <div className="space-y-2 max-w-md">
          <p className="text-xl font-black text-white">Conversation unavailable</p>
          <p className="text-sm text-zinc-500">{error}</p>
        </div>
        <Link href="/dashboard/chat">
          <Button className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">Back to Inbox</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <Link href="/dashboard/chat"><ArrowLeft className="h-5 w-5 text-zinc-500 hover:text-white transition-colors" /></Link>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative shrink-0">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white">
              {otherName.charAt(0)}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-900 ${isOnline ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white truncate">{otherName}</p>
            <p className="text-xs text-zinc-500 flex items-center gap-2 truncate">
              <span className={isOnline ? 'text-emerald-400' : 'text-zinc-600'}>{isOnline ? 'Online in this chat' : 'Offline'}</span>
              <span>· Trust {them?.trust_score || 85}</span>
              {otherDepartment && <span>· {otherDepartment}</span>}
            </p>
            {listing?.title && <p className="text-[11px] text-indigo-300 truncate mt-1">About: {listing.title}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-600/20 text-emerald-400 text-xs font-bold px-3 py-1" title={`Trust ${otherTrust}`}>
            Verified Trader
          </Badge>
        </div>
      </div>

      {error && (
        <div className="px-4 pt-4 shrink-0">
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-300">{error}</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="text-center py-4 space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
            <ShieldAlert className="h-3 w-3 text-indigo-400" />
            <span className="text-[10px] text-indigo-300 font-medium">Campus Guardian AI is monitoring this chat for safety</span>
          </div>
          {listing?.title && (
            <div className="inline-flex items-center px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-[11px] text-zinc-400">
              Thread linked to: <span className="text-white font-semibold ml-1">{listing.title}</span>
            </div>
          )}
        </div>

        {messages.length === 0 ? (
          <div className="p-10 border border-dashed border-zinc-800 rounded-3xl text-center bg-zinc-900/30">
            <p className="text-white font-bold">No messages yet</p>
            <p className="text-sm text-zinc-500 mt-2">Start the conversation and this thread will update live for both users.</p>
          </div>
        ) : (
          messages.map((message) => {
            const isMine = message.sender_id === me?.id
            return (
              <div key={message.id} className={`flex gap-3 ${isMine ? 'flex-row-reverse' : ''}`}>
                {!isMine && (
                  <div className="h-8 w-8 rounded-full bg-zinc-800 shrink-0 flex items-center justify-center text-zinc-400 text-xs font-bold">
                    {otherName.charAt(0)}
                  </div>
                )}
                <div className={`max-w-[75%] space-y-1 ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${isMine ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-zinc-800 text-zinc-100 rounded-tl-none'}`}>
                    {message.content}
                  </div>
                  <div className={`flex items-center gap-1.5 text-[10px] text-zinc-600 ${isMine ? 'flex-row-reverse' : ''}`}>
                    <span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {showQuickReplies && (
        <div className="flex gap-2 overflow-x-auto pb-3 px-4 scrollbar-hide shrink-0 animate-in slide-in-from-bottom-2">
          {QUICK_REPLIES.map(qr => (
            <button key={qr} onClick={() => void handleSend(qr)}
              className="whitespace-nowrap px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-2xl text-xs font-semibold hover:border-indigo-500 hover:text-white transition-all shrink-0 shadow-lg">
              {qr}
            </button>
          ))}
        </div>
      )}

      <div className="p-4 bg-zinc-900 border-t border-zinc-800 shrink-0">
        <div className="flex gap-3 items-center">
          <button
            type="button"
            onClick={() => setError('Image sharing is coming soon. Text chat is fully live now.')}
            className="h-12 w-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-indigo-400 hover:bg-zinc-700 transition-all shrink-0"
            title="Image sharing coming soon"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => setShowQuickReplies(!showQuickReplies)} className={`h-12 w-12 rounded-2xl border flex items-center justify-center transition-all shrink-0 ${showQuickReplies ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'bg-zinc-800 border-transparent text-zinc-500 hover:text-indigo-400 hover:bg-zinc-700'}`}>
            <span className="text-xs font-black tracking-tighter">QUICK</span>
          </button>
          <div className="flex-1 flex bg-zinc-950 border border-zinc-800 rounded-2xl focus-within:border-indigo-500/50 transition-all">
            <input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), void handleSend())}
              placeholder="Start typing safely..."
              className="flex-1 bg-transparent px-5 py-3 text-white text-sm placeholder-zinc-700 focus:outline-none"
            />
          </div>
          <Button onClick={() => void handleSend()} disabled={!newMessage.trim() || sending} className="h-12 w-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 shrink-0 transition-all active:scale-95">
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
