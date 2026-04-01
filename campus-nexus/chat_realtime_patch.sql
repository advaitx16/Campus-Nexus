-- Safe chat compatibility patch for existing Campus Nexus databases.
-- Run this after the main schema if your project is already provisioned.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_name TEXT;

CREATE INDEX IF NOT EXISTS chats_listing_buyer_seller_idx
  ON public.chats (listing_id, buyer_id, seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS chats_buyer_seller_created_idx
  ON public.chats (buyer_id, seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS chat_messages_chat_id_created_idx
  ON public.chat_messages (chat_id, created_at DESC);

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
