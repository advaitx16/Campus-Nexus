-- ============================================================
-- Campus Nexus v2 Migration — Run in Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- enables fuzzy search

-- ============================================================
-- EXTEND EXISTING profiles table with new fields
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trust_score NUMERIC(5,2) DEFAULT 50.0,
  ADD COLUMN IF NOT EXISTS cc_points INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS total_sales INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2) DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS account_age_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_shadow_banned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS campus TEXT DEFAULT 'Main Campus',
  ADD COLUMN IF NOT EXISTS department TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS github_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_checkin DATE,
  ADD COLUMN IF NOT EXISTS referral_code TEXT DEFAULT uuid_generate_v4()::text;

-- ============================================================
-- EXTEND EXISTING products table with new fields
-- ============================================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_bumped BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bump_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_shadow_banned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allows_rental BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rental_price_daily NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS rental_price_weekly NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS rental_price_semester NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS security_deposit NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS rent_to_own BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rent_to_own_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS campus TEXT DEFAULT 'Main Campus',
  ADD COLUMN IF NOT EXISTS course_tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS wishlist_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- ============================================================
-- BADGES
-- ============================================================
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT '🏆',
  color TEXT DEFAULT 'zinc',
  criteria_type TEXT NOT NULL, -- 'sales_count', 'eco_count', 'response_time', 'manual'
  criteria_value INTEGER DEFAULT 0
);

INSERT INTO badges (name, description, icon, color, criteria_type, criteria_value) VALUES
  ('Senior Seller', 'Completed 20+ successful sales', '🌟', 'amber', 'sales_count', 20),
  ('Fast Responder', 'Responds to messages within 1 hour', '⚡', 'blue', 'response_time', 60),
  ('Eco-Warrior', 'Sold 5+ used books or reusable items', '🌿', 'emerald', 'eco_count', 5),
  ('Campus Legend', 'Top seller of the month', '👑', 'purple', 'manual', 0),
  ('Verified Student', 'ID verified by Gemini AI', '✅', 'indigo', 'manual', 0),
  ('Deal Hunter', 'Purchased 10+ items', '🎯', 'rose', 'sales_count', 10)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'pending', -- pending, reviewed, dismissed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto shadow-ban trigger: if product gets 3 reports, shadow ban it
CREATE OR REPLACE FUNCTION auto_shadow_ban_product()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products SET is_shadow_banned = TRUE
  WHERE id = NEW.product_id
    AND (SELECT COUNT(*) FROM reports WHERE product_id = NEW.product_id) >= 3;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_report_created ON reports;
CREATE TRIGGER on_report_created
  AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION auto_shadow_ban_product();

-- ============================================================
-- WISHLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS wishlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  last_notified_price NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- ============================================================
-- WANTED FEED (Reverse Marketplace)
-- ============================================================
CREATE TABLE IF NOT EXISTS wanted_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  max_budget NUMERIC(10,2),
  category TEXT,
  campus TEXT DEFAULT 'Main Campus',
  status TEXT DEFAULT 'open', -- open, fulfilled
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RENTALS
-- ============================================================
CREATE TABLE IF NOT EXISTS rentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  renter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rental_tier TEXT NOT NULL, -- 'daily', 'weekly', 'semester'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  daily_rate NUMERIC(10,2),
  total_amount NUMERIC(10,2),
  deposit_amount NUMERIC(10,2),
  deposit_status TEXT DEFAULT 'held', -- held, released, disputed
  late_fee_deducted NUMERIC(10,2) DEFAULT 0,
  handover_photo_url TEXT,
  return_photo_url TEXT,
  ai_condition_report JSONB,
  rent_to_own_exercised BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active', -- active, returned, disputed, completed
  razorpay_order_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ESCROW TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS escrow_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  platform_fee NUMERIC(10,2) DEFAULT 0,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  status TEXT DEFAULT 'pending', -- pending, paid, released, refunded, disputed
  buyer_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  released_at TIMESTAMPTZ
);

