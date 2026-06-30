## 4thepeople — Master Elite Plan (granskning klar)

Tre djupgranskningar gjorda: **filstruktur**, **admin/automation**, **säkerhet/prestanda**. Här är hela hit-listan, prioriterad efter ROI. Kör vi i ordning får du en triljardär-snabb, säker, lyxig sajt.

---

### 🔥 FAS 0 — Akut kritiskt (gör först, läcker pengar/säkerhet)

**0.1 Lazy-loada alla 39 admin-sidor** (`src/App.tsx:14–86`)
Idag laddar varje besökare hela admin-bundlen. Mål: -60–70% JS för publika besökare. Wrappa alla `/admin/*` i `lazy()` + `<Suspense>`.

**0.2 Lås CORS på alla edge functions** till `4thepeople.se` + localhost. Idag `*`.

**0.3 Skydda `google-places`** — kräv JWT, inte bara anon-key (annars gratis Google Maps-proxy för hackers).

**0.4 Distribuerad rate-limit** för `submit-contact`, `lookup-order`, `google-places` via Postgres-tabell istället för in-memory (som inte funkar).

**0.5 Gate `MiniWorkbench` + `GodModeOverlay`** bakom `pathname.startsWith('/admin')` — idag kör de DB-query på varje sidladdning för varje besökare.

---

### 🤖 FAS 1 — Automatisering (sparar tid varje dag)

**1.1 Schemalägg 3 färdigbyggda edge-functions via `pg_cron`**:
- `automation-engine` (varje timme) — SLA-bevakning
- `send-review-reminder` (dagligen 09:00) — review-mail med 10% rabatt
- `send-retention-email` (dagligen 10:00) — påfyllnadspåminnelser

**1.2 DB-trigger: order → 'delivered' → auto-skicka review-mail**
Fältet `review_reminder_sent` finns redan. Ingen trigger kopplad.

**1.3 DB-trigger: stock ≤ threshold → notification-bell**
Auto-larm istället för manuell koll i AdminStockIntelligence.

**1.4 Wire `suggest-product-metadata` AI till produktformuläret**
Knapp "✨ Auto-fyll med AI" i `AdminProductForm` — fyller meta/SEO/beskrivning från titel.

**1.5 Fixa trasiga batch-ship-knappen** (`AdminOrderManager.tsx:629`)
Idag visar bara toast. Bygg riktig BatchShipDialog för bulk-frakt.

---

### 🧹 FAS 2 — Städning av kodbas (15+ döda filer)

**Radera direkt** (0 referenser, bevisat):
```
src/pages/Shop.tsx                       (importerad men aldrig renderad)
src/pages/Donations.tsx                  (route är Navigate→/)
src/pages/DonationsPanel.tsx             (route är Navigate→/)
src/pages/admin/AdminFinance.tsx         (importerad men aldrig renderad)
src/pages/admin/AdminAudit.tsx           (helt orphan)
src/pages/admin/AdminUpdates.tsx         (redirected, ej importerad)
src/pages/admin/AdminCommunication.tsx   (redirected, ej importerad)
src/pages/admin/system/                  (hela mappen, 5 filer, 0 imports)
src/lib/criticalEscalation.ts            (0 imports)
src/lib/criticalPathProtection.ts        (0 imports)
src/lib/safeFetch.ts                     (0 imports, monkey-patchar fetch)
src/core/scanner/snapshotResolver.ts     (0 imports)
src/components/sections/TrustBadges.tsx  (0 imports, dubblett)
```

**Sammanfoga**:
- `AdminControl` + `AdminControlCenter` → behåll Center, en route
- `AdminScans` + `AdminIssues` → en flikad sida
- `AdminHistory` + `AdminChangeHistory` → `AdminAuditHistory` med tabs
- `PaymentIcons` + `PaymentMethods` → en komponent med `size` prop

**Rensa App.tsx**: ta bort 4 döda imports + duplicerade `/admin/finance`-route.

---

