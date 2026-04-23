# Annonseportal - Implementeringsguide

## 1. DATABASEOPPSETT

### Steg 1: Kjør migrasjonsscriptet
```bash
# Koble til PostgreSQL og kjør setup-skriptet
psql -U [bruker] -d [database] -f scripts/setup_annonseportal_db.sql
```

Dette oppretter alle nødvendige tabeller og indekser.

---

## 2. KONFIGURER ROLLER (Valgfritt, men anbefales)

Hvis du bruker rolle-basert kontroll, sikre at disse rollene eksisterer i databasen:
- `user` - Vanlig bruker
- `advertiser` - Bruker som kan opprette annonser
- `admin` / `editor` - Administrator som godkjenner annonsører og annonser

Du kan oppdatere rollen i `users`-tabellen:
```sql
UPDATE users SET role = 'editor' WHERE id = [admin_id];
```

---

## 3. API-ENDEPUNKTER - OVERSIKT

### FOR ANNONSØRER

**Registrering:**
```bash
POST /api/advertisers
{
  "company_name": "Bedriftsnavn",
  "company_description": "Bedriftsbeskrivelse",
  "contact_person": "Navn",
  "phone": "+47 98765432",
  "website": "https://bedrift.no",
  "payment_method": "card",
  "bank_account": "1234567890"  // Hvis bank_transfer
}
```

**Hent profil:**
```bash
GET /api/advertisers
```

**Oppdater profil:**
```bash
PUT /api/advertisers/[id]
```

**Opprett annonse:**
```bash
POST /api/advertisements
{
  "title": "Annonsetittel",
  "description": "Beskrivelse",
  "image_url": "https://...",
  "url": "https://landing-page.no",
  "categories": ["hiking_gear", "hiking_food"],
  "keywords": ["fjell", "utstyr"],
  "pricing_model": "cpc",  // eller "cpm"
  "cost_per_click": 5.00,
  "placement": "right_sidebar",
  "start_date": "2024-01-15",
  "end_date": "2024-02-15"
}
```

**Hent advertiserstatistikk:**
```bash
GET /api/advertisers/dashboard/stats?start_date=2024-01-01&end_date=2024-01-31
```

**Hent annonsestatistikk:**
```bash
GET /api/advertisements/[id]/stats?start_date=2024-01-01&end_date=2024-01-31
```

### FOR ADMIN

**Ventende annonsører:**
```bash
GET /api/admin/advertisers/pending
```

**Godkjenn annonsør:**
```bash
POST /api/admin/advertisers/[id]/approve
```

**Avvis annonsør:**
```bash
POST /api/admin/advertisers/[id]/reject
{
  "reason": "Grunn for avvisning"
}
```

**Ventende annonser:**
```bash
GET /api/admin/advertisements/pending
```

**Godkjenn annonse:**
```bash
POST /api/admin/advertisements/[id]/approve
```

**Avvis annonse:**
```bash
POST /api/admin/advertisements/[id]/reject
{
  "reason": "Grunn for avvisning"
}
```

### FOR TRACKING (Automatisk via komponenter)

**Registrer visning:**
```bash
POST /api/advertisements/[id]/impression
{
  "page_url": "https://frittfram.no/explore"
}
```

**Registrer klikk:**
```bash
POST /api/advertisements/[id]/click
{
  "referrer": "https://google.com"
}
```

---

## 4. UI-KOMPONENTER

### Disponible komponenter:

#### `<AdvertiserRegistration />`
```javascript
import AdvertiserRegistration from '@/app/components/AdvertiserRegistration';

// Brukes på annonsørregistreringssiden
export default function Page() {
  return <AdvertiserRegistration />;
}
```

#### `<AdvertiserDashboard />`
```javascript
import AdvertiserDashboard from '@/app/components/AdvertiserDashboard';

// Brukes på annonsørdashboardet
export default function Page() {
  return <AdvertiserDashboard />;
}
```

#### `<AdminAdvertiserApprovalPanel />`
```javascript
import AdminAdvertiserApprovalPanel from '@/app/components/AdminAdvertiserApprovalPanel';

// Brukes på admin panel for annonsgatodkjenning
export default function Page() {
  return <AdminAdvertiserApprovalPanel />;
}
```

