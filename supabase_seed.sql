-- ============================================================
-- INITIAL SEED DATA FOR DEMONSTRATION 
-- Run this in Supabase SQL Editor AFTER running the schema script.
-- ============================================================

-- Ensure columns exist in case of legacy table schema
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trust_score NUMERIC(5,2) DEFAULT 50.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cc_points INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_id_verified BOOLEAN DEFAULT false;

ALTER TABLE public.community_feed ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS seller_name TEXT;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS admin_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Drop foreign key constraints that conflict with legacy schemas
ALTER TABLE public.community_feed DROP CONSTRAINT IF EXISTS community_feed_author_id_fkey;
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_seller_id_fkey;
ALTER TABLE public.lost_items DROP CONSTRAINT IF EXISTS lost_items_reporter_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Instead of inserting fake User IDs (which violates auth.users foreign keys), 
-- this script will detect YOUR existing profile and populate the dummy data under YOUR name!
DO $$
DECLARE
  my_id uuid;
BEGIN
  -- Grab the first registered user (You!)
  SELECT id INTO my_id FROM public.profiles LIMIT 1;
  
  IF my_id IS NULL THEN
    RAISE EXCEPTION 'NO USERS FOUND! Please go to your campus-nexus website and sign up / create an account first, then run this script again!';
  END IF;

  -- Update your profile so you appear on the leaderboard
  UPDATE public.profiles SET 
    full_name = 'Campus Nexus Founder',
    department = 'Computer Science',
    trust_score = 99.5,
    cc_points = 5000,
    student_id_verified = true
  WHERE id = my_id;

  -- Add a few public listings under your account
  INSERT INTO public.listings (seller_id, seller_name, title, price, category, condition, is_active, admin_status, image_url)
  VALUES 
    (my_id, 'Campus Nexus Founder', 'MacBook Pro M1 (Lightly Used)', 75000, 'Electronics', 'Good', true, 'APPROVED', '💻'),
    (my_id, 'Campus Nexus Founder', 'Sony WH-1000XM4 Headphones', 8000, 'Electronics', 'Like New', true, 'APPROVED', '🎧'),
    (my_id, 'Campus Nexus Founder', 'Calculus Early Transcendentals 8th Edition', 400, 'Textbooks', 'Fair', true, 'APPROVED', '📘');

  -- Add Community Feed posts under your account
  INSERT INTO public.community_feed (author_id, author_name, channel, content, is_anon)
  VALUES 
    (my_id, 'Campus Nexus Founder', 'global', 'Welcome to the live Campus Pulse! This is running purely on Supabase.', false),
    (my_id, 'Campus Nexus Founder', 'flash-deals', 'Selling my dorm mini-fridge! Extremely cheap, moving out tomorrow! DM me!', false),
    (my_id, 'Anonymous', 'confessions', 'I accidentally slept through my final today... someone save me 😭', true);

  -- Add Lost & Found items
  INSERT INTO public.lost_items (reporter_id, item_name, description, location, lost_date, status, reward_cc)
  VALUES 
    (my_id, 'AirPods Pro Case', 'White case, no airpods inside. Has a small dog sticker on the back.', 'Library 2nd Floor', CURRENT_DATE - INTERVAL '1 day', 'LOST', 50),
    (my_id, 'Blue Hydroflask', 'Covered in stickers.', 'Main Cafeteria', CURRENT_DATE - INTERVAL '3 days', 'FOUND', 0);

END $$;
