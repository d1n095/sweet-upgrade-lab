## Mål

1. Göra donationssystemet **juridiskt korrekt** för svensk handel (Marknadsföringslagen, Konsumentverket/EU Dark Patterns, GDPR, Bokföringslagen).
2. Samla **all donationskontroll** i admin under låst behörighet (founder/finance — inte generic admin).
3. Rensa upp hela **behörighetskapitlet** så det är en professionell, central matris istället för ad-hoc rollistor utspridda i koden.

---

## Del A — Donationer: lagar, transparens, kontroll

### A1. Lagliga brister som måste fixas

| Brist idag | Risk | Åtgärd |
|---|---|---|
| `roundUpEnabled = true` som default i `RoundUpDonation.tsx:19` | EU Digital Services Act + Konsumentverket: förkryssade donationer = mörkt mönster, kan tolkas som vilseledande marknadsföring | Default `false`. Användaren måste aktivt kryssa i. |
| Ingen tydlig text om vad pengarna används till vid kassan | Marknadsföringslagen §10 (transparenskrav) | Lägg in kort, obligatorisk disclosure ("Din gåva går till projekt X, hanteras av 4ThePeople AB, ej avdragsgill") + länk till `/donations-policy` |
| `donations` saknar `project_id` FK | Omöjligt att verifiera vart pengarna gick → bryter mot transparenskravet | Migration: lägg till `project_id uuid REFERENCES donation_projects` |
| `donation_projects.current_amount` redigeras manuellt | Admin kan fejka insamlingsstatus → konsumentbedrägeri | Gör fältet read-only i UI. Automatisk uppräkning via DB-trigger när `donations` insert/delete. |
| Anonyma donationer lagrar fortfarande `user_id` | GDPR-konflikt: "anonym" är inte anonym | Trigger: om `is_anonymous = true` → tvinga `user_id = NULL` vid insert |
| Ingen retention / radering | GDPR art. 5(1)(e) — datalagring längre än nödvändigt | Lägg till retention-rutin: anonymisera donationer äldre än 7 år (BFL kräver 7 år för bokföring) |
| Ingen bokföringsexport | Bokföringslagen §5 — verifikationer måste kunna återskapas | "Exportera till bokföring" knapp (CSV) per period + per projekt |
| Ingen audit-logg på projektändringar | Internkontroll-krav | Trigger: logga alla `donation_projects`-UPDATE till `activity_logs` |

### A2. Admin-konsolidering

Allt finns redan utspritt — flytta till **/admin/donations** som blir den enda kontrollpunkten med flikar:

```text
/admin/donations
├── Översikt        (totaler, projekt-progress, senaste 30 dgr)
├── Projekt         (CRUD, aktivera/inaktivera, current_amount read-only)
├── Donationer      (lista, filter, sök, anonymisera-knapp per rad)
├── Bokföring       (CSV-export per period, månadsrapport)
└── Compliance      (disclosure-text, retention-policy, GDPR-radering)
```

### A3. Behörighetslås på donationer

Idag: `is_admin()` räcker (12 personer kan komma åt). Ska bli:
- **Visa**: `founder` eller `finance`
- **Redigera projekt**: `founder` eller `finance`
- **Radera/anonymisera donation**: **endast `founder`**
- **Bokföringsexport**: `founder` eller `finance`

Route-guard på `/admin/donations` + RLS-policies uppdateras till `is_founder() OR has_role(_, 'finance')`.

---

## Del B — Behörighetskapitlet: städning

### B1. Problem idag

- 12 roller i `app_role`-enum, men ingen central översikt vem som har vad
- `is_admin`/`is_staff` har hårdkodade listor (admin/founder/it/moderator/support/...) — ändrar man en roll måste man redigera SQL
- `role_module_permissions`-tabellen finns (8 kolumner, 2 policies) men används knappt i koden — alla checkar gör direkta rollistor
- Ingen UI för att se "vad får roll X göra"
- Privilege-escalation-risk: admin kan tilldela `founder` till sig själv via `user_roles`-tabellen (även om policy säger `is_founder()` kontrollera)

### B2. Åtgärder

1. **Central permissionsmatris i admin** (`/admin/security`, ny flik "Roller & moduler"):
   - Tabell: rader = roller, kolumner = moduler (orders, products, donations, users, finance, system, ...)
   - Checkboxar: read / create / update / delete
   - Spara → uppdaterar `role_module_permissions`
   - Endast `founder` kan ändra
