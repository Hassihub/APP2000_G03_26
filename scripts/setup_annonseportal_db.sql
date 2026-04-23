-- Annonseportal - Database Setup Script
-- Kjør dette i PostgreSQL for å opprette alle nødvendige tabeller

-- 1. ADVERTISER TABLE
CREATE TABLE IF NOT EXISTS advertisers (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  company_name VARCHAR(255) NOT NULL,
  company_description TEXT,
  contact_person VARCHAR(255),
  phone VARCHAR(20),
  website VARCHAR(255),
  logo_url VARCHAR(500),
  payment_method VARCHAR(50),
  bank_account VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  rejection_reason TEXT,
  approved_by INT REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. AD CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS ad_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  display_order INT
);

-- Insert standard categories
INSERT INTO ad_categories (name, slug, description, display_order) VALUES
  ('Turutstyr', 'hiking_gear', 'Utstyr for turer og friluftsliv', 1),
  ('Turmat', 'hiking_food', 'Mat og drikke for turopplevelser', 2),
  ('Hytte', 'cabin', 'Hytter, overnatting og housing', 3),
  ('Guid og opplevelser', 'guides', 'Guidede turer og opplevelser', 4),
  ('Reise og transport', 'travel', 'Transport og reisearrangementer', 5)
ON CONFLICT (name) DO NOTHING;

-- 3. ADVERTISEMENTS TABLE
CREATE TABLE IF NOT EXISTS advertisements (
  id SERIAL PRIMARY KEY,
  advertiser_id INT NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  image_urls VARCHAR(500)[],
  url VARCHAR(500) NOT NULL,
  categories VARCHAR(50)[] DEFAULT '{}',
  keywords VARCHAR(100)[] DEFAULT '{}',
  pricing_model VARCHAR(20),
  cost_per_click DECIMAL(10, 2),
  cost_per_thousand_impressions DECIMAL(10, 2),
  placement VARCHAR(50),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  rejection_reason TEXT,
  approved_by INT REFERENCES users(id),
  approved_at TIMESTAMP,
  is_published BOOLEAN DEFAULT FALSE,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advertisements_advertiser ON advertisements(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_advertisements_status ON advertisements(status);
CREATE INDEX IF NOT EXISTS idx_advertisements_placement ON advertisements(placement);
CREATE INDEX IF NOT EXISTS idx_advertisements_end_date ON advertisements(end_date);

-- 4. AD ANALYTICS TABLE
CREATE TABLE IF NOT EXISTS ad_analytics (
  id SERIAL PRIMARY KEY,
  advertisement_id INT NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  cost DECIMAL(10, 2) DEFAULT 0,
  revenue DECIMAL(10, 2) DEFAULT 0,
  UNIQUE(advertisement_id, date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_ad ON ad_analytics(advertisement_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON ad_analytics(date);

-- 5. IMPRESSION LOGS TABLE
CREATE TABLE IF NOT EXISTS impression_logs (
  id SERIAL PRIMARY KEY,
  advertisement_id INT NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id),
  ip_address INET,
  user_agent TEXT,
  page_url VARCHAR(500),
  viewed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_impression_ad ON impression_logs(advertisement_id);
CREATE INDEX IF NOT EXISTS idx_impression_time ON impression_logs(viewed_at);
CREATE INDEX IF NOT EXISTS idx_impression_ip ON impression_logs(ip_address);

-- 6. CLICK LOGS TABLE
CREATE TABLE IF NOT EXISTS click_logs (
  id SERIAL PRIMARY KEY,
  advertisement_id INT NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id),
  ip_address INET,
  user_agent TEXT,
  referrer VARCHAR(500),
  clicked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_click_ad ON click_logs(advertisement_id);
CREATE INDEX IF NOT EXISTS idx_click_time ON click_logs(clicked_at);
CREATE INDEX IF NOT EXISTS idx_click_ip ON click_logs(ip_address);

-- 7. AD TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS ad_transactions (
  id SERIAL PRIMARY KEY,
  advertiser_id INT NOT NULL REFERENCES advertisers(id),
  advertisement_id INT REFERENCES advertisements(id),
  transaction_type VARCHAR(20),
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  billing_period_start DATE,
  billing_period_end DATE,
  transaction_date TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_advertiser ON ad_transactions(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON ad_transactions(transaction_date);

-- 8. Update roles in users table if needed (add 'advertiser' and 'admin' as valid roles)
-- This assumes your users table allows role column. Adjust if necessary.

-- The database setup is complete!