### ⚡ FAS 3 — Prestanda & credit-svinn

**3.1 Vite manual chunks** (`vite.config.ts`):
```ts
manualChunks: { vendor: [...], supabase: [...], charts: [...], motion: [...] }
```

**3.2 Ersätt `useUiStateSync` polling (var 15s)** med Supabase Realtime (redan wired).

**3.3 Ersätt `scanEngine` 2s-poll** med Realtime-subscription filtrerat på scan-ID.

**3.4 Ta bort dubbel realtime-channel** i `AdminNotificationBell` (overlappar `useAdminRealtime`).

**3.5 Cacha `useStaffAccess`/`useAdminRole`/`useFounderRole`** via React Query — idag fyrdubblade DB-queries utan cache.

**3.6 Flytta `StealthScheduler.register()`** från modul-load till admin-only `useEffect`.

**3.7 Gate `LiveDonationFeed` Realtime** — öppen websocket för anonyma besökare idag.

---

### 🎨 FAS 4 — Visuell identitet (svart + guld lyx)

**4.1 Designsystem omskrivning** (`src/index.css` + `tailwind.config.ts`):
- Bakgrund: ren svart `#0A0A0A`, surfaces `#111`/`#1A1A1A`
- Accent: guld `#C9A24B` / `#E8C77A` / `#8B6F2A`
- Text: varm off-white `#F5F1E8`
- Typografi: **Cormorant Garamond** (display serif) + **Inter** (body)
- Border-radius ner till `0.5rem`, shadows med varm guld-glöd

**4.2 Logo-integration** när du skickar bilden — Header, Footer, favicon, OG-bild.

**4.3 Intro-animation** "4thepeople" — svart skärm → guldtext fade-in, 1.5s, en gång per session.

**4.4 Hero & komponentpass** — editorial layout, guldlinje-dividers, guld-kantvarianter.

---

### 💰 FAS 5 — Konvertering & prebuy

**5.1 Waitlist/notify-me** — ny tabell `waitlist_signups` (RLS), knapp på slutsåld/kommande produkter, edge function för bekräftelsemail.

**5.2 Exit-intent popup** — 10% mot email, en gång per session.

**5.3 Global trust-rad** — säker betalning · fri frakt 500+ · 14 dgr ångerrätt.

**5.4 POS-förbättringar**: `autoFocus`, Enter-to-add, discount-fält.

**5.5 Keyboard shortcuts** för packning/frakt (P, S, Esc i AdminOrderManager).

**5.6 Ersätt native `confirm()`** i refund med AlertDialog.

---

### 🔒 FAS 6 — Säkerhet & SEO (resten)

**6.1 Admin route guard** — redirecta non-admins före AdminLayout mountar.

**6.2 `sitemap` edge function** — använd anon-key, inte service-role.

**6.3 Static OG-fallback i `index.html`** för bots utan JS (Slack/Twitter/FB).

**6.4 JSON-LD strukturerad data** för Product, Organization, BreadcrumbList.

**6.5 Fortsätt minska security-warnings** (110 → mål <20).

**6.6 Fixa hårdkodade fraktvärden** i AdminSettingsPage (visar 499 men riktig är 500).

---

### 🗂️ Exekveringsordning (1 fas i taget, du godkänner mellan varje)

```text
FAS 0 (akut)  →  FAS 1 (automation)  →  FAS 2 (städning)
   →  FAS 3 (prestanda)  →  FAS 4 (design)  →  FAS 5 (konvertering)  →  FAS 6 (säkerhet/SEO)
```

Inom varje fas tar vi ett steg åt gången så du kan verifiera.

### Frågor innan vi börjar

1. **Börja med FAS 0?** (akut, störst impact, ingen visuell förändring)
2. **Display-font** för lyx-känslan: Cormorant Garamond, Playfair Display, eller Italiana?
3. **Intro-animation**: en gång per session eller bara första besök någonsin?
4. När får jag logo-bilden (svart bg + guld text)?
