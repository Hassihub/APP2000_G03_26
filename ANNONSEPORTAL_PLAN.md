# Annonseportal - Implementeringsplan

## Oversikt

En komplett annonseportal for TiU med godkjenningsworkflow, fleksible betalingsmodeller og detaljert statistikk.

---

## 1. DATABASE SCHEMA

### 1.1 Advertisers (Annonsører)
```sql
CREATE TABLE advertisers (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  company_name VARCHAR(255) NOT NULL,
  company_description TEXT,
  contact_person VARCHAR(255),
  phone VARCHAR(20),
  website VARCHAR(255),
  logo_url VARCHAR(500),
  payment_method VARCHAR(50), -- 'card', 'invoice', 'bank_transfer'
  bank_account VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'suspended'
  rejection_reason TEXT,
  approved_by INT REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 1.2 Advertisements (Annonser)
```sql
CREATE TABLE advertisements (
  id SERIAL PRIMARY KEY,
  advertiser_id INT NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  image_urls VARCHAR(500)[], -- Multiple images
  url VARCHAR(500) NOT NULL,
  categories VARCHAR(50)[] DEFAULT '{}', -- 'hiking_gear', 'hiking_food', 'cabin', etc.
  keywords VARCHAR(100)[] DEFAULT '{}',
  pricing_model VARCHAR(20), -- 'cpc' (cost per click), 'cpm' (cost per thousand impressions)
  cost_per_click DECIMAL(10, 2), -- Relevant for CPC model
  cost_per_thousand_impressions DECIMAL(10, 2), -- Relevant for CPM model
  placement VARCHAR(50), -- 'right_sidebar', 'left_sidebar', 'top_banner', 'mid_page_banner'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'active', 'expired', 'paused'
  rejection_reason TEXT,
  approved_by INT REFERENCES users(id),
  approved_at TIMESTAMP,
  is_published BOOLEAN DEFAULT FALSE,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_advertisements_advertiser ON advertisements(advertiser_id);
CREATE INDEX idx_advertisements_status ON advertisements(status);
CREATE INDEX idx_advertisements_placement ON advertisements(placement);
```

### 1.3 Ad Analytics (Statistikk per dag)
```sql
CREATE TABLE ad_analytics (
  id SERIAL PRIMARY KEY,
  advertisement_id INT NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  cost DECIMAL(10, 2) DEFAULT 0,
  revenue DECIMAL(10, 2) DEFAULT 0,
  UNIQUE(advertisement_id, date)
);

CREATE INDEX idx_analytics_ad ON ad_analytics(advertisement_id);
CREATE INDEX idx_analytics_date ON ad_analytics(date);
```

### 1.4 Impressions Log (Visninger)
```sql
CREATE TABLE impression_logs (
  id SERIAL PRIMARY KEY,
  advertisement_id INT NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id), -- NULL if anonymous
  ip_address INET,
  user_agent TEXT,
  page_url VARCHAR(500),
  viewed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_impression_ad ON impression_logs(advertisement_id);
CREATE INDEX idx_impression_time ON impression_logs(viewed_at);
```

### 1.5 Clicks Log (Klikk)
```sql
CREATE TABLE click_logs (
  id SERIAL PRIMARY KEY,
  advertisement_id INT NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id), -- NULL if anonymous
  ip_address INET,
  user_agent TEXT,
  referrer VARCHAR(500),
  clicked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_click_ad ON click_logs(advertisement_id);
CREATE INDEX idx_click_time ON click_logs(clicked_at);
```

### 1.6 Ad Transactions (Betalinger)
```sql
CREATE TABLE ad_transactions (
  id SERIAL PRIMARY KEY,
  advertiser_id INT NOT NULL REFERENCES advertisers(id),
  advertisement_id INT REFERENCES advertisements(id),
  transaction_type VARCHAR(20), -- 'impression', 'click', 'manual_credit'
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  billing_period_start DATE,
  billing_period_end DATE,
  transaction_date TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_advertiser ON ad_transactions(advertiser_id);
CREATE INDEX idx_transactions_date ON ad_transactions(transaction_date);
```

### 1.7 Ad Categories (Kategorier)
```sql
CREATE TABLE ad_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  display_order INT
);

-- Insert standard categories:
INSERT INTO ad_categories (name, slug, description) VALUES
  ('Turutstyr', 'hiking_gear', 'Utstyr for turer og friluftsliv'),
  ('Turmat', 'hiking_food', 'Mat og drikke for turopplevelser'),
  ('Hytte', 'cabin', 'Hytter, overnatting og housing'),
  ('Guid og opplevelser', 'guides', 'Guidede turer og opplevelser'),
  ('Reise og transport', 'travel', 'Transport og reisearrangementer');
```

---

## 2. API ENDPOINTS

### Advertiser Management
- `POST /api/advertisers/register` - Registrer ny annonsør
- `GET /api/advertisers/profile` - Hent annonsørprofil
- `PUT /api/advertisers/profile` - Oppdater profil
- `PUT /api/advertisers/bank-details` - Oppdater bankdetaljer

### Advertisement Management
- `POST /api/advertisements/create` - Lag ny annonse
- `GET /api/advertisements` - List annonser (med filter)
- `GET /api/advertisements/:id` - Hent detaljer
- `PUT /api/advertisements/:id` - Oppdater annonse
- `DELETE /api/advertisements/:id` - Slett annonse
- `PUT /api/advertisements/:id/pause` - Pause annons
- `PUT /api/advertisements/:id/resume` - Gjenoppta annons

### Admin Approval
- `GET /api/admin/advertisers/pending` - Hent ventende annonsører
- `POST /api/admin/advertisers/:id/approve` - Godkjenn annonsør
- `POST /api/admin/advertisers/:id/reject` - Avvis annonsør
- `GET /api/admin/advertisements/pending` - Hent ventende annonser
- `POST /api/admin/advertisements/:id/approve` - Godkjenn annonse
- `POST /api/admin/advertisements/:id/reject` - Avvis annonse

### Analytics & Tracking
- `GET /api/advertisements/:id/stats` - Hent statistikk for annonse
- `POST /api/advertisements/:id/impression` - Registrer visning
- `POST /api/advertisements/:id/click` - Registrer klikk
- `GET /api/advertisers/dashboard/stats` - Hent samlede statistikker
- `GET /api/advertisers/dashboard/transactions` - Hent finansielle data

### Public
- `GET /api/advertisements/active` - Hent aktive annonser (med filter)

---

## 3. KEY FEATURES

### 3.1 Advertiser Registration Flow
1. Advertiser registrerer bedrift
2. System sender verifikasjons-email
3. Admin godkjenner/avviser annonsør
4. Godkjent annonsør kan opprette annonser

### 3.2 Advertisement Approval Workflow
1. Advertiser legger inn annonse
2. System validerer:
   - Bilde størrelse/format
   - Grafisk profil compliance
   - URL validering
3. Admin gjennomgår og godkjenner/avviser
4. Godkjent annonse publiseres på start_date

### 3.3 Pricing Models
**CPC (Cost Per Click)**
- Annonsør velger pris per klikk (f.eks. 5 kr/klikk)
- Betaling skjer bare når bruker klikker

**CPM (Cost Per Thousand Impressions)**
- Annonsør velger pris per 1000 visninger
- Betaling basert på antall visninger

### 3.4 Ad Placements
- Right sidebar
- Left sidebar
- Top banner
- Mid-page banner
- (Kan utvides)

### 3.5 Categories & Keywords
- Annonser knyttet til kategorier (turutstyr, turmat, hytte, guides, reise)
- Og fritt valg av keywords
- Muliggør kontekstuelle annonser

### 3.6 Time-based Activation
- Start date: Annonse aktiveres
- End date: Annonse deaktiveres automatisk
- Can be paused/resumed

---

## 4. IMPLEMENTATION PHASES

### Fase 1: Database & Auth
- Opprett alle tabeller (migrering/setup script)
- Implementer rolle-sjekk (admin, advertiser, user)
- Testdata

Phase 2: Advertiser Management
- Registrering av annonsør
- Profil-redigering
- Admin godkjenning

### Fase 3: Advertisement Management
- Annonse-opprettelse
- Bilde-upload
- Kategori/keyword-valg
- Admin godkjenning

### Fase 4: Analytics & Tracking
- Impression-logging
- Click-logging
- Statistikk-beregning
- Transaksjonshåndtering

### Fase 5: Dashboards
- Annonsør-dashboard
- Admin-dashboard
- Finansiell oversikt

---

## 5. GRAPHIC PROFILE COMPLIANCE

For å sikre at annonser passer inn grafisk:

1. **Image Validation**
   - Maksimal størrelse: 1024x768px
   - Minimum størrelse: 300x200px
   - Format: JPG, PNG, WebP
   - Max filstørrelse: 5MB per bilde

2. **Color Palette Check**
   - Sikre at fargene harmonerer med nettsted
   - Reduser oversaturering hvis nødvendig

3. **Text/Font Guidelines**
   - Maksimal tekstlengde i tittel
   - Godkjente fonter
   - Minimum kontrast ratio

4. **Preview Before Approval**
   - Admin kan forhåndsvise annonse i alle plasseringer
   - Se hvordan det ser ut på ulike skjermstørrelser

---

## 6. SECURITY CONSIDERATIONS

- Rate limiting på impression/click endpoints
- IP-deduplication for impressions (samme IP = samme person)
- User-Agent tracking for bot detection
- Fraud detection for suspicious click patterns
- Transaction logging for audit trail

---

## 7. TESTING SCENARIOS

- Advertiser signup og godkjenning
- Annonse-opprettelse og publisering
- Impression/click-tracking
- Analytics-korrekthet
- Prising-beregning (CPC vs CPM)
- End-date automatisk deaktivering
- Admin-panelens godkjenning av annonser