#### `<AdminAdvertisementApprovalPanel />`
```javascript
import AdminAdvertisementApprovalPanel from '@/app/components/AdminAdvertisementApprovalPanel';

// Brukes på admin panel for annonsegodkjenning
export default function Page() {
  return <AdminAdvertisementApprovalPanel />;
}
```

#### `<AdDisplay ad={advertisement} placement="right_sidebar" />`
```javascript
import AdDisplay from '@/app/components/AdDisplay';

// Brukes for å vise annonser på siden
// Sporer automatisk impressions og clicks
export default function Page({ ads }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr' }}>
      <main>Main content</main>
      <aside>
        {ads.map(ad => (
          <AdDisplay key={ad.id} ad={ad} placement={ad.placement} />
        ))}
      </aside>
    </div>
  );
}
```

---

## 5. SIDESTRUKTUR

Anbefalt sidemapping:

```
/register/advertiser          - Annonsørregistrering
/dashboard/advertiser         - Annonsør dashboard
/admin/advertisers/pending    - Admin godkjenning av annonsører
/admin/advertisements/pending - Admin godkjenning av annonser
```

### Eksempel på routing:

```javascript
// app/register/advertiser/page.js
import AdvertiserRegistration from '@/app/components/AdvertiserRegistration';

export const metadata = {
  title: 'Registrer som Annonsør',
};

export default function Page() {
  return <AdvertiserRegistration />;
}
```

```javascript
// app/dashboard/advertiser/page.js
import { getCurrentUser } from '@/lib/auth';
import AdvertiserDashboard from '@/app/components/AdvertiserDashboard';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Annonsør Dashboard',
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return <AdvertiserDashboard />;
}
```

```javascript
// app/admin/advertisers/pending/page.js
import { getCurrentUser } from '@/lib/auth';
import AdminAdvertiserApprovalPanel from '@/app/components/AdminAdvertiserApprovalPanel';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Godkjenn Annonsører',
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    redirect('/');
  }

  return <AdminAdvertiserApprovalPanel />;
}
```

---

## 6. AUTOMATISERTE OPPGAVER (CRON JOBS)

### Deaktiver utløpte annonser
```bash
# Kjør daglig, f.eks. 01:00 AM
0 1 * * * cd /path/to/project && node scripts/deactivate-expired-ads.js
```

### Behandle CPM-basert billing
```bash
# Kjør daglig, f.eks. 02:00 AM
0 2 * * * cd /path/to/project && node scripts/process-ad-billing.js
```

### I package.json kan du legge til:
```json
{
  "scripts": {
    "cron:deactivate-ads": "node scripts/deactivate-expired-ads.js",
    "cron:process-billing": "node scripts/process-ad-billing.js"
  }
}
```

---

## 7. GRAFISK PROFIL - VALIDERING

For å sikre at annonser passer inn grafisk, implementeres følgende validering:

### Bildevalidering (Anbefalt):
- **Format:** JPG, PNG, WebP
- **Maks størrelse:** 5 MB
- **Maks dimensjoner:** 1024x768px
- **Min dimensjoner:** 300x200px
- **Aspect ratio:** 4:3 eller 16:9

### Tekstvalidering:
- **Tittel:** Maks 60 tegn
- **Beskrivelse:** Maks 200 tegn
- **Font:** Poppins, sans-serif (bruker nettstedets font)
- **Skriftfarge:** Må kontrastere mot bakgrunn (WCAG AA standard)

### Implementering av validering:

Du kan utvide API-et med Image Processing:

```javascript
// Legg til i /api/advertisements mot slutten
import sharp from 'sharp';

async function validateAdImage(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const buffer = await response.buffer();
    const metadata = await sharp(buffer).metadata();

    if (metadata.width > 1024 || metadata.height > 768) {
      throw new Error('Image dimensions too large');
    }

    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
      throw new Error('Invalid image format');
    }

    return true;
  } catch (error) {
    throw new Error('Image validation failed: ' + error.message);
  }
}
```

---

## 8. SIKKERHETSMERKNADER

### Rate Limiting
Implementer rate limiting på impression/click endpoints for å forhindre fraud:

