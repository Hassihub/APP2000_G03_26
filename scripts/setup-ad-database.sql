-- ==========================================
-- Annonseportal - Database Setup
-- ==========================================

-- Annonsørprofiler (Advertiser Registration)
CREATE TABLE IF NOT EXISTS advertisers (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  company_registration_number VARCHAR(50),
  contact_person VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  website VARCHAR(255),
  approval_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Annonse-kategorier (Ad Categories/Tags)
CREATE TABLE IF NOT EXISTS ad_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE, -- turutstyr, turmat, hytte, etc
  description TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Annonser (Advertisements/Ads)
CREATE TABLE IF NOT EXISTS advertisements (
  id SERIAL PRIMARY KEY,
  advertiser_id INT NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category_id INT NOT NULL REFERENCES ad_categories(id),
  image_url VARCHAR(500),
  image_approved BOOLEAN DEFAULT FALSE, -- Grafisk profil-godkjenning
  target_url VARCHAR(500) NOT NULL,
  placement VARCHAR(50) NOT NULL, -- right-sidebar, left-sidebar, top-banner, mid-banner
  pricing_model VARCHAR(10) NOT NULL, -- cpc, cpm
  cost_per_click DECIMAL(10, 2),
  cost_per_thousand_impressions DECIMAL(10, 2),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  daily_budget DECIMAL(10, 2),
  status VARCHAR(20) DEFAULT 'draft', -- draft, pending_approval, approved, active, paused, ended, rejected
  approval_status VARCHAR(20) DEFAULT 'pending_approval', -- pending_approval, approved, rejected
  rejection_reason TEXT,
  rejected_by INT REFERENCES users(id),
  approved_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP
);

-- Annonse-analyser (Ad Analytics/Statistics)
CREATE TABLE IF NOT EXISTS ad_analytics (
  id SERIAL PRIMARY KEY,
  ad_id INT NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  spent DECIMAL(10, 2) DEFAULT 0,
  UNIQUE(ad_id, date)
);

-- Betalingslogger (Payment Ledger)
CREATE TABLE IF NOT EXISTS ad_payments (
  id SERIAL PRIMARY KEY,
  advertiser_id INT NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  ad_id INT REFERENCES advertisements(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_type VARCHAR(20), -- click, impression, deposit
  transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Godkjenningslogg (Approval Log)
CREATE TABLE IF NOT EXISTS approval_logs (
  id SERIAL PRIMARY KEY,
  ad_id INT NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  approved_by INT NOT NULL REFERENCES users(id),
  approval_type VARCHAR(50), -- content, image, advertiser
  status VARCHAR(20), -- approved, rejected
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Standard Kategorier (Seed Data)
-- ==========================================
INSERT INTO ad_categories (name, description, display_order) VALUES
  ('turutstyr', 'Utstyr for turer og friluftsliv', 1),
  ('turmat', 'Mat og drikke for turer', 2),
  ('hytte', 'Hytte- og overnattingstjenester', 3),
  ('guide', 'Gidseleder og turguider', 4),
  ('photo', 'Fotografi og kunsttilbud', 5),
  ('transport', 'Transport og parkering', 6),
  ('annet', 'Annet', 99)
ON CONFLICT (name) DO NOTHING;

-- ==========================================
-- Indexes for Performance
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_advertisers_user_id ON advertisers(user_id);
CREATE INDEX IF NOT EXISTS idx_advertisers_approval ON advertisers(approval_status);
CREATE INDEX IF NOT EXISTS idx_ads_advertiser ON advertisements(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_ads_category ON advertisements(category_id);
CREATE INDEX IF NOT EXISTS idx_ads_status ON advertisements(status);
CREATE INDEX IF NOT EXISTS idx_ads_approval ON advertisements(approval_status);
CREATE INDEX IF NOT EXISTS idx_ads_placement ON advertisements(placement);
CREATE INDEX IF NOT EXISTS idx_ads_dates ON advertisements(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_analytics_ad ON ad_analytics(ad_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON ad_analytics(date);
CREATE INDEX IF NOT EXISTS idx_payments_advertiser ON ad_payments(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_payments_ad ON ad_payments(ad_id);
CREATE INDEX IF NOT EXISTS idx_approval_logs_ad ON approval_logs(ad_id);
