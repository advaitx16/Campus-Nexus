-- Campus Nexus V2.0 - Core High-Fidelity Schema
-- Ensures UUID generation and necessary extensions (like pgvector for AI).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- ENUMS
-- ==========================================
CREATE TYPE user_role AS ENUM ('STUDENT', 'ADMIN', 'MODERATOR');
CREATE TYPE user_status AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'RESTRICTED', 'BANNED', 'SHADOW_BANNED');
CREATE TYPE product_type AS ENUM ('SELL', 'RENT', 'REQ');
CREATE TYPE product_status AS ENUM ('DRAFT', 'ACTIVE', 'SOLD', 'RESERVED', 'SHADOW_BANNED');
CREATE TYPE rental_status AS ENUM ('PENDING', 'ACTIVE', 'RETURNED', 'OVERDUE', 'DISPUTE');
CREATE TYPE escrow_status AS ENUM ('HELD', 'RELEASED', 'REFUNDED');
CREATE TYPE message_moderation_status AS ENUM ('CLEAN', 'FLAGGED', 'HIDDEN');

-- ==========================================
-- 1. USERS & TRUST (The "Shield" Module)
-- ==========================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    univ_email VARCHAR(255) UNIQUE NOT NULL,
    real_name VARCHAR(255),
    display_name VARCHAR(255),
    alias_name VARCHAR(100) DEFAULT 'Mystery Engineer',
    trust_score NUMERIC(5,2) DEFAULT 50.00,
    cc_balance INTEGER DEFAULT 0 CHECK (cc_balance >= -100), -- Allow negative balance but cap
    verification_data JSONB, -- Stores Gemini OCR data (Student_ID_Num, Expiry)
    role user_role DEFAULT 'STUDENT',
    status user_status DEFAULT 'PENDING_VERIFICATION',
    college_id VARCHAR(50) DEFAULT 'MAIN_CAMPUS',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ==========================================
-- 2. PRODUCTS & DISCOVERY (The "Brain" Module)
-- ==========================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type product_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    tags TEXT[],
    condition_rating INTEGER CHECK (condition_rating BETWEEN 1 AND 5),
    price NUMERIC(10,2),
    rental_price_daily NUMERIC(10,2),
    rental_price_weekly NUMERIC(10,2),
    rental_price_semester NUMERIC(10,2),
    ai_metadata JSONB, -- Fast filtering via GIN index
    -- embedding VECTOR(1536), -- Vector embeddings (enable pgvector if available)
    status product_status DEFAULT 'DRAFT',
    priority_score INTEGER DEFAULT 0, -- For "Bump" / Ads
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
-- Accelerate JSON queries for AI filtering
CREATE INDEX idx_products_ai_metadata ON products USING GIN (ai_metadata);

-- ==========================================
-- 3. RENTALS & CIRCULAR ECONOMY (The "Loop" Module)
-- ==========================================
CREATE TABLE rentals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id),
    renter_id UUID REFERENCES users(id),
    escrow_status escrow_status DEFAULT 'HELD',
    deposit_id UUID,
    deposit_amount NUMERIC(10,2),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    expected_return_date TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_return_date TIMESTAMP WITH TIME ZONE,
    handover_qr_hash VARCHAR(255),
    status rental_status DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE rental_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_id UUID REFERENCES rentals(id) ON DELETE CASCADE,
    type VARCHAR(20) CHECK (type IN ('HANDOVER', 'RETURN')),
    condition_image_url TEXT NOT NULL,
    ai_damage_assessment JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 4. CONVERSATIONS & SOCIAL (The "Pulse" Module)
-- ==========================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_context_id UUID REFERENCES products(id),
    type VARCHAR(50) CHECK (type IN ('DIRECT', 'DEPARTMENT', 'GLOBAL', 'CONFESSIONS')),
    department_id VARCHAR(100),
    last_message_ts TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_conversations_last_ts ON conversations (last_message_ts DESC);

CREATE TABLE chat_members (
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY(conversation_id, user_id)
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    content TEXT,
    media_url TEXT,
    is_anon BOOLEAN DEFAULT false,
    sentiment_score NUMERIC(4,3),
    moderation_status message_moderation_status DEFAULT 'CLEAN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 5. COMMUNITY HUB
-- ==========================================
CREATE TABLE community_feed (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES users(id),
    channel VARCHAR(100),
    content TEXT,
    is_anon BOOLEAN DEFAULT false,
    sentiment_score NUMERIC(4,3),
    moderation_status message_moderation_status DEFAULT 'CLEAN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ==========================================
-- 6. LEDGER & MONETIZATION (The "Engine" Module)
-- ==========================================
CREATE TABLE ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_hash VARCHAR(255) UNIQUE NOT NULL,
    from_user UUID REFERENCES users(id),
    to_user UUID REFERENCES users(id),
    points_delta INTEGER NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;

-- Security Policies
CREATE POLICY "Users can view their own sensitive data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Public profile data viewable by verified" ON users FOR SELECT USING (status = 'VERIFIED');

CREATE POLICY "Anyone can view active products" ON products FOR SELECT USING (status = 'ACTIVE');
CREATE POLICY "Verified users can insert products" ON products FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND status = 'VERIFIED')
);
CREATE POLICY "Sellers can update their own products" ON products FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Verified users can create rentals" ON rentals FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND status = 'VERIFIED')
);

-- ==========================================
-- TRIGGERS & FUNCTIONS
-- ==========================================

-- Function: Auto-flag toxic community posts
CREATE OR REPLACE FUNCTION check_community_sentiment() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sentiment_score < -0.8 THEN
        NEW.moderation_status := 'FLAGGED';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_community_sentiment
BEFORE INSERT OR UPDATE ON community_feed
FOR EACH ROW EXECUTE FUNCTION check_community_sentiment();

-- Function: Immutable Ledger
CREATE OR REPLACE FUNCTION prevent_ledger_updates() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Vault/Ledger records are immutable.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_immutable_ledger
BEFORE UPDATE OR DELETE ON ledger
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_updates();

-- Function: Compute Trust Score & Mint CC Points for Successful Sale
CREATE OR REPLACE FUNCTION handle_completed_sale() RETURNS TRIGGER AS $$
DECLARE
    bonus INTEGER := 10;
BEGIN
    IF NEW.status = 'SOLD' AND OLD.status != 'SOLD' THEN
        -- Increase trust score
        UPDATE users SET trust_score = LEAST(100.0, trust_score + 2.5) WHERE id = NEW.seller_id;
        
        -- Mint CC points (Sustainability multiplier check)
        IF NEW.category = 'Books' THEN
            bonus := 20; -- 2x CC points for green items
        END IF;
        
        INSERT INTO ledger (transaction_hash, to_user, points_delta, reason)
        VALUES (gen_random_uuid()::text, NEW.seller_id, bonus, 'SALE_COMPLETED');
        
        UPDATE users SET cc_balance = cc_balance + bonus WHERE id = NEW.seller_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sale_completed
AFTER UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION handle_completed_sale();

-- ==========================================
-- VIEWS (Leaderboards)
-- ==========================================
CREATE OR REPLACE VIEW leaderboard_top_sellers AS
SELECT 
    u.id, 
    u.real_name, 
    u.alias_name, 
    u.trust_score, 
    u.college_id,
    COUNT(p.id) as total_sales,
    SUM(p.price) as total_revenue
FROM users u
JOIN products p ON u.id = p.seller_id
WHERE p.status = 'SOLD'
GROUP BY u.id
ORDER BY total_sales DESC, u.trust_score DESC;