-- ============================================================
-- COMMUNITY FEED (Extended)
-- ============================================================
ALTER TABLE community_feed
  ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES community_feed(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_anon BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_flagged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS shared_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campus TEXT DEFAULT 'Main Campus';

-- Create community_feed if it doesn't exist
CREATE TABLE IF NOT EXISTS community_feed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  channel TEXT DEFAULT 'global',
  parent_id UUID REFERENCES community_feed(id) ON DELETE CASCADE,
  is_anon BOOLEAN DEFAULT FALSE,
  ai_flagged BOOLEAN DEFAULT FALSE,
  media_url TEXT,
  shared_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  campus TEXT DEFAULT 'Main Campus',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- POLLS
-- ============================================================
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  votes JSONB NOT NULL DEFAULT '{}',
  campus TEXT DEFAULT 'Main Campus',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DIRECT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  content TEXT,
  media_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  is_quick_reply BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'price_drop', 'message', 'sale', 'badge', 'rental_due', 'late_fee'
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCHEDULED HANDOVERS
-- ============================================================
CREATE TABLE IF NOT EXISTS handover_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES escrow_transactions(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  safe_zone_name TEXT,
  safe_zone_lat NUMERIC,
  safe_zone_lng NUMERIC,
  status TEXT DEFAULT 'scheduled', -- scheduled, completed, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LOST AND FOUND
-- ============================================================
CREATE TABLE IF NOT EXISTS lost_and_found (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'lost', 'found'
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  location TEXT,
  campus TEXT DEFAULT 'Main Campus',
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REFERRALS
-- ============================================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  cc_awarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_user_id)
);

-- ============================================================
-- KEYWORD BLACKLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS keyword_blacklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword TEXT NOT NULL UNIQUE,
  added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO keyword_blacklist (keyword) VALUES
  ('alcohol'), ('drugs'), ('illegal'), ('weapon'), ('fake id')
ON CONFLICT (keyword) DO NOTHING;

-- ============================================================
-- TRUST SCORE FUNCTION (Feature 2 — Trust Score 2.0)
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_trust_score(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_sales INTEGER;
  v_avg_rating NUMERIC;
  v_age_days INTEGER;
  v_score NUMERIC;
BEGIN
  SELECT total_sales, avg_rating, account_age_days
    INTO v_sales, v_avg_rating, v_age_days
    FROM profiles WHERE id = p_user_id;

  v_score := (v_sales * 0.4) + (v_avg_rating * 10 * 0.3) + (v_age_days * 0.01 * 0.3);
  v_score := GREATEST(0, LEAST(100, v_score));

  UPDATE profiles SET trust_score = v_score WHERE id = p_user_id;
  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE lost_and_found ENABLE ROW LEVEL SECURITY;
ALTER TABLE wanted_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;

-- Wishlists: user owns their wishlist
CREATE POLICY IF NOT EXISTS "Own wishlist" ON wishlists FOR ALL USING (auth.uid() = user_id);

-- Reports: anyone can insert anonymously
CREATE POLICY IF NOT EXISTS "Anyone can report" ON reports FOR INSERT WITH CHECK (TRUE);
CREATE POLICY IF NOT EXISTS "Admins see all reports" ON reports FOR SELECT USING (TRUE);

-- Rentals: involved parties only
CREATE POLICY IF NOT EXISTS "Rental parties" ON rentals FOR ALL USING (auth.uid() = renter_id OR auth.uid() = owner_id);

-- Escrow: involved parties only
CREATE POLICY IF NOT EXISTS "Escrow parties" ON escrow_transactions FOR ALL USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- DMs: sender and receiver
CREATE POLICY IF NOT EXISTS "DM parties" ON direct_messages FOR ALL USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Notifications: own only
CREATE POLICY IF NOT EXISTS "Own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);

-- Community: public read, auth write
CREATE POLICY IF NOT EXISTS "Public community read" ON community_feed FOR SELECT USING (TRUE);
CREATE POLICY IF NOT EXISTS "Auth community write" ON community_feed FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Lost & Found: public read, auth write
CREATE POLICY IF NOT EXISTS "Public lost found" ON lost_and_found FOR SELECT USING (TRUE);
CREATE POLICY IF NOT EXISTS "Auth lost found write" ON lost_and_found FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Wanted posts: public read
CREATE POLICY IF NOT EXISTS "Public wanted" ON wanted_posts FOR SELECT USING (TRUE);
CREATE POLICY IF NOT EXISTS "Auth wanted write" ON wanted_posts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Polls: public
CREATE POLICY IF NOT EXISTS "Public polls" ON polls FOR SELECT USING (TRUE);
CREATE POLICY IF NOT EXISTS "Auth polls write" ON polls FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE community_feed;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
