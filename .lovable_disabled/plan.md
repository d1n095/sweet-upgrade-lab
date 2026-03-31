
# Omfattande förbättringar: Admin, Roller, Språk & UX

## Sammanfattning
Du har begärt ett antal förbättringar kring rollhantering, språkstöd, produktredigering, och admin-panelens struktur. Jag kommer att implementera alla dessa funktioner i en sammanhängande uppdatering.

---

## Nya funktioner att implementera

### 1. Förbättrad rolltilldelning i AdminMemberManager
**Vad:** Utöka rollhanteringen så att admin kan tilldela:
- Admin
- Affiliate
- Anställd (moderator)

**Hur:** Uppdatera `AdminMemberManager.tsx` för att visa alla roller och hantera affiliate-koppling

---

### 2. Saldo-ruta för Admin/Affiliate/Anställd
**Vad:** En synlig ruta på "Mina sidor" som visar:
- **Admin:** Total affiliate-provision i systemet, donationssaldo
- **Affiliate:** Tillgängligt saldo (redan implementerat i AffiliateDashboard)
- **Anställd:** Ingen saldo-vy (inte relevant)

**Hur:** Skapa en ny `BalanceCard`-komponent som visas högst upp på profilsidan för relevanta roller

---

### 3. Flytta lager/synlighet till Produktredigering
**Vad:** Integrera lagerhantering och synlighet direkt i produktredigeringsdialogen istället för separat AdminInventoryManager

**Hur:** Uppdatera `AdminProductManager.tsx`:
- Lägg till dropdown för kategori (product_type)
- Lägg till tagg-förslag som knappar
- Lägg till synlighetstoggel
- Lägg till lagerhantering med "tillåt överförsäljning"-switch

---

### 4. Språkbaserad välkomsttext
**Vad:** Välkomstmail skickas på det språk användaren har valt på sidan

**Hur:** 
- Uppdatera registreringsflödet att skicka med användarens nuvarande språk
- Edge function `send-welcome-email` stödjer redan `language`-parameter
- Lägg till stöd för NO/DA/DE i välkomstmailen

---

### 5. Utöka språkstöd i alla komponenter
**Vad:** Se till att norska (NO), danska (DA) och tyska (DE) fungerar överallt

**Hur:** Uppdatera content-objekt i alla administrativa komponenter:
- `AdminMemberManager.tsx`
- `AdminCategoryManager.tsx`
- `EmployeeDashboard.tsx`
- `AffiliateDashboard.tsx`

---

### 6. Bättre struktur i Admin-panelen
**Vad:** Organisera admin-funktionerna i logiska sektioner med vikbara rubriker

**Hur:** Gruppera komponenter under:
- **Produkter & Lager** (ProductManager, InventoryManager, CategoryManager)
- **Medlemmar & Roller** (MemberManager)
- **Partners** (InfluencerManager, AffiliateManager, Applications, Payouts)
- **Recensioner & Kommunikation** (länk till /admin/reviews, EmailTemplates)
- **Juridik & Donationer** (LegalDocuments, DonationManager)

---

## Teknisk plan

### Steg 1: Uppdatera AdminProductManager.tsx
```text
Lägg till i redigeringsdialogen:
├── Kategori-dropdown (product_type)
├── Tagg-förslag (klickbara badges)
├── Synlighetstoggel (visa/dölj produkt)
├── Lagerhantering
│   ├── Nuvarande lager (input)
│   ├── Tillåt överförsäljning (switch)
│   └── +/- knappar
```

### Steg 2: Skapa BalanceOverview-komponent
```text
BalanceOverview.tsx
├── För Admin: Visa donationssaldo + affiliate-totaler
├── För Affiliate: Visa tillgängligt saldo + snabbknapp till uttag
├── Placeras högst upp i MemberProfile
```

### Steg 3: Uppdatera rolltilldelning
```text
AdminMemberManager.tsx
├── SelectContent med:
│   ├── Ingen roll (-)
│   ├── Admin
│   ├── Moderator/Anställd
│   ├── Affiliate (koppla till affiliates-tabell)
```

### Steg 4: Språkutökning
```text
Alla admin-komponenter får:
├── sv: { ... }
├── en: { ... }
├── no: { ... }
├── da: { ... }
├── de: { ... }
```

### Steg 5: Uppdatera send-welcome-email
```text
Lägg till stöd för:
├── NO: Norsk välkomsttext
├── DA: Dansk välkomsttext  
├── DE: Tysk välkomsttext
```

---

## Filer som kommer att ändras

| Fil | Ändring |
|-----|---------|
| `src/components/admin/AdminProductManager.tsx` | Kategori-dropdown, taggar, synlighet, lager i redigering |
| `src/components/admin/AdminMemberManager.tsx` | Utökade roller, bättre språkstöd |
| `src/components/admin/AdminCategoryManager.tsx` | Flerspråkstöd NO/DA/DE |
| `src/components/dashboard/EmployeeDashboard.tsx` | Flerspråkstöd NO/DA/DE |
| `src/components/dashboard/AffiliateDashboard.tsx` | Flerspråkstöd NO/DA/DE |
| `src/pages/MemberProfile.tsx` | Lägg till BalanceOverview, bättre struktur |
| `src/components/auth/AuthModal.tsx` | Skicka språk vid registrering |
| `supabase/functions/send-welcome-email/index.ts` | NO/DA/DE malltexter |

---

## Ny komponent att skapa

| Fil | Syfte |
|-----|-------|
| `src/components/profile/BalanceOverview.tsx` | Visar saldo för admin/affiliate |

---

## Sammanfattning av ändringar

1. **Produktredigering** - All lager/synlighetshantering flyttas in i redigeringsformuläret
2. **Saldo-vy** - Ny komponent som visar relevant ekonomisk info baserat på roll
3. **Roller** - Admin kan nu tilldela Admin/Moderator/Affiliate
4. **Språk** - Alla admin-komponenter stödjer 5 språk (SV/EN/NO/DA/DE)
5. **Välkomstmail** - Skickas på användarens valda språk
6. **Struktur** - Bättre organiserad admin-panel

