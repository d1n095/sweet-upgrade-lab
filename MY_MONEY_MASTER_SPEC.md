# MY MONEY MASTER — LIFE OS
## MASTER PRODUCT SPECIFICATION v2.0
### Kompilerad och uppgraderad från alla källdokument

---

# DEL 1 — IDENTITET & VISION

## Projektnamn
**Officiellt:** My Money Master  
**Internt:** Life OS / Life Operating System  
**Tidigare arbetsnamn:** MyMoneyMaker, Ultimate Life OS

> **VIKTIGT:** Detta projekt är INTE 4ThePeople, Glow Up eller e-handelssidan.  
> Blanda aldrig kod, databas, design eller funktioner mellan projekten.

## North Star
> "Mitt liv, organiserat."

## Vad det är
My Money Master är inte en budgetapp.  
Det är inte en kalender.  
Det är inte en träningsapp.  
Det är ett **komplett Life Operating System** — ett konto, ett system, hela livet.

## Vad vi ersätter
Google Calendar + Excel + Fortnox + budgetappar + anteckningsappar + träningsappar + dokumentappar + schemaprogram + lönekalkylatorer — allt i ett.

---

# DEL 2 — MÅLGRUPP

**Nu:** Privatpersoner, studenter, timanställda, kommunanställda, LSS, region, sjukvård, skiftarbete, industri, egenföretagare, familjer.

**Senare:** Företag, kommuner, organisationer, enterprise.

Systemet ska kunna växa från en privatperson till ett företag utan att byggas om.

---

# DEL 3 — KÄRNFILOSOFI

## Produktfilosofi
- Vi bygger resultat, inte funktioner
- Användaren ska känna: kontroll, lugn, överblick, trygghet
- Systemet minskar stress och manuellt arbete
- AI ger råd — aldrig beslut. Användaren bestämmer alltid

## Kärnvärden
1. Enkelhet före komplexitet
2. Planering före problemlösning
3. Automatisering före manuellt arbete
4. Långsiktighet före kortsiktighet
5. Kvalitet före hastighet
6. Användaren äger alltid sin data
7. Ingen dold logik, ingen dold AI, ingen dold datainsamling

## UX-manifest
- Om användaren måste tänka → designa om
- Om användaren måste leta → designa om
- Om användaren skriver samma sak två gånger → automatisera
- Fler än 3 klick → utvärdera flödet
- 30-sekundersregeln: nytt konto, första passet, första budget, första mål — på 30 sek

---

# DEL 4 — DESIGNSYSTEM

## Känsla
Apple · Linear · Notion · Arc · Raycast  
**Aldrig:** Excel, myndighetssystem, gammalt ERP

## Färger
- Mörkt tema som standard (ljust tema stöds)
- Djupa toner: svart, grafit, mörkgrå
- Accenter: blå, lila, grön
- Röd = varning · Gul = uppmärksamhet · Grön = positivt

## Design tokens (centralt styrda)
Primärfärg · Sekundärfärg · Accent · Success · Warning · Error  
Spacing (4/8/12/16/24/32/48/64) · Border radius · Shadow · Typography · Animation speed

## Komponentsystem
Ett enda komponentbibliotek. Ingen modul bygger egna komponenter.  
Button · Card · Input · Dropdown · Calendar · Timeline · Chart · Dialog · Drawer · Toast · Tooltip · Badge · Tabs · Table · Widget

## States (alla måste finnas)
- Loading → Skeleton loaders (aldrig bara spinner)
- Empty → Illustration + förklaring + CTA
- Error → Vad gick fel + vad användaren kan göra
- Success → Diskret feedback + nästa steg

## Responsivitet
Mobil first → Surfplatta → Desktop → Ultrawide  
Desktop är inte en förstorad mobil — använd hover, shortcuts, drag & drop, split view

---

# DEL 5 — ARKITEKTUR & INGENJÖRSREGLER

## Engineering Constitution
1. Hoppa aldrig över funktionalitet — dela upp om för stort (18 → 18.1, 18.2...)
2. Bygg modulärt — ingen modul beroende av hårdkodad logik
3. Återanvänd komponenter, formulär, tabeller, filter, sök
4. One Source of Truth — data lagras en gång, läses överallt
5. Ingen dubbellagring
6. Mobil först
7. Buggar alltid före nya funktioner
8. Konsekvent design
9. All data ska kunna exporteras, importeras, sökas, filtreras
10. Bygg för 20+ år

## Motorer (engines) — kärnarkitektur
Allt byggs som återanvändbara motorer:

| Motor | Ansvar |
|---|---|
| Rule Engine | IF/THEN-logik, inga hårdkodade regler |
| Event Engine | Alla händelser i systemet skapar events |
| Import Engine | Upload → OCR → Tolkning → Preview → Godkänn → Spara |
| Export Engine | PDF, CSV, Excel, JSON, Print |
| OCR Engine | Utbytbar — ej låst till leverantör |
| Document Engine | Versioner, taggar, AI-summering, relationer |
| Search Engine | Global, semantisk, naturligt språk |
| Notification Engine | Push, mail, digest, prioritet |
| Form Engine | Universell — alla formulär samma motor |
| Automation Engine | Event Bus + Rule Engine + Scheduler |
| AI Engine | Utbytbar — stöder OpenAI, Claude, Gemini, lokala modeller |

