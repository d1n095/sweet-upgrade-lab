# ADR-003: Enhetlig transaktionsmodell för ekonomi + multi-valuta

**Status:** Beslutad · **Datum:** 2026-07-11 · **Beslutsfattare:** teknisk ägare (Claude)

## Kontext — problem upptäckta vid granskning

1. **Inkomst saknar hem.** UI:t lovar "Lägg inkomst" (quick-add, action-sheet,
   timeline visar `income`), men det finns INGEN inkomsttabell. Bara `expenses`.
   Detta bryter Lag 10 (No Mockups): en synlig knapp som inte kan spara något.
2. **Ingen valuta.** `expenses.amount` saknar currency. Allt antas SEK. Blockerar
   gränsarbetare, utlandsinkomst, resande, och framtida internationalisering.
3. **Kategorier hårdkodade.** `expense_category` är ett Postgres-ENUM → ny kategori
   kräver migration. Bryter principen "regler/data ska vara data, inte kod".
4. **Fragmenterade penningflöden.** shifts (löneinkomst), payslips, expenses lever
   isolerat utan enande begrepp. Svårt att svara "vad är min nettoekonomi denna månad".

## Beslut — en enhetlig transaktionsmodell

Alla penningrörelser blir **transactions** med riktning, belopp, valuta, kategori:

```
transactions
  id, owner_context_id, user_id (created_by)
  direction        'in' | 'out'          -- inkomst vs utgift
  amount           NUMERIC(14,2)          -- alltid positivt; direction ger tecken
  currency         TEXT DEFAULT 'SEK'     -- ISO 4217
  amount_sek       NUMERIC(14,2)          -- normaliserat för summering (via kurs)
  fx_rate          NUMERIC(12,6)          -- kurs mot SEK vid tidpunkten (1 om SEK)
  category_id      UUID -> categories     -- data, inte enum
  description, merchant, occurred_at
  source           'manual'|'salary'|'ocr'|'import'|'recurring'
  source_table, source_id                 -- härkomst (t.ex. shift som gav lönen)
  is_recurring, recurrence_pattern
  metadata JSONB, created_at, deleted_at

categories                                -- ANVÄNDARDEFINIERADE (inte enum)
  id, owner_context_id, name, kind ('income'|'expense'|'both'),
  icon, color, parent_id (underkategorier), is_system, sort_order
```

### Varför detta är bättre för BÅDE privatperson och vision
- **Privatperson:** en enkel "lägg inkomst/utgift"-vy. Ett ställe för allt.
  Nettoekonomi = SUM(in) − SUM(out) blir trivialt. Känns enklare, inte mer komplext.
- **Vision:** multi-valuta klart; kategorier per kontext (hushåll/företag kan ha
  egna); löneinkomst kan flöda in som transaktion via source; företagsbokföring
  och rapporter bygger på samma modell.

### Valuta-normalisering
`amount` lagras i sin valuta; `amount_sek` beräknas via `fx_rate` vid registrering
och används för summeringar. Historisk kurs fryses (samma princip som ADR-001:
historiska belopp är fakta). Kurskälla kan vara manuell nu, API senare — modellen
är redo utan ombyggnad.

### Löneintegration
Ett `shift` skapar INTE automatiskt en transaction (lön är intjänad, inte
utbetald — ADR-001/Del 62). Först när en `payslip` verifieras/utbetalas skapas
motsvarande `transaction` med source='salary'. Detta håller intjänat≠utbetalt rent.

### expenses → migreras till transactions
Befintliga `expenses` blir `transactions` med direction='out'. Gamla enum-kategorier
mappas till rader i `categories`. `expenses` behålls som vy tills koden flyttats,
sen droppas den.

## Konsekvenser

**Positiva:** en modell för all ekonomi · inkomst får hem · multi-valuta · kategorier
som data · nettoekonomi trivial · bär privatperson→hushåll→företag · rapporter/budget
bygger på ett ställe.

**Kostnad:** migration + flytta `pengar.tsx` från expenses till transactions.
Engångskostnad; dev-kopia så ingen bakåtkompatibilitet krävs.

## Avvisat
- Lägga till separat `incomes`-tabell: förkastat — då har vi två nästan identiska
  tabeller och samma summerings-krångel. En riktning-kolumn är enklare och riktigare.
- Behålla enum-kategorier: förkastat — bryter data-inte-kod-principen och kan inte
  vara per-kontext.