```javascript
// Eksempel: Bruk npm-pakke som `express-rate-limit`
import rateLimit from 'express-rate-limit';

const impressionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // max 100 requests per IP per minute
});

app.post('/api/advertisements/:id/impression', impressionLimiter, ...);
```

### IP-Dedeplication
Ta hensyn til at samme IP fra samme bruker innenfor kort tid sannsynligvis er samme person:

```sql
-- Query for å finne potensielle bot-aktiviteter
SELECT 
  advertisement_id,
  ip_address,
  COUNT(*) as click_count
FROM click_logs
WHERE clicked_at > NOW() - INTERVAL '1 minute'
GROUP BY advertisement_id, ip_address
HAVING COUNT(*) > 5
ORDER BY click_count DESC;
```

### HTTPS-krav
Sikre at betalingsinformasjon og sensitiv data er kryptert med HTTPS.

### SQL Injection Protection
Alle queries bruker paramteriserte statements (bereits implementert).

---

## 9. TESTING

### Manual testing:

1. **Annonsørregistrering:**
   - Registrer ny annonsør
   - Verifiser at den vises som "pending"
   - Admin godkjenner
   - Verifiser at annonsør nå kan opprette annonser

2. **Annonseopprettelse:**
   - Opprett annonse med CPC-modell
   - Opprett annonse med CPM-modell
   - Verifiser at annonsen vises som "pending"

3. **Admin godkjenning:**
   - Admin godkjenner annonse
   - Verifiser at is_published = true

4. **Impression tracking:**
   - Last inn annonse på en side
   - Verifiser at impression_logs registreres
   - Bekrefter at impressions-teller økes

5. **Click tracking:**
   - Klikk på annonse
   - Verifiser at click_logs registreres
   - Bekrefter at clicks-teller økes

6. **Billing:**
   - Kjør cron-job for CPM billing
   - Verifiser at transactions opprettes

---

## 10. DEPLOYMENT

### Miljøvariabler som trengs:

```bash
# .env.local
DATABASE_URL="postgresql://user:password@localhost/dbname"
NODE_ENV="production"
```

### Build:

```bash
npm run build
npm start
```

### Test i produksjon:

1. Verifiser at alle API-endepunkter er tilgjengelige
2. Test annonsørregistrering og godkjenning
3. Test ad display og tracking på live nettsted
4. Verifiser at cron-jobs kjører som forventet

---

## 11. MONITORING

Implementer logging for:

- Annonsørregistreringer
- Annonse-godkjenninger (godkjent/avvist)
- Impression og click logs
- Betalingstransaksjoner
- Feil og exceptions

Eksempel:

```javascript
import { log } from '@/lib/logger'; // Implementer loggingtjeneste

// I API-endepunkter:
log({
  level: 'info',
  event: 'advertiser_registration',
  userId: user.id,
  companyName: form.company_name,
  timestamp: new Date(),
});
```

---

## 12. NESTE STEG

Anbefalt prioritering for videre utvikling:

1. ✅ Database setup
2. ✅ API-endepunkter
3. ✅ UI-komponenter
4. ✅ Admin panel for godkjenning
5. ⏳ Email notifier (ved godkjenning/avvisning)
6. ⏳ Betalingintegrasjon (Stripe, Vipps, etc.)
7. ⏳ Avansert analytics dashboard
8. ⏳ CSV export for annonsører
9. ⏳ A/B testing
10. ⏳ Performance optimization

---

## 13. SUPPORT & TROUBLESHOOTING

### Vanlige problemer:

**Impression/Click tracking fungerer ikke:**
- Verifiser at ad.is_published = true
- Verifiser at ad.start_date <= today <= ad.end_date
- Sjekk browser console for feilmeldinger

**Admin panel viser ingen annonseørere:**
- Verifiser at bruker har rolle "admin" eller "editor"
- Verifiser at advertiser.status = 'pending'

**Cron-jobs kjører ikke:**
- Verifiser at database-tilkoblingen fungerer
- Sjekk server logs for feilmeldinger
- Verifiser crontab syntax

---

**Opprettet:** 2025-04-23
**Sist oppdatert:** 2025-04-23