## Five Questions — varje ny funktion måste svara ja på minst 3:
1. Sparar detta tid?
2. Minskar detta antalet klick?
3. Gör detta användaren tryggare?
4. Kan detta återanvändas?
5. Passar detta visionen?

---

# DEL 6 — NAVIGATION

## Huvudmeny
Dashboard · Kalender · Arbete & Lön · Ekonomi · Hälsa · Dokument · Projekt · Life Feed · Mer

## Mer-menyn
Resor · Fordon · Hem · Relationer · Karriär · Kunskap · Inställningar · Support

## Command Palette (Cmd+K / Ctrl+K)
Skapa · Sök · Navigera · Importera · Exportera — allt från ett ställe

---

# DEL 7 — MODULÖVERSIKT

## ALPHA-MODULER (byggs nu)

### 7.1 Dashboard / Mission Control
- Levande startsida, personlig och kontextuell
- Visar: datum/tid, nästa pass, intjänat denna månad, budgetstatus, kommande räkningar, Life Feed, snabbknappar, AI-insikter
- Dynamisk: ändras beroende på situation (jobbar idag / semester / renovering)
- Daglig briefing: "God morgon. Idag jobbar du 08–16..."

### 7.2 Arbete & Lön ⭐ (prioritet 1)
**Arbetsprofiler**
- Obegränsat antal — arbetsgivare, arbetsplats, roll, timlön, månadslön
- OB-regler, jourregler, rastregler, skatt, semester, övertid, traktamente, milersättning

**Pass**
- Datum, start, slut, pass över midnatt, arbetsplats, roll
- Jour, beredskap, raster (automatiska + manuella), OB, övertid, anteckning
- Status: planerat / utfört / sjuk / semester / VAB / inställt

**Rastregler**
- Inte hårdkodade — användaren skapar regler per profil
- Exempel: 30 min efter 5h · 45 min efter 8h · ingen rast

**Jour**
- Lördag 20:00 → Söndag 08:00 ska räknas korrekt
- Jour som hela/del av pass eller separat

**OB**
- Standard: kväll, natt, helg, röd dag, jour, beredskap
- Avancerat: egna regler

**Schema**
- Dag/vecka/månad/agenda/timeline/år
- Snabbfyllning: markera hela veckan, välj tid → klart
- Massredigering: kopiera/flytta/duplicera veckor
- Konfliktkontroll: överlapp, dubbelbokning, semester + jobb

**Timlön:** Alltid textfält — inga stepper/+1-knappar

### 7.3 OCR & Schema-import ⭐ (prioritet 1)
**Importflöde:**
1. Ladda upp (bild/PDF/screenshot/text)
2. OCR-tolkning
3. Förhandsgranskning med osäkerheter markerade
4. Konfliktkontroll
5. Användaren godkänner
6. Skapar pass + räknar lön
7. Sparar originaldokument

**Stöd för:** Medvind-screenshot, pappersschema, PDF-schema, inklistrad text

### 7.4 Lönespecifikation
- Importera: PDF, bild, screenshot
- OCR läser: arbetsgivare, period, brutto, netto, skatt, OB, jour, semester, avdrag, bonus
- Jämför mot appens uträkning — visar differens

### 7.5 Lönemotor
- Räknar automatiskt: grundlön, OB, jour, beredskap, övertid, raster, semester, bonus, skatt, netto
- Lönesimulator: "Vad tjänar jag om jag tar söndag natt?"

### 7.6 Kalender
- Dag/vecka/månad/år/agenda/timeline
- Dagens datum extremt tydligt
- Dagar med aktiviteter markeras, klickbara
- Layer-system: slå av/på arbete, träning, semester etc.
- Stöd: flera kalendrar, snabbfyllning med konfliktvarning

### 7.7 Ekonomi
- Inkomster, utgifter, budget, räkningar, abonnemang, skulder, sparande, mål
- Kategorier, återkommande utgifter, budgetstatus (budget/förbrukat/kvar/prognos)
- Skulder: ränta, amortering, snöbollsmetod, amorteringssimulator
- Sparande: mål, simulering, prognos
- Abonnemang: identifiera dubbletter och oanvända

### 7.8 Dokument
- PDF, bild, OCR, kvitto, lönespec, schema, garanti, avtal, försäkring
- Smart namngivning, automatisk kategorisering, versionshantering
- Smart påminnelse: garanti går ut, försäkring löper ut

## BACKLOG-MODULER (byggs senare, arkitektur förbereds nu)