2. **Använd `has_module_permission()` i koden** istället för rollistor — den finns redan, används bara inte
3. **Stärk `user_roles` RLS**: tillägg av roller `admin`/`founder`/`finance` får endast göras av founder (verifierat via WITH CHECK)
4. **Audit-trigger på `user_roles`**: varje role-ändring loggas till `activity_logs` med `before/after` + vem som gjorde det
5. **Visning av "Mina behörigheter"** i admin-headern (debug-vy så användaren ser vad hen kan)

### B3. RLS-genomgång (donations + user_roles)

Konkreta policy-uppdateringar i migrationen:

```sql
-- donations: only founder/finance
DROP POLICY "Admins can view all donations" ON donations;
CREATE POLICY "Finance & founder can view donations"
  ON donations FOR SELECT
  USING (is_founder(auth.uid()) OR has_role(auth.uid(), 'finance'));

-- donation_projects: write locked to founder/finance
DROP POLICY "Admins can manage donation projects" ON donation_projects;
CREATE POLICY "Finance & founder can manage projects"
  ON donation_projects FOR ALL
  USING (is_founder(auth.uid()) OR has_role(auth.uid(), 'finance'))
  WITH CHECK (is_founder(auth.uid()) OR has_role(auth.uid(), 'finance'));

-- user_roles INSERT/UPDATE: only founder can grant privileged roles
CREATE POLICY "Only founder can grant privileged roles"
  ON user_roles FOR INSERT
  WITH CHECK (
    is_founder(auth.uid())
    OR role NOT IN ('admin','founder','finance','it')
  );
```

---

## Tekniska detaljer

### Filer som skapas/ändras

**Nytt:**
- `src/pages/admin/AdminDonations.tsx` — byggs om till flikbaserad container
- `src/components/admin/donations/DonationOverview.tsx`
- `src/components/admin/donations/DonationBookkeeping.tsx` (CSV-export)
- `src/components/admin/donations/DonationCompliance.tsx` (disclosure-text + retention-knapp)
- `src/components/admin/security/PermissionMatrix.tsx`
- `src/components/checkout/DonationDisclosure.tsx` (visas vid round-up)

**Ändras:**
- `src/components/cart/RoundUpDonation.tsx` — `roundUpEnabled` default `false`, disclosure inline
- `src/components/admin/AdminDonationManager.tsx` — splittas, `current_amount` read-only
- `src/pages/admin/AdminSecurity.tsx` — ny flik "Roller & moduler"
- `src/pages/admin/AdminLayout.tsx` — donationsmenypost kräver finance/founder, ej admin

**Migration (en SQL-batch):**
- `donations`: lägg till `project_id`, trigger för anonymisering, trigger för current_amount auto-uppdatering
- `donation_projects`: RLS-uppdatering, audit-trigger
- `user_roles`: tillägg av WITH CHECK för privilege escalation, audit-trigger
- Helper: `is_finance_or_founder(uuid)` security-definer för clean policies

### Det jag INTE rör

- Stripe/checkout-flödet (donationer går via befintlig orderlinje, ingen ny betalintegration)
- 90-konto-ansökan (det är en juridisk process som kräver att 4ThePeople ansöker hos Svensk Insamlingskontroll — jag flaggar bara att texten "ej avdragsgill, ej 90-konto" måste finnas tills ni ansökt)
- Hela `app_role`-enumet — för stort scope att rensa just nu, men jag dokumenterar vilka som faktiskt används

---

## Frågor innan jag bygger

1. **Är ni registrerade hos Svensk Insamlingskontroll (90-konto)?** Påverkar disclosure-texten. Om nej → vi skriver "voluntary contribution, not tax-deductible".
2. **Vill ni att donationsbeloppet ska vara en separat orderrad eller bakas in i totalsumman?** (Bokföringsmässigt är separat rad korrekt.)
3. **Ska `admin`-rollen behålla någon insyn i donationer (read-only) eller helt utelåst?** Mitt förslag: helt utelåst, endast `founder`+`finance`.
4. **Retention 7 år (BFL-krav)** — OK att jag implementerar automatisk anonymisering efter 7 år, eller vill ni hantera det manuellt?