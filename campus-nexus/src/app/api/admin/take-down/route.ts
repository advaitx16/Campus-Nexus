'use server'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const listingId = body?.listingId as string | undefined

  if (!listingId) {
    return NextResponse.json({ success: false, message: 'listingId required' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return NextResponse.json({ success: false, message: 'Supabase service credentials not configured' }, { status: 500 })
  }

  const supabase = createClient(url, serviceKey)

  const { error } = await supabase
    .from('listings')
    .update({ is_active: false, admin_status: 'REJECTED' })
    .eq('id', listingId)

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