| Modul | Status |
|---|---|
| Hälsa & Träning | Backlog |
| Resor | Backlog |
| Hem & Fastighet | Backlog |
| Fordon | Backlog |
| Projekt & Mål | Backlog |
| Karriär & CV | Backlog |
| Kunskap & Second Brain | Backlog |
| Relationer & Familj | Backlog |
| Life Feed & Timeline | Backlog |
| Mission Control Pro | Backlog |
| AI Copilot | Backlog |
| Automation & Rules | Backlog |
| Smart Savings & Cashback | Backlog |
| Shopping Engine | Backlog |
| Bankintegration | Backlog |
| Enterprise & Team | Backlog |
| Digital Twin | Backlog |
| Life Score & KPI | Backlog |

---

# DEL 8 — ALPHA STATUS & BUGGAR

## Vad som finns (påbörjat i Lovable)
- Autentisering (instabil)
- Grundläggande kalender
- Grundläggande dashboard
- Grundläggande ekonomi
- Grundläggande arbetsmodul
- Projektstruktur, databas, UI

## Identifierade buggar (åtgärda först)
- Appen laggar
- Måste ibland logga ut/in för att fortsätta
- Timlön kan inte skrivas direkt (stepper används)
- Jour fungerar inte korrekt
- Pass över midnatt fungerar inte
- Veckoplanering missar redan ifyllda dagar
- Kalender markerar inte dagens datum tydligt
- Dashboard visar för lite relevant information
- För många klick krävs
- E-postverifiering fungerar ej (inget mail skickas)
- Session verkar instabil
- Supabase Auth behöver felsökas

## UX-problem
- För många knappar och formulär
- För mycket manuell inmatning
- För lite automation och återanvändning

## UI-problem
- Känns mer adminpanel än premiumprodukt
- För lite animationer och spacing
- För lite modern känsla

---

# DEL 9 — ALPHA PRIORITERINGSLISTA

**Fas 0 — Stabilisera (gör detta först)**
1. Fixa Supabase Auth (email confirmation, redirect URLs, SMTP)
2. Fixa session-instabilitet
3. Ta bort alla laggar
4. Tydliga felmeddelanden vid inloggning/registrering

**Fas 1 — Premium design-remake**
5. Implementera design system (tokens, typografi, spacing)
6. Skeleton loaders överallt
7. Micro-animationer
8. Empty states med guide + CTA
9. Mobil first genomgång

**Fas 2 — Arbete & Lön**
10. Timlön som textfält (ta bort stepper)
11. Pass över midnatt
12. Jour lördag–söndag korrekt
13. Automatiska rastregler per profil
14. OB-regler
15. Konfliktkontroll

**Fas 3 — OCR & Import**
16. Schema-import (bild/PDF/screenshot)
17. Förhandsgranskningsvy
18. Lönespec-import
19. Jämförelse app vs lönespec

**Fas 4 — Dashboard & Översikter**
20. Smart dashboard (dynamisk, levande)
21. Månadsöversikt: timmar, OB, jour, brutto, netto
22. Planerat vs faktiskt

**Fas 5 — Ekonomi**
23. Utgifter med kategorier
24. Skulder med amorteringssimulator
25. Sparande med mål

---

# DEL 10 — AFFÄRSMODELL

| Nivå | Innehåll |
|---|---|
| Gratis | Schema, lön, budget, dokument, mål |
| Premium | OCR, avancerade prognoser, AI, fler profiler, automationer, rapporter |
| Enterprise | HR, team, behörigheter, bemanning, semesterplanering, dashboards |

Rättigheterna ägs av projektägaren.

---

# DEL 11 — TEKNISK STACK (Lovable)

- **Frontend:** React + Tailwind (via Lovable)
- **Backend/DB:** Supabase
- **Auth:** Supabase Auth
- **OCR:** Tesseract.js (lokalt, gratis) → AI Gateway senare
- **AI:** Utbytbar arkitektur — börja med Claude/OpenAI
- **Deployment:** Via Lovable

---

# DEL 12 — REGLER FÖR LOVABLE-PROMPTS

1. Läs alltid hela kontextdokumentet innan implementation
2. Tidigare beslut gäller om de inte uttryckligen ändrats
3. Om något är oklart → fråga, gissa aldrig
4. Om något är för stort → dela upp i delmoment
5. Hoppa aldrig över funktionalitet
6. Bygg aldrig enklare version bara för att spara tid
7. Buggar alltid före nya funktioner
8. Agera som senior systemarkitekt, inte kodgenerator
9. Blanda ALDRIG kod från 4ThePeople in i detta projekt

---

# DEL 13 — ONBOARDING

Första inloggning ska vara välkomnande och sälja in appen direkt.

Fråga om:
- Namn
- Arbetstyp (tim/månads)
- Timlön / arbetsgivare / arbetsplats
- Rastregler, OB-regler
- Vill du använda ekonomi? Hälsa? Dokument?

Känsla: "Det här hjälper dig räkna lön, planera livet och få kontroll."

---

*Kompilerad från källdokument del 1–38 + addendum*  
*Version 2.0 — Klar för Lovable-implementation*
