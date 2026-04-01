export type ChatProfile = {
  id?: string | null
  full_name?: string | null
  student_name?: string | null
  avatar_url?: string | null
  department?: string | null
  trust_score?: number | null
}

export type ChatListing = {
  id: string
  title?: string | null
  image_url?: string | null
  seller_id?: string | null
}

export type ChatThreadRow = {
  id: string
  buyer_id: string | null
  seller_id: string | null
  listing_id: string | null
  created_at: string
  listing?: ChatListing | null
  buyer_profile?: ChatProfile | null
  seller_profile?: ChatProfile | null
}

export type ChatMessageRow = {
  id: string
  chat_id: string
  sender_id: string | null
  content: string
  created_at: string
  is_flagged?: boolean | null
}

export function buildParticipantFilter(firstUserId: string, secondUserId: string) {
  return `and(buyer_id.eq.${firstUserId},seller_id.eq.${secondUserId}),and(buyer_id.eq.${secondUserId},seller_id.eq.${firstUserId})`
}

export function getOtherParticipantId(chat: ChatThreadRow, currentUserId: string) {
  return chat.buyer_id === currentUserId ? chat.seller_id : chat.buyer_id
}

export function getOtherParticipantProfile(chat: ChatThreadRow, currentUserId: string) {
  return chat.buyer_id === currentUserId ? chat.seller_profile ?? null : chat.buyer_profile ?? null
}

export function getProfileDisplayName(profile?: ChatProfile | null) {
  if (profile?.student_name?.trim()) {
    return profile.student_name.trim()
  }

  if (profile?.full_name?.trim()) {
    return profile.full_name.trim()
  }

  if (profile?.id) {
    return `Student ${profile.id.slice(0, 8)}`
  }

  return 'Student'
}

export function buildLastMessageMap(messages: ChatMessageRow[]) {
  const lastMessageByChatId = new Map<string, ChatMessageRow>()

  for (const message of [...messages].sort((left, right) => {
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })) {
    if (!lastMessageByChatId.has(message.chat_id)) {
      lastMessageByChatId.set(message.chat_id, message)
    }
  }

  return lastMessageByChatId
}

export function sortMessagesChronologically(messages: ChatMessageRow[]) {
  return [...messages].sort((left, right) => {
    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  })
}

export function upsertMessage(messages: ChatMessageRow[], incomingMessage: ChatMessageRow) {
  return sortMessagesChronologically([
    ...messages.filter((message) => message.id !== incomingMessage.id),
    incomingMessage,
  ])
}
