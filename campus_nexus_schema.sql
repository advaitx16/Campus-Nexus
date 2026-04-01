-- ============================================================
-- Campus Nexus — Production Schema V3 (Full Realtime & Moderation)
-- Uses DROP IF EXISTS so it's safe to run multiple times
-- Run in: Supabase → SQL Editor → New query → Run
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────────────────────
-- PROFILES
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT,
  student_name TEXT,
  department  TEXT,
  roll_number TEXT,
  student_id_verified BOOLEAN DEFAULT false,
  cc_points   INTEGER DEFAULT 0,
  trust_score NUMERIC(5,2) DEFAULT 50.00,
  last_checkin DATE,
  avatar_url  TEXT,
  is_shadow_banned BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_shadow_banned BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_name TEXT;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone"     ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile"    ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile"    ON public.profiles;

CREATE POLICY "Profiles are viewable by everyone"  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, cc_points)
  VALUES (NEW.id, NEW.email, 0)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ──────────────────────────────────────────────────────────
-- LISTINGS
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.listings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_email    TEXT,
  seller_name     TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT DEFAULT 'Other',
  condition       TEXT DEFAULT 'Good',
  price           NUMERIC(10,2) NOT NULL,
  original_price  NUMERIC(10,2),
  tags            TEXT[],
  image_url       TEXT,
  allows_rental   BOOLEAN DEFAULT false,
  rental_daily    NUMERIC(10,2),
  rental_weekly   NUMERIC(10,2),
  rental_semester NUMERIC(10,2),
  security_deposit NUMERIC(10,2),
  is_active       BOOLEAN DEFAULT true,
  is_featured     BOOLEAN DEFAULT false,
  is_bumped       BOOLEAN DEFAULT false,
  admin_status    TEXT DEFAULT 'APPROVED' CHECK (admin_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  view_count      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS admin_status TEXT DEFAULT 'PENDING' CHECK (admin_status IN ('PENDING', 'APPROVED', 'REJECTED'));

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active listings viewable by all"     ON public.listings;
DROP POLICY IF EXISTS "Users can insert their own listings" ON public.listings;
DROP POLICY IF EXISTS "Users can update their own listings" ON public.listings;
DROP POLICY IF EXISTS "Users can delete their own listings" ON public.listings;

-- Only approved ones are public, but sellers can see their own
CREATE POLICY "Active listings viewable by all"    ON public.listings FOR SELECT USING ((is_active = true AND admin_status = 'APPROVED') OR auth.uid() = seller_id);
CREATE POLICY "Users can insert their own listings" ON public.listings FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Users can update their own listings" ON public.listings FOR UPDATE  USING (auth.uid() = seller_id);
CREATE POLICY "Users can delete their own listings" ON public.listings FOR DELETE  USING (auth.uid() = seller_id);

-- ──────────────────────────────────────────────────────────
-- ORDERS
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id          UUID REFERENCES public.listings(id),
  buyer_id            UUID REFERENCES public.profiles(id),
  seller_id           UUID REFERENCES public.profiles(id),
  amount              NUMERIC(10,2) NOT NULL,
  platform_fee        NUMERIC(10,2),
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  escrow_status       TEXT DEFAULT 'HELD' CHECK (escrow_status IN ('HELD','RELEASED','REFUNDED')),
  order_status        TEXT DEFAULT 'PENDING' CHECK (order_status IN ('PENDING','PAID','CONFIRMED','COMPLETE','CANCELLED','DISPUTED')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Orders viewable by buyer or seller"   ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.orders;

CREATE POLICY "Orders viewable by buyer or seller"   ON public.orders FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Authenticated users can create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Authenticated users can update orders" ON public.orders FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- ──────────────────────────────────────────────────────────
-- COMMUNITY FEED
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_feed (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id   UUID REFERENCES public.profiles(id),
  author_name TEXT,
  channel     TEXT NOT NULL DEFAULT 'global',
  content     TEXT NOT NULL,
  is_anon     BOOLEAN DEFAULT false,
  ai_flagged  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.community_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Community posts visible to all" ON public.community_feed;
DROP POLICY IF EXISTS "Authenticated users can post"   ON public.community_feed;

CREATE POLICY "Community posts visible to all" ON public.community_feed FOR SELECT USING (true);
CREATE POLICY "Authenticated users can post"   ON public.community_feed FOR INSERT WITH CHECK (true);

-- ──────────────────────────────────────────────────────────
-- NEW: WISHLIST ITEMS
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own wishlist" ON public.wishlist_items;
CREATE POLICY "Users can manage their own wishlist" ON public.wishlist_items FOR ALL USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- NEW: SELLER REVIEWS & TRUST SCORE ALGORITHM
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seller_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.orders(id),
  buyer_id UUID REFERENCES public.profiles(id),
  seller_id UUID REFERENCES public.profiles(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id)
);
ALTER TABLE public.seller_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reviews viewable by everyone" ON public.seller_reviews;
DROP POLICY IF EXISTS "Buyers can leave review" ON public.seller_reviews;
CREATE POLICY "Reviews viewable by everyone" ON public.seller_reviews FOR SELECT USING (true);
CREATE POLICY "Buyers can leave review" ON public.seller_reviews FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE OR REPLACE FUNCTION public.update_trust_score()
RETURNS TRIGGER AS $$
DECLARE
  total_sales INTEGER;
  avg_rating NUMERIC;
  new_trust NUMERIC;
BEGIN
  SELECT COUNT(*) INTO total_sales FROM public.orders WHERE seller_id = NEW.seller_id AND order_status = 'COMPLETE';
  SELECT COALESCE(AVG(rating), 3) INTO avg_rating FROM public.seller_reviews WHERE seller_id = NEW.seller_id;
  new_trust := 50 + (total_sales * 2) + ((avg_rating - 3) * 5);
  IF new_trust > 100 THEN new_trust := 100; END IF;
  IF new_trust < 0 THEN new_trust := 0; END IF;
  UPDATE public.profiles SET trust_score = new_trust WHERE id = NEW.seller_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_review_created ON public.seller_reviews;
CREATE TRIGGER on_review_created
  AFTER INSERT ON public.seller_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_trust_score();

-- ──────────────────────────────────────────────────────────
-- NEW: CHATS (REALTIME)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES public.listings(id),
  buyer_id UUID REFERENCES public.profiles(id),
  seller_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, buyer_id)
);
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chat participants can view" ON public.chats;
DROP POLICY IF EXISTS "Chat participants can insert" ON public.chats;
CREATE POLICY "Chat participants can view" ON public.chats FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Chat participants can insert" ON public.chats FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  is_flagged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participants can view messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Participants can send messages" ON public.chat_messages;
CREATE POLICY "Participants can view messages" ON public.chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid()))
);
CREATE POLICY "Participants can send messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ──────────────────────────────────────────────────────────
-- NEW: LOST AND FOUND
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lost_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES public.profiles(id),
  item_name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  lost_date DATE,
  status TEXT DEFAULT 'LOST' CHECK (status IN ('LOST', 'FOUND', 'RETURNED')),
  reward_cc INTEGER DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.lost_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lost items viewable by all" ON public.lost_items;
DROP POLICY IF EXISTS "Users can create lost items" ON public.lost_items;
DROP POLICY IF EXISTS "Creators can update lost items" ON public.lost_items;
CREATE POLICY "Lost items viewable by all" ON public.lost_items FOR SELECT USING (true);
CREATE POLICY "Users can create lost items" ON public.lost_items FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Creators can update lost items" ON public.lost_items FOR UPDATE USING (auth.uid() = reporter_id);

-- ──────────────────────────────────────────────────────────
-- ENABLE REALTIME
-- ──────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.listings; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.community_feed; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_reviews; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chats; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.lost_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
