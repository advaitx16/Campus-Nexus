import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { buildChatHref } from '@/lib/chat'

function getProfileDisplayName(profile?: { student_name?: string | null; full_name?: string | null } | null) {
  if (profile?.student_name?.trim()) return profile.student_name.trim()
  if (profile?.full_name?.trim()) return profile.full_name.trim()
  return 'A campus user'
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient() as any
    const payload = await request.json()
    const action = payload.action as string

    if (action === 'boost_listing') {
      const listingId = String(payload.listingId || '')
      if (!listingId) {
        return NextResponse.json({ error: 'Listing id is required' }, { status: 400 })
      }

      const { data: listing, error: listingError } = await admin
        .from('listings')
        .select('id, title, seller_id')
        .eq('id', listingId)
        .single()
      const listingRow = listing as any

      if (listingError || !listingRow) {
        return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
      }

      if (listingRow.seller_id !== user.id) {
        return NextResponse.json({ error: 'Only the seller can broadcast a boost' }, { status: 403 })
      }

      const { data: actorProfile } = await admin
        .from('profiles')
        .select('student_name, full_name')
        .eq('id', user.id)
        .maybeSingle()

      const actorName = getProfileDisplayName(actorProfile)
      const { data: recipients } = await admin
        .from('profiles')
        .select('id')
        .neq('id', user.id)

      const rows = (recipients || []).map((recipient: any) => ({
        user_id: recipient.id,
        type: 'boost',
        title: `${actorName} boosted "${listingRow.title}"`,
        body: 'Freshly boosted listing is live in the marketplace right now.',
        link: `/dashboard/product/${listingId}`,
      }))

      if (rows.length > 0) {
        await admin.from('notifications').insert(rows)
      }

      return NextResponse.json({ success: true, delivered: rows.length })
    }

    if (action === 'order_interest') {
      const orderId = String(payload.orderId || '')
      if (!orderId) {
        return NextResponse.json({ error: 'Order id is required' }, { status: 400 })
      }

      const { data: order, error: orderError } = await admin
        .from('orders')
        .select('id, buyer_id, seller_id, listing_id, amount, escrow_status, order_status')
        .eq('id', orderId)
        .single()
      const orderRow = order as any

      if (orderError || !orderRow) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }

      if (orderRow.buyer_id !== user.id) {
        return NextResponse.json({ error: 'Only the buyer can trigger this alert' }, { status: 403 })
      }

      const [{ data: buyerProfile }, { data: listing }] = await Promise.all([
        admin.from('profiles').select('student_name, full_name').eq('id', user.id).maybeSingle(),
        admin.from('listings').select('title').eq('id', orderRow.listing_id).maybeSingle(),
      ])

      const buyerName = getProfileDisplayName(buyerProfile)
      const listingTitle = listing?.title || 'your listing'

      await admin.from('notifications').insert([
        {
          user_id: orderRow.seller_id,
          type: 'sale',
          title: `New buyer interest for "${listingTitle}"`,
          body: `${buyerName} wants to buy this item. Payment is now in escrow and ready for your response.`,
          link: '/dashboard/profile',
        },
        {
          user_id: orderRow.buyer_id,
          type: 'message',
          title: `Order sent for "${listingTitle}"`,
          body: `Your purchase request of Rs.${Number(orderRow.amount || 0).toLocaleString()} has been sent to the seller.`,
          link: '/dashboard/orders',
        },
      ])

      return NextResponse.json({ success: true })
    }

    if (action === 'review_posted') {
      const orderId = String(payload.orderId || '')
      const rating = Number(payload.rating || 0)
      const comment = typeof payload.comment === 'string' ? payload.comment.trim() : ''

      if (!orderId || !rating) {
        return NextResponse.json({ error: 'Order id and rating are required' }, { status: 400 })
      }

      const { data: order, error: orderError } = await admin
        .from('orders')
        .select('id, buyer_id, seller_id, listing_id')
        .eq('id', orderId)
        .single()
      const orderRow = order as any

      if (orderError || !orderRow) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }

      if (orderRow.buyer_id !== user.id) {
        return NextResponse.json({ error: 'Only the buyer can notify about a review' }, { status: 403 })
      }

      const [{ data: buyerProfile }, { data: listing }] = await Promise.all([
        admin.from('profiles').select('student_name, full_name').eq('id', user.id).maybeSingle(),
        admin.from('listings').select('title').eq('id', orderRow.listing_id).maybeSingle(),
      ])

      const buyerName = getProfileDisplayName(buyerProfile)
      const listingTitle = listing?.title || 'your item'
      const reviewSummary = comment ? `${comment.slice(0, 120)}${comment.length > 120 ? '...' : ''}` : 'Open the item to read the feedback.'

      await admin.from('notifications').insert({
        user_id: orderRow.seller_id,
        type: 'review',
        title: `New buyer feedback on "${listingTitle}"`,
        body: `${buyerName} rated this order ${rating}/5. ${reviewSummary}`,
        link: '/dashboard/profile',
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'sale_complete') {
      const orderId = String(payload.orderId || '')
      if (!orderId) {
        return NextResponse.json({ error: 'Order id is required' }, { status: 400 })
      }

      const { data: order, error: orderError } = await admin
        .from('orders')
        .select('id, buyer_id, seller_id, listing_id, amount')
        .eq('id', orderId)
        .single()
      const orderRow = order as any

      if (orderError || !orderRow) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }

      if (orderRow.buyer_id !== user.id) {
        return NextResponse.json({ error: 'Only the buyer can confirm this sale' }, { status: 403 })
      }

      const [{ data: buyerProfile }, { data: listing }] = await Promise.all([
        admin.from('profiles').select('student_name, full_name').eq('id', user.id).maybeSingle(),
        admin.from('listings').select('title').eq('id', orderRow.listing_id).maybeSingle(),
      ])

      const buyerName = getProfileDisplayName(buyerProfile)
      const listingTitle = listing?.title || 'your item'

      await admin.from('notifications').insert([
        {
          user_id: orderRow.seller_id,
          type: 'sale',
          title: `Item sold: "${listingTitle}"`,
          body: `${buyerName} confirmed receipt. Rs.${Number(orderRow.amount || 0).toLocaleString()} is now released to your account.`,
          link: '/dashboard/orders',
        },
        {
          user_id: orderRow.buyer_id,
          type: 'sale',
          title: `Purchase completed: "${listingTitle}"`,
          body: 'Your escrow confirmation is complete and the order has been marked as sold.',
          link: '/dashboard/orders',
        },
      ])

      return NextResponse.json({ success: true })
    }

    if (action === 'chat_message') {
      const chatId = String(payload.chatId || '')
      const content = typeof payload.content === 'string' ? payload.content.trim() : ''

      if (!chatId || !content) {
        return NextResponse.json({ error: 'Chat id and content are required' }, { status: 400 })
      }

      const { data: chat, error: chatError } = await admin
        .from('chats')
        .select('id, buyer_id, seller_id, listing_id')
        .eq('id', chatId)
        .single()
      const chatRow = chat as any

      if (chatError || !chatRow) {
        return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
      }

      if (chatRow.buyer_id !== user.id && chatRow.seller_id !== user.id) {
        return NextResponse.json({ error: 'Not part of this chat' }, { status: 403 })
      }

      const recipientId = chatRow.buyer_id === user.id ? chatRow.seller_id : chatRow.buyer_id
      const [{ data: senderProfile }, { data: listing }] = await Promise.all([
        admin.from('profiles').select('student_name, full_name').eq('id', user.id).maybeSingle(),
        chatRow.listing_id
          ? admin.from('listings').select('title').eq('id', chatRow.listing_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      const senderName = getProfileDisplayName(senderProfile)
      const preview = content.length > 90 ? `${content.slice(0, 90)}...` : content

      await admin.from('notifications').insert({
        user_id: recipientId,
        type: 'message',
        title: `${senderName} sent you a message`,
        body: listing?.title ? `${listing.title}: ${preview}` : preview,
        link: buildChatHref(user.id, chatId, chatRow.listing_id),
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown notification action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to dispatch notifications' }, { status: 500 })
  }
}
