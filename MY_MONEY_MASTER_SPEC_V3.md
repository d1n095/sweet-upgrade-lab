# MY MONEY MASTER — LIFE OS
## MASTER PRODUCT SPECIFICATION v3.2
### 5600+ rader · 58 delar · Kompilerad från 130+ källdokument
### Klar för Lovable-implementation

> **LÄSORDNING FÖR LOVABLE:** Läs Del 48 (Lagarna) → Del 20 (Lovable-regler) → Del 16 (Alpha-prioritet) → Del 14 (Modulöversikt) → sedan resten vid behov.

---

# KONSTITUTION — HÖGSTA STYRDOKUMENT

> "Om en framtida funktion bryter mot detta dokument ska dokumentet ha företräde."

> "Life OS Core är produkten. AI är ett tillval. Användarens data tillhör alltid användaren."

> "Designen ska sälja appen innan funktionerna gör det."

> "Life OS ska inte reagera på knapptryckningar. Life OS ska förstå livssituationer."

> "Systemet ska bli renare för varje version, inte tvärtom."

> "Den enklaste lösningen som uppfyller kraven ska alltid väljas."

> "AI ska hjälpa användaren investera resurser där de ger störst långsiktigt värde."

> "Värdet uppstår i relationerna."

> "Osäker information får aldrig presenteras som säker."

> "Life OS ska inte uppfinna problem som redan är lösta."

> "En plan som inte tar hänsyn till tid, pengar, energi och kapacitet är inte en riktig plan."

> "Små kontinuerliga korrigeringar är bättre än stora ryckvisa förändringar."

> "Robusthet prioriteras före komplexitet."

> "Life OS ska fungera som ett levande kretslopp där varje erfarenhet förbättrar nästa."

> "Systemet ska bli smartare ju längre användaren använder det. Aldrig tvärtom."

> "AI ska hjälpa användaren bygga system som fungerar även när motivationen är låg."

> "Life OS ska hjälpa användaren förstå beslut, inte vinna argument."

> "Design Thinking: All utveckling börjar med användarens problem, inte tekniken."

---

# DEL 1 — IDENTITET & VISION

## Projektnamn
**Officiellt:** My Money Master
**Internt:** Life OS / Life Operating System
**Tidigare arbetsnamn:** MyMoneyMaker, Ultimate Life OS

> **KRITISKT:** Detta projekt är INTE 4ThePeople, Glow Up eller e-handelssidan.
> Blanda ALDRIG kod, databas, design eller funktioner mellan projekten.
> Om en prompt är oklar vilket projekt den gäller: STOPPA. Fråga. Gissa aldrig.

## North Star
> "Mitt liv, organiserat."

## Vad det är
My Money Master är inte en budgetapp. Det är inte en kalender. Det är inte en träningsapp.
Det är ett **komplett Life Operating System** — ett konto, ett system, hela livet.
Systemet organiseras efter **människans liv**, inte efter tekniska funktioner.

## Vad vi ersätter
Google Calendar + Excel + Fortnox + budgetappar + anteckningsappar + träningsappar + dokumentappar + schemaprogram + lönekalkylatorer — allt i ett.

## Long Term Vision
Life OS ska kunna användas 20–30–40+ år. All data ska följa användaren hela livet.

---

# DEL 2 — MÅLGRUPP

**Nu:** Privatpersoner, studenter, timanställda, kommunanställda, LSS, region, sjukvård, skiftarbete, industri, egenföretagare, familjer.

**Senare:** Företag, kommuner, organisationer, enterprise.

Systemet ska kunna växa från en privatperson till ett företag utan att byggas om.

---

# DEL 3 — KÄRNFILOSOFI & VÄRDERINGAR

## Global Core Values
1. Enkelhet före komplexitet
2. Kvalitet före kvantitet
3. Återanvändning före duplicering
4. Transparens före magi
5. Användaren före företaget
6. Långsiktighet före kortsiktighet
7. Modularitet före speciallösningar
8. Frihet före inlåsning
9. Planering före problemlösning
10. Automatisering före manuellt arbete

## Produktfilosofi
- Vi bygger resultat, inte funktioner
- Användaren ska känna: kontroll, lugn, överblick, trygghet
- Systemet minskar stress, administration och glömska
- AI ger råd — aldrig beslut. Användaren bestämmer alltid

## Privacy by Design
- Security by Design
- Offline First
- Encryption First
- Consent First
- Ingen dold datainsamling
- Ingen försäljning av användardata
- Ingen dold AI

## AI Philosophy — vad AI får och INTE får
**AI får:**
- Analysera, sammanfatta, planera, jämföra
- Föreslå, förklara, motivera, varna
- Automatisera med användarens godkännande
- Lära sig användarens arbetsmönster

**AI får ALDRIG:**
- Fatta slutgiltiga beslut
- Hitta på fakta
- Dölja information
- Utföra irreversibla åtgärder utan godkännande
- Manipulera användaren
- Skapa beroende
- Ta kontroll

## AI-Optional Architecture — KÄRNPRINCIP
All kärnfunktionalitet fungerar utan AI. AI är ett tillval, aldrig ett krav.
- AI kan stängas av helt, per modul, per dokument, per funktion
- AI måste begära behörighet per åtgärd — läser aldrig allt automatiskt
- Varje AI-funktion har ett icke-AI-alternativ

**Non-AI Fallbacks:**
- AI-budgetförslag → manuell budgetmall
- AI-OCR-tolkning → vanlig OCR + manuell verifiering
- AI-planering → kalender + regler + mallar
- AI-sök → global sökning + filter
- AI-sammanfattning → vanlig rapport
- AI-insikter → statistik + regler

---

# DEL 4 — UX-MANIFEST

- Om användaren måste tänka → designa om
- Om användaren måste leta → designa om
- Om användaren skriver samma sak två gånger → automatisera
- Fler än 3 klick → utvärdera flödet
- **30-sekundersregeln:** nytt konto, första passet, första budget, första mål — på 30 sek
- **Grandma Test:** om en 70-åring inte förstår → designa om
- **Delete Rule:** kan detta ligga på en befintlig sida? → bygg inte ny sida
- Max tre tryck till viktig information
- Context Aware UI — systemet förstår sammanhang
- Progressiv komplexitet: Nybörjare → Enkel vy, Van → Mer info, Expert → Full kontroll

---

# DEL 5 — DESIGNSYSTEM

## Känsla
Apple · Linear · Notion · Arc · Raycast · 2030-design
**Aldrig:** Excel, myndighetssystem, gammalt ERP

## Designspråk
- Mjuk, elegant, modern
- Glassmorphism där det passar
- Subtila skuggor, rounded corners, lätta gradients
- Mikroanimationer, djup
- WCAG-tillgänglighet

## Färger
- Mörkt tema standard (ljust + auto + high contrast stöds)
- Djupa toner: svart, grafit, mörkgrå
- Accenter: blå, lila, grön
- Röd = varning · Gul = uppmärksamhet · Grön = positivt

## Design Tokens (centralt styrda)
Primärfärg · Sekundärfärg · Accent · Success · Warning · Error
Spacing (4/8/12/16/24/32/48/64) · Border radius · Shadow · Typography · Animation speed

## States (alla måste finnas)
- Loading → Skeleton loaders (aldrig bara spinner)
- Empty → Illustration + förklaring + CTA + mallar
- Error → Vad gick fel + vad användaren kan göra
- Success → Diskret feedback + nästa steg

## Responsivitet
Mobil first → Surfplatta → Desktop → Ultrawide → Foldables
Desktop är INTE en förstorad mobil — använd hover, shortcuts, drag & drop, split view, multi window

## Platforms
- iOS: Widgets, Live Activities, Dynamic Island, Shortcuts, Siri, Haptics
- Android: Widgets, Material You, Quick Settings, Intent-system
- Lock Screen widgets
- Apple Watch / Wear OS (framtid)
- PWA support
- Desktop app (framtid)

---

# DEL 6 — ARKITEKTUR & ENGINEERING CONSTITUTION

## Engineering Constitution
1. Hoppa aldrig över funktionalitet — dela upp om för stort (18 → 18.1, 18.2...)
2. Bygg modulärt — ingen modul beroende av hårdkodad logik
3. One Source of Truth — data lagras en gång, läses överallt
4. Ingen dubbellagring, ingen duplicerad kod
5. Feature-based arkitektur
6. Mobil först
7. Buggar alltid före nya funktioner
8. Konsekvent design
9. All data ska kunna exporteras, importeras, sökas, filtreras
10. Bygg för 20+ år
11. Optimistiska uppdateringar — UI uppdateras innan server bekräftar
12. Offline Queue — köar ändringar när offline

## Five Questions — varje ny funktion måste svara ja på minst 3:
1. Sparar detta tid?
2. Minskar detta antalet klick?
3. Gör detta användaren tryggare?
4. Kan detta återanvändas?
5. Passar detta visionen?

## Feature Rules — varje ny funktion ska besvara:
- Vilket problem löser den?
- Vilket värde skapar den?
- Vilka Engines används?
- Vilka objekt påverkas?
- Kan detta lösas med befintliga Engines?
- Blir appen enklare eller mer komplex?

## Quality Gates — ingen funktion är klar förrän:
- UI fungerar · UX fungerar
- Mobil fungerar · Desktop fungerar
- Tester är gröna · Prestanda godkänd
- Dokumentation finns · Non-AI fallback finns

## Scientific Principles
- **Systems Theory:** Helheten > summan av delarna. Lokala optimeringar får inte försämra helheten
- **Cybernetics Loop:** Observera → Mät → Analysera → Justera → Verifiera → Lär → Upprepa
- **Theory of Constraints:** Optimera alltid den största begränsningen först
- **Lean:** Identifiera och eliminera slöseri
- **Kaizen:** Små kontinuerliga förbättringar
- **Complexity Theory:** Systemet ska minska komplexitet, aldrig skapa den
- **Human Factors:** Ta hänsyn till mental belastning och kognitiv kapacitet
- **Behavioral Economics:** Förstå beslutsbias utan att manipulera
- **Resilience:** Tål fel, ofullständig data, avbrott, förändrade mål
- **Information Theory:** Rätt information, rätt tid, rätt plats, rätt mängd

## OS Kernel-principen
Life OS har en Central Kernel (Core Engines) precis som ett operativsystem.
Inspirerat av: Windows/Linux/macOS, PostgreSQL (ACID), Git (versionshantering), Obsidian (backlinks), Home Assistant (automation), Linear/Jira (projekt).

---

# DEL 7 — CORE ENGINES (kärnmotorer)

Alla motorer är återanvändbara. Ingen modul bygger egna.

| Motor | Ansvar |
|---|---|
| Rule Engine | IF/THEN-logik, State Machines, inga hårdkodade regler |
| Event Engine (Event Bus) | Alla händelser skapar events, nervsystem för hela OS |
| Import Engine | Upload → OCR → Tolkning → Preview → Godkänn → Spara |
| Export Engine | PDF, CSV, Excel, JSON, ICS, Markdown, Print |
| OCR Engine | Utbytbar — ej låst till leverantör. Tesseract.js nu, AI Gateway senare |
| Document Engine | Versioner, taggar, AI-summering, relationer, backlinks |
| Search Engine | Global, semantisk, naturligt språk, Knowledge Graph |
| Notification Engine | Push, mail, digest, prioritet, snooze, Akut/Hög/Normal/Låg |
| Form Engine | Universell — alla formulär samma motor, autospar |
| Automation Engine | Event Bus + Rule Engine + Scheduler + Workflow Engine |
| AI Engine | Utbytbar — OpenAI, Claude, Gemini, lokala modeller |
| Analytics Engine | Central — alla moduler skickar data hit |
| Calendar Engine | Alla moduler kan skriva till kalendern, layer-system |
| Time Engine | Alla tidsresurser genom samma motor |
| Task Engine | Universell uppgiftsmotor |
| Project Engine | Bygger ovanpå Task Engine |
| Goal Engine | Bygger ovanpå Project Engine |
| Resource Engine | Tid, energi, uppmärksamhet, pengar, kunskap, hälsa, relationer, AI |
| Permission Engine | Roller, behörigheter per modul och objekt |
| Security Engine | Zero Trust, kryptering, sessioner |
| Backup Engine | Auto/manuell/snapshot/punkt-i-tid |
| Sync Engine | Offline-first, konflikthantering, versionskontroll |
| Relationship Engine | Objekt kopplas fritt, Knowledge Graph |
| Mission Engine | Nedbrytning av livsmål till år/kvartal/månad/vecka/dag |
| Evolution Engine | Spårar hur användaren och systemet utvecklas |
| Trust Engine | Trust Level per objekt, Source Model, Confidence Engine |
| Life Flow Engine | Input → Analys → Klassificering → Beslut → Handling → Lärdom |
| Control Loop Engine | Observera → Mät → Jämför → Avvikelse → Korrigering → Verifiera |
| Optimization Engine | Constraint solving, scheduling, portfolio, route |
| Template Engine | Mallar för allt |
| Dashboard Engine | Modulär, dynamisk, widget-baserad |
| Widget Engine | Alla informationsblock som widgets |
| Component Engine | Gemensamt komponentbibliotek |
| Animation Engine | Centralt styrd motion design |
| Gamification Engine | Streaks, achievements, milestones (frivilligt) |
| Media Engine | Bilder, video, ljud, PDF |
| Plugin Engine | Sandbox, versioner, signering |
| Integration Engine | Alla externa tjänster genom ett lager |
| API Engine | REST, Webhooks, SDK, rate limits |
| Logging Engine | Structured, AI, Performance, Security, Audit |
| History Engine | All ändringshistorik |
| Learning Engine | AI lär sig av användaren |
| Memory Engine | AI Long Term Memory |
| Discovery Engine | Hitta glömda objekt, dubbletter, möjligheter |
| Immune Engine | Hotidentifiering, isolering, self-healing |
| Bottleneck Engine | Identifierar flaskhalsar och slöseri |
| Deviation Engine | Identifierar avvikelser från mål |
| Stakeholder Engine | Vem påverkas av ett beslut |
| Trade-off Engine | Alla val har kostnad — visar explicit |

---

# DEL 8 — GLOBAL OBJECTS (universell datamodell)

Alla moduler använder samma objekt. Ingen modul skapar egna.

**Människor & Organisationer:**
User · Person · Company · Organization · Contact · Relationship

**Livs-objekt:**
Property · Room · Vehicle · Pet · Appliance · Inventory Item

**Arbete & Lön:**
Work Profile · Work Shift · Salary · Payslip · Break Rule · OB Rule · Jour · Leave

**Ekonomi:**
Account · Transaction · Budget · Expense · Income · Debt · Asset · Subscription · Insurance · Bill · Investment · Pension

**Dokument:**
Document · Receipt · Invoice · Warranty · Contract · Certificate · Manual · OCR Import

**Planering:**
Project · Task · Goal · Habit · Checklist · Template · Reminder · Calendar Event

**Kunskap:**
Note · Idea · Research · Knowledge · Memory · Book · Course · Quote · Decision

**Resor & Platser:**
Trip · Booking · Packing List · Currency · Place · Location

**Media:**
Photo · Video · Audio · Attachment

**System:**
Automation · Rule · Notification · Report · Dashboard · AI Conversation · Plugin · Integration · Webhook

Alla objekt har: Unikt ID · Metadata · Source · Trust Level · Timestamp · Version · Relations · Tags · History

---

# DEL 9 — LIFE DOMAINS (livsdomäner)

Systemet organiseras efter människans liv:

| Domän | Ansvar |
|---|---|
| Personal | Identitet, livsprinciper, dagbok, personlig utveckling |
| Identity | Pass, körkort, certifikat, digital wallet, fullmakter |
| Work | Schema, lön, jour, OB, karriär, kompetenser |
| Finance | Budget, utgifter, skulder, sparande, investeringar |
| Home | Bostäder, rum, renoveringar, service, garantier |
| Relationship | Familj, partner, vänner, kontakter, nätverk |
| Legal | Avtal, testamente, samboavtal, juridiska dokument |
| Government | Skatteverket, Försäkringskassan, CSN, myndighetspost |
| Health | Sömn, kost, träning, mediciner, vaccinationer |
| Knowledge | Anteckningar, research, böcker, kurser, Second Brain |
| Travel | Resor, pass, visum, packlistor, valutor |
| Asset | Bilar, elektronik, verktyg, samlingar |
| Business | CRM, kunder, leverantörer, fakturor, lager |
| Education | Kurser, certifikat, studieplaner, AI-lärare |
| Skill | Kompetenser, certifieringar, mastery tracking |
| Creativity | Idéer, musik, foto, video, skrivande, brainstorming |
| Food | Recept, matplanering, skafferi, inköpslistor |
| Shopping | Prisbevakning, cashback, bonusprogram, orderhistorik |
| Subscription | Abonnemang, förnyelser, dubletter, AI-besparingar |
| Pet | Husdjur, veterinär, vaccination, försäkring |
| Parenting | Barn, skola, aktiviteter, familjeekonomi |
| Elder Care | Anhörigstöd, mediciner, påminnelser, AI-stöd |
| Social | Vänner, evenemang, nätverk |
| Community | Föreningar, frivilligarbete, organisationer |
| Spiritual | Reflektion, meditation, dagbok (frivillig, neutral) |
| Charity | Donationer, volontärarbete, insamlingar |
| Environment | Energiförbrukning, klimatavtryck, miljömål |
| Survival | Krisberedskap, förnödenheter, nödkontakter |
| Insurance | Alla försäkringar, villkor, AI-jämförelser |
| Wealth | Nettoförmögenhet, kapitalplanering, pension, arv |
| Time | Hur tid används, produktivitet, livsbalans |
| Personal Intelligence | Arbetsmönster, energinivåer, beslutsmönster |
| Risk | Ekonomisk risk, datasäkerhet, krisplaner |
| Opportunity | ROT, RUT, bidrag, cashback, skatteavdrag |
| Legacy | Digitalt arv, instruktioner, efterlevandestöd |
| Communication | Mail, möten, AI-sammanfattningar, kontaktlogg |

---

# DEL 10 — LIFE ROLES & LIFE STAGES

## Life Roles (användaren kan ha flera samtidigt)
Private Person · Employee · Employer · Business Owner · Investor · Consumer · Student · Teacher/Mentor · Parent · Child/Family Member · Partner · Home Owner · Vehicle Owner · Traveler · Citizen · Volunteer · Creator · Researcher · Pet Owner · Caregiver

## Life Stages
Childhood → Education → First Job → Career Growth → Family Building → Home Ownership → Business Creation → Financial Independence → Retirement Planning → Retirement → Legacy Planning

## Role-based Experience
- AI identifierar aktuell roll automatiskt
- Dashboard och workspace anpassas efter roll
- Rollspecifika råd och insikter
- Automatic Role Detection baserat på kontext

---

# DEL 11 — LIFE MISSIONS

Mission är systemets högsta nivå. Alla projekt, vanor, budgetar, dokument och AI-förslag ska kunna kopplas till ett eller flera Life Missions.

**Mission Library (färdiga templates):**
Financial Freedom · Home Ownership · Career Growth · Business Building · Family Building · Health Transformation · Learning Journey · Creative Journey · Travel Journey · Legacy Journey · Debt Freedom · Early Retirement · Build Passive Income · Write a Book

**Mission Structure:** Vision · Prioritet · Delmål · Projekt · Checklistor · Vanor · Budget · Kalender · Dokument · Risker · AI-plan · Automation · Milstolpar · Lärdomar

**Mission Engine:** Automatisk nedbrytning → År → Kvartal → Månad → Vecka → Dag → Vanor

**Mission Score:** Framsteg · Risk · Tid kvar · Budget · Sannolikhet · AI Confidence

**Mission Dependencies:** AI visualiserar hur mål påverkar varandra (nytt jobb → högre lön → husköp → ekonomisk frihet)

---

# DEL 12 — PERSONAL OPERATING SYSTEM

Varje användare bygger sitt eget personliga OS:

- **Life Principles** — personliga regler AI respekterar
- **Decision Model** — hur beslut ska tas (vänta 24h, jämför 3 alternativ etc.)
- **Value System** — rangordning av vad som är viktigt
- **Energy Profile** — när är användaren fokuserad/kreativ/behöver vila
- **Communication Profile** — hur vill användaren ha påminnelser och AI-svar
- **Learning Profile** — video/text/ljud/praktiskt, AI anpassar
- **Financial Profile** — risknivå, investeringsfilosofi, köpbeteende
- **Work Profile** — arbetsstil, fokusblock, mötespreferenser
- **Personal Constitution** — samlingsdokument för livsprinciper
- **Longitudinal Behaviour Analysis** — AI analyserar beteendeförändringar över år

---

# DEL 13 — NAVIGATION & STRUKTUR

## Huvudmeny
Dashboard · Kalender · Arbete & Lön · Ekonomi · Hälsa · Dokument · Projekt · Life Feed · Mer

## Mer-menyn
Resor · Fordon · Hem · Relationer · Karriär · Kunskap · Inställningar · Support

## Navigation
- Bottom Navigation mobil · Sidebar desktop
- Command Palette (Cmd+K / Ctrl+K)
- Global Search alltid tillgänglig
- Favoriter · Pinned Items · Senaste
- Breadcrumbs · Recent Items
- Floating Assistant — AI alltid nära

## Workspaces & Life Modes
**Workspaces:** Life · Work · Finance · Travel · Health · Business · Study · Home · Project · Family

**Life Modes:** Normal · Work · Focus · Home · Travel · Vacation · Study · Business · Emergency · Recovery · Move · Renovation · Holiday

---

# DEL 14 — MODULÖVERSIKT

## ALPHA-MODULER (byggs nu)

### 14.1 Dashboard / Mission Control ⭐
- Levande startsida, personlig och kontextuell
- Daglig briefing: "God morgon. Idag jobbar du 08–16..."
- Visar: datum/tid, nästa pass, intjänat, budgetstatus, kommande räkningar, Life Feed, snabbknappar
- Dynamisk: ändras efter situation, tid, arbetsdag, semester
- Modulär: drag & drop widgets, Dashboard Builder
- Smart Resume — fortsätt exakt där du slutade
- AI Welcome Back — AI summerar vad som hänt sedan sist

### 14.2 Arbete & Lön ⭐ (prioritet 1)
**Arbetsprofiler:**
- Obegränsat antal — arbetsgivare, arbetsplats, roll, timlön, månadslön
- OB-regler, jourregler, rastregler, skatt, semester, övertid, traktamente, milersättning, timbank

**Pass:**
- Datum, start, slut, pass över midnatt, arbetsplats, roll
- Jour, beredskap, raster (auto + manuell), OB, övertid, anteckning
- Status: planerat/utfört/sjuk/semester/VAB/inställt
- Passkoder: D/K/N/J/B/SEM/LEDIG — användaren definierar egna

**Rastregler (inte hårdkodade):**
- Användaren skapar regler per profil
- Exempel: 30 min efter 5h · 45 min efter 8h · ingen rast

**Jour:**
- Lördag 20:00 → Söndag 08:00 räknas korrekt
- Jour som hela/del av pass eller separat

**Schema:**
- Dag/vecka/månad/agenda/timeline/år
- Snabbfyllning hela veckor
- Massredigering: kopiera/flytta/duplicera
- Konfliktkontroll: överlapp, dubbelbokning, semester+jobb

**Timlön:** Alltid textfält — ALDRIG stepper/+1-knappar

### 14.3 OCR & Schema-import ⭐ (prioritet 1)
**Import-flöde:**
1. Ladda upp (bild/PDF/screenshot/text)
2. OCR-tolkning med confidence score
3. Förhandsgranskning — osäkerheter markerade (95%=auto, 70%=bekräfta, 40%=manuell)
4. Konfliktkontroll
5. Användaren godkänner
6. Skapar pass + räknar lön
7. Sparar originaldokument
8. AI lär sig av korrigeringar

**Stöd för:** Medvind-screenshot, pappersschema, PDF-schema, text

### 14.4 Lönespecifikation
- Importera: PDF, bild, screenshot
- OCR läser: brutto, netto, skatt, OB, jour, semester, avdrag, bonus, pension
- Jämför mot appens uträkning — visar differens per post

### 14.5 Lönemotor & Simulator
- Räknar: grundlön, OB, jour, beredskap, övertid, raster, semester, bonus, skatt, netto
- Lönesimulator: "Vad tjänar jag om jag tar söndag natt?"
- Testräkning: "Är det värt att jobba?"

### 14.6 Kalender
- Dag/vecka/månad/år/agenda/timeline
- Layer-system: slå av/på arbete, träning, semester etc.
- Stöd: flera kalendrar, snabbfyllning med konfliktvarning
- Snabbfyll-alternativ: behåll/ersätt/slå ihop/hoppa över/lägg till

### 14.7 Ekonomi
- Inkomster, utgifter, budget, räkningar, abonnemang, skulder, sparande, mål
- Utgiftstyper: vanlig/räkning/abonnemang/skuld/lån/privat skuld/kreditkort/avbetalning/Klarna
- Skulder: ränta, amortering, snöbollsmetod, amorteringssimulator
- Scenario Planner: "Vad händer om räntan höjs?"
- Abonnemang: identifiera dubbletter och oanvända
- Net Worth Engine: tillgångar minus skulder = nettovärde med historik

### 14.8 Dokument
- PDF, bild, OCR, kvitto, lönespec, schema, garanti, avtal, försäkring
- Smart namngivning, automatisk kategorisering, versionshantering
- Smart påminnelse: garanti går ut, försäkring löper ut
- Digital Safe: krypterat kassaskåp för viktiga dokument

## BACKLOG-MODULER (arkitektur förbereds, implementation senare)

Hälsa & Träning · Resor · Hem & Fastighet · Fordon · Projekt & Mål · Karriär & CV · Kunskap & Second Brain · Relationer & Familj · Life Feed & Timeline · Mission Control Pro · AI Copilot · Automation & Rules · Smart Savings & Cashback · Shopping Engine · Bankintegration · Enterprise & Team · Digital Twin · Life Score & KPI · Business Platform · Pet Platform · Parenting Platform · Elder Care

---

# DEL 15 — ALPHA STATUS & BUGGAR

## Vad som finns (i Lovable)
- Autentisering (instabil)
- Grundläggande kalender, dashboard, ekonomi, arbetsmodul
- Projektstruktur, databas, UI

## Buggar — åtgärda FÖRST
1. Appen laggar
2. Måste ibland logga ut/in
3. Timlön kan inte skrivas direkt (stepper används)
4. Jour fungerar inte korrekt
5. Pass över midnatt fungerar inte
6. Veckoplanering missar redan ifyllda dagar
7. Kalender markerar inte dagens datum tydligt
8. Dashboard visar för lite relevant information
9. E-postverifiering fungerar ej
10. Session instabil
11. Supabase Auth behöver felsökas (confirmation settings, redirect URLs, SMTP)

---

# DEL 16 — ALPHA PRIORITERINGSLISTA

**Fas 0 — Stabilisera (gör detta ALLRA FÖRST)**
1. Fixa Supabase Auth (email confirmation, redirect URLs, SMTP)
2. Fixa session-instabilitet
3. Ta bort alla laggar
4. Tydliga felmeddelanden

**Fas 1 — Premium design-remake**
5. Implementera design system (tokens, typografi, spacing)
6. Skeleton loaders överallt
7. Micro-animationer, transitions
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
17. Förhandsgranskningsvy med confidence
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

# DEL 17 — SÄKERHET

## Security Levels (12 nivåer)
1. App Lock
2. PIN / Biometri / Face ID / Touch ID
3. Lokal kryptering
4. Krypterade dokument
5. Krypterad backup
6. Behörigheter per modul
7. Behörigheter per objekt
8. AI Sandbox
9. Integration Sandbox
10. Audit Log
11. Zero Trust
12. Offline Mode

## Privacy Dashboard
Användaren ser alltid:
- Vilken data finns sparad och om den är krypterad
- Vad AI har fått läsa och vilka dokument analyserats
- Vilka integrationer är aktiva
- Vilka exporter och inloggningar har skett

## Data Ownership
Användaren äger all data. Kan exportera, radera och flytta allt. Ingen inlåsning.

## Offline-First
Hela grundappen fungerar utan internet. Backup till lokal fil.

---

# DEL 18 — AFFÄRSMODELL

| Nivå | Innehåll |
|---|---|
| Gratis | Schema, lön, budget, dokument, mål, grundläggande OCR |
| Plus | AI, automation, analytics, fler profiler, rapporter |
| Pro | Avancerade integrationer, plugins, flera företag, premium AI |
| Enterprise | HR, team, behörigheter, bemanning, SSO, compliance |
| White Label | Kommuner, organisationer (framtid) |

**Marketplace:** Mallar · Automationer · Plugins · Widgets · Teman · AI-agenter · Dashboards
**AI Credits:** Kvot per plan, AI Model Selector, AI Cost Optimizer

---

# DEL 19 — TEKNISK STACK

- **Frontend:** React + Tailwind (via Lovable)
- **Backend/DB:** Supabase (ACID-liknande integritet, soft delete, audit log)
- **Auth:** Supabase Auth
- **OCR:** Tesseract.js (lokalt, gratis) → AI Gateway senare (utbytbar)
- **AI:** Utbytbar — Claude/OpenAI/Gemini/lokala modeller. Model Routing, Prompt Templates
- **State:** Global state, optimistiska uppdateringar, Offline Queue
- **CI/CD:** Automatiska tester, lint, build, security scan, release pipeline
- **Testing:** Unit · Integration · Component · E2E · Performance · Security · Accessibility · Visual Regression
- **Deployment:** Via Lovable

---

# DEL 20 — REGLER FÖR LOVABLE

1. Läs alltid hela kontextdokumentet innan implementation
2. Tidigare beslut gäller om de inte uttryckligen ändrats
3. Om något är oklart → fråga, gissa ALDRIG
4. Om något är för stort → dela upp i delmoment, hoppa ALDRIG över
5. Lovable får ALDRIG säga "Det här är för stort" — dela upp istället
6. Bygg ALDRIG enklare version bara för att spara tid
7. Buggar ALLTID före nya funktioner
8. Agera som senior systemarkitekt, inte kodgenerator
9. Blanda ALDRIG kod från 4ThePeople in i detta projekt
10. Ingen modul får bygga egna komponenter, databaser, sökmotorer, AI eller notifieringar
11. Alla förändringar dokumenteras med motivering

---

# DEL 21 — ONBOARDING

Välkomnande, säljer in appen direkt. Känsla: "Det här hjälper dig räkna lön, planera livet och få kontroll."

Fråga om: Namn · Arbetstyp (tim/månads) · Timlön / arbetsgivare / arbetsplats · Rastregler · OB-regler · AI på/av · Vilka moduler vill du använda?

Demo-läge: testa appen med exempeldata utan konto.

---

# DEL 22 — FRAMTIDA PRINCIPER (att bygga mot)

## Life Flow Engine
Input → Analys → Klassificering → Planering → Beslut → Handling → Resultat → Lärdom → Optimering → NY Input

## Sense → Think → Act (all AI)
Observera → Förstå → Analysera → Besluta → Agera → Verifiera → Lär → Förbättra

## Ecosystem Graph
Alla noder (människor, platser, objekt, dokument, projekt, resurser) kopplas i ett levande nätverk. Ju fler relationer som byggs, desto smartare blir AI.

## Evolution Engine
Systemet spårar hur användaren utvecklas. Life Chapters, Turning Points, Life Trajectory.

## Trust Engine
Varje objekt har Trust Level, Source, Confidence Score. Osäker info märks alltid.

## Infrastructure Principles
- Ingen enskild komponent får slå ut hela systemet
- Failover automatiskt vid tjänstefel
- Self-healing: systemet reparerar trasiga länkar automatiskt
- Resilience Score: mäter backup, redundans, återställningsförmåga

## Control Loop
Reference Values (användarens önskade normalläge) → Deviation Engine → Stability Engine → Oscillation Detection → Korrigering

## Biological Principles
Homeostasis (balans) · Immune System (hotidentifiering) · DNA Model (permanent identitet) · Memory Consolidation (daglig sammanfattning) · Circulatory System (fri informationsflöde)

---

*Kompilerad från källdokument del 1–38, Product Bible Prompt 1–25, System Bible Master Prompt 1–24, och alla addendum.*
*Version 3.0 — Komplett underlag för Lovable-implementation*

---

# DEL 23 — DEFINITION OF READY & DEFINITION OF DONE

## Definition of Ready
En fas/funktion får inte påbörjas förrän följande är definierat:
- Syfte — varför byggs detta?
- Datamodell — vilka objekt och relationer?
- UI — hur ser det ut?
- UX — hur fungerar det?
- Beroenden — vad måste finnas först?
- Non-AI fallback — vad händer utan AI?
- Acceptanskriterier — hur vet vi att det är klart?

## Definition of Done
En fas/funktion är INTE klar förrän:
- Funktionen fungerar korrekt
- Mobil fungerar
- Desktop fungerar
- Loading states finns (skeleton)
- Empty states finns (guide + CTA)
- Error states finns (mänskligt språk)
- Buggar är åtgärdade
- Design följer Design System
- Non-AI fallback fungerar
- Tidigare funktioner fungerar fortfarande (regression)

---

# DEL 24 — SUPABASE & DATABAS-REGLER

## Row Level Security (RLS) — KRITISKT
Alla Supabase-tabeller MÅSTE ha RLS aktiverat.
Ingen användare får kunna läsa eller skriva andras data.
Varje tabell ska ha policies för: SELECT · INSERT · UPDATE · DELETE

## Auth-krav för alpha
- Email confirmation: måste fungera (SMTP konfigurerat)
- Redirect URLs: korrekt konfigurerade för både dev och prod
- Session refresh: automatisk, ingen manuell inloggning
- Protected routes: redirect till login om ej inloggad
- Resend verification email: knapp på login-sidan
- Forgot password: fullständigt flöde

## Databasstruktur alpha (grundtabeller)
```
profiles (id, user_id, name, created_at)
work_profiles (id, user_id, name, employer, hourly_rate, ...)
work_shifts (id, user_id, work_profile_id, date, start_time, end_time, ...)
break_rules (id, work_profile_id, after_hours, break_minutes, ...)
ob_rules (id, work_profile_id, type, multiplier, ...)
expenses (id, user_id, amount, category, date, ...)
debts (id, user_id, name, amount, interest_rate, ...)
documents (id, user_id, type, file_url, ocr_text, ...)
```

## Allmänna databasregler
- Alltid `user_id` på alla tabeller (kopplat till auth.users)
- Alltid `created_at` och `updated_at`
- Alltid soft delete (`deleted_at`) — aldrig permanent radering
- Alltid audit log på kritiska tabeller
- Inga hårdkodade värden i databasen

---

# DEL 25 — LOVABLE COMMIT-REGLER

Utöver reglerna i Del 20:

12. Spara/committa efter varje delmoment — inte bara i slutet
13. Testa varje delmoment innan nästa påbörjas
14. Om ett delmoment misslyckas → stoppa, rapportera, vänta på instruktion
15. Ändra ALDRIG funktioner som redan fungerar utan explicit instruktion
16. Skapa ALDRIG nya filer om befintliga kan återanvändas
17. Använd ALLTID befintliga Supabase-tabeller om de redan finns — skapa inte dubbletter
18. RLS måste vara aktivt på ALLA nya tabeller från dag ett


---

# DEL 26 — SPRÅKREGLER

## Svenska vs Engelska
- **UI-text mot användaren:** Svenska (hela appen är på svenska)
- **Kod, variabelnamn, kommentarer:** Engelska
- **Databaskolumner:** Engelska (snake_case)
- **Komponentnamn:** Engelska (PascalCase)
- **Filnamn:** Engelska (kebab-case)
- **Felmeddelanden mot användaren:** Svenska, mänskligt språk — aldrig teknisk text
- **Lovable-prompts:** Svenska

Exempel:
```
✅ work_shifts (DB) → WorkShift (komponent) → "Arbetspass" (UI)
❌ arbetspass (DB) → ArbetspassComponent → "Work Shift" (UI)
```

---

# DEL 27 — PRESTANDAMÅL (konkreta targets)

- App-start: under 2 sekunder (mål: under 1 sekund)
- Navigering mellan sidor: under 300ms
- Sökning: resultat under 500ms
- OCR-start: feedback till användaren under 1 sekund (även om OCR tar längre)
- API-anrop: timeout efter 10 sekunder, visa felmeddelande
- Animationer: 60 FPS minimum, aldrig under 30 FPS
- Offline-start: under 1 sekund (från cache)
- Skeleton loaders: visas inom 100ms av sidladdning

Om ett mål inte kan uppnås: visa skeleton loader + progressindikator. Aldrig blank skärm.

---

# DEL 28 — DO NOT TOUCH-LISTA

Lovable får ALDRIG ändra följande utan explicit skriftlig instruktion:

**Databas:**
- Befintliga RLS-policies
- Befintliga tabellstrukturer (lägg till kolumner OK, ta bort ALDRIG)
- user_id-kopplingar på befintliga tabeller
- Auth-konfiguration som fungerar

**Kod:**
- Fungerande auth-flöde
- Fungerande löneuträkningslogik
- Befintliga Core Engine-strukturer
- Design tokens som är satta

**Generellt:**
- Ta aldrig bort en funktion för att lösa ett annat problem
- Byt aldrig teknologi (t.ex. från Supabase till något annat) utan explicit instruktion
- Installera aldrig nya npm-paket utan att nämna det

---

# DEL 29 — FELHANTERING & ÅTERHÄMTNING

## OCR-felhantering
- Om OCR kraschar halvvägs: spara delresultatet, visa vad som lyckades
- Visa alltid: "X av Y sidor tolkade"
- Erbjud alltid: "Försök igen" eller "Fortsätt manuellt"
- Originaldokumentet sparas alltid INNAN OCR körs — aldrig efter

## API-felhantering
- Alla API-anrop måste ha try/catch
- Timeout: 10 sekunder, sedan felmeddelande på svenska
- Retry: automatiskt 3 gånger vid nätverksfel, sedan ge upp och visa fel
- Visa aldrig: "Something went wrong" eller stacktraces
- Visa alltid: vad gick fel + vad användaren kan göra

## Databasfelhantering
- Om skrivning misslyckas: behåll lokalt, försök igen vid nästa sync
- Visa alltid synkstatus i UI (synkad / synkar / offline / fel)
- Ingen data får gå förlorad vid nätavbrott

## Migrationsregler
- Lägg alltid TILL kolumner, ta aldrig BORT
- Befintlig data får aldrig förstöras vid schemaändring
- Alla migreringar ska vara reversibla
- Testa alltid migrering på testdata innan produktion

---

# DEL 30 — SEED-DATA & DEMO-LÄGE

## Demo-läge (ingen inloggning krävs)
Visa appen med realistisk exempeldata:
- En användare: "Alex Svensson", kommunanställd LSS
- Arbetsprofil: Sundsvalls Kommun, timlön 185 kr, OB-regler för kommun
- 3 månaders pass: dag/kväll/natt/jour-blandning
- Lönespecifikationer: 2 st importerade
- Budget: mat/transport/boende/abonnemang
- En skuld: privatlån 45 000 kr, 7% ränta
- Sparmål: semester 15 000 kr (60% klar)
- 5 dokument: lönespec, schema, hyresavtal, försäkring, garanti

Demo-data ska:
- Vara realistisk (verkliga OB-procenter, verkliga skattenivåer)
- Visa alla alpha-funktioner
- Kunna återställas med en knapp
- ALDRIG blandas med riktig användardata

---

# DEL 31 — API-VERSIONERING & KOMPATIBILITET

- Alla API-endpoints versioneras: `/api/v1/...`
- Frontend och backend ska alltid ha kompatibla versioner
- Om versioner inte matchar: visa tydligt felmeddelande, erbjud reload
- Breaking changes kräver ny versionssiffra
- Gamla versioner ska fungera i minst 30 dagar efter ny release
- Changelog uppdateras vid varje API-ändring


---

# DEL 32 — PERSONAL LIFE AUDIT — LUCKOR & FÖRBÄTTRINGAR

## Identity — saknas i spec
- **Försäkringsnummer** — explicit som eget fält på profilen
- **Viktiga kontaktuppgifter** — samlad vy, inte utspridda i systemet
- **ICE-kontakter** (In Case of Emergency) — separat, lättillgänglig vy, fungerar offline
- **Medlemskap** — egna objekt med nummer, förmåner, förfallodatum (skilt från abonnemang)

## Daily Life — saknas i spec
- **Idag-vy** — en dedikerad "/idag"-sida som visar BARA det som är relevant just nu
- **Timer** — inbyggd timer direkt i appen (för pomodoro, arbetspass, projekt)
- **Enhandsläge** — viktig funktion för mobil, viktiga knappar inom tumzonen
- **Zoom** — tillgänglighetsfunktion som saknades
- **Återhämtningsläge** — explicit vy när användaren är sjuk/utbränd, visar minimal info

## Anteckningar — förtydliganden
- **Voice Notes** — röstanteckningar med automatisk transkribering
- **Whiteboard** — frihandritning, skisser, mindmaps
- **Markdown-stöd** — anteckningar stödjer markdown-formatering
- **Ritningar** — enkla skisser (t.ex. rumsritning för renovering)

## Offline — förtydligande (viktig lucka)
Spec:en säger "offline first" men specificerar inte vad som fungerar offline vs inte.

**Fungerar alltid offline (kärna):**
- Kalender (visa befintliga pass)
- Lägga till pass manuellt
- Budget (visa + lägga till utgifter)
- Anteckningar
- Checklistor
- Dokument (visa redan laddade)
- Sök (i lokalt cachad data)
- Inställningar

**Kräver internet:**
- OCR-tolkning via AI
- Synkronisering
- Bankintegration
- Realtidsnotiser

**Synkstatus-indikatorer (alltid synliga):**
- Grön = synkad
- Gul = synkar
- Röd = offline / synkfel
- Grå = okänd

## Accessibility — saknas i spec
- **Zoom** — pinch-to-zoom + textzoominställning
- **Enhandsläge** — alla primärfunktioner inom tumzonen
- **Reducerad rörelse** — stäng av animationer för användare med rörelsekänslighet
- **Röststyrning** — iOS/Android inbyggd röststyrning ska fungera
- **Kortkommandon** — fullständig lista för desktop (Tab, Enter, Esc, Cmd+K, Cmd+S...)

## Vanebibliotek — saknades
Färdiga vanor att välja från:
- Hälsa: dricka vatten, sova 8h, promenad, stretching
- Ekonomi: kontrollera budget, logga utgifter, spara X kr
- Arbete: planera dagen, veckorecension, logga pass
- Lärande: läsa 20 min, lyssna på podcast, öva språk
- Välmående: meditation, tacksamhetsdagbok, no-screen-time

## Förenklingsförslag (från audit)
- **Idag-vyn** ska vara absolut enklast — bara det viktigaste, inga distraktioner
- **Snabbinmatning** ska vara möjlig från varje skärm, inte bara dashboard
- **Morgonbriefing** ska vara opt-in, inte default — användaren väljer

## Offline-first checklista för Lovable
Innan varje funktion byggs, svara:
1. Fungerar detta utan internet?
2. Fungerar detta utan AI?
3. Fungerar detta utan backend (från cache)?
4. Om svaret är nej på något — bygg offline-fallback FÖRST


---

# DEL 33 — FRICTION AUDIT & HUMAN EXPERIENCE

## Zero Friction Principle
För varje funktion ska systemet fråga:
- Kan detta göras med färre klick?
- Kan detta automatiseras?
- Kan detta upptäckas automatiskt?
- Kan detta döljas tills det behövs?
- Kan detta lösas utan formulär?
- Kan detta lösas med ett svep?
- Kan detta lösas med en widget?
- Kan detta fungera offline?

## One Touch Principle
Vanliga uppgifter: 1–2 tryck max.
- Lägg till utgift
- Registrera arbetspass
- Starta timer
- Scanna kvitto
- Lägg till anteckning
- Skapa uppgift
- Markera uppgift klar
- Öppna dagens dashboard

## Progressive Disclosure
Visa bara det användaren behöver just nu:
Grundläge → Mer information → Avancerat → Expert
Systemet ska ALDRIG overbelasta nya användare med alla alternativ.

## Error Prevention (förebygg, rätta inte bara)
- Bekräfta alltid destruktiva åtgärder (radera, överskriva)
- Visa konsekvenser INNAN användaren bekräftar
- Automatisk validering i realtid — inte bara vid submit
- Ångra-knapp alltid tillgänglig efter kritiska åtgärder
- Versionshistorik på alla viktiga objekt

## Recovery — allt ska kunna ångras
- **Ångra (Cmd+Z / Shake)** — sista åtgärden
- **Papperskorg** — raderade objekt sparas 30 dagar
- **Versionshistorik** — se alla tidigare versioner av ett objekt
- **Snapshot** — ta en ögonblicksbild innan stora ändringar
- Ingen åtgärd ska vara permanent utan en extra bekräftelse

## Reduce Decision Fatigue
- AI eller regelmotor föreslår — aldrig tvingar
- Minska antalet val per skärm
- Gruppera relaterade val
- Använd smart defaults så användaren behöver ändra så lite som möjligt
- Behåll alltid kontrollen hos användaren

## Emotional Design
Systemet ska kännas:
- Tryggt — aldrig osäkert på vad som händer
- Lugnt — inga störande animationer eller ljud
- Förutsägbart — samma beteende varje gång
- Stabilt — inget kraschat, inget förlorat
- Professionellt — aldrig barnsligt eller billigt
- Aldrig stressande — systemet ska minska stress, aldrig öka den

## Friction Audit Checklist (kör på varje ny funktion)
Innan en ny funktion godkänns:
1. Hur många tryck krävs för vanligaste uppgiften?
2. Kan det göras med färre?
3. Finns ett one-touch-alternativ?
4. Fungerar det offline?
5. Finns ångra-möjlighet?
6. Är destructive actions skyddade?
7. Förstår en ny användare det direkt?
8. Är det konsekvent med resten av appen?

## Consistency Rules
Samma regler ÖVERALLT:
- Samma ikoner = samma funktion alltid
- Samma swipe-gester = samma åtgärd alltid
- Samma sök = samma beteende i varje modul
- Samma filter = samma gränssnitt överallt
- Samma språk = inga synonymer för samma sak
- Radera = alltid röd · Spara = alltid primärfärg · Avbryt = alltid grå

## Nya UX-detaljer som saknades
- **Shake to undo** — skaka telefonen för att ångra senaste åtgärd (iOS-standard)
- **Swipe to delete** — svep för att radera i listor, med ångra-toast
- **Long press** — håll in för snabbmeny (duplicera, flytta, tagga, dela)
- **Pull to refresh** — dra ned för att uppdatera
- **Infinite scroll** — aldrig "ladda mer"-knappar i listor
- **Haptic feedback** — vibration vid viktiga åtgärder (spara, radera, bekräfta)
- **Toast notifications** — diskreta bekräftelser längst ned (3 sek, kan stängas)


---

# DEL 34 — SCREEN ARCHITECTURE & UI-REGLER

## Global Screen Rules
Varje skärm ska besvara:
- Vad är syftet med den här skärmen?
- Vad gör användaren oftast här?
- Vad är viktigast och ska vara överst?
- Vad kan döljas tills det behövs?
- Vad kan automatiseras bort?
- Vad kräver för många klick just nu?

## Screen Template — alla sidor följer samma struktur

```
1. HEADER
   - Titel (tydlig, kort)
   - Status (synkad / offline / laddar)
   - Senast uppdaterad
   - Sök (alltid tillgänglig)
   - Snabbmeny (⋯)

2. PRIMARY AREA
   - Det användaren kom hit för
   - Tar störst plats
   - Laddar alltid först

3. SECONDARY AREA
   - Relaterad information
   - Historik / statistik
   - AI-insikter (om AI är på)
   - Kollapsbar

4. QUICK ACTIONS
   - Vanligaste åtgärderna
   - Max 5 synliga
   - Användaren kan anpassa

5. DETAILS
   - Mer information
   - Kollapsbar / expanderbar
   - Aldrig default öppen
```

## Quick Action Bar — anpassningsbar av användaren
Användaren väljer själv sina snabbknappar (max 6):
- Ny anteckning
- Ny utgift
- Nytt arbetspass
- Ny uppgift
- Scanner (OCR)
- Röstanteckning
- Sök
- Timer
- Ny påminnelse
- Nytt projekt

## Screen Audit Checklist — kör på varje skärm
1. Förstår en nybörjare vad skärmen gör direkt?
2. Kan en avancerad användare arbeta snabbt?
3. Fungerar den utan AI?
4. Fungerar den offline?
5. Fungerar den med en hand på mobil?
6. Är viktigaste information överst?
7. Finns max 5 quick actions?
8. Kan skärmen anpassas av användaren?
9. Finns senast-uppdaterad-indikator?
10. Är destructive actions skyddade?

## Settings Screen — strukturerad uppdelning
Inställningar ska alltid vara uppdelade i exakt dessa kategorier (aldrig utspridda):
- **Konto** — namn, e-post, profilbild, lösenord
- **Säkerhet** — 2FA, enheter, sessioner, PIN
- **Synk** — synkstatus, konfliktlösning, offline-cache
- **AI** — på/av per modul, modellval, historik, rensa
- **Automation** — aktiva regler, loggar, schemaläggning
- **Behörigheter** — vem ser vad, delning, familj
- **Backup** — automatisk/manuell, exportera allt, återställ
- **Integritet** — vad lagras, radera konto, GDPR-export
- **Utseende** — tema, typstorlek, animationer, täthet
- **Aviseringar** — per kanal, per modul, digest-inställningar
- **Export** — PDF/CSV/JSON/backup
- **Avancerat** — developer-läge, beta-funktioner, diagnostik

## Customization-regler
Alla större skärmar ska kunna:
- Visa/dölj sektioner
- Flytta widgets
- Sortera listor
- Fästa favoriter
- Spara anpassad vy som "Min vy"
- Återställa till standard med ett tryck

## "Senast uppdaterad"-indikator
Alla listor och dashboards visar när data senast uppdaterades.
Format: "Uppdaterad 14:32" eller "Uppdaterad för 3 min sedan"
Klick på indikatorn → tvinga uppdatering (om online) eller visa synkstatus (om offline)


---

# DEL 35 — USER LIFECYCLE & EXPERIENCE JOURNEY

## Grundprincip
> "Om användaren fastnar någonstans har systemet misslyckats. Inte användaren."

## Phase 1 — First Launch
- **Konto frivilligt** — användaren kan testa i demo-läge utan konto
- **AI hoppas över** — onboarding funkar utan AI, ingen fråga om AI förrän användaren är inne
- **Offline direkt** — appen startar och är användbar utan internet
- **Lokal databas direkt** — data sparas lokalt innan molnsynk sätts upp
- **Första PIN/Face ID** — erbjuds direkt, aldrig tvingat
- **Första backup** — erbjuds efter onboarding, inte under
- Onboarding: max 3 steg, resten är valfritt att fylla i senare

## Phase 2 — First Day (utan guide)
Användaren ska kunna göra detta utan hjälp dag 1:
- Registrera arbetspass
- Lägga in timlön
- Skapa budget
- Lägga till anteckning
- Scanna dokument
- Förstå dashboarden

Om något av dessa kräver guide → designa om, inte guiden.

## Phase 3 — First Week
Systemet ska automatiskt:
- Påminna om att sätta upp backup
- Visa veckoöversikt på söndag kväll
- Föreslå vanor baserat på vad användaren registrerat
- Visa första synkstatus

## Phase 4 — First Month
Systemet genererar automatiskt:
- Månadsrapport (lön, timmar, budget, OB)
- Budgetuppföljning med avvikelser
- Systemhälsokontroll (backup OK? data komplett?)

## Phase 5 — First Year
Systemet kan visa:
- Årsrapport — lön, timmar, ekonomi, projekt, mål
- Skatteunderlag (milersättning, traktamente, avdrag)
- Löneutveckling över 12 månader
- Förmögenhetsutveckling (tillgångar vs skulder)

## Device Journey — ny enhet / förlorad enhet
- **Ny telefon:** QR-kod eller kod för snabb återställning
- **Förlorad telefon:** fjärr-logout från alla sessioner, data krypterad
- **Offline:** allt fungerar, synkar när internet återkommer
- **Återställning:** från backup, steg-för-steg guide, inget data förloras

## Security Journey
- PIN/biometri: erbjuds vid första start, aldrig tvingat
- Ny enhet: kräver verifiering (e-post + kod)
- Misstänkt inloggning: notis + möjlighet att blockera
- Lösenordsbyte: alla sessioner loggas ut automatiskt
- Full export: alltid tillgänglig, verifiering krävs
- Kontoborttagning: 30 dagars avveckling, full export innan

## AI Journey — fyra lägen som alla fungerar
```
AI AV      → Kärnappen fungerar fullt ut
AI PÅ      → Extra intelligens och insikter
AI BYTS    → Byt modell, inget i appen påverkas
AI BORTTAGEN → Ingen funktion slutar fungera
```
AI-beroenden ska aldrig byggas in i kärnflöden.

## Family Journey
- Partner bjuds in via e-post, väljer vad som delas
- Delad budget: var och en ser sin del + gemensam del
- Barn: separata profiler med begränsade behörigheter
- Gemensamma projekt: kommentarer, tilldelning, notiser
- Ingen kan se den andres privata data utan explicit delning

## Failure Journey — systemet har alltid en väg vidare
| Scenario | Lösning |
|---|---|
| Internet borta | Offline-läge, synkar sedan |
| Molnet nere | Lokal data tillgänglig |
| AI nere | Non-AI fallback aktiveras |
| OCR nere | Manuell inmatning erbjuds |
| Telefon trasig | Återställ från backup |
| Backup skadad | Alternativ backup (lokal + moln) |
| Import misslyckas | Visa vad som gick fel, erbjud retry eller manuell |

## Exit Journey — användaren lämnar Life OS
Ska alltid vara möjligt, smärtfritt och komplett:
- **Full export** — allt i öppna format (JSON, CSV, PDF)
- **Verifiering** — bekräfta att exporten är komplett
- **Historik** — all historik ingår i exporten
- **Öppna format** — ingen proprietär inlåsning
- **30 dagars avveckling** — konto inaktivt men data finns kvar
- **Permanent radering** — explicit bekräftelse krävs, oåterkalleligt

## Review Questions (kör på varje flöde)
- Vad saknas i detta steg?
- Vad känns långsamt eller krångligt?
- Vad fungerar inte utan AI?
- Vad fungerar inte offline?
- Hur kan detta förenklas?
- Vad händer om det går fel?


---

# DEL 36 — EXPERT REVIEW: KRITISKA LUCKOR & FÖRBÄTTRINGAR

## Release Readiness Gate — ingen version är klar förrän:
- Kärnflöden fungerar utan AI
- Offline-läge fungerar
- Jourpass över dygn räknas korrekt
- Schema-OCR fungerar med manuell granskning
- Lönespec-OCR fungerar med manuell granskning
- Löneberäkning kan verifieras manuellt
- Data kan exporteras och är komplett
- Backup kan återställas (testad, inte bara skapad)
- Säkerhetskontroller fungerar
- Mobil och desktop fungerar
- Inga falska knappar, tomma länkar eller dekorativa mockfunktioner finns
- Ingen version av appen ger intryck av att en funktion finns som inte fungerar

## Säkerhetsluckor som saknades
- **Input-validering** — all indata valideras på både frontend och backend, aldrig bara ett ställe
- **Beroendeskanning** — automatisk skanning av npm-paket för säkerhetshål (CI/CD)
- **Rate limiting** — på alla API-endpoints, inte bara autentisering
- **Intrångsdetektering** — varna vid ovanliga mönster (massradering, massexport)
- **Skydd mot massradering** — kräver extra bekräftelse + 30 dagars papperskorg
- **Skydd mot massändringar** — bulk-edit kräver preview + bekräftelse
- **Safe Mode** — begränsad read-only-läge vid misstänkt korruption
- **Korruptionsdetektering** — systemet kontrollerar dataintegritet vid start

## Ekonomiluckor som saknades
- **Överföringar utan dubbelräkning** — en överföring mellan egna konton ska inte räknas som inkomst + utgift
- **Delbetalningar** — skulder och räkningar kan betalas delvis
- **Inflation** — budgetprognoser kan ta hänsyn till inflation
- **Flera valutor** — utgifter kan registreras i annan valuta, konverteras automatiskt
- **Projektbudgetar** — separat budget per projekt, inte bara kategorier
- **Alla beräkningar spårbara** — användaren kan alltid se hur ett belopp räknats fram, inga svarta lådor

## Arbete & Lön-luckor som saknades
- **Mertid** (under heltid men över avtalad tid) — separat från övertid
- **Komptid** — explicit hantering, kan bytas mot ledighet
- **Skiftrotation** — schema som roterar automatiskt (vecka A/B/C)
- **Delade arbetspass** — ett pass som delas med annan anställd
- **Avvikelsehantering** — om utbetalt lön avviker från beräknat, explicit orsaksregistrering
- **Systemet kan verifiera lönespec mot pass utan AI** — detta är ett hårt krav

## OCR-luckor som saknades
- **Flera sidor** — ett dokument kan ha många sidor, alla ska bearbetas
- **Roterade bilder** — OCR ska hantera roterade och snett fotograferade dokument
- **Confidence per fält** — inte bara per dokument, utan per enskilt fält
- **Felkö** — misslyckade OCR-jobb hamnar i kö för ombearbetning
- **Originalfilen bevaras alltid oförändrad** — OCR-resultatet är en kopia, aldrig en ersättning
- **Lärande från korrigeringar utan att dela privat data** — lokal inlärning

## Legal & Compliance-luckor som saknades
- **Minderåriga** — familjekonton med barn kräver extra skydd och begränsade behörigheter
- **Ansvarsfriskrivning** — systemet skiljer tydligt mellan information, beräkning, rekommendation och professionell rådgivning
- **AI-gränser för finansiell och medicinsk rådgivning** — AI säger explicit "detta är inte professionell rådgivning"
- **Bevarandeperioder** — användaren kan välja hur länge data sparas (1/5/10/alltid år)
- **Plugin- och integrationsvillkor** — tydliga villkor för tredjepartsdata

## Support-luckor som saknades
- **Statussida** — publik sida som visar systemstatus (API, OCR, AI, Sync)
- **Incidentkommunikation** — notis i appen vid driftstörningar
- **Felsökningspaket** — användaren kan exportera diagnostik utan privat data för support
- **Ingen dold supportåtkomst** — support ser bara det användaren explicit delar
- **Supporthistorik** — användaren ser alla supportärenden

## Self-hosting & Vendor Independence (saknades)
- Arkitekturen ska stödja framtida self-hosting
- Ingen kritisk funktion får vara låst till en enda molnleverantör
- Om Supabase försvinner ska data och logik kunna migreras
- Om AI-leverantör försvinner ska appen fungera utan den

## Prestandabudgetar (konkreta blockerare)
Dessa ska blockera CI/CD-pipeline automatiskt om de bryts:
- Bundle size: max 500KB initial load
- Largest Contentful Paint: max 2.5 sekunder
- Time to Interactive: max 3.5 sekunder
- Databas-queries: max 200ms per query
- Sökning: max 500ms för 100 000 objekt

## Lovable Implementation Rules (tillägg)
19. Inventera alltid vad som redan finns innan ny kod skrivs
20. Ersätt aldrig fungerande system med tomma mockups
21. Inga dekorativa knappar — om en knapp finns ska den fungera
22. Om krediter tar slut: dokumentera exakt återstående arbete som nästa körbara steg
23. Dela alltid stora arbeten i körbara delar om max 30 minuters arbete

## Landsanpassning
- Svenska som primärt språk
- Stöd för svenska OB-regler, kollektivavtal och semesterlagar
- Stöd för svenska myndigheter (Skatteverket, FK, CSN)
- Framtida stöd för norska, danska, finska varianter
- Datumformat: YYYY-MM-DD (ISO 8601)
- Valuta: SEK default, stöd för multi-valuta
- Vecka startar måndag (ISO-veckor)
- Röda dagar: svenska helgdagar inbyggda


---

# DEL 37 — DEVELOPMENT CONSTITUTION

## Object First
All ny funktion utgår från Object Model — inte från skärmen, databasen eller AI.
Fråga alltid: är detta egentligen ett objekt? En automation? En vy? En inställning?
Bygg aldrig dubbletter.

## Core Before UI — byggordern är alltid:
```
Core Engine → Data/Datamodell → API → Automation → Tester → UI → AI
```
Aldrig tvärtom. UI byggs aldrig utan fungerande backend.

## No Mockups — absolut regel
Ingen knapp, meny, widget eller sida får visas om den inte fungerar.
Ingen falsk funktionalitet.
Ingen "coming soon"-knapp utan tydlig markering att den är inaktiv.

## Complete Flows — en funktion är inte klar förrän hela kedjan fungerar:
```
Skapa → Redigera → Historik → Sök → Filter → Export →
Backup → Återställning → Behörigheter → Offline → Tester
```
Halvfärdiga flöden är värre än inga flöden.

## Backward Compatibility
- Gamla användare ska aldrig förlora data vid uppdatering
- Migrationer ska alltid vara säkra och testade
- Tidigare versioner ska kunna återställas vid problem
- Breaking changes kräver explicit användarnotis

## Test Pyramid — varje större funktion testas mot:
Unit · Integration · System · Offline · Backup · Import · Export · Recovery · OCR · AI av · AI på

## Refactor Rule
Om bättre arkitektur upptäcks → förbättra istället för att bygga ovanpå dålig struktur.
Teknisk skuld registreras alltid, prioriteras och följs upp. Ingen dold skuld.

## Release Checklist — ingen release utan:
```
✓ Alla tester gröna
✓ Backup skapad och verifierad (testad återställning)
✓ Recovery verifierad
✓ Offline verifierad
✓ Export verifierad och komplett
✓ AI av verifierad (alla flöden fungerar)
✓ OCR verifierad
✓ Säkerhet verifierad (RLS, input-validering, rate limit)
✓ Prestanda inom budget
✓ UX verifierad (mobil + desktop)
✓ Inga falska knappar eller tomma sidor
✓ Dokumentation uppdaterad
✓ Changelog uppdaterad
```

## Pre-build Checklist — innan ny funktion byggs:
```
□ Finns den redan?
□ Kan befintlig funktion byggas ut istället?
□ Kan två funktioner slås ihop?
□ Kan detta lösas i Core Engine?
□ Är detta egentligen bara ett objekt?
□ Är detta egentligen bara en automation?
□ Är detta egentligen bara en inställning?
□ Finns Non-AI fallback?
□ Fungerar det offline?
□ Är det bakåtkompatibelt?
```


---

# DEL 38 — KOMPLETTERANDE TILLÄGG (egen granskning)

## Saknade ekonomifunktioner

### Löneuträkning — saknade detaljer
- **Skattetabell** — systemet ska kunna räkna preliminärskatt per kolumn (33, 34 etc.)
- **Arbetsgivaravgift** — visa vad jobbet kostar arbetsgivaren (relevant för egenföretagare)
- **Semesterlön** — 12% av bruttolön för timanställda, ska beräknas automatiskt
- **Sjuklön** — dag 2–14: 80% av lön, dag 1: karensavdrag (20% av veckolön)
- **Föräldrapenning** — beräkning av SGI och föräldrapenningnivåer
- **ROT/RUT-avdrag** — beräkning och dokumentation för deklaration

### Budget — saknade detaljer
- **Rullande budget** — budget som automatiskt förs över till nästa månad om ej förbrukad
- **Budgetmallar per målgrupp** — student, singel, familj, pensionär med rimliga startvärden
- **Sparkvot-mål** — sätt ett %-mål för sparkvot, systemet beräknar automatiskt

## Saknade arbetsflöden

### Importflöde — edge cases som saknades
- **Duplikat-detektering vid import** — om ett pass redan finns, visa tydlig varning
- **Partiell import** — importera bara valda pass från ett schema, inte allt
- **Import-historik** — visa alla tidigare importer med status och resultat
- **Rollback av import** — ångra en hel import med ett klick (inom 24h)

### Lönespec — saknade detaljer
- **Arbetsgivarintyg** — stöd för att tolka och spara arbetsgivarintyg (FK-ansökningar)
- **Semester-utbetalning** — tolka och kategorisera semesterlönsutbetalningar
- **Retroaktiv lön** — hantera retroaktiva lönejusteringar korrekt i historiken

## Saknade UX-detaljer

### Formulär — konkreta regler som saknades
- **Tab-ordning** — logisk tab-ordning i alla formulär
- **Autofill** — stöd för iOS/Android autofill på relevanta fält (namn, adress, e-post)
- **Numerisk tangentbord** — beloppsfält öppnar alltid numeriskt tangentbord på mobil
- **Datumväljare** — konsekvent datepicker i hela appen, aldrig textinmatning för datum
- **Formulär sparas automatiskt** — utkast sparas var 30:e sekund, aldrig förlorat vid krasch

### Notiser — saknades
- **Tyst timme** — användaren sätter tidsfönster utan notiser (t.ex. 22:00–07:00)
- **Notis-sammanfattning** — morgonnotis som summerar dagen, inte 10 separata
- **Kritiska notiser** — kan inte stängas av (säkerhetsvarningar, backup-fel)
- **Notis-historik** — visa alla notiser de senaste 30 dagarna

### Navigation — saknades
- **Snabbnavigering med siffertangenter** — på desktop: 1=Dashboard, 2=Kalender etc.
- **Historik-navigation** — bakåt/framåt i navigationshistorik (som webbläsare)
- **Deep links** — direktlänkar till specifika objekt (t.ex. lifeos://shift/123)
- **Spotlight-integration** — iOS Spotlight och Android App Search kan söka i Life OS

## Saknade säkerhetsdetaljer

- **Session-timeout** — automatisk utloggning efter X minuters inaktivitet (konfigurerbart)
- **Screenshot-skydd** — känsliga skärmar (lönespec, bankuppgifter) blockerar screenshots
- **Clipboard-rensning** — känslig data rensas från clipboard efter 60 sekunder
- **Jailbreak/root-detektering** — varna om enheten är komprometterad
- **Certificate pinning** — skydd mot man-in-the-middle-attacker

## Saknade databasdetaljer

```sql
-- Alla tabeller ska ha dessa kolumner:
id          UUID DEFAULT gen_random_uuid() PRIMARY KEY
user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL
created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
deleted_at  TIMESTAMPTZ DEFAULT NULL  -- soft delete

-- Trigger för updated_at (ska finnas på alla tabeller):
CREATE TRIGGER update_timestamp
  BEFORE UPDATE ON [table]
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index på vanliga sökkolumner:
CREATE INDEX ON work_shifts(user_id, date);
CREATE INDEX ON expenses(user_id, date);
CREATE INDEX ON documents(user_id, created_at);
```

## Saknade integrationsprioriteringar

**Fas 1 (alpha):** Ingen extern integration — allt manuellt + OCR
**Fas 2:** Google Calendar (export av arbetspass)
**Fas 3:** Apple Calendar + iCal-export
**Fas 4:** Bankintegration (read-only, PSD2)
**Fas 5:** Medvind, TimeCare, Personec (schema-import)
**Backlog:** Apple Health, Google Health, Wearables

## Konkreta förbättringar av onboarding

Nuvarande spec är för vag. Konkret flöde:

```
Steg 1 (30 sek): Välkommen — välj: Demo eller Skapa konto
Steg 2 (60 sek): Vad jobbar du med? (Tim/Månads/Egenföretagare/Annat)
Steg 3 (60 sek): Sätt upp din första arbetsprofil (arbetsgivare + lön)
Steg 4 (valfritt): Importera schema (OCR) eller lägg in manuellt
Steg 5 (valfritt): Aktivera AI? (Förklaring av vad AI gör + opt-in)
→ Dashboard med första passet
```

Allt efter steg 3 är valfritt och kan göras senare.

## Saknade tillgänglighetskrav (WCAG 2.1 AA)

- Alla interaktiva element: minst 44x44px tryckareal
- Fokusmarkering: tydlig, aldrig bara färg
- Kontrastratio: minst 4.5:1 för text, 3:1 för UI-element
- Alternativtext på alla bilder och ikoner
- Semantisk HTML-struktur (inte bara divs)
- Aria-labels på ikoner utan text
- Formulärfält alltid med synlig label (inte bara placeholder)
- Felmeddelanden kopplade till fält via aria-describedby

## Versionsnumrering — konkret schema

```
MAJOR.MINOR.PATCH
1.0.0 = Alpha release (stabil grundfunktion)
1.1.0 = Ny funktion tillagd
1.1.1 = Buggfix
2.0.0 = Breaking change eller stort nytt system
```

Varje version har en changelog synlig i appen under Inställningar → Om appen.

## Saker att ta bort eller förenkla

- **Life Score** — för abstrakt och potentiellt stressande. Ersätt med konkreta nyckeltal istället
- **Gamification som default** — streaks och achievements ska vara helt dolda tills användaren aktiverar dem
- **AI-briefing som default** — ska vara opt-in, inte tvingad funktion vid start


---

# DEL 39 — KOMPLETT OBJEKTMODELL

## Universal Object Metadata — alla objekt har dessa fält
```
id            UUID (primary key, aldrig återanvänd)
user_id       UUID (ägare, kopplat till auth)
title         TEXT (visningsnamn)
description   TEXT (valfri beskrivning)
type          TEXT (objekttyp)
status        TEXT (active/archived/deleted)
color         TEXT (valfri färgkodning)
icon          TEXT (valfri ikon)
is_favorite   BOOLEAN (snabbåtkomst)
tags          TEXT[] (globala taggar)
ai_status     TEXT (none/pending/processed/error)
offline_status TEXT (synced/pending/conflict)
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
deleted_at    TIMESTAMPTZ (soft delete)
version       INTEGER (versionsnummer)
```

## Komplett objektlista — saknade objekt tillagda

**Identitet:**
Person · Familj · Organisation · Arbetsgivare · Arbetsplats · Kontakt · Roll · Behörighet

**Arbete:**
Löneprofil · Arbetspass · Lönespecifikation · Rastregel · OB-regel · Jour · Ledighet · Timbank

**Ekonomi:**
Konto · Transaktion · Budget · Budgetpost · Utgift · Inkomst · Skuld · Sparmål · Tillgång · Prenumeration · Försäkring · Garanti · Faktura · Kvitto

**Dokument:**
Dokument · Bild · PDF · **OCR-resultat** (separat från dokumentet) · **Versionspost** · **Exportpost** · **Importpost**

**Planering:**
Projekt · Uppgift · Delmål · Mål · Livsmål · Vana · Checklista · Checklistpost · Mall · Påminnelse · Kalenderhändelse

**Kunskap:**
Anteckning · Dagbok · **Journal** · AI-konversation · **AI-minne** · Research · Bok · Kurs · Citat · Beslut

**Fysiska objekt:**
Fastighet · Rum · Fordon · Inventarie · Verktyg · Husdjur

**Resor:**
Resa · Bokning · Packlista · Valuta · Plats

**System:**
Automation · Regel · **Integration** · **Plugin** · **API-token** · Notifikation · Logg · **Session** · **Enhet** · Rapport · Dashboard-widget · **Mapp** · Tagg · Backup · **Versionspost**

## Object Lifecycle — varje objekt kan:
```
Skapas → Valideras → Redigeras → Dupliceras →
Flyttas → Länkas → Arkiveras → Exporteras →
Återställas → Raderas (soft) → Raderas permanent (efter 30 dagar)
```

## Relation-typer (standardiserade)
```
äger          (user äger projekt)
tillhör       (dokument tillhör projekt)
beror_på      (uppgift beror på annan uppgift)
påverkar      (lön påverkar budget)
skapades_av   (AI-konversation skapades av user)
delar         (user delar projekt med annan user)
kopplas_till  (kvitto kopplas till utgift)
ersätter      (ny version ersätter gammal)
```

## AI och objektmodellen
- AI skapar ALDRIG egna objekt utanför objektmodellen
- AI-förslag är alltid ett förslag-objekt med status "pending" tills användaren godkänner
- AI-konversationer sparas som objekt med relationer till berörda objekt
- AI-minne är ett objekt som användaren kan se, redigera och radera

## Sökbarhet — alla objekt ska kunna:
- Sökas globalt (titel, beskrivning, taggar, OCR-text)
- Filtreras (status, typ, datum, ägare, taggar)
- Sorteras (datum, titel, status, favorit)
- Exporteras (individuellt eller i bulk)
- Arkiveras (försvinner från aktiv vy, finns kvar i arkiv)
- Favoritmarkeras (visas överst i listor)


---

# DEL 40 — PRO-GRANSKNING: KRITISKA INSIKTER

## Problem 1: Spec:en beskriver VAD men ofta inte HUR

### Löneuträkning — exakt algoritm saknas
Lovable kommer gissa om vi inte specificerar. Här är den exakta uträkningsordningen:

```
1. Hämta alla pass för perioden
2. För varje pass:
   a. Beräkna arbetstid (sluttid - starttid - raster)
   b. Dela upp tid i OB-intervall (kväll/natt/helg/röd dag)
   c. Multiplicera varje intervall med rätt OB-faktor
   d. Lägg till jourersättning om jour
   e. Lägg till övertid om övertid
3. Summera all tid och alla OB-tillägg
4. Beräkna bruttolön = (timmar × timlön) + OB + jour + övertid
5. Dra av raster (om obetalda)
6. Lägg till semesterersättning (12% om timanställd)
7. Beräkna preliminärskatt (skattetabell)
8. Nettolön = bruttolön - skatt - avdrag

VIKTIGT: Jour lördag→söndag beräknas som:
- Lördag 20:00–24:00 = lördag-OB
- Söndag 00:00–08:00 = söndag-OB (INTE lördag)
- Inga klipp vid midnatt i datumvisning, men OB räknas rätt
```

### Konfliktregler — exakt prioritetsordning
```
Prioritet (högst vinner):
1. Sjuk
2. VAB
3. Semester (godkänd)
4. Jour/Beredskap
5. Planerat arbetspass
6. Ledig

Om konflikt: visa varning, låt användaren välja.
Automatisk resolution ALDRIG.
```

## Problem 2: Supabase-schema är ofullständigt

Utökat schema med alla alpha-tabeller och kritiska index:

```sql
-- Komplett alpha-schema

-- Grundtabeller
CREATE TABLE profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  hourly_rate DECIMAL(10,2),
  tax_column INTEGER DEFAULT 33,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE work_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  employer TEXT,
  workplace TEXT,
  role TEXT,
  hourly_rate DECIMAL(10,2),
  monthly_salary DECIMAL(10,2),
  tax_column INTEGER DEFAULT 33,
  vacation_pay_percent DECIMAL(5,2) DEFAULT 12.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE work_shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  work_profile_id UUID REFERENCES work_profiles(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  crosses_midnight BOOLEAN DEFAULT false,
  end_date DATE, -- för pass över midnatt
  break_minutes INTEGER DEFAULT 0,
  break_paid BOOLEAN DEFAULT false,
  is_on_call BOOLEAN DEFAULT false,  -- jour
  is_standby BOOLEAN DEFAULT false,  -- beredskap
  overtime_minutes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'planned', -- planned/worked/sick/vacation/vab/cancelled
  shift_code TEXT, -- D/K/N/J/B/SEM/LEDIG eller custom
  notes TEXT,
  source TEXT DEFAULT 'manual', -- manual/ocr/import
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE break_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_profile_id UUID REFERENCES work_profiles(id) ON DELETE CASCADE NOT NULL,
  after_hours DECIMAL(4,2) NOT NULL,
  break_minutes INTEGER NOT NULL,
  is_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ob_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_profile_id UUID REFERENCES work_profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- evening/night/weekend/holiday/on_call/standby
  start_time TIME,
  end_time TIME,
  day_of_week INTEGER[], -- 0=sön, 1=mån ... 6=lör
  multiplier DECIMAL(4,2) NOT NULL,
  is_addition BOOLEAN DEFAULT true, -- tillägg (true) eller multiplikator (false)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payslips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  work_profile_id UUID REFERENCES work_profiles(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_salary DECIMAL(10,2),
  net_salary DECIMAL(10,2),
  tax_amount DECIMAL(10,2),
  ob_amount DECIMAL(10,2),
  on_call_amount DECIMAL(10,2),
  vacation_pay DECIMAL(10,2),
  overtime_amount DECIMAL(10,2),
  total_hours DECIMAL(6,2),
  document_id UUID, -- koppling till originaldokument
  ocr_raw TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'SEK',
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT,
  date DATE NOT NULL,
  expense_type TEXT DEFAULT 'expense', -- expense/bill/subscription/debt_payment
  is_recurring BOOLEAN DEFAULT false,
  recurrence_interval TEXT, -- monthly/weekly/yearly
  receipt_id UUID, -- koppling till kvitto-dokument
  project_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE debts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  debt_type TEXT NOT NULL, -- mortgage/personal_loan/csn/credit_card/private/installment
  original_amount DECIMAL(10,2) NOT NULL,
  current_amount DECIMAL(10,2) NOT NULL,
  interest_rate DECIMAL(5,2),
  monthly_payment DECIMAL(10,2),
  minimum_payment DECIMAL(10,2),
  start_date DATE,
  end_date DATE,
  lender TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  document_type TEXT, -- payslip/schema/receipt/contract/warranty/insurance/other
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  ocr_text TEXT,
  ocr_confidence DECIMAL(4,2),
  ocr_status TEXT DEFAULT 'pending', -- pending/processing/completed/failed
  ai_summary TEXT,
  metadata JSONB DEFAULT '{}',
  tags TEXT[],
  expires_at DATE, -- för garantier, försäkringar
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Kritiska index
CREATE INDEX idx_work_shifts_user_date ON work_shifts(user_id, date) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_shifts_profile ON work_shifts(work_profile_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_user_date ON expenses(user_id, date) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_category ON expenses(user_id, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_debts_user ON debts(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_user ON documents(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_type ON documents(user_id, document_type) WHERE deleted_at IS NULL;

-- RLS policies (mall för alla tabeller)
ALTER TABLE work_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see own shifts"
  ON work_shifts FOR ALL
  USING (auth.uid() = user_id);
-- (Samma pattern för alla tabeller)
```

## Problem 3: OB-beräkning för svenska kollektivavtal

De vanligaste OB-tilläggen i Sverige som systemet ska känna till som defaults:

```
Kommunal (KA):
- Kväll 19:00–22:00: +50% (vardagar)
- Natt 22:00–06:00: +70%
- Lördag 06:00–24:00: +70%
- Söndag/helgdag 00:00–24:00: +100%
- Midsommarafton/julafton/nyårsafton: +100%

Handel (HÄS):
- Kväll 18:00–20:00: +16,25 kr/h (fast tillägg)
- Kväll 20:00–21:00: +24,25 kr/h
- Natt 21:00–06:00: +29,25 kr/h
- Lördag 12:00–18:00: +16,25 kr/h
- Lördag 18:00–24:00: +29,25 kr/h
- Söndag: +45% av timlön

Industri (IF Metall):
- Natt 22:00–06:00: +30%
- Lördag: +50%
- Söndag: +70%

Systemet ska ha dessa som valbara presets vid skapande av OB-regler.
Användaren kan alltid anpassa.
```

## Problem 4: Kalender — edge cases som kommer orsaka buggar

```
Svenska helgdagar (hårdkodade i systemet):
- Nyårsdagen: 1 jan
- Trettondedag jul: 6 jan
- Långfredag: rörlig (påsk)
- Påskafton: rörlig
- Påskdagen: rörlig
- Annandag påsk: rörlig
- Valborg: 30 apr (OB men ej röd dag)
- Första maj: 1 maj
- Kristi himmelsfärd: rörlig (39 dagar efter påsk)
- Pingstdagen: rörlig
- Nationaldagen: 6 jun
- Midsommarafton: rörlig fredag
- Midsommardagen: rörlig lördag
- Alla helgons dag: rörlig lördag
- Julafton: 24 dec (OB men ej röd dag)
- Juldagen: 25 dec
- Annandag jul: 26 dec
- Nyårsafton: 31 dec (OB men ej röd dag)

Systemet ska beräkna påsk och alla rörliga helgdagar korrekt
för minst 5 år framåt och 10 år bakåt.
```

## Problem 5: Demo-data är för enkel

Uppdaterat demo-scenario som faktiskt testar alla edge cases:

```
Alex Svensson, 34 år, Sundsvall
Arbetsgivare: Sundsvalls Kommun, LSS-assistent

Arbetsprofil:
- Timlön: 187,50 kr (2024 KA-avtal LSS)
- OB: Kommunal-preset
- Rast: 30 min efter 5h (obetald)
- Semesterersättning: 12%
- Skattekolumn: 33

Senaste månaden (testdata):
- Måndag–fredag dagpass 07:00–15:00 (3 st)
- Kvällspass 15:00–23:00 (2 st, kväll-OB)
- Nattpass 23:00–07:00 (1 st, inkl. söndags-OB)
- Jourpass lördag 20:00 – söndag 08:00 (1 st, testar midnatt)
- En sjukdag (karensavdrag)
- En VAB-dag

Ekonomi:
- Hyra: 7 200 kr/mån (återkommande)
- Mat: 3 800 kr (varierande)
- Bil: 1 200 kr försäkring + 600 kr bensin
- Abonnemang: Spotify 119 kr, Netflix 139 kr, Gym 399 kr
- Skuld: CSN 142 000 kr, 0,19% ränta, 1 600 kr/mån
- Sparmål: "Ny dator" 12 000 kr, 4 500 kr sparade (37%)
- Buffert: 18 000 kr (2,5 månaders lön = under rekommenderat)

Dokument:
- Lönespec mars 2024 (importerad, OCR verifierad)
- Schema april 2024 (importerad, ett pass flaggat som osäkert)
- Hyresavtal (garanti utgår 2026-12-31)
- Hemförsäkring (förnyas 2025-03-01)
```

## Problem 6: Spec nämner aldrig notis-timing

```
Exakta notistriggers för alpha:

OMEDELBART:
- Import klar (OCR klar)
- Synk-fel
- Säkerhetshändelse

SAMMA DAG:
- Pass börjar om 1 timme (kl 07:00 för dagpass)
- Räkning förfaller idag
- Garanti löper ut idag

3 DAGAR INNAN:
- Räkning förfaller
- Garanti löper ut

30 DAGAR INNAN:
- Försäkring förnyas
- Abonnemang förnyas (om belopp > 500 kr/mån)

VECKOVIS (söndag 19:00):
- Veckoöversikt (opt-in)
- Kommande veckas pass

MÅNADSVIS (siste vardagen kl 09:00):
- Månadsöversikt lön och budget
```

## Problem 7: Saknad felmeddelande-standard

Alla felmeddelanden ska följa detta format:

```
✗ [Vad som gick fel]
  [Varför det gick fel, om känt]
  [Vad användaren kan göra]
  [Knapp: Försök igen / Gå tillbaka / Kontakta support]

Exempel:
✗ Kunde inte spara arbetspasset
  Kontrollera din internetanslutning.
  [Försök igen] [Spara lokalt]

✗ OCR kunde inte tolka dokumentet
  Bilden kan vara för suddig eller mörk.
  [Försök med bättre bild] [Ange manuellt]

✗ Inloggningen misslyckades
  E-postadressen eller lösenordet stämmer inte.
  [Försök igen] [Glömt lösenord?]

ALDRIG:
- "Something went wrong"
- "Error 500"
- "Unexpected error occurred"
- Stacktraces
- JSON-felkoder
```

## Problem 8: Spec saknar konkret komponenthierarki

```
Komponenthierarki för alpha (Lovable ska följa denna):

/components
  /ui (atomära komponenter, aldrig ändra)
    Button.tsx
    Input.tsx
    Select.tsx
    DatePicker.tsx
    TimePicker.tsx
    Card.tsx
    Badge.tsx
    Toast.tsx
    Modal.tsx
    Drawer.tsx
    Skeleton.tsx
    EmptyState.tsx
    ErrorState.tsx

  /forms (sammansatta formulär)
    WorkShiftForm.tsx
    WorkProfileForm.tsx
    ExpenseForm.tsx
    DebtForm.tsx
    DocumentUploadForm.tsx

  /features (feature-specifika komponenter)
    /work
      ShiftCard.tsx
      ShiftList.tsx
      WeekView.tsx
      MonthView.tsx
      SalaryCalculator.tsx
    /finance
      ExpenseCard.tsx
      BudgetBar.tsx
      DebtCard.tsx
    /documents
      DocumentCard.tsx
      OCRPreview.tsx

  /layout
    AppShell.tsx
    Header.tsx
    BottomNav.tsx (mobil)
    Sidebar.tsx (desktop)
    PageContainer.tsx
```


---

# DEL 41 — DJUPGRANSKNING: VARDAGSANVÄNDARENS PERSPEKTIV

## Saker som kommer irritera användaren efter 3 månaders daglig användning

### Problem: Appen minns inte var användaren var
```
Scenario: Användaren håller på att fylla i ett arbetspass.
Telefonen ringer. Appen minimeras.
Användaren öppnar appen igen.
Formuläret är tomt.

Lösning (krav):
- Alla formulär sparar state lokalt var 10:e sekund
- Vid återöppning: "Vill du fortsätta där du slutade?"
- State sparas i 24 timmar
- Gäller: arbetspass, utgifter, anteckningar, OCR-granskning
```

### Problem: Sök returnerar för mycket
```
Scenario: Användaren söker "mars" och får 847 träffar.
Löner, pass, utgifter, dokument, anteckningar — allt blandat.

Lösning (krav):
- Sök returnerar max 5 träffar per kategori som default
- Kategorier visas tydligt (Pass / Ekonomi / Dokument / Anteckningar)
- "Visa alla i [kategori]" expanderar
- Senast använda visas först inom varje kategori
```

### Problem: Listan växer och blir oanvändbar
```
Scenario: Efter 2 år har användaren 800+ arbetspass.
Listan laddas, scrollar, är seg.

Lösning (krav):
- Virtuell scrollning (renderar bara synliga objekt)
- Default: visa senaste 30 dagarna
- Arkivera automatiskt pass äldre än 13 månader
- Arkiverade pass fortfarande sökbara och i statistik
- Pagination ALDRIG — alltid infinite scroll eller virtuell lista
```

### Problem: Duplikata kategorier i budget
```
Scenario: Användaren skapar "Mat", sedan "mat", sedan "MAT".
Tre separata kategorier. Statistiken är splittrad.

Lösning (krav):
- Kategorier är case-insensitive (mat = Mat = MAT)
- Vid ny kategori: föreslå befintlig om liknande finns
- Slå ihop kategorier: markera flera → "Slå ihop"
- Kategori-synonymer: "Livsmedel" = "Mat" om användaren anger det
```

### Problem: Appen är för tyst när saker är fel
```
Scenario: Backup misslyckades för 5 dagar sedan.
Användaren vet inte om det.
Synk har haft konflikter som ignorerats.

Lösning (krav):
- Systemhälsa-ikon alltid synlig i header
- Grön = allt OK, Gul = varningar, Röd = kritiska fel
- Tryck på ikon = systemhälso-panel med detaljer
- Kritiska fel (backup, synk, auth) visas som banner tills löst
```

### Problem: OCR-granskning är tidskrävande
```
Scenario: Schema med 20 pass importeras.
Användaren måste granska varje pass ett i taget.

Lösning (krav):
- Bulk-godkänn: "Godkänn alla med confidence > 90%"
- Visa bara osäkra pass för manuell granskning
- Osäkra pass markeras tydligt (gul/röd border)
- Möjlighet att redigera direkt i granskninsyvyn utan att öppna nytt formulär
- "Godkänn alla och korrigera senare" som alternativ
```

## Saknade mikrointeraktioner (viktiga för premium-känslan)

```
Drag-to-reorder:
- Budgetkategorier kan sorteras om med drag
- Favoriter kan sorteras om
- Dashboard-widgets kan sorteras om
- Checklistor kan sorteras om

Pull-to-refresh:
- Fungerar på alla listor
- Visar senast synkad tid när man drar

Swipe-actions (iOS-standard):
- Höger swipe på pass → markera som utfört (grön)
- Vänster swipe på pass → visa alternativ (redigera/kopiera/radera)
- Höger swipe på utgift → kopiera till nästa månad
- Vänster swipe på dokument → arkivera

Contextual loading:
- Visar skeleton för exakt den sektion som laddar
- Resten av sidan är redan interaktiv
- Aldrig hel-sidans spinner

Number formatting:
- 1 500,00 kr (aldrig 1500 kr)
- Negativt: -1 500,00 kr (röd text)
- Stort belopp: 1 500 000 kr (aldrig 1500000)
- Timmar: 7h 30min (aldrig 7.5h eller 450min)
```

## Saknade tillståndsövergångar (state transitions)

```
Arbetspass:
Planerat → Pågående (automatiskt när starttid passeras)
         → Utfört (automatiskt vid sluttid, bekräftas av användaren)
         → Avbokat (manuellt)
         → Sjuk (manuellt, ersätter passet)
         → VAB (manuellt)

Dokument:
Uppladdad → OCR pågår → Granskning krävs → Verifierad → Arkiverad
         → OCR misslyckades → Manuell inmatning krävs

Skuld:
Aktiv → Delvis betald → Betald → Arkiverad

Import:
Väntar → Bearbetar → Granskning krävs → Godkänd → Importerad
       → Misslyckad → Kan försöka igen
```

## Saknade tillgänglighetsdetaljer för mobil

```
iOS-specifikt:
- Dynamic Type: appen ska fungera med alla iOS textstorlekar (xSmall till AX5)
- Bold Text: respektera iOS Bold Text-inställning
- Reduce Motion: inga slideövergångar, bara fade
- Increase Contrast: förstärkt kontrast vid inställning
- Smart Invert: ska fungera utan konstiga artefakter
- VoiceOver: alla element ska ha meningsfulla labels

Android-specifikt:
- TalkBack: semantisk struktur för skärmläsare
- Large Text: text ska flöda om vid stor textstorlek
- High Contrast Text: respektera systeminställning
- Remove Animations: respektera Animator duration scale = 0
```

## Saknade edge cases i löneuträkning

```
Edge case 1: Pass börjar sent på nyårsafton
31 dec 23:00 → 1 jan 07:00
- 31 dec 23:00–24:00: röd dag-OB (nyårsafton)
- 1 jan 00:00–07:00: röd dag-OB (nyårsdagen)
- Ska hanteras korrekt automatiskt

Edge case 2: Midsommarafton är alltid fredag
Men OB-nivå är ofta "röd dag"-nivå
- Systemet ska känna till att midsommarafton = speciell OB
- Inte hårdkodad datum utan beräknad fredag

Edge case 3: Deltidsanställd med varierat schema
Anställd på 75% men jobbar ibland 100%
- Övertid räknas från 75%-gränsen, inte 100%
- Systemet ska stödja "avtalad tid" per profil

Edge case 4: Timanställd utan fast schema
Jobbar olika veckor, ingen fast tjänstgöringsgrad
- Semesterersättning 12% per timme
- Ingen övertidsgräns
- Systemet ska hantera detta som eget anställningsläge

Edge case 5: Lön utbetald i förskott
Sommarjobb: hela sommarlönen utbetalas i juni
- Ska inte räknas som 3 månaders lön i statistiken
- Ska markeras explicit som förskott
```

## Saknade datavalideringsregler

```
Arbetspass:
- Starttid måste vara ett giltigt klockslag
- Sluttid > starttid ELLER crosses_midnight = true
- Datum kan inte vara mer än 1 år framåt
- Datum kan inte vara mer än 10 år bakåt
- Timlön: 0–10 000 kr (varna om utanför rimligt intervall)
- Rast kan inte vara längre än passet

Utgifter:
- Belopp: 0,01–999 999,99 kr
- Datum: inte mer än 5 år bakåt
- Kategori: obligatorisk
- Negativt belopp: tillåtet (återbetalning)

Skulder:
- Ränta: 0–100% (varna om > 30%)
- Startbelopp > 0
- Nuvarande belopp ≤ startbelopp (varna annars)
- Förfallodatum måste vara i framtiden vid skapande

Alla datum:
- Visa alltid tydligt: "Måndag 15 april 2024" inte bara "15/4"
- Acceptera aldrig tvetydiga format som 04/05/24
- Datepicker alltid, aldrig fri textinmatning för datum
```

## Saknade exportformat-specifikationer

```
Löneunderlag (PDF):
Rubrik: "Löneunderlag [Period] — [Namn]"
Innehåll:
  - Sammanfattning (brutto, netto, skatt, OB, timmar)
  - Tabell: alla pass med datum, tid, OB, belopp
  - Jämförelse med lönespec (om importerad)
  - Signatur-rad för arbetsgivare (valfritt)

Skatteunderlag (CSV/PDF):
  - Milersättning per månad
  - Traktamente per resa
  - ROT/RUT-arbeten
  - Ränteutgifter på skulder

Budgetrapport (PDF):
  - Inkomster vs utgifter per kategori
  - Stapeldiagram
  - Trend sista 12 månader
  - Jämförelse mot budget

Backup (JSON):
  - Alla objekt med relationer
  - Versionsnummer
  - Checksumma för verifiering
  - Instruktioner för återställning
```

## Saknade Supabase-specifika säkerhetsregler

```sql
-- Förhindra att användaren ändrar sin egen user_id
CREATE POLICY "Cannot change user_id"
  ON work_shifts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Förhindra soft-deleted records från att visas
-- (lägg till i alla queries automatiskt via view)
CREATE VIEW active_work_shifts AS
  SELECT * FROM work_shifts
  WHERE deleted_at IS NULL;

-- Rate limiting via Supabase Edge Functions
-- Max 100 inserts per minut per användare
-- Max 10 OCR-requests per timme per användare

-- Audit log trigger
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (table_name, operation, old_data, new_data, user_id)
  VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW), auth.uid());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Saknade React-specifika regler för Lovable

```typescript
// Fel-boundary på varje feature (aldrig hela appen kraschar)
// Varje feature-komponent ska wrappas i ErrorBoundary

// Aldrig useEffect för data-fetching — använd React Query / SWR
// Aldrig prop-drilling djupare än 2 nivåer — använd Context eller Zustand

// Alla datum hanteras som UTC internt, konverteras till lokal tid i UI
// Aldrig new Date() utan timezone — använd date-fns med locale

// Formulär: använd react-hook-form + zod för validering
// Aldrig kontrollerade inputs utan react-hook-form

// Bilder: alltid lazy loading + WebP-format
// Aldrig <img> utan width och height (layout shift)

// Alla listor: alltid virtualiserade om > 100 element
// Använd @tanstack/react-virtual

// Animationer: alltid CSS transitions, aldrig JS-animationer
// Undantag: komplexa animationer med Framer Motion

// Internationalisering: alla strings i i18n-fil från dag 1
// Aldrig hårdkodade svenska strings i komponenter
```


---

# DEL 42 — QA-GRANSKNING: SAKER SOM KRASCHAR I VERKLIGHETEN

## Sommartid (DST) — kritisk bugg-källa

```
Problem: Sverige byter sommartid 2 gånger per år.
Natten 30 mars 02:00 → hoppar till 03:00 (klockan finns inte)
Natten 26 oktober 03:00 → går tillbaka till 02:00 (klockan finns dubbelt)

Konsekvens för arbetspass:
- Nattpass 22:00–07:00 på DST-natten = 8h (inte 9h)
- Nattpass 22:00–07:00 vid återgång = 10h (inte 9h)

Krav:
- Alla tider lagras som UTC i databasen, ALDRIG lokal tid
- All visning konverteras till Europe/Stockholm
- OB-beräkning baseras på UTC, konverteras korrekt
- Visa aldrig "02:30" utan att specificera om det är CEST eller CET
- Använd date-fns-tz eller Temporal API, aldrig new Date()
```

## Race conditions — dubbla submits

```
Problem: Användaren trycker "Spara" två gånger snabbt.
Resultat: Två identiska arbetspass skapas.

Krav för alla formulär:
1. Knappen disablas omedelbart vid första klick
2. Visa laddningsindikator
3. Idempotency key skickas med varje request
   (UUID genererad på klienten vid formuläröppning)
4. Server kontrollerar: om samma idempotency key finns → returnera befintligt svar
5. Knappen aktiveras igen om request misslyckas

SQL-implementering:
ALTER TABLE work_shifts ADD COLUMN idempotency_key UUID UNIQUE;
-- Om insert misslyckas pga duplicate key → returnera befintlig rad
```

## Filuppladdning — regler som saknas

```
Filstorlekar:
- Bild (kvitto, schema): max 10 MB
- PDF (lönespec, dokument): max 25 MB
- Backup-fil: max 500 MB
- Videofil: INTE STÖDD i alpha

Accepterade format:
- Bilder: JPEG, PNG, HEIC (iOS), WebP
- Dokument: PDF
- Import: CSV, JSON, ICS

Vid uppladdning:
1. Kontrollera filtyp (mime-type, INTE bara filändelse)
2. Kontrollera filstorlek INNAN uppladdning startar
3. Komprimera bilder till max 2048px längsta sida (behåll proportioner)
4. Konvertera HEIC → JPEG automatiskt
5. Generera thumbnail (200x200px) för förhandsgranskning
6. Spara original + thumbnail i Supabase Storage
7. Visa uppladdningsProgress (0-100%)
8. Tillåt avbryta pågående uppladdning

Supabase Storage-struktur:
{user_id}/documents/{year}/{month}/{document_id}_original.{ext}
{user_id}/documents/{year}/{month}/{document_id}_thumb.jpg
{user_id}/backups/{backup_id}.json.gz
```

## iOS-specifika permissions som saknas

```
Appen måste hantera alla permissionsstatus:

Kamera (för OCR-scanning):
- Ej tillfrågad → Fråga med förklaring: "För att scanna dokument direkt med kameran"
- Nekad → Visa: "Gå till Inställningar → Privacy → Kamera → My Money Master"
- Beviljad → Öppna kamera direkt

Fotobibliotek:
- Ej tillfrågad → Fråga: "För att importera schema-bilder från Foton"
- Begränsad → Visa bildväljare för specifika bilder
- Nekad → Visa alternativ: "Dela från Foton-appen istället"

Notiser:
- Ej tillfrågad → Fråga EFTER onboarding, inte vid start
- Nekad → Påminn max 1 gång i appen, visa vad som missas
- Beviljad → Registrera för FCM/APNS

Mikrofon (för röstanteckningar):
- Fråga vid första röstanteckning, inte vid start

FaceID/TouchID:
- Fråga vid inställning av biometri, inte vid start

Alla permissions:
- Förklara ALLTID varför INNAN systemdialogen visas
- Ha alltid en fallback om permission nekas
- Fråga aldrig om samma permission mer än 2 gånger
```

## Supabase Realtime — när och hur

```
Använd Supabase Realtime BARA för:
- Synkstatus-indikator (visa om annan enhet synkar)
- Familjedela-notiser (om implementerat)
- OCR-status (uppdatera UI när OCR är klar på server)

Använd INTE Realtime för:
- Vanlig datahämtning (använd React Query med polling)
- Dashboard-uppdateringar (för dyrt i battery/network)

Realtime-prenumeration:
- Prenumerera vid app-start
- Avprenumerera vid app-minimering
- Återprenumerera vid app-återöppning
- Hantera reconnect automatiskt med exponential backoff
```

## Debounce och throttle — specifika regler

```
Sök-input: debounce 300ms (börja söka 300ms efter senaste tangentryckning)
Autospara formulär: debounce 10 sekunder
API-anrop vid scrollning: throttle 100ms
Swipe-gester: throttle 16ms (60fps)
Knapp-klick: debounce 500ms (förhindra dubbelklick)
Resize-event: debounce 250ms
```

## Print CSS — saknades helt

```css
/* Alla sidor ska ha print-styles */
@media print {
  /* Dölj navigation, knappar, sidofält */
  nav, .sidebar, .bottom-nav, .action-buttons,
  .ai-panel, .search-bar { display: none !important; }

  /* Visa dold print-information */
  .print-only { display: block !important; }

  /* Sidhuvud och sidfot på varje sida */
  @page {
    margin: 20mm;
    @top-center { content: "My Money Master — " attr(data-title); }
    @bottom-right { content: "Sida " counter(page) " av " counter(pages); }
  }

  /* Undvik sidbrytning mitt i kort */
  .card { page-break-inside: avoid; }

  /* Svart text på vit bakgrund alltid vid utskrift */
  * { color: black !important; background: white !important; }

  /* Visa URL för länkar */
  a[href]:after { content: " (" attr(href) ")"; font-size: 10px; }
}

/* Specifika print-layouts:
   - Löneunderlag: A4 stående, tabell med pass
   - Schema: A4 liggande, veckokalender
   - Budgetrapport: A4 stående, stapeldiagram
*/
```

## GDPR & Cookie-compliance — saknades

```
Krav (EU-lag):
1. Ingen analytics-tracking utan samtycke
2. Inga tredjepartscookies utan samtycke
3. Session-cookies (tekniskt nödvändiga) kräver INTE samtycke
4. Samtycke ska vara aktivt (opt-in), aldrig förvalt
5. Användaren kan dra tillbaka samtycke när som helst

Vad appen får göra utan samtycke:
- Supabase auth-cookies (tekniskt nödvändiga)
- Lokal lagring för app-funktion
- Anonymiserad crash-reporting (Sentry utan persondata)

Vad kräver samtycke:
- Produktanalys (PostHog, Mixpanel, Amplitude)
- AI-modellförbättring baserad på användardata
- Delade anonymiserade OB-statistiker

GDPR-export (krav vid begäran):
- Svar inom 30 dagar
- Innehåll: all persondata, alla objekt, alla loggar
- Format: JSON (maskinläsbart) + PDF (mänskligt läsbart)
- Kostnad: gratis för användaren
```

## Error Tracking — saknas helt

```
Sentry-integration (eller liknande):
- Fånga alla JavaScript-errors automatiskt
- Fånga alla API-errors
- Fånga alla React render-errors (ErrorBoundary)
- ALDRIG skicka persondata till Sentry
- Scrubba: email, namn, lönedata, kontonummer

Vad som ska loggas:
- Error type och message
- Stack trace
- App version
- OS och version
- Anonymt session-ID (inte user_id)
- Route/sida där felet uppstod
- Timestamps

Vad som ALDRIG ska loggas:
- User ID
- Email
- Lönedata
- Ekonomidata
- Dokumentinnehåll
- OCR-text
```

## Feature Flags — konkret implementation

```javascript
// Feature flags i Supabase (eller lokal config)
const FEATURES = {
  // Alpha: alltid på
  WORK_SHIFTS: true,
  OCR_IMPORT: true,
  BASIC_FINANCE: true,

  // Beta: kan slås på per användare
  AI_COPILOT: false,
  AUTOMATION_ENGINE: false,
  FAMILY_SHARING: false,

  // Coming soon: alltid av
  BANK_INTEGRATION: false,
  HEALTH_MODULE: false,
  TRAVEL_MODULE: false,
}

// Regel: Om feature flag är false:
// 1. Visa INTE knappen / menyn / sidan
// 2. Om djuplänk når inaktiv feature → redirect till dashboard
// 3. Logga att användaren försökte nå inaktiv feature
// 4. ALDRIG visa "Coming soon" på en klickbar knapp
```

## Saknade typsnitt och ikoner — konkret spec

```
Typsnitt:
Primary: Inter (gratis, Google Fonts, GDPR-ok om självhostad)
Monospace: JetBrains Mono (för siffror, tider, belopp)
Fallback: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif

Varför Inter:
- Extremt läsbar på skärm
- Siffror med fast bredd (tabular-nums) inbyggt
- Stöder svenska tecken (å, ä, ö)
- Gratis och open source

Laddning:
- Ladda bara använda vikter (Regular 400, Medium 500, SemiBold 600, Bold 700)
- Använd font-display: swap
- Subset till latin+latin-ext (sparar 60% filstorlek)

Ikonbibliotek: Lucide (samma som Lovable använder som default)
- Konsekvent stroke-width: 1.5px
- Standard storlek: 20px (inline), 24px (standalone)
- Aldrig blanda med andra ikonbibliotek
```

## Saknade keyboard shortcuts — komplett lista

```
Global (fungerar överallt):
Cmd/Ctrl + K    → Command Palette
Cmd/Ctrl + /    → Global sök
Cmd/Ctrl + ,    → Inställningar
Cmd/Ctrl + Z    → Ångra
Cmd/Ctrl + Y    → Gör om
Escape          → Stäng modal/drawer
? (frågetecken) → Visa shortcuts

Navigation (desktop sidebar):
1               → Dashboard
2               → Kalender
3               → Arbete & Lön
4               → Ekonomi
5               → Dokument
6               → Hälsa (om aktiverad)
7               → Projekt
G sedan D       → Gå till Dashboard (vim-stil alternativ)

I aktiva listor:
N               → Ny (nytt pass, ny utgift, etc.)
E               → Redigera markerat
D               → Radera markerat (med bekräftelse)
Space           → Markera/avmarkera
Shift + Space   → Markera range
Cmd + A         → Markera alla

I formulär:
Cmd/Ctrl + S    → Spara
Cmd/Ctrl + Enter → Spara och stäng
Escape          → Avbryt (fråga om osparade ändringar)
Tab             → Nästa fält
Shift + Tab     → Föregående fält
```

## Saknade animationstider — exakt spec

```css
/* Alla transitions i appen ska följa detta */
:root {
  --duration-instant:  0ms;   /* Inga visuella states */
  --duration-fast:     100ms; /* Hover states, focus */
  --duration-normal:   200ms; /* Button clicks, toggles */
  --duration-moderate: 300ms; /* Modaler, drawers öppnar */
  --duration-slow:     500ms; /* Sidbyten, onboarding-steps */
  --duration-extra:    800ms; /* Välkomsanimationer, celebrations */

  --ease-default:      cubic-bezier(0.4, 0, 0.2, 1);  /* Material standard */
  --ease-in:           cubic-bezier(0.4, 0, 1, 1);     /* Objekt lämnar */
  --ease-out:          cubic-bezier(0, 0, 0.2, 1);     /* Objekt anländer */
  --ease-spring:       cubic-bezier(0.34, 1.56, 0.64, 1); /* Sviktande känsla */
}

/* Reducerad rörelse — MÅSTE respekteras */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Saknade state management-regler

```typescript
// Zustand store-struktur för alpha
// En store per feature-domän, INTE en global store

// work-store.ts
interface WorkStore {
  // State
  shifts: WorkShift[]
  profiles: WorkProfile[]
  selectedProfileId: string | null
  isLoading: boolean
  error: string | null

  // Actions
  addShift: (shift: Omit<WorkShift, 'id'>) => Promise<void>
  updateShift: (id: string, data: Partial<WorkShift>) => Promise<void>
  deleteShift: (id: string) => Promise<void>
  setSelectedProfile: (id: string) => void
  syncWithServer: () => Promise<void>
}

// Regler:
// 1. Server state i React Query, UI state i Zustand
// 2. Aldrig duplicera server state i Zustand
// 3. Optimistiska uppdateringar: uppdatera Zustand direkt, rollback vid fel
// 4. Offline queue: lägg till/ändra/radera i kö om offline
// 5. En store per domain: workStore, financeStore, documentStore
// 6. Stores kommunicerar INTE direkt — via events/callbacks
```

## Saknade laddningstillstånd — fullständig spec

```
Varje datafetch ska ha exakt 4 tillstånd:

1. IDLE (ej startat):
   - Visa ingenting extra
   - Används sällan

2. LOADING (laddar för första gången):
   - Visa skeleton loader
   - Skeleton ska ha SAMMA layout som faktiskt innehåll
   - Skeleton animeras med shimmer-effekt
   - Visa aldrig tom sida

3. REFRESHING (uppdaterar befintlig data):
   - Visa befintlig data
   - Visa diskret spinner i hörnet ELLER pull-to-refresh-indikator
   - ALDRIG byta ut befintlig data med skeleton

4. ERROR:
   - Visa befintlig data (om finns)
   - Visa felmeddelande med retry-knapp
   - Logga till Sentry
   - Om ingen befintlig data: visa error state med retry

Skeleton-regler:
- Samma antal rader som faktisk data (estimerat)
- Animeras: shimmer vänster → höger, 1.5s loop
- Färg: --skeleton-base och --skeleton-highlight i design tokens
- Aldrig pulsera (känns billigt)
```

## Saknad cache-strategi

```
React Query cache-inställningar per datatyp:

Arbetspass (ändras ofta):
  staleTime: 30 sekunder
  cacheTime: 5 minuter
  refetchOnWindowFocus: true

Arbetsprofiler (ändras sällan):
  staleTime: 5 minuter
  cacheTime: 30 minuter
  refetchOnWindowFocus: false

Dokument-lista (ändras ibland):
  staleTime: 1 minut
  cacheTime: 10 minuter

OB-regler (ändras mycket sällan):
  staleTime: 10 minuter
  cacheTime: 60 minuter

Svenska helgdagar (aldrig):
  staleTime: Infinity (hårdkodade)
  cacheTime: Infinity

Offline-cache:
  - All data sparas i IndexedDB via @tanstack/query-persist-client
  - Max 50 MB offline-cache
  - Rensas automatiskt vid logout
  - Prioritet: senaste 90 dagars data
```


---

# DEL 43 — KOMPLETT TEKNISK DATAMODELL

## Utökade standardfält — alla användartabeller
```sql
-- Utöver tidigare spec, lägg till:
version        INTEGER DEFAULT 1 NOT NULL  -- konflikthantering
sync_status    TEXT DEFAULT 'synced'       -- synced/pending/conflict/error
source_type    TEXT DEFAULT 'manual'       -- manual/ocr/import/integration/automation
source_id      UUID                        -- referens till importkälla
metadata       JSONB DEFAULT '{}'          -- SEKUNDÄR flexibel data
                                           -- ALDRIG kärnfält i JSONB
```

## Komplett tabellgrupper

### Identity
```
profiles, user_settings, devices, sessions,
trusted_devices, permissions, consent_records
```

### Work
```
employers, workplaces, employment_profiles,
pay_profiles, work_shifts, shift_breaks,
leave_entries, pay_rules, holiday_rules
```

### Payroll
```
payslips, payslip_lines, calculated_pay,
payroll_reconciliations, manual_adjustments
```

### Finance
```
accounts, transactions, categories, budgets,
budget_lines, debts, debt_payments,
savings_goals, bills, subscriptions, assets
```

### Documents
```
documents, document_versions, document_relations,
ocr_jobs, ocr_results, ocr_fields, verification_actions
```

### Projects
```
projects, tasks, subtasks, milestones,
dependencies, checklists, project_resources, project_budgets
```

### Calendar
```
calendars, calendar_events, recurrence_rules,
reminders, event_relations
```

### Security
```
audit_logs, access_logs, consent_records,
export_jobs, backup_jobs, recovery_events
```

### System
```
notifications, automation_rules, automation_runs,
sync_queue, import_jobs, background_jobs, feature_flags
```

## Pay Rules — löneregler som data (inte hårdkodad logik)

```sql
CREATE TABLE pay_rules (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users NOT NULL,
  pay_profile_id    UUID REFERENCES pay_profiles NOT NULL,
  employer_id       UUID REFERENCES employers,
  rule_type         TEXT NOT NULL,
  -- Typer: base_hourly/base_monthly/ob/overtime/additional_hours/
  --        on_call/standby/night/weekend/holiday/vacation_pay/deduction/custom
  name              TEXT NOT NULL,
  valid_from        DATE NOT NULL,
  valid_to          DATE,
  weekday_conditions INTEGER[],  -- 0=sön, 1=mån ... 6=lör
  time_start        TIME,
  time_end          TIME,
  holiday_type      TEXT,        -- red_day/eve/special
  rate_type         TEXT NOT NULL, -- multiplier/fixed_addition/fixed_amount
  fixed_amount      DECIMAL(10,2),
  multiplier        DECIMAL(5,3),
  priority          INTEGER DEFAULT 10,
  stacking_allowed  BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
-- Beräkningen ska kunna visa EXAKT vilka regler som applicerades
-- Aldrig en svart låda
```

## Shift Breaks — raster som separata rader

```sql
CREATE TABLE shift_breaks (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id            UUID REFERENCES work_shifts(id) ON DELETE CASCADE NOT NULL,
  user_id             UUID REFERENCES auth.users NOT NULL,
  start_at            TIMESTAMPTZ NOT NULL,
  end_at              TIMESTAMPTZ NOT NULL,
  is_paid             BOOLEAN DEFAULT false,
  break_type          TEXT DEFAULT 'rest',  -- rest/meal/mandatory
  manually_adjusted   BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
-- KRITISKT: Pass över midnatt lagras som ETT pass
-- Kalendervyer visualiserar det över flera dagar
-- Databasen delar ALDRIG upp originalpasset automatiskt
```

## OCR Fields — per fält, inte per dokument

```sql
CREATE TABLE ocr_fields (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ocr_job_id          UUID REFERENCES ocr_jobs(id) NOT NULL,
  user_id             UUID REFERENCES auth.users NOT NULL,
  field_name          TEXT NOT NULL,
  raw_value           TEXT,              -- exakt vad OCR läste
  normalized_value    TEXT,              -- tolkad version
  confidence          DECIMAL(4,3),      -- 0.000–1.000
  bounding_box        JSONB,             -- koordinater på originaldokumentet
  is_verified         BOOLEAN DEFAULT false,
  corrected_value     TEXT,              -- om användaren korrigerade
  corrected_by        UUID,
  correction_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
-- Originalfilen får ALDRIG skrivas över av OCR-resultatet
-- OCR-resultatet är alltid en kopia
```

## Generic Relations — polymorfa kopplingar

```sql
CREATE TABLE object_relations (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users NOT NULL,
  source_type         TEXT NOT NULL,  -- 'work_shift', 'document', etc.
  source_id           UUID NOT NULL,
  target_type         TEXT NOT NULL,
  target_id           UUID NOT NULL,
  relation_type       TEXT NOT NULL,
  -- Typer: contains/references/caused_by/replaces/
  --        verifies/belongs_to/tagged_with/created_from
  confidence          DECIMAL(4,3) DEFAULT 1.0,
  is_verified         BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  created_by          UUID,
  UNIQUE(source_type, source_id, target_type, target_id, relation_type)
);
-- Tillåtna kombinationer ska dokumenteras explicit
-- Polymorfa relationer används försiktigt
```

## Permission Model — AI-behörighet separat

```sql
-- Att användaren FÅR läsa ett dokument
-- betyder INTE att AI får läsa det
CREATE TABLE ai_permissions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users NOT NULL,
  object_type     TEXT NOT NULL,
  object_id       UUID,             -- NULL = gäller alla av typen
  ai_can_read     BOOLEAN DEFAULT false,
  ai_can_analyze  BOOLEAN DEFAULT false,
  ai_can_write    BOOLEAN DEFAULT false,
  granted_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ
);
-- Default: AI har INGA behörigheter
-- Användaren måste explicit bevilja
```

## Conflict Resolution — inte "sista vinner"

```
Konfliktstrategi per datatyp:

Arbetspass, Lön, Ekonomi:
→ Kräver användarval — aldrig automatisk merge
→ Visa: "Denna enhet" vs "Annan enhet" med tidsstämplar
→ Alternativ: Behåll båda som konflikt-kopia

Anteckningar, checklistor:
→ Fältvis merge om möjligt
→ Om konflikt: duplicera som konflikt-kopia

Inställningar:
→ Serverversion vinner (säkraste)

OCR-verifieringar:
→ Aldrig automatisk resolution
→ Kräver alltid manuell granskning

Regel: Ingen konflikt får tyst skriva över viktig data.
Visa alltid vad som skiljer sig och låt användaren välja.
```

## Background Jobs — fullständigt schema

```sql
CREATE TABLE background_jobs (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users NOT NULL,
  job_type          TEXT NOT NULL,
  -- Typer: ocr/import/export/backup/index/report/sync/file_process
  priority          INTEGER DEFAULT 5,  -- 1=kritisk, 10=låg
  status            TEXT DEFAULT 'queued',
  -- Status: queued/running/paused/completed/failed/cancelled
  progress          INTEGER DEFAULT 0,  -- 0-100
  retry_count       INTEGER DEFAULT 0,
  max_attempts      INTEGER DEFAULT 3,
  retry_after       TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  last_error        TEXT,
  cancellation_state TEXT,             -- requested/confirmed
  result_summary    JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
-- Användaren SKA kunna se status på långvariga jobb
-- OCR-progress visas i realtid via Supabase Realtime
```

## Offline Sync Queue — komplett struktur

```sql
CREATE TABLE sync_queue (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users NOT NULL,
  local_id        UUID NOT NULL,      -- lokal referens
  server_id       UUID,               -- sätts vid synk
  table_name      TEXT NOT NULL,
  operation       TEXT NOT NULL,      -- create/update/delete/upload/relate
  payload         JSONB NOT NULL,
  version         INTEGER NOT NULL,
  changed_at      TIMESTAMPTZ NOT NULL,
  sync_state      TEXT DEFAULT 'pending', -- pending/syncing/synced/conflict/error
  retry_count     INTEGER DEFAULT 0,
  last_error      TEXT,
  idempotency_key UUID DEFAULT gen_random_uuid()
);
-- Användaren SKA kunna se väntande synkningar
-- Visa: "3 ändringar väntar på synk"
```

## Eventkatalog — komplett lista

```
Core events som Event Bus hanterar:

WORK:
shift.created / shift.updated / shift.deleted
shift.verified / shift.conflict_detected
payslip.imported / payslip.reconciled / payslip.mismatch_found
leave.requested / leave.approved

FINANCE:
transaction.created / transaction.categorized
budget.threshold_reached / budget.exceeded
debt.payment_registered / debt.payoff_approaching
savings_goal.milestone_reached / savings_goal.completed

DOCUMENTS:
document.uploaded / document.ocr_started
document.ocr_completed / document.ocr_failed
document.verified / document.review_required
document.expiring_soon / document.expired

SYSTEM:
backup.started / backup.completed / backup.failed
sync.started / sync.completed / sync.conflict
import.completed / import.rollback
export.completed
permission.changed / ai_permission.granted / ai_permission.revoked
auth.login / auth.logout / auth.suspicious_activity

Events bär references, ALDRIG fullständiga privata objekt.
```

## Observability — vad som mäts

```
API-latens (p50, p95, p99 per endpoint)
Databaslatens (långsamma queries > 200ms loggas)
Felprocent per endpoint
Synkkonflikter per användare
Misslyckade bakgrundsjobb
OCR-bearbetningstid
Backupresultat (lyckad/misslyckad)
Lagringsanvändning per användare
Antal dubbletter stoppade av idempotency
Migrationsstatus

ALDRIG logga:
- Lösenord eller tokens
- Dokumentinnehåll
- Lönedata i klartext
- Fullständiga AI-prompter med persondata
- OCR-text från känsliga dokument
```

## Tekniska acceptanskriterier — datagrunden godkänd när:

```
1.  Alla kärntabeller har RLS aktiverat
2.  Kärnflöden använder databastransaktioner
3.  Pass över midnatt lagras som ett enda pass
4.  Löner beräknas från versionerade pay_rules (inte hårdkodad logik)
5.  OCR-fält kan verifieras individuellt med confidence per fält
6.  Alla viktiga objekt har versionshistorik
7.  Offlineändringar kan synkas utan databortfall
8.  Konflikter visas för användaren, aldrig tyst överskrivning
9.  Export innehåller fullständig data med relationer
10. Backup kan faktiskt återställas (testad, inte bara skapad)
11. AI kan stängas av utan datamodelländring
12. Inga service-role-nycklar exponeras i klientkod
13. Databasmigrationer har dokumenterad rollback
14. Dubblettimport stoppas av idempotency_key
15. Kritiska handlingar finns i audit_logs
```

## Migrationsstrategi — destructive changes i 6 steg

```
1. Lägg till ny struktur (kolumn/tabell)
2. Migrera data till ny struktur
3. Verifiera att data är korrekt
4. Byt läsning till ny struktur
5. Byt skrivning till ny struktur
6. Ta bort gammal struktur FÖRST EFTER godkännande

Varje migration dokumenterar:
- Syfte
- Påverkat schema
- Bakåtkompatibilitet
- Datamigrering
- Test
- Rollback
- Uppskattad körtid
- Risknivå (låg/medel/hög/kritisk)

Migrationer testas mot kopia av realistisk data
INNAN de körs mot produktion.
```


---

# DEL 44 — DESIGN SYSTEM: KOMPLETT SPEC

## Utökad spacing scale
```css
/* Lägg till dessa som saknades i ursprunglig spec */
:root {
  --space-0:   0px;
  --space-1:   4px;
  --space-2:   8px;
  --space-3:   12px;
  --space-4:   16px;
  --space-5:   20px;   /* NYT */
  --space-6:   24px;
  --space-8:   32px;
  --space-10:  40px;   /* NYT */
  --space-12:  48px;
  --space-16:  64px;
  --space-24:  96px;   /* NYT — för hero-sektioner */
}
/* Inga godtyckliga marginaler — använd alltid tokens */
```

## Komponenter som saknades i komponentlistan

**Nya komponenter att lägga till i biblioteket:**
- **Bottom Sheet** — mobil-drawer underifrån med snap-points
- **Segmented Control** — flikväxlare (Dag/Vecka/Månad)
- **Chips** — taggar, filterknappar, valda alternativ
- **Avatars** — användarbild med initialer som fallback
- **Accordion** — expanderbar sektion (FAQ, inställningar)
- **Context Menu** — högerklick/långtryck-meny
- **OCR Preview** — specifik komponent för dokumentgranskning
- **AI Card** — specifik komponent för AI-insikter och förslag
- **Offline State** — specifik komponent för offline-läge
- **Ripple Effect** — tryckvåg vid tap (Material-stil, subtil)

## Widget System — utökade regler
Widgets ska kunna:
- Flyttas (drag & drop)
- Storleksändras (small/medium/large/full-width)
- Döljas utan att raderas
- Favoritmarkeras (visas alltid överst)
- Dupliceras (visa samma data på två ställen)
- Grupperas (lägg widgets i grupper med rubrik)
- Snabbkonfigureras (inställningsikon på hover)

## Ljud — valfritt system
```
Ljud ska vara HELT AV som default.
Användaren aktiverar explicit under Inställningar → Utseende → Ljud.

Om aktiverat:
- Spara: diskret "click" (system-ljud, inte custom)
- Radera: diskret "whoosh"
- Notis: systemets standard-notisljud
- Framgång (sparmål nått etc.): diskret "chime"

Aldrig:
- Ljud vid varje knapptryckning
- Annoying or repetitive sounds
- Ljud som inte kan stängas av
```

## Density — informationstäthet
```
Tre lägen (under Inställningar → Utseende → Täthet):

Kompakt:
- Mindre padding i listor (8px vertikal)
- Mindre typsnittsstorlek (13px body)
- Fler rader synliga
- För: avancerade användare, desktop, stora datamängder

Normal (default):
- Standard padding (16px vertikal)
- Standard typsnitt (15px body)

Luftig:
- Mer padding (24px vertikal)
- Större typsnitt (16px body)
- Färre rader synliga
- För: nybörjare, tillgänglighet, presentation
```

## Design QA Checklist — per ny skärm
```
□ Använder spacing tokens (inte magic numbers)?
□ Färger från design tokens (inte hex-koder direkt)?
□ Typografi från typografisk skala?
□ Komponenter från komponentbiblioteket?
□ Animationer följer duration/easing-spec?
□ Tillgänglighet: kontrast, tryckytor, labels?
□ Mobil: fungerar enhandsläge?
□ Desktop: hover states implementerade?
□ Empty state definierad?
□ Error state definierad?
□ Loading state (skeleton) definierad?
□ Offline state definierad?
□ Dark mode testad?
□ Large text (Dynamic Type) testad?
□ Prefers-reduced-motion testad?
```

## Konkreta färgroller med CSS-variabler
```css
:root {
  /* Bakgrunder */
  --color-bg-primary:    #0A0A0B;  /* Mörkaste bakgrund */
  --color-bg-secondary:  #111113;  /* Kort, paneler */
  --color-bg-tertiary:   #1A1A1E;  /* Hover, aktiva states */

  /* Ytor */
  --color-surface-1:     #16161A;  /* Kort-bakgrund */
  --color-surface-2:     #1E1E24;  /* Nestad yta */

  /* Borders */
  --color-border:        rgba(255,255,255,0.08);
  --color-border-strong: rgba(255,255,255,0.16);

  /* Text */
  --color-text-primary:  rgba(255,255,255,0.92);
  --color-text-secondary:rgba(255,255,255,0.60);
  --color-text-tertiary: rgba(255,255,255,0.35);
  --color-text-disabled: rgba(255,255,255,0.20);

  /* Accent (blå som primary) */
  --color-accent:        #3B82F6;  /* Primär action */
  --color-accent-hover:  #2563EB;
  --color-accent-subtle: rgba(59,130,246,0.12);

  /* Semantiska färger */
  --color-success:       #22C55E;
  --color-success-subtle:rgba(34,197,94,0.12);
  --color-warning:       #F59E0B;
  --color-warning-subtle:rgba(245,158,11,0.12);
  --color-error:         #EF4444;
  --color-error-subtle:  rgba(239,68,68,0.12);
  --color-info:          #06B6D4;
  --color-info-subtle:   rgba(6,182,212,0.12);

  /* Skeleton */
  --color-skeleton-base: rgba(255,255,255,0.06);
  --color-skeleton-shine:rgba(255,255,255,0.12);
}

/* Light mode override */
[data-theme="light"] {
  --color-bg-primary:    #F8F9FA;
  --color-bg-secondary:  #FFFFFF;
  --color-surface-1:     #FFFFFF;
  --color-border:        rgba(0,0,0,0.08);
  --color-text-primary:  rgba(0,0,0,0.90);
  --color-text-secondary:rgba(0,0,0,0.55);
  /* etc. */
}
```

## Bottom Sheet — spec
```
Snap points: 25% / 50% / 90% av skärmhöjd
Dismiss: swipe ned eller tryck utanför
Backdrop: mörk overlay 40% opacity
Handle: liten horisontell linje överst
Animering: spring easing, 300ms

Används för:
- Filterval i mobilvy
- Snabbregistrering (ny utgift, nytt pass)
- Bekräftelsedialoger på mobil
- OCR-granskning av enskilt fält
- Kontextmeny med många alternativ

ALDRIG för:
- Lång scrollbar information (använd full modal istället)
- Innehåll som kräver tangentbord (tangentbordet trycker upp sheet)
```

## Typografisk skala — exakt
```css
/* Alla typsnittsdefinitioner */
.text-display-lg  { font-size: 48px; font-weight: 700; line-height: 1.1; }
.text-display-md  { font-size: 36px; font-weight: 700; line-height: 1.15; }
.text-heading-lg  { font-size: 28px; font-weight: 600; line-height: 1.2; }
.text-heading-md  { font-size: 22px; font-weight: 600; line-height: 1.25; }
.text-heading-sm  { font-size: 18px; font-weight: 600; line-height: 1.3; }
.text-body-lg     { font-size: 16px; font-weight: 400; line-height: 1.6; }
.text-body-md     { font-size: 15px; font-weight: 400; line-height: 1.6; }
.text-body-sm     { font-size: 13px; font-weight: 400; line-height: 1.5; }
.text-label-lg    { font-size: 14px; font-weight: 500; line-height: 1.4; }
.text-label-md    { font-size: 12px; font-weight: 500; line-height: 1.4; letter-spacing: 0.02em; }
.text-label-sm    { font-size: 11px; font-weight: 500; line-height: 1.4; letter-spacing: 0.04em; }
.text-caption     { font-size: 11px; font-weight: 400; line-height: 1.4; }
.text-mono        { font-family: 'JetBrains Mono'; font-size: 14px; }

/* Siffror ska alltid vara tabular (fast bredd) */
.text-number      { font-variant-numeric: tabular-nums; }
/* Använd på: belopp, timmar, datum, procent */
```


---

# DEL 45 — MICRO UX & POLISH

## Input Experience — konkreta regler

```
Rätt tangentbord per fälttyp (mobil):
- Belopp (kr):     type="decimal"    → numeriskt med decimaltecken
- Timmar:          type="decimal"    → numeriskt
- Procent:         type="decimal"    → numeriskt
- Heltal (antal):  type="number"     → numeriskt utan decimaler
- Telefon:         type="tel"        → telefontangentbord
- E-post:          type="email"      → e-posttangentbord
- URL:             type="url"        → URL-tangentbord
- Sök:             type="search"     → sök-tangentbord med sök-knapp
- Datum:           type="date"       → native datepicker (aldrig text)
- Tid:             type="time"       → native timepicker (aldrig text)
- Text:            type="text"       → standard

Clipboard-detektering:
- Om användaren klistrar in ett belopp → strippa "kr", "SEK", mellanslag
- Om klistrat innehåll ser ut som ett datum → fråga om konvertering
- Om klistrat innehåll är ett personnummer → varna om känslig data

Automatisk formattering:
- Belopp: formateras till "1 500,00" direkt vid inmatning
- Personnummer: formateras till "YYYYMMDD-XXXX" automatiskt
- Bankkontonummer: formateras med bindestreck
- Telefon: formateras "+46 70 123 45 67"
```

## Camera Experience — detaljer som saknades

```
Auto-beskärning:
- Identifiera dokumentkanter automatiskt
- Visa gula guidelinjer runt detekterat dokument
- Trycka på "Skanna" → automatisk beskärning
- Alltid möjlighet att justera manuellt

Perspektivkorrigering:
- Rätta till om dokumentet är sett från vinkel
- Visa "before/after" preview
- Användaren godkänner

Batch-skanning:
- "Scanna fler sidor" — lägg till sida utan att avsluta
- Visa miniatyrer av alla inscannade sidor
- Drag & drop för att sortera om
- Radera enskilda sidor
- Sedan: skicka alla sidor som ett OCR-jobb

Bästa ljusförhållanden:
- Varna om bilden är för mörk (expo-camera API)
- Varna om för mycket bländning
- Automatisk flash-justering
```

## Table Experience — fullständig spec

```
Alla tabeller i appen ska ha:
- Sticky header (scrollar inte bort)
- Kolumnsortering (klick på header → asc → desc → ingen)
- Kolumnbredd: kan dras (desktop) eller väljs (mobil)
- Export: synlig knapp, exporterar filtrerad vy
- Filter: dropdowns per kolumn
- Inline-redigering: dubbelklick på cell → redigera direkt
- Multi-select: checkbox per rad
- Kopiera: markera cell → Cmd+C kopierar värdet
- Pagination ALDRIG — virtuell scrollning istället
- "X rader" visas alltid (t.ex. "Visar 47 arbetspass")
```

## Smart Scroll Position

```
Systemet ska komma ihåg scroll-position:
- Återgå till samma position vid bakåtnavigering
- Återgå till position vid app-återöppning (om < 24h)
- "Hoppa till idag" i kalender-listvyer
- "Hoppa till första osedda" i notis-historik
- Smooth scroll vid programmatisk navigering

Förhandsladdning (prefetch):
- Nästa sida i paginerad vy laddas i bakgrunden
- Troligt nästa steg laddas (t.ex. löneberäkning efter schema-import)
- Dashboard-data laddas vid app-start i bakgrunden
```

## 120Hz Animationer

```
På enheter som stöder ProMotion (120Hz):
- Alla animationer körs i 120fps
- Scroll-physics känns mer naturlig
- Drag & drop är mer precis

Implementering:
- Undvik JS-animationer för scroll (använd CSS scroll-behavior)
- Använd will-change: transform sparsamt
- Aldrig blockera main thread under animering
- Testa på iPhone 15 Pro och iPad Pro
```

## Siri Shortcuts & iOS Integration

```
Siri Shortcuts att exponera:
- "Logga arbetspass" → öppnar nytt pass-formulär
- "Visa min lön denna månad" → öppnar löneöversikt
- "Lägg till utgift" → öppnar utgifts-formulär
- "Visa nästa arbetspass" → returnerar text-svar till Siri
- "Starta timer" → startar work-timer

Spotlight-sökning:
- Alla arbetspass indexeras (datum, arbetsgivare)
- Alla dokument indexeras (titel, typ)
- Alla projekt indexeras (titel, status)
- Sökning i Spotlight öppnar direkt rätt del av appen

Share Sheet (iOS):
- Ta emot PDF → föreslå import som dokument
- Ta emot bild → föreslå OCR
- Ta emot text → föreslå som anteckning

App Clips (framtid):
- Mini-version för att logga ett enstaka arbetspass
- Utan att ladda ner hela appen
```

## Rich Text i anteckningar — spec

```
Stödda format:
- **Fetstil** (Cmd+B)
- *Kursiv* (Cmd+I)
- ~~Genomstrykning~~
- `Kod` (inline)
- # Rubrik 1
- ## Rubrik 2
- - Punktlista
- 1. Numrerad lista
- - [ ] Checklista
- > Citat
- --- Avdelare
- [[länk till objekt]] (intern länk)
- https://... (extern länk, auto-detekterad)

Inte stött (för komplext):
- Tabeller i rich text
- Inbäddade bilder i text (bilagor istället)
- Formler
- Kommentarer

Smart links (intern länkning):
- Skriv [[arbetspass]] → autocomplete för befintliga pass
- Skriv [[projekt: Renovering]] → länk till projekt
- Klicka på länk → öppnar objektet
- Länkade objekt visas i "Relationer" på källobjektet
```

## Notification Groups — konkret implementation

```
Gruppering (iOS Notification Grouping):
- Alla Life OS-notiser i en grupp som standard
- Undgrupper: Arbete / Ekonomi / Dokument / System

Sammanfattning istället för spam:
- 3+ liknande notiser inom 10 min → slå ihop
- "3 nya arbetspass importerade" (inte 3 separata)
- "Budget för Mat överskreds (2 gånger)" (inte 2 separata)

Kritiska notiser (kräver interaktion):
- Synk-fel som pågått > 24h
- Backup misslyckad
- Säkerhetsvarning (ny enhet)
- OCR-granskning krävs (inte kritisk men hög prio)

Quiet Hours (tyst timme):
- Inga notiser 22:00–07:00 (konfigurerbart)
- Undantag: kritiska säkerhetsnotiser
- Sammanfattning skickas 07:05 med vad som missades
```

## Power User — batch operations

```
Batch-operationer på markerade objekt:
- Markera flera arbetspass → ändra status för alla
- Markera flera utgifter → ändra kategori för alla
- Markera flera dokument → arkivera/exportera alla
- Markera flera uppgifter → byt projekt för alla

Bulkimport:
- Dra och släpp flera filer → batch-OCR
- Importera CSV med flera transaktioner → preview → godkänn
- Klistra in schema-text → parser → preview → godkänn

Split View (iPad/Desktop):
- Kalender + Löneöversikt sida vid sida
- Dokument + OCR-granskning sida vid sida
- Schema + Lönesimulator sida vid sida
- Drag ett objekt från vänster panel → släpp i höger panel
```

## "Ingen knapp ska kännas död" — konkret implementering

```
Varje interaktivt element ska ha:

Idle state:     Normal utseende
Hover state:    Lätt bakgrundsfärg (rgba(255,255,255,0.06))
Active state:   Mörkare bakgrund + scale(0.98)
Focus state:    2px solid accent-color outline (WCAG)
Disabled state: 40% opacity, cursor: not-allowed
Loading state:  Spinner INUTI knappen, text ersätts inte
Success state:  Grön checkmark, 1 sekund, sedan tillbaka till idle

Alla transitions: 100ms ease

Aldrig:
- En knapp som ser klickbar ut men inte gör något
- En knapp som sparar utan visuell feedback
- En knapp som disablas utan förklaring
```


---

# DEL 46 — SKALBARHET & LÅNGSIKTIG ARKITEKTUR

## Multi-Workspace — samma konto, flera kontexter

```
En användare kan ha flera workspaces:
- Privat (default, alltid finns)
- Familj (delas med partner/barn)
- Företag (separata affärsobjekt)
- Test (sandbox för att prova utan att förstöra riktig data)

Varje workspace:
- Isoleras logiskt (separata RLS-policies per workspace_id)
- Har egna inställningar och preferenser
- Delar konto och autentisering
- Kan ALDRIG läsa varandras data utan explicit delning
- Visas i en workspace-switcher (övre vänster, som Slack)

Datamodell:
ALTER TABLE work_shifts ADD COLUMN workspace_id UUID DEFAULT 'private-workspace-id';
-- Alla tabeller får workspace_id
-- RLS uppdateras: auth.uid() = user_id AND workspace_id = current_workspace()
```

## Tenant Safety — verifieras med tester

```
Dessa tester måste ALLTID vara gröna:
1. Användare A kan ALDRIG se Användare B:s data
2. Workspace X kan ALDRIG se Workspace Y:s data
3. RLS-bypass via service role är ALDRIG möjlig från klientkod
4. Malicious payload i metadata JSONB ska inte kunna exekveras
5. SQL injection via användarinput ska vara omöjlig (parametriserade queries)

Verifieras via:
- Automatiska penetrationstester i CI/CD
- Manuell säkerhetsgenomgång vid varje större release
- Supabase Row Level Security tester
```

## Storage Growth — designa för decennier

```
Partitioneringsstrategi (när tabeller växer > 10M rader):
- work_shifts: partitionera på YEAR(start_at)
- transactions: partitionera på YEAR(transaction_date)
- documents: partitionera på YEAR(created_at)
- audit_logs: partitionera på MONTH(created_at)

Livscykelhantering:
- Aktiv data: 0–13 månader → standard tabeller
- Arkivdata: 13+ månader → komprimerade partition-tabeller
- Permanent historik: exporteras till cold storage (S3/Supabase Storage)
- Sökning i arkivdata: möjlig men långsammare (tydlig indikator i UI)

Komprimering:
- JSONB-kolumner komprimeras automatiskt av PostgreSQL (TOAST)
- Dokumentfiler: WebP för bilder, komprimerade PDF:er
- Backup: gzip-komprimering (sparar ~70% utrymme)
- Gamla audit_logs: komprimeras efter 90 dagar

Lagringskvot per plan:
- Gratis: 1 GB dokument + 10 000 objekt
- Plus: 10 GB dokument + obegränsade objekt
- Pro: 100 GB dokument + prioriterad OCR-kö
```

## Delta Updates & Incremental Sync

```
Istället för att synka hela datasettet:

Full sync (vid första installation):
- Ladda ner alla objekt en gång
- Lagra i IndexedDB

Delta sync (därefter):
- Server skickar bara ÄNDRINGAR sedan last_sync_timestamp
- Klienten applicerar ändringar på lokal cache
- Minskar dataförbrukning med ~95%

Implementation:
SELECT * FROM work_shifts
WHERE user_id = auth.uid()
  AND updated_at > $last_sync_timestamp
  AND (deleted_at IS NULL OR deleted_at > $last_sync_timestamp)
ORDER BY updated_at ASC;

-- deleted_at inkluderas så klienten vet vad som raderats
```

## Disaster Recovery — kontrollerad degradering

```
System ska degradera nivå för nivå:

Nivå 1 (allt fungerar): Normal drift
Nivå 2 (AI nere): AI-funktioner ersätts av icke-AI alternativ
Nivå 3 (OCR nere): Manuell inmatning erbjuds istället
Nivå 4 (Sync nere): Offline-läge aktiveras automatiskt
Nivå 5 (Supabase nere): Lokal databas används, sync köas
Nivå 6 (App kraschar): Data är säker i IndexedDB, startar om

Ingen nivå ska resultera i:
- Dataförlust
- Blank skärm utan information
- Felmeddelande utan handlingsalternativ

"Controlled degradation over catastrophic failure"
```

## Plugin Arkitektur — säker sandboxing

```
Plugin-typer:
- Dashboard Widgets (HTML/CSS/JS i iframe-sandbox)
- Report Templates (definerade i JSON)
- Automation Rules (IF/THEN i säkert DSL, inte godtycklig kod)
- OCR Profiles (inställningar för specifika dokumenttyper)
- AI Prompts (anpassade prompt-templates)
- Import/Export Adapters (transformationsfunktioner)
- Themes (CSS variables och tokens)

Plugin-begränsningar:
- Ingen tillgång till andra användares data
- Ingen nätverksåtkomst utan explicit permission
- Ingen localStorage-åtkomst utanför plugin-scope
- Sandboxad exekvering (Web Workers eller iframe)
- Plugin kan inte modifiera Core Engines

Plugin-manifest (package.json-liknande):
{
  "id": "my-plugin",
  "name": "Plugin Name",
  "version": "1.0.0",
  "permissions": ["read:work_shifts", "write:widgets"],
  "sandbox": true,
  "verified": false
}
```

## AI Provider Abstraction — utbytbar AI

```typescript
// Abstrakt AI-interface — aldrig anropa OpenAI/Claude direkt
interface AIProvider {
  complete(prompt: string, options: AIOptions): Promise<AIResponse>
  embed(text: string): Promise<number[]>
  classify(text: string, categories: string[]): Promise<Classification>
}

// Implementations
class OpenAIProvider implements AIProvider { ... }
class ClaudeProvider implements AIProvider { ... }
class GeminiProvider implements AIProvider { ... }
class LocalLlamaProvider implements AIProvider { ... }
class MistralProvider implements AIProvider { ... }

// Routing
const ai = createAIRouter({
  primary: new ClaudeProvider(config.CLAUDE_API_KEY),
  fallback: new OpenAIProvider(config.OPENAI_API_KEY),
  local: new LocalLlamaProvider(config.LOCAL_MODEL_PATH),
})

// Aldrig i produktionskod:
// fetch('https://api.openai.com/v1/...')  ← FÖRBJUDET
// Anthropic SDK direkt                    ← FÖRBJUDET
// Alltid via ai.complete(...)             ← KORREKT
```

## OpenAPI Spec — framtida publik API

```yaml
# Alla endpoints dokumenteras i OpenAPI 3.0
# Genereras automatiskt från kod
# Publiceras på /api/docs (Swagger UI)
# Versioneras: /api/v1/, /api/v2/ etc.

# Exempel:
paths:
  /api/v1/work-shifts:
    get:
      summary: List work shifts
      parameters:
        - name: from_date
          in: query
          required: false
          schema:
            type: string
            format: date
        - name: to_date
          in: query
          required: false
          schema:
            type: string
            format: date
      responses:
        200:
          description: List of work shifts
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WorkShiftList'
        401:
          description: Unauthorized
        429:
          description: Rate limit exceeded
```

## Portabilitet — data följer användaren

```
Life OS ska kunna köras:
- Supabase Cloud (default)
- Supabase self-hosted (egen server)
- Annan PostgreSQL (med anpassning)
- Lokalt (Electron-app med lokal SQLite, framtid)

Krav för portabilitet:
- Inga proprietära Supabase-funktioner som inte kan ersättas
  (Edge Functions → vanliga API-routes, Realtime → WebSocket)
- All data exporterbar i öppna format
- Databasschema dokumenterat och versionshanterat
- Inga vendor lock-in i kärnlogiken

Self-hosting guide ska finnas från dag 1
(inte som eftertanke)
```

## Long-term Compatibility — 20+ år

```
Vad som SKA vara stabilt (aldrig bryta):
- Dataformat för export (JSON-schema versioneras)
- Objekt-ID:n (UUID, aldrig återanvändas)
- Grundläggande datamodell (lägg till, aldrig ta bort)
- Auth-metod (e-post + lösenord alltid ett alternativ)
- Exportformat (CSV, JSON alltid tillgängliga)

Vad som FÅR ändras:
- UI-design
- AI-provider
- OCR-engine
- Frontend-ramverk
- Backend-infrastruktur

Princip: "Data outlives code"
Användarens data ska kunna läsas om 20 år
även om appen är helt omskriven.
```


---

# DEL 47 — ARCHITECT DECISION FRAMEWORK

## Decision Tree — innan något nytt byggs
```
Svara i ordning. Stanna när ett svar ger tydlig riktning.

1.  Löser detta ett verkligt användarproblem?          Nej → Bygg inte
2.  Finns lösningen redan?                             Ja  → Använd den
3.  Kan befintlig funktion utökas?                     Ja  → Utöka den
4.  Är detta egentligen ett objekt?                    Ja  → Lägg till i objektmodellen
5.  Är detta egentligen en relation?                   Ja  → Lägg till relation
6.  Är detta egentligen metadata?                      Ja  → Lägg i metadata JSONB
7.  Är detta egentligen en inställning?                Ja  → Lägg i settings
8.  Är detta egentligen en automation?                 Ja  → Bygg automation-regel
9.  Är detta egentligen en rapport?                    Ja  → Bygg rapport-template
10. Är detta bara en ny vy av befintlig data?          Ja  → Bygg vy, inte ny modul
11. Kan detta lösas regelbaserat utan AI?              Ja  → Bygg utan AI
12. Ska detta vänta till en senare fas?                Ja  → Lägg i backlog
```

## Build Hierarchy — hoppa aldrig över steg
```
1. Problem          (vad är det verkliga problemet?)
2. Krav             (vad ska lösningen göra?)
3. Objektmodell     (vilka objekt berörs?)
4. Datamodell       (hur lagras det?)
5. Säkerhet         (RLS, behörigheter, kryptering)
6. API              (endpoints och kontrakt)
7. Affärslogik      (beräkningar, regler, validering)
8. Tester           (unit, integration, e2e)
9. UI               (komponenter, states, responsivitet)
10. Automation      (triggers, regler, notiser)
11. AI              (om regelbaserat inte räcker)
12. Optimering      (prestanda, cache, bundle)
```

## Feature Classification — varje funktion klassas
```
CORE        — krävs för att produkten ska fungera
              (auth, arbetspass, löneuträkning, OCR-import)

OPTIONAL    — förbättrar upplevelsen men krävs inte
              (AI-insikter, gamification, avancerad statistik)

FUTURE      — byggs i en senare fas, arkitektur förbereds nu
              (bankintegration, familjedela, enterprise)

EXPERIMENTAL — testas bakom Feature Flag, kan tas bort
               (nya AI-funktioner, beta-features)
```

## Quality Score — bedöm varje större funktion
```
Poäng 1–5 per dimension:

Användarvärde    (löser ett verkligt problem?)
Enkelhet         (kan en nybörjare använda det?)
Säkerhet         (RLS, kryptering, audit)
Prestanda        (svarar under prestandabudget?)
Skalbarhet       (fungerar med 1M objekt?)
Underhållbarhet  (kan en ny utvecklare förstå koden?)
AI-oberoende     (fungerar utan AI?)
Offline-stöd     (fungerar offline?)
Testbarhet       (kan det testas automatiskt?)
Dokumentation    (är det dokumenterat?)

Minimum för release: 35/50 (70%)
Under 30/50: omarbeta innan release
```

## Feature Freeze — regler
```
När en fas nearmar sig release (sista 2 veckorna):

TILLÅTET:
- Fixa buggar
- Förbättra prestanda
- Åtgärda säkerhetsproblem
- Förbättra stabilitet
- Uppdatera dokumentation

FÖRBJUDET:
- Nya funktioner
- Ändra datamodell
- Ny UI-design
- Refaktorering av kärnlogik
- Experimentella ändringar

Bryta Feature Freeze kräver: skriftlig motivering + riskanalys
```

## AI Decision Gate — AI används BARA om:
```
□ Regelbaserad lösning räcker inte?     (Ja → överväg AI)
□ AI ger tydligt mätbart användarvärde? (Nej → bygg inte)
□ Funktionen fungerar utan AI?           (Nej → bygg om)
□ Användaren samtycker explicit?         (Nej → bygg inte)
□ AI kan stängas av per modul?          (Nej → bygg om)
□ Non-AI fallback finns?                (Nej → bygg den)
□ AI-cost är rimlig per operation?      (Nej → optimera)

AI ska aldrig bli en dold beroendekedja.
Om ovanstående inte stämmer: bygg regelbaserat.
```

## Quarterly Architecture Review — checklista
```
Varje kvartal (Q1/Q2/Q3/Q4):

KOD:
□ Teknisk skuld inventerad och prioriterad?
□ Duplicerad kod identifierad?
□ Dead code borttagen?
□ Dependencies uppdaterade och scannade?

DATABAS:
□ Långsamma queries identifierade (> 200ms)?
□ Index optimerade?
□ Partitioner i rätt skick?
□ Backup testad?

SÄKERHET:
□ RLS-policies verifierade?
□ API-endpoints penetrationstestade?
□ Beroendeskanning gjord (npm audit)?
□ GDPR-compliance kontrollerad?

PRESTANDA:
□ Bundle size kontrollerad (< 500KB initial)?
□ Core Web Vitals godkända?
□ Mobil-prestanda testad på enklare enhet?

DOKUMENTATION:
□ API-dokumentation uppdaterad?
□ Changelog komplett?
□ Onboarding-guide aktuell?
□ README korrekt?
```

## Lovable Workflow — exakt process
```
Vid varje uppdrag:

1. Läs hela System Bible (detta dokument)
2. Identifiera exakt vilka moduler som berörs
3. Inventera befintlig kod i projektet
4. Kör Decision Tree (ovan)
5. Dela upp arbetet i steg om max 30 min vardera
6. Implementera ETT steg
7. Testa steget (manuellt + auto om möjligt)
8. Committa med beskrivande commit-meddelande
9. Rapportera: "Klart: [vad som gjordes]. Kvar: [lista]"
10. Vänta på nästa instruktion

ALDRIG:
- Implementera mer än ett steg utan att rapportera
- Gissa vad som ska göras härnäst
- Ändra fungerande kod utan explicit instruktion
- Hoppa över tester för att spara tid
```


---

# DEL 48 — DE 20 LAGARNA (LIFE OS CONSTITUTION)

> Detta är de fundamentala lagarna. De har alltid företräde.
> Om något i spec:en strider mot en lag — lagen vinner.

---

**LAG 1 — USER FIRST**
Användaren kommer alltid först. Allt annat är sekundärt.

**LAG 2 — USER OWNS EVERYTHING**
All data ägs av användaren. Life OS lånar rätten att lagra den. Ingen dold profilering, ingen dataförsäljning, ingen dold AI-träning.

**LAG 3 — AI IS OPTIONAL**
Life OS fungerar fullt ut utan AI. AI är ett tillval, aldrig ett krav.

**LAG 4 — OFFLINE FIRST**
Kärnfunktionerna fungerar utan internet. Internet förbättrar, aldrig kräver.

**LAG 5 — SECURITY BY DEFAULT**
Säkerhet är standard. Aldrig ett tillval.

**LAG 6 — PRIVACY BY DEFAULT**
Minsta möjliga datainsamling. Minsta möjliga delning. Full transparens.

**LAG 7 — OBJECT FIRST**
Allt bygger på objekt. Inte skärmar. Inte AI. Inte databastabeller.

**LAG 8 — ONE SOURCE OF TRUTH**
Information finns endast på ett ställe. Alla vyer använder samma data.

**LAG 9 — REUSE BEFORE BUILD**
Återanvänd alltid. Bygg nytt endast när det verkligen behövs.

**LAG 10 — NO MOCKUPS**
Inga falska knappar. Inga tomma funktioner. Allt användaren ser ska fungera.

**LAG 11 — EVERYTHING IS REVERSIBLE**
Användaren ska alltid kunna ångra, återställa, exportera och lämna systemet.

**LAG 12 — TRANSPARENCY**
Systemet ska kunna förklara vad det gör, varför, och vilken data som används.

**LAG 13 — MODULARITY**
Allt utanför kärnan ska kunna bytas ut: AI, OCR, moln, integrationer, plugins.

**LAG 14 — NO VENDOR LOCK-IN**
Ingen leverantör får bli ett krav.

**LAG 15 — LONG-TERM THINKING**
Varje beslut ska fungera även om tio år.

**LAG 16 — QUALITY OVER QUANTITY**
Färre men genomarbetade funktioner är bättre än många halvfärdiga.

**LAG 17 — TEST BEFORE RELEASE**
Ingen release utan tester. Ingen release utan backup. Ingen release utan testad återställning.

**LAG 18 — ACCESSIBILITY**
Life OS ska kunna användas av så många som möjligt.

**LAG 19 — PERFORMANCE**
Systemet ska kännas snabbt även med mycket data.

**LAG 20 — CONSISTENCY**
Samma regler, samma språk, samma beteende — överallt.

---

**FINAL LAW — TIE BREAKER**
Om två lösningar är lika bra, välj alltid den som är:
- Enklare
- Säkrare
- Mer privat
- Mer modulär
- Mer framtidssäker
- Lättare att underhålla

---

*MY MONEY MASTER / LIFE OS — MASTER PRODUCT SPECIFICATION v3.1*
*4000+ rader · 48 delar · Kompilerad från 97+ källdokument*
*Klar för Lovable-implementation*


---

# DEL 49 — SECURITY CONSTITUTION & THREAT MODEL

## Grundprincipen
> "Anta att fel KOMMER att inträffa. Designa så att skadan begränsas, data inte förloras, återställning alltid är möjlig, och användaren behåller kontrollen."

## Zero Trust — lita aldrig automatiskt på
```
Klienten          → verifiera alla requests server-side
API-anrop         → autentisering + behörighet varje gång
AI                → kräver explicit behörighet per objekt
Plugin            → sandboxad, begränsad åtkomst
OCR-filer         → validera filtyp, storlek, innehåll
Importerad data   → sanitera, validera, aldrig exekvera
Enhet             → registreras och verifieras
Session           → kortlivad, refreshas säkert
Nätverk           → HTTPS/TLS alltid, certificate pinning
```

## Threat Model — identifierade hot med skydd

| Hot | Risk | Förebyggande | Återställning |
|---|---|---|---|
| Kontoövertagande | Hög | 2FA, passkeys, session-alerts | Återställningskoder, identity verification |
| Stulen telefon | Hög | Biometri, remote logout, krypterad lokal data | Fjärr-radering, backup |
| Läckta lösenord | Hög | Passkeys, 2FA, breach-detection | Tvingad lösenordsbyte |
| Social engineering | Medium | Utbildning i UI, bekräftelse vid kritiska åtgärder | Audit log, papperskorg |
| Skadliga plugins | Medium | Sandbox, permissions manifest, review | Avinstallera utan dataförlust |
| Manipulerade OCR-filer | Medium | Filvalidering, checksumma, preview | Originaldokument oförändrat |
| Korrupt backup | Medium | Checksumma-verifiering, multipla backups | Alternativ backup-källa |
| Ransomware | Låg | Offline backup, versionering, export | Punkt-i-tid återställning |
| Datakorruption | Medium | ACID-transaktioner, checksummor | Rollback, backup |
| Massradering (oavsiktlig) | Medium | Bekräftelse, papperskorg 30 dagar | Återställning från papperskorg |
| API-missbruk | Medium | Rate limiting, anomali-detektering | Blockera, notifiera |
| Felaktig AI-rekommendation | Medium | Confidence-score, "detta är inte rådgivning" | Audit log, ångra |
| Leverantörsbortfall | Låg | Vendor abstraction, exporterbara format | Self-hosting, data export |
| Molnavbrott | Medium | Offline-läge, lokal cache | Automatisk återanslutning |
| Insiderhot | Låg | Minsta möjliga access, audit log | Revoke access, incident response |

## Key Management — krypteringsnycklar

```
Regler:
- Krypteringsnycklar lagras ALDRIG i klientkod
- Aldrig i .env-filer som committade till git
- Roteras minst en gång per år
- Kan återkallas omedelbart vid misstanke
- Backup av nycklar separat från backup av data
- Supabase hanterar databas-kryptering (AES-256)
- Dokumentfiler krypteras med per-user-nycklar i Supabase Storage

Key rotation process:
1. Generera ny nyckel
2. Re-kryptera data med ny nyckel (bakgrundsprocess)
3. Verifiera re-kryptering
4. Markera gammal nyckel som deprecated
5. Ta bort gammal nyckel efter 30 dagar
```

## Fraud Detection — anomali-baserad

```
Triggas automatiskt vid:
- 5+ misslyckade inloggningsförsök → tillfällig blockering + notis
- Inloggning från nytt land → notis + kräv verifiering
- Export av > 100 MB data på < 1 timme → flagga + notis
- Radering av > 50 objekt på < 5 minuter → pausa + kräv bekräftelse
- API-anrop > 1000/timme → rate limit + notis
- AI läser > 100 dokument på < 10 min → pausa + kräv bekräftelse
- Ny enhet loggar in → notis till befintliga enheter

Alla anomalier:
- Loggas i audit_log
- Notifieras till användaren
- Kan granskas i Trust Dashboard
```

## Safe Mode — read-only vid kritiska fel

```
Aktiveras automatiskt vid:
- Misstänkt datakorruption
- Misslyckad integritetskontroll
- Admin-initierad (vid säkerhetsincident)

I Safe Mode:
✓ Visa all data (read-only)
✓ Exportera all data
✓ Skapa backup
✓ Köra diagnostik
✓ Kontakta support

✗ Skapa eller ändra objekt
✗ Importera data
✗ Köra automationer
✗ AI-åtkomst

Exitera Safe Mode:
- Manuell bekräftelse av användaren
- Verifiering av dataintegritet
- Eventuell supportkontakt
```

## Trust Dashboard — alltid tillgänglig

```
Användaren ser alltid:
□ Aktiva enheter (namn, OS, senast aktiv, [Logga ut])
□ Aktiva sessioner (webb/mobil, IP-land, [Avsluta])
□ AI-status (på/av per modul, senast använd)
□ Backup-status (senast lyckad, nästa planerade)
□ Sync-status (synkad/offline/konflikt)
□ Senaste export (datum, storlek, vad)
□ Senaste import (datum, källa, vad)
□ Aktiva behörigheter (vilka plugins/integrationer har åtkomst)
□ Aktiva delningar (familj/team)
□ Säkerhetsvarningar (om några)
□ Audit log (senaste 30 händelserna)

Tillgänglig via: Inställningar → Säkerhet & Integritet
```

## Business Continuity — kontrollerad degradering

```
Vid avbrott hos extern tjänst:

AI-leverantör nere:
→ Non-AI fallbacks aktiveras automatiskt
→ Notis: "AI-funktioner tillfälligt otillgängliga"
→ All annan funktionalitet fungerar

OCR-leverantör nere:
→ Manuell inmatning erbjuds
→ Dokument köas för OCR när tjänsten återkommer
→ Notis: "OCR tillfälligt otillgänglig, manuell inmatning möjlig"

Push-tjänst nere:
→ In-app notiser fungerar
→ E-post-notiser som backup
→ Push-notiser köas och skickas vid återanslutning

Supabase nere:
→ Offline-läge aktiveras automatiskt
→ Lokal IndexedDB används
→ Ändringar köas för synk
→ Synkstatus-banner visas

Molnlagring nere (dokument):
→ Lokalt cachade dokument visas
→ Uppladdning av nya dokument köas
→ Notis om begränsad dokumentfunktion
```

## Security Pre-release Checklist

```
Inför varje release, verifiera:
□ Penetrationstest genomfört
□ npm audit: inga kritiska sårbarheter
□ RLS-policies testade (cross-user-access omöjlig)
□ Kryptering verifierad (data at rest + in transit)
□ Backup skapad och testad (återställning fungerar)
□ Recovery-flöde testat
□ Offline-läge fungerar
□ Export komplett och korrekt
□ Audit log fångar alla kritiska händelser
□ AI kan stängas av utan krasch
□ Plugin-sandbox verifierad
□ Safe Mode fungerar
□ Rate limiting aktivt på alla endpoints
□ Session-timeout fungerar
□ Screenshot-skydd på känsliga vyer
□ Trust Dashboard visar korrekt information
```


---

# DEL 50 — IMPLEMENTATION ORDER & MASTER CHECKLIST

## Implementeringsordning — 5 faser

### Fas 1 — Core (byggs ALLRA FÖRST)
```
1. Core Engines (Event Bus, Rule Engine, Form Engine)
2. Security (RLS, Auth, Zero Trust)
3. Database (schema, index, triggers, RLS-policies)
4. Navigation (routing, layout, Bottom Nav, Sidebar)
5. Authentication (login, register, verify, forgot password)
```

### Fas 2 — Work & Money (alpha)
```
6. Work Profiles (arbetsgivare, timlön, OB-regler, rastregler)
7. Work Shifts (skapa, redigera, konfliktkontroll, midnatt)
8. OCR Pipeline (upload → OCR → preview → godkänn → spara)
9. Payroll Engine (löneuträkning, OB, jour, skatt, netto)
10. Budget & Expenses (kategorier, återkommande, budgetstatus)
```

### Fas 3 — Content & Overview
```
11. Documents (upload, kategorisering, versioner, garanti-påminnelse)
12. Projects & Tasks (projekt, uppgifter, beroenden, checklistor)
13. Dashboard (widgets, daglig briefing, smart context)
14. Reports (månadsöversikt, löneunderlag, budgetrapport)
15. Search (global, offline, filter, taggar)
```

### Fas 4 — Platform
```
16. Automation (Rule Engine UI, triggers, actions, simulation)
17. Widgets (anpassningsbar dashboard, drag & drop)
18. Customization (teman, density, widgets, preferences)
19. Offline (IndexedDB, sync queue, conflict resolution)
20. Notifications (smart grouping, quiet hours, digest)
```

### Fas 5 — Intelligence (SIST)
```
21. AI Copilot (valfri, alla non-AI fallbacks redan byggda)
22. Marketplace (plugins, templates, automations)
23. Advanced Analytics (KPI, trends, forecasts, Life Score)
24. Family/Team (multi-workspace, delning, behörigheter)
25. Enterprise (SSO, admin, compliance, white label)
```

## Master Checklist — kör innan varje implementation

```
□ Finns detta redan i systemet?
□ Kan befintlig kod återanvändas?
□ Kan lösningen förenklas?
□ Är RLS implementerat?
□ Fungerar offline?
□ Fungerar utan AI?
□ Fungerar på mobil?
□ Fungerar på desktop?
□ Är tillgänglighetskrav uppfyllda?
□ Håller det prestandabudgeten?
□ Finns tester?
□ Är det dokumenterat?
□ Finns Non-AI fallback?
□ Finns ångra-möjlighet?
□ Är destruktiva åtgärder skyddade?
```

## Spec-index — hitta rätt del snabbt

```
Vision & mål:              Del 1–3
UX & Design:               Del 4–5, 33–34, 44–45
Arkitektur:                Del 6–8
Alpha-moduler:             Del 14
Alpha-prioritet:           Del 15–16
Supabase & databas:        Del 24, 38, 40, 43
Lovable-regler:            Del 20, 25, 47
Säkerhet:                  Del 17, 36, 49
Offline:                   Del 32
Felhantering:              Del 29
Demo-data:                 Del 30
Performance:               Del 27, 42
Svenska specifikt:         Del 26, 40
OB-procenter:              Del 40
Helgdagar:                 Del 40
Löneuträkning algoritm:    Del 40
Komponenthierarki:         Del 40
React-regler:              Del 41
State management:          Del 42
Cache-strategi:            Del 42
Skalbarhet:                Del 46
Lagarna (20 lagar):        Del 48
Threat Model:              Del 49
Implementeringsordning:    Del 50 (denna)
```


---

# DEL 51 — KRAV-ID SYSTEM (FÖRENKLAT)

## Varför krav-ID (men enkelt)

Full requirements traceability är rätt tänkt men för tungt för Lovable-baserad utveckling.
Vi tar det värdefulla: ett enkelt ID-system som gör det möjligt att referera krav i kod,
buggar och commits — utan byråkrati.

## Krav-ID Format

```
[KATEGORI]-[NUMMER]

Kategorier:
CORE   = kärnarkitektur
SEC    = säkerhet
AUTH   = autentisering
WORK   = arbete & schema
PAY    = lön & uträkning
OCR    = OCR & import
DOC    = dokument
FIN    = ekonomi
DASH   = dashboard
CAL    = kalender
SEARCH = sökning
NOTIF  = notiser
PERF   = prestanda
UX     = användarupplevelse
UI     = gränssnitt
DB     = databas
API    = API
TEST   = testfall
SYNC   = synkronisering
EXPORT = export/import
```

## Alpha-krav med ID (P0 = blocker, P1 = MVP)

```
AUTH-001 [P0] Email-verifiering fungerar (Supabase SMTP konfigurerat)
AUTH-002 [P0] Session är stabil (ingen manuell re-login)
AUTH-003 [P0] Forgot password-flöde fungerar
AUTH-004 [P1] Resend verification email-knapp på login

WORK-001 [P0] Timlön är textfält (aldrig stepper)
WORK-002 [P0] Pass över midnatt lagras korrekt (ett pass, rätt OB)
WORK-003 [P0] Jour lördag→söndag räknas korrekt (OB delas vid midnatt)
WORK-004 [P0] Rastregler per arbetsprofil (inte hårdkodade)
WORK-005 [P1] Konfliktkontroll vid dubbelbokning
WORK-006 [P1] Snabbfyll hela veckan på 1–2 tryck
WORK-007 [P1] Massredigering: kopiera/flytta vecka

PAY-001  [P0] Löneuträkning: grundlön + OB + jour + raster = korrekt
PAY-002  [P0] Skatteberäkning per kolumn (33 default)
PAY-003  [P0] Semesterersättning 12% för timanställda
PAY-004  [P1] Lönesimulator ("Vad tjänar jag på söndag?")
PAY-005  [P1] Jämförelse app vs importerad lönespec

OCR-001  [P0] Schema-import (bild/PDF/screenshot → pass)
OCR-002  [P0] Förhandsgranskningsvy med confidence per fält
OCR-003  [P0] Originaldokument sparas oförändrat
OCR-004  [P0] Inget importeras automatiskt utan godkännande
OCR-005  [P1] Lönespec-import med OCR
OCR-006  [P1] Duplikat-detektering vid import
OCR-007  [P1] Rollback av import inom 24h

FIN-001  [P1] Utgifter med kategorier
FIN-002  [P1] Återkommande utgifter
FIN-003  [P1] Skulder med amorteringssimulator
FIN-004  [P1] Sparande med mål och framsteg
FIN-005  [P2] Net Worth (tillgångar - skulder)
FIN-006  [P2] Abonnemang med duplikat-detektering

DASH-001 [P1] Dashboard visar: nästa pass, intjänat, budget, räkningar
DASH-002 [P1] Daglig briefing (opt-in)
DASH-003 [P2] Modulär dashboard (drag & drop widgets)

DOC-001  [P1] Dokument-upload (PDF, bild)
DOC-002  [P1] Smart kategorisering
DOC-003  [P1] Garanti-påminnelse (30 dagar före)
DOC-004  [P2] Versionshantering

SEC-001  [P0] RLS aktivt på alla tabeller
SEC-002  [P0] Ingen service-role-nyckel i klientkod
SEC-003  [P1] Session-timeout (konfigurerbart)
SEC-004  [P1] Trust Dashboard (enheter, sessioner, AI-status)

PERF-001 [P0] App-start under 2 sekunder
PERF-002 [P0] Inga blank screens (alltid skeleton eller data)
PERF-003 [P1] Virtuell scrollning i alla listor > 100 objekt

UX-001   [P0] Ångra-funktion på alla destruktiva åtgärder
UX-002   [P0] Papperskorg (30 dagar)
UX-003   [P0] Synkstatus alltid synlig (grön/gul/röd/grå)
UX-004   [P1] Formulär-state sparas vid avbrott
UX-005   [P1] Offline-läge med tydlig indikator
```

## Hur Lovable använder krav-ID

```
I commit-meddelanden:
"[WORK-002] Fix midnight shift crossing OB calculation"
"[OCR-001] Add schema import preview step"
"[AUTH-001] Configure Supabase SMTP for email verification"

I kod-kommentarer:
// WORK-003: OB splits at midnight for weekend shifts
// See spec Del 40 for exact algorithm

I bugrapporter:
Bug: PAY-001 — Semesterersättning beräknas inte för timanställda
Priority: P0
Affected: work_shifts, salary calculation
```

## Prioritetsordning för alpha

```
Implementera i denna ordning:

P0 (blockers — ingenting annat fungerar utan dessa):
AUTH-001, AUTH-002, SEC-001, SEC-002, PERF-001

P0 (kärnfunktion):
WORK-001, WORK-002, WORK-003, WORK-004
PAY-001, PAY-002, PAY-003
OCR-001, OCR-002, OCR-003, OCR-004

P1 (MVP):
AUTH-003, AUTH-004
WORK-005, WORK-006, WORK-007
PAY-004, PAY-005
OCR-005, OCR-006, OCR-007
FIN-001, FIN-002, FIN-003, FIN-004
DASH-001, DASH-002
DOC-001, DOC-002, DOC-003
SEC-003, SEC-004
PERF-002, PERF-003
UX-001, UX-002, UX-003, UX-004, UX-005
```


---

# DEL 52 — KRAVREGISTER: TILLÄGG

## Saknade krav-kategorier (utöver Del 51)
```
Lägg till dessa kategorier om/när de behövs:
PROJ   = projekt & uppgifter
HOME   = hem & fastighet
ASSET  = tillgångar & fordon
HEALTH = hälsa & träning
AUTO   = automation & regler
PRIV   = integritet & GDPR
SYNC   = synkronisering
BACKUP = backup & återställning
IMPORT = import-pipelines
EXPORT = export-pipelines
OPS    = drift & observabilitet
AI     = AI-funktioner
PLUGIN = plugin-system
```

## MVP-klassificering (utöver P0/P1)
```
Critical    = P0 (blocker, ingenting fungerar utan detta)
Important   = P1 (MVP, appen är värdefull med detta)
Nice To Have = P2 (version 1.x)
Future      = P3 (backlog)
Experimental = bakom Feature Flag
```

## Risk Score — per krav
```
Varje P0/P1-krav bedöms:
Business Risk:   Hur allvarligt om detta inte fungerar? (1-5)
Security Risk:   Kan detta skapa säkerhetshål? (1-5)
Technical Risk:  Hur komplex är implementationen? (1-5)
User Value:      Hur mycket värde ger detta? (1-5)

Krav med Security Risk > 3 kräver explicit säkerhetsgranskning.
Krav med Technical Risk > 3 delas upp i delkrav.
```

## Sanningshierarki
```
Strategisk sanning:  System Bible (detta dokument)
Operativ sanning:    Krav-ID:n i Del 51-52
Implementation:      Kod i Lovable

"Kravregistret är den operativa sanningen.
System Bible är den strategiska sanningen.
Kod är endast implementationen."
```


---

# DEL 53 — REAL LIFE GAP ANALYSIS

## Kritiska luckor — verkliga livshändelser som saknades

### Svenska specifika ekonomifunktioner
```
Sociala förmåner som egna inkomstkällor:
- Barnbidrag (1 250 kr/barn/mån 2024) — återkommande inkomst
- Bostadsbidrag — återkommande inkomst, kopplas till bostad
- Studiebidrag / CSN-bidrag — separat från CSN-lån
- A-kassa — inkomst vid arbetslöshet, dagpenning × arbetsdagar
- Sjukpenning — 80% av SGI dag 15+, registreras som inkomst
- Aktivitetsersättning / sjukersättning — FK-ersättning

Fackförbund:
- Fackavgift som återkommande utgift (avdragsgill)
- Koppling till a-kassa (samma förbund)
- Stöd vid löneförhandling (dokumentera)

Skatterelaterat (mer konkret än vi hade):
- A-skatt vs F-skatt (egenföretagare har F-skatt)
- Skattekolumn-väljare med förklaring (kolumn 1-6 för extra jobb)
- Milersättning: skattefri del (25 kr/mil 2024), skattepliktig del
- Traktamente: skattefri del (Sverige 290 kr/dygn 2024)
- Representation: avdragsregler
- ROT/RUT-avdrag: max 75 000 kr/år ROT, 75 000 kr/år RUT
```

### Dödsbo & Arvskifte — saknades helt
```
När en anhörig dör behöver användaren:
- Registrera dödsfallet (datum, relation)
- Lista tillgångar och skulder som ska ingå i bouppteckning
- Dokument: testamente, äktenskapsförord, försäkringar
- Checklist: vem ska notifieras (banker, FK, Skatteverket, hyresvärd)
- Arvskifte: hur tillgångar fördelas
- Avveckla: avsluta abonnemang, konton, kontrakt

Systemet ska:
→ Skapa automatisk "Dödsbo"-checklista vid registrering
→ Lista alla identifierade tillgångar och skulder
→ Påminna om bouppteckning (inom 3 månader enligt lag)
```

### Separation/Skilsmässa — saknades
```
- Gemensam ekonomi delas upp
- Bodelning: lista gemensamma tillgångar
- Gemensamma skulder: vem tar vad
- Gemensamma abonnemang: lista och avsluta
- Barn: underhållsbidrag som återkommande utgift/inkomst
- Adressändring för båda parter
```

### Digital kontoinventering — saknades
```
"Digitala konton"-modul:
- E-post (Gmail, Outlook, iCloud)
- Sociala medier
- Streaming-tjänster
- Banktjänster
- Molnlagring
- Abonnemang (kopplas till Subscription Engine)
- Speltjänster
- Arbetsrelaterade (Slack, Teams, LinkedIn)

För varje konto:
- Tjänstnamn
- Användarnamn (aldrig lösenord)
- 2FA: ja/nej
- Återställningskod sparad: ja/nej
- Kopplad till: familj/jobb/privat
- Status: aktiv/inaktiv/avslutad

OBS: Inga lösenord lagras (hänvisa till lösenordshanterare)
Legacy: "Vid dödsfall — ge åtkomst till: [person]"
```

### Medicinsk information — mer konkret
```
Medicin-objekt (mer detaljerat än "mediciner" i hälsomodulen):
- Läkemedelsnamn
- Dos och frekvens (morgon/middag/kväll/vid behov)
- Recept: ordinerat av, datum, refill-datum
- Apotek: favorit-apotek
- Påminnelse: "Dags att ta medicin" (opt-in)
- Biverkningar att hålla koll på
- Interaktioner: "ta inte med X"

Allergier (separat, kritisk information):
- Läkemedels-allergier (penicillin etc.)
- Mat-allergier
- Miljö-allergier
- Allvarlighetsgrad
- Visas i ICE-vyn (Emergency)

Blodgrupp: eget fält på hälsoprofilen
Vaccinations-historik: datum, vaccin, nästa dos
1177-journal: länk/dokument till digitala journaler
```

### Kollektivtrafik & Pendling — saknades
```
Pendlings-objekt:
- Reslängd (km)
- Resmetod (bil/buss/tåg/cykel/kombinerat)
- Månadskortkostnad
- Parkeringskostnad
- Skattefri milersättning (beräknas automatiskt)

För lönespecifikation:
- Milersättning: automatisk beräkning (km × 25 kr)
- Pendlingsavdrag i deklaration (om > 5 km och > 2 000 kr/år)

Kollektivtrafik-kort:
- SL-kort, Västtrafik, Skånetrafiken etc.
- Förfallodatum, automatisk påminnelse om förnyelse
- Månadskostnad kopplas till budget automatiskt
```

### Kronofogden & Betalningsanmärkning — saknades
```
Ovanliga men viktiga scenario:
- Inkasso-ärende: registrera, spåra, betala
- Betalningsanmärkning: datum, belopp, status
- Avbetalningsplan: Klarna/inkasso med avbetalningar
- UC-kontroll: påminn att kontrollera kreditupplysning en gång per år

Systemet ska:
→ Aldrig döma eller värdera
→ Bara hjälpa användaren hålla ordning
→ Visa konsekvenser av obetalt (ränta, avgifter)
→ Hjälpa skapa avbetalningsplan
```

### Kivra / Mina Meddelanden — saknades
```
Digital post:
- Kivra: ta emot och spara digitala brev
- Mina Meddelanden (Skatteverket, FK, CSN)
- Hantera som dokument i Life OS
- OCR-läs automatiskt om möjligt
- Koppla till rätt modul (skattebesked → Ekonomi, lönespec → Arbete)

Framtida integration (backlog):
- Kivra API (om tillgängligt)
- Skatteverkets API för skattebesked
```

## Viktiga förbättringar — saker som kan göras bättre

### Budgetkategorier — mer svenska
```
Standard-kategorier bör spegla svenska vardagen:

Boende: Hyra/Avgift, El, Vatten, Internet, Hemförsäkring, Städ/RUT
Transport: Bensin, Kollektivtrafik, Parkering, Bilförsäkring, Trängselskatt
Mat: Dagligvaror (ICA/Coop/Willys), Restaurang, Takeaway, Café
Hälsa: Läkare/Tandläkare, Apotek, Gym, Frisör
Barn: Dagis/Förskola, Skola, Aktiviteter, Kläder
Sparande: Buffer, Semester, Pension, Övrigt
Skulder: CSN, Lån, Kreditkort, Privat skuld
Kommunikation: Mobil, Streaming, Tidningar, Övriga abonnemang
```

### Löneuträkning — saknad detalj
```
Nettolön-kalkylator behöver:
- Skattereduktion för låga inkomster (jobbskatteavdrag)
  → 2024: upp till ~33 000 kr/år i reduktion
- Grundavdrag (varierar med inkomst)
- Kommunalskatt (varierar per kommun, 29–35%)
- Systemet bör fråga: "Vilken kommun bor du i?"
  → hämta kommunalskattesats automatiskt (eller låt användaren ange)

Kommunalskattesatser (2024 exempel):
Stockholm: 30,09%
Göteborg: 31,60%
Malmö: 32,35%
Sundsvall: 32,83%
→ Bygg in dessa som valbara defaults
```

### Kvitton — mer praktiskt
```
Kvitto-scanning i vardagen:
- "Jag handlade mat för 847 kr på ICA" → scanna kvitto direkt
- OCR läser: butik, belopp, datum, produkter (om möjligt)
- Automatisk kategorisering: ICA → Mat
- Koppla till budget: "Mat-budgeten 67% förbrukad"
- Spara: garanti om produkten identifieras

Digitala kvitton (framtid):
- Mottagning av e-kvitton via e-post
- Trustly/Klarna-kvitton via integration
```

## Saker som kan slås ihop

```
Dessa är för lika för att vara separata:
- "Tillgångar" + "Inventarier" → ett objekt med typ-klassning
- "Garantier" + "Försäkringar" → båda är tidsbegränsade skydd på objekt
- "Projekt" + "Mål" → mål är projekt med slutdatum och framstegsmätning
- "Vanor" + "Rutiner" → vanor ÄR rutiner, ett objekt räcker
- "Anteckningar" + "Journal" + "Dagbok" → ett objekt med kategori
```

## Saker som bör vänta (men noteras nu)

```
Avancerat men inte för alpha:
- Deklarationsassistent (K4, kapitalvinst etc.)
- Pensionsprognos med PPM-integration
- Aktie/fond-portfölj med kurser
- Kryptovaluta-spårning
- Bostadsrättsvärdets utveckling
- Hyresintäkter (uthyrning av rum/lägenhet)
- ROT/RUT-faktura-hantering med hantverkare
```

## Enklare lösningar på komplexa problem

```
Problem: Användaren glömmer att logga utgifter
Enklare lösning än AI: En "Daglig påminnelse" kl 21:00
"Har du loggat dagens utgifter? [Ja] [Lägg till nu]"

Problem: Budget är svår att förstå
Enklare lösning: Visa bara tre siffror överst
"Kvar denna månad: 3 240 kr"
"Dagar kvar: 18"
"Snitt per dag som återstår: 180 kr"

Problem: Många arbetspass att fylla i
Enklare lösning: "Kopiera förra veckan" + ändra undantag
→ Fylls i 90% av schemat på 10 sekunder

Problem: Svårt att förstå sin lön
Enklare lösning: Visa en rad
"Du jobbar 160h → Brutto 30 000 kr → Netto ~21 500 kr"
Klicka för detaljer
```


---

# DEL 54 — KOMPLETT STATE MANAGEMENT PER SIDA

## De 20 frågorna — kör på varje sida

```
1.  Vad är sidans enda syfte?
2.  Kommer användaren hit dagligen / veckovis / månadsvis?
3.  Vad ska synas FIRST (above the fold)?
4.  Vad kan döljas tills det behövs?
5.  Vad kan automatiseras bort helt?
6.  Vad kan AI hjälpa med (om aktiverat)?
7.  Hur fungerar sidan utan AI? (måste fungera)
8.  Vad kräver fler klick än nödvändigt?
9.  Finns modala popup-fönster som kan ersättas med inline?
10. Finns dubbletter av information på sidan?
11. Kan två sektioner slås ihop?
12. Saknas en snabbknapp för vanligaste åtgärden?
13. Kan sidan användas med tummen utan att flytta handen?
14. Är all text läsbar utan att zooma?
15. Utnyttjar desktop-versionen extra utrymmet?
16. Vad känns gammalt och tungt?
17. Vad känns modernt och snabbt?
18. Vad skulle Apple ta bort?
19. Vad skulle Notion förenkla?
20. Vad stör användaren efter 6 månaders daglig användning?
```

## Komplett State-katalog — varje sida implementerar alla

```
EMPTY_STATE         Ingen data alls (första gången)
FIRST_USE           Allra första gången sidan öppnas
LOADING             Data hämtas (skeleton visas)
REFRESHING          Data uppdateras (befintlig data synlig)
PARTIAL_DATA        En del data saknas men annat visas
LARGE_DATA          Tusentals objekt (virtuell lista)
ERROR               Något gick fel (med förklaring)
OFFLINE             Ingen internet (offline-data visas)
SYNCING             Data synkar just nu
SYNC_CONFLICT       Konflikt mellan enheter
IMPORT_PROGRESS     Import pågår (med progress)
EXPORT_PROGRESS     Export pågår (med progress)
OCR_PROCESSING      OCR bearbetar dokument
OCR_REVIEW          OCR klar, granskning krävs
SEARCH_RESULTS      Sökresultat visas
NO_SEARCH_RESULTS   Sökning gav inget (med förslag)
SUCCESS             Åtgärd lyckades (diskret, 3 sek)
WARNING             Varning (kräver uppmärksamhet)
PROCESSING          Bakgrundsprocess pågår
READ_ONLY           Skrivskyddat (t.ex. delat med view-access)
LOCKED              Låst av säkerhetsskäl (Safe Mode)
ARCHIVED            Visar arkiverad data
DELETE_CONFIRM      Bekräftelse innan radering
DELETED_UNDO        Raderat, ångra-möjlighet (5 sek toast)
```

## Per sida — konkreta förbättringar

### Dashboard
```
PROBLEM: För mycket information = ingen information
LÖSNING:
- Visa MAX 3 widgets above the fold
- Resten scrollas till
- Viktigaste: "Nästa pass" / "Kvar denna månad" / "Senaste åtgärd"
- Snabbknapp: alltid synlig FAB (+) för vanligaste åtgärden
- FIRST_USE: "Välkommen! Börja med att lägga in ditt första arbetspass →"
- EMPTY: Inte tomt — visa exempeldata med "Demo-läge" badge
```

### Arbete & Schema
```
PROBLEM: Fylla i pass tar för många steg
LÖSNING:
- "Snabbpass": datum + start + slut → spara på 3 tryck
- Avancerat (raster, OB, anteckning) → kollapsbar sektion
- Veckovy: visa alla 7 dagar, tryck på dag → lägg till pass direkt
- FIRST_USE: "Lägg till din första arbetsgivare och timlön"
- EMPTY_DAY: "Ledig" (inte tom) — klicka för att ändra
- Kalender-chip för status: grön=arbetat, blå=jour, grå=ledig, röd=sjuk
```

### Lön
```
PROBLEM: Användaren förstår inte varifrån siffror kommer
LÖSNING:
- Visa alltid: "Brutto X kr → Skatt Y kr → Netto Z kr"
- Tryck på rad → expandera med förklaring
- "Varför fick jag X i OB?" → visa beräkningsdetalj
- Jämförelsevy: "App säger: X kr / Lönespec säger: Y kr / Skillnad: Z kr"
- Gör skillnaden klickbar → visa vilken post som skiljer
```

### Ekonomi
```
PROBLEM: Budget-sidan är överväldigande
LÖSNING:
- Primär vy: tre nyckeltal (Kvar, Sparat, Skuld)
- Sekundär: kategorier (kollapsbar lista)
- Tertsiär: transaktioner (tryck på kategori)
- Snabbregistrering: swipe från kant → ny utgift (bottom sheet)
- LARGE_DATA: virtuell lista, gruppera per dag
- Återkommande utgifter: visa som separata chips, inte i transaktionslista
```

### Dokument
```
PROBLEM: Svårt att hitta rätt dokument
LÖSNING:
- Primär: senaste 5 dokumenten (inte en stor lista)
- Sekundär: sök (alltid synlig)
- Tersiär: kategorier som filter-chips
- Kamera-knapp: alltid synlig (scanna direkt)
- EMPTY: "Du har inga dokument ännu. [Scanna ditt första] [Ladda upp fil]"
- Automatisk namngivning visas som förslag, användaren bekräftar
```

### Kalender
```
PROBLEM: Kalender visar för lite kontext
LÖSNING:
- Veckovyn är primär (inte månadsvy)
- Varje dag: tid kvar / total tid / OB-indikator
- Klick på dag → inline expandering (inte ny sida)
- Snabb-läggtill: håll in dag → välj typ (pass/påminnelse/ledig)
- Mini-lön under varje dag: "≈ 850 kr" (estimat)
- EMPTY_WEEK: "Inga pass denna vecka. [Kopiera förra veckan] [Lägg till]"
```

### Inställningar
```
PROBLEM: Inställningar är utspridda
LÖSNING:
- Dela i max 3 sektioner på startsidan:
  "Mitt konto" / "Appen" / "Data & Integritet"
- Sök i inställningar (som iOS Inställningar)
- Senast besökta inställningar visas överst
- Kritiska (säkerhet, backup) markeras med ikon
- Varning vid inaktiv backup (> 7 dagar)
```

## Universella state-regler

```
ALDRIG:
- Blank skärm (alltid skeleton eller placeholder)
- "No data found" utan förklaring och CTA
- Spinner utan tidsprognos för operationer > 3 sek
- Felmeddelande utan "Försök igen"-knapp
- Radera utan bekräftelse och ångra
- Framgång utan visuell bekräftelse

ALLTID:
- Skeleton med samma layout som faktisk data
- Empty state med nästa steg
- Error state med mänsklig förklaring
- Offline state med vad som fungerar
- Success med nästa logiska åtgärd (inte bara "Klart!")
- Delete med 5 sekunders ångra-toast
```

## "Vad Apple skulle förenkla" — konkret lista

```
1. Login: Bara "Fortsätt med Apple" + e-post. Ta bort användarnamn.
2. Nytt pass: Datum + start + slut. Allt annat är Advanced.
3. Budget: En siffra, en färg. Grönt = bra, rött = varning.
4. Sök: Alltid synlig. Aldrig bakom en meny.
5. Notiser: Samla och visa en gång om dagen, inte var 5:e minut.
6. Inställningar: 3 kategorier, inte 15 rader med alternativ.
7. Dashboard: En sak per widget, inte fem saker per widget.
8. Radera: Svep + bekräfta. Inte 3 menyer.
9. Import: Drag-and-drop eller kamera. Ingen fil-manager.
10. Lön: En rad med siffran. Expandera för detaljer.
```


---

# DEL 55 — "WHAT IF" — VERKLIGHETEN GÅR FEL

> "Life OS ska inte bara fungera när allt går rätt. Det ska fungera när verkligheten går fel."

Varje scenario nedan har: **Upptäckt → Varning → Lösning → Återställning**

## Arbete — röriga verklighetsscenarier

```
Två pass överlappar:
→ Upptäckt: vid sparande, kontrollera överlapp mot befintliga pass
→ Varning: "Detta pass överlappar med [befintligt pass 08:00–16:00]"
→ Lösning: [Behåll båda] [Ersätt] [Justera tider] [Avbryt]
→ Aldrig tyst spara överlappande pass

Användaren glömmer stämpla ut:
→ Pass har start men ingen sluttid efter 12h
→ Notis: "Ditt pass som började 08:00 pågår fortfarande. Stämpla ut?"
→ Lösning: [Stämpla ut nu] [Ange sluttid manuellt] [Det pågår fortfarande]

Stämplar ut dagen efter:
→ Sluttid är före starttid OCH nästa dag
→ Tolka som pass över midnatt automatiskt
→ Bekräfta: "Menar du att passet slutade 07:00 nästa dag?"

Pass börjar ena månaden, slutar nästa:
→ 31 jan 22:00 → 1 feb 06:00
→ Passet tillhör startdatumets månad för lönestatistik
→ Men OB för feb-timmarna räknas korrekt
→ Visa i BÅDA månadernas kalender (med indikator)

OB-regler ändras mitt i anställning:
→ pay_rules har valid_from/valid_to
→ Pass beräknas med reglerna som gällde det datumet
→ Historiska pass räknas ALDRIG om automatiskt
→ Notis: "Nya OB-regler gäller från [datum]. Tidigare pass påverkas inte."

Lön saknar pass / Pass finns men ingen lön:
→ Vid lönespec-import: matcha mot registrerade pass
→ "Lönespec visar 12 pass, appen har 11. Ett pass saknas."
→ Visa vilket datum som saknas → [Lägg till pass] [Ignorera]

Fel tidszon (användaren reser):
→ All tid lagras UTC, visas i vald tidszon
→ Om enhetens tidszon ändras: "Du verkar ha bytt tidszon. 
   Visa tider i [Stockholm] eller [Ny tidszon]?"
→ Arbetspass behåller ALLTID sin ursprungliga tidszon
```

## OCR — problematiska dokument

```
Suddig/mörk bild:
→ Upptäckt: OCR confidence < 40% totalt
→ Varning: "Bilden är svår att läsa. Prova igen med bättre ljus?"
→ Lösning: [Ta ny bild] [Fortsätt ändå] [Ange manuellt]

Trasigt/handskrivet papper:
→ OCR försöker, markerar osäkra fält tydligt
→ Handskrift: "Handskrivna dokument stöds inte fullt ut. 
   Verifiera alla fält noga."

PDF med 500 sidor:
→ Varning INNAN bearbetning: "Detta dokument har 500 sidor. 
   Bearbeta alla eller välj sidor?"
→ Lösning: [Alla] [Välj sidintervall] [Bara första 10]
→ Bearbeta i bakgrunden med progress

Fel språk:
→ OCR detekterar språk
→ Om inte svenska/engelska: "Dokumentet verkar vara på [språk]. 
   OCR fungerar bäst på svenska och engelska."

Samma dokument laddas upp igen:
→ Checksumma jämförs mot befintliga dokument
→ "Detta dokument finns redan (uppladdat [datum]). 
   [Öppna befintligt] [Ladda upp ändå som kopia] [Avbryt]"
```

## Ekonomi — kaotiska pengar

```
Negativ budget / negativt konto:
→ Tillåtet (verkligheten är så)
→ Visa i rött med tydlig indikator
→ Ingen skam-formulering, bara fakta: "-1 240 kr"
→ Erbjud: "Vill du se vad som kan justeras?"

Dubbla transaktioner (bank importerar dubbelt):
→ Upptäckt: samma belopp + datum + beskrivning inom 24h
→ Varning: "Möjlig dubblett: [transaktion]. Är detta två separata köp?"
→ Lösning: [Ja, behåll båda] [Nej, ta bort dubblett]

Återbetalning:
→ Negativt belopp i utgiftskategori = återbetalning
→ Minskar månadens utgift i den kategorin
→ Tydlig visuell skillnad (grön, med minustecken)

Delbetalning:
→ En skuld kan betalas i flera omgångar
→ debt_payments spårar varje betalning
→ Visa: "45 000 kr → 12 000 kr betalt → 33 000 kr kvar"

Skuld säljs vidare (till inkasso):
→ Behåll historik, uppdatera borgenär
→ "Denna skuld har övergått från [Bank] till [Inkasso]"
→ Ursprungsinformation bevaras

Konto tas bort:
→ Transaktioner kopplade till kontot: vad händer?
→ Varning: "Detta konto har 47 transaktioner. 
   [Arkivera konto (behåll historik)] [Ta bort allt]"
→ Rekommendera arkivering, aldrig tyst radera historik
```

## Dokument — filproblem

```
Lösenordsskyddad PDF:
→ Upptäckt vid uppladdning
→ "Denna PDF är lösenordsskyddad. Ange lösenord för att läsa:"
→ Lösenord används bara för att läsa, sparas ALDRIG
→ Alternativ: [Spara som skyddad (ingen OCR)] 

Korrupt PDF:
→ "Filen kunde inte läsas. Den kan vara skadad."
→ [Försök ladda upp igen] [Spara ändå (utan förhandsvisning)]

Gigantisk fil (> 25 MB):
→ Varning INNAN uppladdning: "Filen är 47 MB (max 25 MB). 
   Komprimera automatiskt?"
→ [Komprimera] [Avbryt]

Fel filtyp:
→ "Filtypen .xyz stöds inte. Stödda format: PDF, JPG, PNG, HEIC."
```

## Kalender — dubbletter och ändringar

```
Kalender importeras två gånger:
→ Matcha på titel + start + slut
→ "23 händelser finns redan. Importera bara nya (5 st)?"

Återkommande händelse ändras:
→ "Ändra bara denna, eller alla framtida?"
→ [Bara denna] [Denna och framåt] [Alla]
→ Aldrig ändra alla utan att fråga
```

## Backup — när räddningen fallerar

```
Backup avbryts:
→ Delvis backup markeras som "ofullständig"
→ "Backup avbröts. Senaste kompletta backup: [datum]. Försök igen?"

Backup är korrupt:
→ Checksumma-kontroll vid återställning
→ "Denna backup verkar skadad. Prova en tidigare backup?"
→ Visa lista med alla tillgängliga backups

Användaren väljer fel backup:
→ FÖRE återställning: visa preview
→ "Denna backup är från [datum] och innehåller: 
   47 pass, 120 transaktioner, 15 dokument. Återställ?"
→ Aldrig återställa utan preview och bekräftelse
```

## Sync — flera enheter, en sanning

```
Två mobiler ändrar samma objekt:
→ Konfliktdetektering via version-nummer
→ "Detta pass ändrades på en annan enhet. 
   [Denna enhets version] [Andra enhetens version] [Behåll båda]"
→ Visa exakt vad som skiljer

Mobilen offline i tre veckor:
→ Alla ändringar köade lokalt
→ Vid återanslutning: batch-synk med konfliktkontroll
→ "Synkar 47 ändringar från de senaste 3 veckorna..."
→ Konflikter samlas och visas för granskning

Internet försvinner mitt i synk:
→ Synk är transaktionell — antingen hela eller inget
→ Delvis synkade ändringar rullas tillbaka
→ Återförsök automatiskt vid återanslutning

Användaren loggar ut under synk:
→ "Synk pågår. Vänta tills den är klar eller [Synka senare]?"
→ Köade ändringar sparas lokalt tills nästa inloggning
```

## Sök — extremfall

```
1 miljon dokument:
→ Virtuell lista + paginerad sökning
→ Visa topp 20, "Ladda fler" eller förfina sökning
→ Sökindex i IndexedDB för snabbhet

Felstavning:
→ Fuzzy matching: "Menade du [rätt stavning]?"
→ Visa närliggande resultat ändå

Emoji / specialtecken:
→ Sanitera sökinput, men tillåt emoji i anteckningar
→ Sökning på emoji fungerar om det finns i data

Inga träffar:
→ "Inga resultat för '[sökord]'"
→ Förslag: [Rensa filter] [Sök i arkiv] [Kontrollera stavning]
→ Visa liknande resultat om möjligt
```

## Säkerhet — attack och förlust

```
Fel PIN 50 gånger:
→ Efter 5 fel: 30 sekunders väntetid
→ Efter 10 fel: 5 minuters väntetid
→ Efter 20 fel: kräv full inloggning (e-post + lösenord)
→ Data raderas ALDRIG automatiskt (till skillnad från vissa appar)
→ Notis till registrerad e-post om upprepade fel

Stulen telefon:
→ Från annan enhet: logga ut alla sessioner
→ Data är krypterad lokalt
→ Biometri/PIN skyddar appen
→ Fjärr-radering möjlig (men data finns i molnet)

Nytt SIM / ny telefon:
→ SIM påverkar inte appen (ingen SMS-baserad auth som enda metod)
→ Ny telefon: logga in → återställ från moln → verifiera enhet

AI försöker läsa spärrat objekt:
→ AI-permission kontrolleras INNAN varje läsning
→ Om nekad: AI får ett tomt svar, loggas i audit
→ "AI försökte läsa [objekt] men saknar behörighet"
```

## Användare — mänskligt beteende

```
Trycker bakåt mitt i formulär:
→ Om osparade ändringar: "Spara innan du lämnar? [Spara] [Släng] [Avbryt]"
→ Autospar-utkast finns som backup ändå

Stänger appen / batteriet dör / krasch:
→ Formulär-state sparas var 10:e sekund lokalt
→ Vid återöppning: "Fortsätt där du slutade?"

Råkar radera:
→ Allt hamnar i papperskorg (30 dagar)
→ 5-sekunders ångra-toast direkt efter radering
→ "Raderat. [Ångra]"

Vill börja om:
→ Inställningar → "Börja om" → radera all data (med bekräftelse × 2)
→ Erbjud export FÖRST: "Vill du spara en backup innan?"

Vill flytta allt (till annan tjänst):
→ Full export i öppna format
→ "Exportera allt" → JSON + CSV + dokument i ZIP
→ Ingen lock-in, allt är portabelt
```

## What-If implementeringskrav

```
Varje scenario ovan ska ha:
□ Automatisk upptäckt (systemet märker problemet)
□ Tydlig varning (användaren informeras begripligt)
□ Konkret lösning (användaren erbjuds vägar framåt)
□ Återställning (inget går förlorat)
□ Loggning (händelsen registreras i audit_log)
□ Testfall (scenariot testas automatiskt)

Detta är inte edge cases att hantera "sen".
Detta ÄR produkten. Verkligheten är rörig.
```


---

# DEL 56 — PLATTFORMSSYSTEM (KONSOLIDERAT + PRIORITERAT)

> Denna del samlar de stora delsystemen från System Bible-promptarna. Var och en är
> beskriven kort med sin kärnprincip och prioritetsnivå. Fullständiga fältlistor finns i
> källpromptarna. Syftet här: en byggbar överblick, inte en upprepning av varje fält.
>
> **Prioritetsnyckel:** CORE = kärna, byggs först · MVP = alpha · V1/V2 = senare · FUTURE = vision

## Arkitektonisk grundprincip (CORE)
Life OS är ett operativsystem, inte en samling appar. Allt bygger på:
**Gemensam kärna → Workspaces → Moduler ovanpå.** Ingen modul bygger egna
notissystem, sökmotorer, regelmotorer eller formulärmotorer — alla använder de
gemensamma motorerna nedan. En modul som kraschar får aldrig ta ner kärnan.

## Workspaces (CORE)
En användare, flera isolerade kontexter: Privat · Familj · Företag · Projekt · Test.
Varje workspace har egna data, dashboards, moduler, roller, färger. `workspace_id` på
alla objekt (se Del 46). Privat data läcker ALDRIG till företagskontext utan explicit
delning. Företagsanvändare ser "Ej tillgänglig", aldrig händelsens innehåll.

## Universal Object Hub (CORE)
Varje större objekt öppnas i en Hub med samma grundstruktur: Header → Overview →
Primary Actions → Status → Timeline → Related Objects → Documents → Notes → Tasks →
Activity → History → Permissions → Settings → (valfri AI-panel). Objektspecifika flikar
läggs till men grundstrukturen är alltid igenkännbar. Hub-mallar: Person, Transaction,
Schedule, Document, Asset, Project. **Ersätter parallella detaljsidor.**

## Universal Search & Command Palette (CORE/MVP)
En sökmotor för allt. Cmd/Ctrl+K. Söklägen: Global · Workspace · Modul · Object Hub ·
Arkiv · Papperskorg · Hjälp · Kommando. Regelbaserad naturlig sökning UTAN AI
("obetalda fakturor denna månad", "jourpass i juli"). Behörighetskontroll vid indexering
OCH sökning — spärrat innehåll syns aldrig. Offline-sök i lokal data. AI-semantisk sök är
valfritt lager som alltid länkar tillbaka till källobjekt. **CORE: grundsök. V1: Command
Palette-actions. V2: AI-semantik.**

## Notification Engine (CORE)
EN motor för alla notiser — ingen modul har eget notissystem. Typer: Info · Påminnelse ·
Varning · Kritisk · Godkännande · Förslag. Prioritetsmotor (🔴🟠🟡🟢). Smart gruppering
("5 fakturor" inte 5 notiser). Daily Briefing + Evening Review (opt-in). Quiet Hours.
Actionable notifications (åtgärda utan att öppna). Kritiska notiser kan ej stängas av.

## Rules Engine (CORE)
EN regelmotor för alla moduler. OM-villkor-resultat, byggd visuellt. Regeltyper:
Validation · Business · Permission · Security · Scheduling · Financial · Workflow ·
Notification · Compliance · Privacy. Actions: Tillåt · Blockera · Varna · Begär bekräftelse ·
Skapa notis/uppgift · Logga · Kräv godkännande. Konfliktdetektering mellan regler.
Test-läge. Alla överträdelser loggas. AI får föreslå regler, aldrig aktivera dem.

## Automation Engine + Event Bus (CORE/V1)
Moduler kommunicerar via Events, aldrig direkt. Varje händelse skapar ett Event (se
eventkatalog Del 43). Automation Builder: OM trigger → villkor → actions. Färdiga
workflow-mallar (Ny kund → CRM + välkomst + uppgift). Allt kan köras manuellt, pausas,
simuleras, loggas. AI får föreslå/optimera automationer, aldrig skapa/aktivera utan
godkännande. **CORE: Event Bus. V1: Automation Builder-UI.**

## Form & Custom Data Engine (V1)
EN formulärmotor för hela systemet — inga separata formulärbyggare per modul. Drag-
and-drop, 40+ fälttyper, villkorliga fält, beräknade fält, upprepade grupper. Custom
fields på alla objekttyper. Custom object types (får ej kringgå kärnans säkerhet/historik).
Publika formulär (bokning, offert) läcker aldrig interna fältnamn. Checklist- och
Inspection-läge. Formulärversionering — gamla svar knyts till exakt version.

## Reporting & Analytics Engine (V1)
EN rapportmotor. Report Builder utan kod. Drill-down: varje summerat värde kan öppnas
till källobjekten — ingen svart låda. Live report vs Snapshot (fryst) tydligt åtskilt.
Rollbaserade dashboards. Regelbaserade prognoser utan AI (visar antaganden + osäkerhet).
Behörighet kontrolleras på BÅDE rapport och underliggande data. Känslig data (lön, hälsa)
kräver extra skydd.

## Contact, CRM & Communication Engine (V1/V2)
Person / Organization / Relationship som separata koncept. Samma person = EN post med
flera relationer (aldrig dubbletter), men workspace-separerade anteckningar. Dubblett-
detektering + merge (aldrig automatisk). CRM-pipeline (V1). Communication Center: alla
kanaler i en tidslinje, källa bevarad. Consent Center — marknadsföringssamtycke ≠
generellt databehandlingssamtycke. **V1: kontakter + kommunikation. V2: full CRM-
pipeline.**

## Digital Vault (MVP/V1)
Användarens digitala bankfack. Alla viktiga dokument (pass, körkort, försäkring, avtal,
lönespec, garanti). Expiration Center: påminner innan pass/försäkring/garanti går ut.
Emergency Vault: kritiska dokument nåbara snabbt. OCR föreslår relationer, skapar dem
aldrig automatiskt. Kryptering + biometri för känsliga. **MVP: dokumentlagring + OCR.
V1: Expiration Center + Emergency Vault.** (Bygger vidare på Del 14 dokumentmodul.)

## Knowledge Base (V2)
Centralt kunskapsbibliotek: manualer, SOP, guider, FAQ, checklistor. Artikel-Hub med
versionering + godkännandeflöde. Kopplas till objekt (SOP för en tjänst, guide för ett
fordon). Learning Mode + onboarding-integration.

## System Health & Maintenance Center (V1)
Alla moduler rapporterar status till ett Health Center. Health Score med förklaring.
Diagnostics: trasiga länkar, dubbletter, felaktiga relationer, misslyckade jobb. Backup
Monitor, Sync Center, Integration Health, Module Health, Security Health, Storage Manager,
Recovery Center. Safe Mode (endast kärna laddas). AI får förklara problem, aldrig köra
reparationer/återställningar utan godkännande. (Utökar Trust Dashboard, Del 49.)

## Integration Hub (V2/FUTURE)
EN integrationsmotor — ingen modul bygger egna integrationer. Typer: banker (Open
Banking), kalendrar, e-post, molnlagring, betalningar, bokföring, kartor, väder, SMS, push,
signering. Allt frivilligt — Life OS fungerar helt utan integrationer. Per-integration-
behörigheter (minsta möjliga). Konflikthantering vid dubbelriktad synk. AI får aldrig läsa
mail/bank/kalender utan separat tillstånd.

## Extension Platform & Marketplace (FUTURE)
Solution Packs = färdiga konfigurationer (Workspaces + dashboards + formulär + regler +
mallar), aldrig separata appar och aldrig användarens privata data. Sandbox-test innan
installation. Safe install (backup + restore point). Capability Manager (varje modul
deklarerar vad den använder). Extension SDK. Allt sandboxat, signerat, resursbegränsat.

## Adaptive Experience Engine (FUTURE)
Observerar användningsmönster (aldrig diagnostiserar användaren), ger frivilliga förslag.
Focus Modes (Business/Finance/Health/Minimal/Senior/Power User). Expert Intelligence-
lager (Finance/Investment/Business/Fitness/Nutrition/Travel-experter) — alla valfria, alla
med Confidence Score + Explainability. Fungerar helt utan AI. **Inga dark patterns:** AI
får aldrig styra, manipulera, dölja osäkerhet eller påstå utan stöd.

## Memory Engine, Decision Center, Future Capsule (FUTURE)
Memory Engine: automatiska + manuella livshändelser på en tidslinje, milstolpar,
"denna dag för X år sedan". Decision Center: dokumentera viktiga beslut med alternativ,
risk, uppföljning, lessons learned. Future Capsule: digitala tidskapslar med öppnings-
villkor. Alla tre: AI får sammanfatta, aldrig skapa falska minnen eller skriva om innehåll.


---

# DEL 57 — PAYDAY CENTER (löneavstämning — MVP-kärna)

> Detta är ett av produktens starkaste värdeerbjudanden: hjälp användaren kontrollera
> att lönen stämmer. **Fungerar helt utan AI.** Prioritet: MVP (P1, efter grundläggande
> arbetspass + lön i Fas 2).

## Kärnidé — three-way reconciliation
Systemet jämför TRE separata datakällor och visar skillnaderna:
```
1. Planerat schema
2. Faktiskt arbetad tid (verifierad)
3. Lönespecifikation (importerad)

Visa: Schema ↔ Faktiskt · Faktiskt ↔ Lönespec · Förväntad lön ↔ Faktisk lön
Varje uppgift visar tydligt vilken källa den kommer från.
```

## Payday-status (per period)
```
🟢 Matchar   🟡 Behöver verifieras   🔴 Avvikelse hittad   ⚪ Underlag saknas
```

## Line-by-line comparison
Varje lönekomponent (grundlön, OB vardag/kväll/natt/helg/storhelg, jour, beredskap,
mertid, övertid, semesterersättning, sjuklön, sjukavdrag, VAB, traktamente, milersättning,
skatt) på egen rad med: förväntat antal · förväntat belopp · lönespecens antal · lönespecens
belopp · skillnad · status · datakälla.

## Deviation detection (regelbaserad, ingen AI)
Systemet markerar möjliga avvikelser: saknade pass, fel timmar, saknad/fel OB, saknad
jour, missad rast ej ersatt, felaktigt rastavdrag, oväntat avdrag, fel semesterersättning,
dubblettrader, lönepost utan pass, skillnad bank vs nettolön.

**Kritiskt språkkrav:** Systemet påstår ALDRIG att arbetsgivaren gjort fel. Formuleringar:
"Möjlig avvikelse" · "Behöver kontrolleras" · "Underlag saknas" · "Beloppen matchar inte".
Användaren avgör alltid vad som faktiskt rapporteras.

## Missed Break Manager + Break Bank (MVP)
Efter varje pass: snabbval för raststatus (tagen/ej tagen/delvis/avbruten/vet inte).
Missade raster samlas i en Rastbank med status (orapporterad → rapporterad → godkänd →
utbetald). Månadsvis påminnelse: "Du har 4 missade raster, uppskattat värde 428 kr."
**Global regel: användaren ska aldrig förlora ersättning för att en missad rast glömts bort.**

## Message Builder (MVP)
Skapar färdigt, redigerbart, professionellt meddelande från markerade avvikelser. Mallar
för missade raster, saknad OB, saknad jour, fel timmar, uppföljning. Kopiera / dela / e-post
/ SMS. **Systemet skickar aldrig automatiskt** — användaren kopierar och skickar själv.

## Report status + follow-up (V1)
Ärendestatus: Utkast → Skickat → Arbetsgivaren utreder → Godkänt → Rättas nästa lön →
Utbetalt → Avslutat. Uppföljningspåminnelser vid uteblivet svar. Vid nästa lönespec:
kontrollera automatiskt om utlovad rättelse kom med.

## History & evidence
Varje avvikelse bevarar: ursprungligt schema, faktiskt pass, lönespec, OCR-resultat,
användarens korrigeringar, skickat meddelande, svar, rättelse, utbetalningsbevis, tidslinje.
Originalmaterial skrivs aldrig över.

---

# DEL 58 — BUSINESS OS (egenföretagare — V1/V2)

> Ett valfritt lager ovanpå kärnan för egenföretagare (t.ex. fönsterputs, städ, frisör).
> Använder SAMMA kalender, objektmodell, dokument, sök, behörigheter som privatdelen.
> Aldrig ett separat system. Branschmallar KONFIGURERAR systemet, skapar aldrig egna
> appar. Prioritet: V1/V2 (efter privat alpha är stabil).

## Public Booking Portal (V1)
Offentlig bokningssida (t.ex. lifeos.app/boka/foretag). Kund bokar utan Life OS-konto.
**Privacy Wall (kritiskt):** kunden ser bara Ledig/Begränsad/Fullbokad — aldrig VARFÖR
en tid är blockerad, aldrig privata kalenderhändelser, aldrig andra kunder. Bokningslägen:
Direct · Request · Quote First · Callback · Recurring.

## Availability Engine (V1)
Beräknar lediga tider från: arbetsschema, privat kalender (blockerar men exponerar ej),
företagskalender, befintliga bokningar, semester, restid, serviceområden, buffertar.
Route-aware: en tid visas ej som bokningsbar om restiden gör den omöjlig.

## Calendar conflict protection (V1)
Innan bokning bekräftas: tiden reserveras kortvarigt → kontrollera fortfarande ledig +
restid + resurser + dagskapacitet → bekräfta atomiskt. Två kunder kan aldrig boka samma
tid/resurs (samma idempotency-princip som Del 42).

## Job Object Hub + Field Service (V2)
Varje bokning blir ett uppdrag med hela kedjan: Förfrågan → Offert → Bokning → Check-in
(tid/GPS/foto) → Utförande (checklista/material/extraarbete) → Check-out (efterbilder) →
Betalning → Faktura → Återkommande. Before/after-foton, RUT/ROT-beräkning,
kundsignatur, väder-varning för väderberoende tjänster.

## Business finance separation (V1)
Privat och företagsekonomi hålls strikt åtskilda. När ett uppdrag slutförs kan intäkt,
fakturaunderlag och kostnader skapas — men i företagets workspace, aldrig blandat med
privat budget.

## Vacation ↔ Business sync (V2)
När företagaren planerar semester: blockera nya bokningar, dölj tider publikt (utan att visa
"semester"), hantera befintliga kundbokningar (föreslå ombokning — aldrig automatiskt
flytta/avboka), gradvis återgång efter hemkomst. Kopplar ihop semesterplanering (privat)
med bokningskalender (företag) utan att exponera privata detaljer.

## Business acceptance (kärnkrav)
Fungerar utan AI · privat kalender blockerar utan att exponeras · kund bokar utan konto ·
dubbelbokning omöjlig · allt kan testas i Sandbox innan publicering · en kalender, en
sanning även med bokningar från flera kanaler.


---

# DEL 59 — UNIVERSAL SCAN & IMPORT ENGINE (kritisk alpha-komponent)

> **EN scanner för allt.** Inte 500 scanners. Användaren fotar/laddar upp
> något, och systemet avgör själv vad det är, extraherar rätt data, och
> gör rätt sak — utan att gissa fram falska pass eller skapa dubbletter.
> Detta är den svåraste delen av appen och byggs med extra säkerhetslager.
> Prioritet: MVP (Fas 3, direkt efter Arbete & Lön fungerar).

## Kärnprincip — KLASSIFICERA FÖRST, HANDLA SEN

Den absoluta grundregeln: **scannern gör ingenting med datan förrän den
vet vad dokumentet ÄR och användaren bekräftat det.** Flödet är alltid:

```
Upload → Spara original → Klassificera → VISA "Detta ser ut som: X" →
Användaren bekräftar/korrigerar typ → Extrahera rätt fält för den typen →
Förhandsgranska → Dubblettkontroll → Användaren godkänner → Importera
```

Scannern skapar ALDRIG pass, ändrar ALDRIG inställningar och sparar ALDRIG
något importerat innan användaren sett förhandsgranskningen och tryckt
godkänn. Originaldokumentet sparas alltid först, oförändrat.

## STEG 1 — DOKUMENTKLASSIFICERING (det som saknades)

Innan någon extraktion sker klassificerar systemet dokumentet till en typ:

```
schema        — arbetsschema/turlista (framtida/planerade pass)
payslip       — lönespecifikation (utbetald lön, en period bakåt)
receipt       — kvitto (en transaktion)
invoice       — faktura/räkning (att betala)
contract      — anställningsavtal/kollektivavtal
warranty       — garantibevis
insurance     — försäkringsbrev
id_document   — pass/körkort/ID
other         — okänt, sparas bara som dokument
```

Klassificeringen bygger på regelbaserade signaler FÖRST (fungerar utan AI),
AI som valfritt förstärkande lager:

**Signaler för `schema`:** flera datum i framtiden · tider i mönster
(07–16, 14–22) · veckodagar · passkoder (D/K/N/J) · rubrik som
"schema/turlista/arbetspass" · avsaknad av kronor-belopp.

**Signaler för `payslip`:** ett periodintervall bakåt i tiden · ord som
"lönespecifikation/löneutbetalning/bruttolön/nettolön/skatteavdrag" ·
kronor-belopp i kolumner · personnummer/anställningsnummer · arbetsgivarens
org.nr · rader som "OB-tillägg", "semesterersättning".

**Signaler för `receipt`:** ett datum · en totalsumma · butiksnamn · moms.

**Om signalerna är svaga eller motstridiga** → systemet gissar INTE. Det
visar: "Jag är osäker på vad detta är. Är det ett schema, en lönespec,
eller något annat?" och låter användaren välja. Aldrig auto-import vid låg
klassificerings-confidence.

**KRITISKT — din huvudpoäng:** en tidöversikt/screenshot som användaren
redan lagt in manuellt får INTE tolkas som ett nytt schema och börja skapa
pass. Skydd mot detta:
- Klassificeraren skiljer "tidöversikt/redan registrerat" från "nytt schema
  att importera" via källkontext (om användaren är inne i schema-vyn och
  screenshottar den egna appen → varning).
- Dubblettkontrollen (Steg 4) fångar pass som redan finns.
- Ingen import startar automatiskt vid uppladdning — bara på uttryckligt
  "Importera schema"-val ELLER efter bekräftad klassificering.

## STEG 2 — TYPSPECIFIK EXTRAKTION (samma motor, olika profil)

Efter bekräftad typ använder scannern en **extraktionsprofil** för just den
typen. Samma OCR-motor, samma `ocr_fields`-tabell (Del: OCR Fields), bara
olika förväntade fält. Detta är hur vi undviker 500 scanners — det är EN
scanner med utbytbara fältmallar per dokumenttyp.

**schema → förväntade fält:** rader av {datum, start, slut, passkod,
arbetsplats?}. Varje rad blir ett FÖRESLAGET pass (ännu ej sparat).

**payslip → förväntade fält:** period_start, period_end, arbetsgivare,
bruttolön, nettolön, skatt, OB-belopp (per nivå), jour, semesterersättning,
övertid, timmar, timlön. Se Steg 5 för vad dessa GÖR.

**receipt → förväntade fält:** datum, totalbelopp, moms, butik, kategori-gissning.

Varje fält får confidence: 95%+ = auto-ifyllt, 70–95% = förifyllt men
"bekräfta", under 70% = tomt/manuellt. (Redan i spec, behålls.)

## STEG 3 — SCHEMA-IMPORT: FÖRESLAGNA PASS, INTE SKAPADE PASS

När ett schema tolkas skapar systemet **förslag**, inte pass. Förhandsgranskningen visar:
- Varje rad som ett föreslaget pass med redigerbara fält
- Vilken arbetsprofil passet kopplas till (användaren väljer om oklart)
- Osäkra fält gulmarkerade
- Rader systemet är osäkra på ("Är detta ett pass eller en anteckning?")

Först när användaren trycker "Skapa X pass" skrivs de till `work_shifts`
(med `source='ocr'`). Innan dess finns de bara i importvyn.

## STEG 4 — DUBBLETTKONTROLL (obligatorisk, ALDRIG hoppa över)

Innan pass skapas kör systemet dubblettkontroll mot befintliga `work_shifts`:

```
Ett föreslaget pass räknas som MÖJLIG DUBBLETT om det matchar ett
befintligt pass på: samma work_profile_id + samma date + överlappande
tid (start/slut inom X min).
```

Vid träff visar systemet båda sida vid sida och låter användaren välja:
**Hoppa över** (behåll befintligt) · **Ersätt** · **Behåll båda** (bara om
användaren är säker). Ingen tyst överskrivning, ingen tyst dubblett. Detta
är samma princip som `idempotency_key` men på affärsnivå.

En importbatch loggas (`import_batches`) så hela importen kan ångras samlat
om något blev fel.

## STEG 5 — LÖNESPEC MATAR TILLBAKA INSTÄLLNINGAR (din nyckelidé)

När en `payslip` scannas ska systemet inte bara spara den — det ska LÄRA
sig arbetsplatsens löneregler ur den och föreslå inställningar:

- Ser systemet "OB-tillägg 22:00–06:00: 45 kr/h" på lönespecen → föreslår
  en `ob_rule` för den arbetsprofilen (efter användarens bekräftelse).
- Ser det timlön, skattekolumn, semesterprocent → föreslår att uppdatera
  `work_profiles`-fälten.
- Ser det en arbetsgivare/arbetsplats som inte finns → föreslår att skapa
  en ny arbetsprofil, eller koppla till befintlig.

**Allt är förslag.** Systemet ändrar aldrig löneregler eller skapar profiler
automatiskt. Det säger: "Din lönespec från [arbetsgivare] verkar använda
dessa OB-nivåer. Vill du spara dem som regler för den här arbetsprofilen?"

Detta stänger cirkeln: schema → pass → appens löneuträkning ↔ verklig
lönespec → korrigerade regler → bättre uträkning nästa gång.

## STEG 6 — LÖNESPEC-JÄMFÖRELSE (koppling till Payday Center, Del 57)

Efter import jämförs lönespecens siffror mot appens egen uträkning för
perioden, post för post. Differenser flaggas som "möjlig avvikelse" (aldrig
"arbetsgivaren gjorde fel"). Detta matar Payday Center.

## ARBETE & ARBETSPLATS-INSTÄLLNINGAR (det du efterfrågade)

Scannern behöver veta VILKEN arbetsprofil data hör till. Därför utökas
`work_profiles` och pass med tydlig arbetsplats-hantering:

- **Flera arbetsplatser per arbetsgivare:** en `work_profile` (arbetsgivare)
  kan ha flera arbetsplatser. Ny tabell `workplaces` (se nedan). Pass kopplar
  till både profil och ev. arbetsplats — olika arbetsplatser kan ha olika
  restid, OB, adress.
- Vid import: om schemat/lönespecen nämner en arbetsplats systemet känner
  igen → auto-koppla. Annars fråga.

## EXTRA-/ÖVERTIDSREGLER (det du efterfrågade)

När man jobbar extra gäller andra löneregler. Detta stöds genom att
`ob_rules` redan är data per profil, plus en tydlig markering på passet:

- Passets `shift_category`: `ordinary` / `extra` / `overtime` / `on_call` /
  `standby` / `inbeordrad`. Varje kategori kan trigga egna regler.
- En `ob_rule` kan gälla bara för en viss `shift_category` (nytt fält
  `applies_to_category`). Så "extra-pass ger OB från timme 1" kan uttryckas
  som data, inte hårdkod.
- Lönemotorn visar vilken kategori + vilka regler som gav vilket belopp.

## NYA/UTÖKADE TABELLER FÖR DETTA

```sql
-- Klassificering + hela importflödet spåras
CREATE TABLE import_batches (
  id UUID PK, user_id, document_id,          -- originaldokumentet
  detected_type TEXT,                        -- schema/payslip/receipt/...
  type_confidence DECIMAL(4,3),
  confirmed_type TEXT,                       -- vad användaren bekräftade
  status TEXT DEFAULT 'classified',          -- classified/previewing/imported/reverted/failed
  items_proposed INTEGER, items_imported INTEGER, items_skipped_dupe INTEGER,
  created_at, reverted_at
);

-- Flera arbetsplatser per arbetsgivare
CREATE TABLE workplaces (
  id UUID PK, user_id, work_profile_id REFERENCES work_profiles,
  name TEXT, address TEXT, travel_minutes INTEGER, notes TEXT, deleted_at
);

-- work_shifts: nya fält
ALTER TABLE work_shifts ADD COLUMN workplace_id UUID REFERENCES workplaces(id);
ALTER TABLE work_shifts ADD COLUMN shift_category TEXT DEFAULT 'ordinary';
ALTER TABLE work_shifts ADD COLUMN import_batch_id UUID REFERENCES import_batches(id);

-- ob_rules: regeln kan gälla bara en passkategori
ALTER TABLE ob_rules ADD COLUMN applies_to_category TEXT; -- NULL = alla
```

## SÄKERHETSÅTGÄRDER (scannern måste vara "perfekt")

1. **Original först, alltid.** Filen sparas i `documents` innan OCR körs.
2. **Ingen auto-handling.** Klassificering och extraktion producerar bara
   förslag; import kräver alltid ett uttryckligt godkännande.
3. **Låg confidence = fråga, gissa aldrig.** Både på dokumenttyp och per fält.
4. **Dubblettkontroll obligatorisk** före varje pass-skapande.
5. **Hela batchen kan ångras** via `import_batches` (reverted_at + soft delete
   på skapade rader).
6. **Klassificera-om.** Om användaren säger "fel typ" backar systemet och
   frågar om, sparar korrigeringen som lärdom (lokalt, ingen delad privat data).
7. **Skydd mot self-import.** En screenshot av appens egen schema-/tidvy
   får inte tolkas som nytt schema (varna, kräv extra bekräftelse).
8. **OCR-motorn utbytbar.** Tesseract.js nu, AI-gateway senare — men
   klassificerings- och godkännandelogiken är oberoende av OCR-leverantör.

## ACCEPTANSKRITERIER

Scan & Import Engine är godkänd först när användaren kan:
1. Ladda upp godtyckligt dokument; originalet sparas oförändrat först.
2. Se en korrekt gissad dokumenttyp + möjlighet att korrigera den.
3. Vid osäker typ få en fråga i stället för en felaktig auto-import.
4. Importera ett schema som FÖRSLAG och godkänna innan pass skapas.
5. Se dubbletter fångas och välja hoppa över/ersätt/behåll båda.
6. Ångra en hel importbatch.
7. Scanna en lönespec och få föreslagna OB-/löneinställningar (ej auto-satta).
8. Få lönespecen jämförd mot appens uträkning (möjliga avvikelser).
9. Koppla pass till rätt arbetsprofil OCH arbetsplats.
10. Markera extra-/övertidspass så att andra löneregler gäller.
11. Lita på att en screenshot av egna appen inte skapar spökpass.
12. Använda hela flödet med EN scanner — aldrig välja mellan flera.

---

# DEL 60 — YTTERLIGARE LUCKOR (upptäckta vid scan-genomgången)

Saker som är lätta att missa men som scan/lön-kedjan behöver:

- **Löneperiod ≠ kalendermånad.** Många scheman/lönespecar går t.ex. 16→15.
  `work_profiles` bör ha `pay_period_start_day` så perioder matchar rätt.
- **Retroaktiva ändringar.** En lönespec kan innehålla korrigering för en
  TIDIGARE period (t.ex. missad OB i förra månaden). Systemet måste kunna
  koppla en lönerad till en annan periods pass.
- **Delade/brutna pass samma dag** (t.ex. 06–10 och 16–20). Får inte slås
  ihop till ett pass vid import.
- **Helgdagar/röda dagar** påverkar OB. Behöver en `holiday_rules`-lista
  (rörliga helgdager: påsk, midsommar osv.) så uträkningen blir rätt.
- **Sjuk/VAB/semester i schemat** ska importeras som rätt `status`, inte som
  vanligt arbetat pass.
- **Valuta & öresavrundning** på lön — definiera avrundningsregel en gång,
  använd överallt (undvik att app och lönespec skiljer på 1 kr av avrundning).
- **Tidszon vid import.** Scannade tider tolkas i Europe/Stockholm, lagras
  UTC (samma DST-regel som resten av appen).
- **Flersidiga scheman/lönespecar** — alla sidor bearbetas, inte bara sida 1.
- **Samma arbetsgivare, olika avdelningar** kan ha olika regler — arbetsplats-
  nivån (Del 59) löser detta.
- **Klassificerarens lärande** ska vara lokalt/privat — korrigeringar
  förbättrar framtida gissningar utan att skicka privat data någonstans.


---

# DEL 61 — INFORMATIONSARKITEKTUR & DASHBOARD SOM CENTRUM

> Appen ska inte kännas som separata sidor (Idag, Kalender, Pengar) utan
> som ETT operativsystem med ett centrum. Detta är IA-beslutet som all
> frontend byggs runt. Känsla: Apple/Linear 2030 — lugnt, snabbt,
> självklart. Prioritet: DASHBOARD = MVP (Fas 4), men navigations- och
> designsystemet nedan gäller RETROAKTIVT för allt som redan byggts.

## Grundfilosofi — ett centrum, inte en meny

Dashboard är hem. När appen öppnas ska användaren aldrig behöva fundera på
var något finns — det viktigaste syns direkt, resten är ett klick bort.
Logotypen "My Money Master" leder alltid tillbaka till Dashboard.

**Princip: Dashboard VISAR, sidorna HANTERAR.** Dashboard är en läs- och
snabbåtgärdsyta (widgets + quick add). Djup redigering sker i respektive
sida. Dashboard duplicerar aldrig funktionalitet — den speglar den (One
Source Of Truth, Lag 8).

## Navigationsnivåer (undvik "fem klick")

Tre nivåer, aldrig fler:

```
NIVÅ 1 — Primär navigation (alltid synlig)
🏠 Dashboard · 📅 Kalender · 💼 Arbete & Lön · 💰 Ekonomi ·
📄 Dokument · 📈 Statistik · ⚙️ Inställningar
(Hälsa och AI Coach läggs till när de modulerna byggs — dolda tills dess,
inga tomma flikar, Lag 10.)

NIVÅ 2 — Sidans egna vyer (flikar inom en sida)
T.ex. Arbete & Lön → Schema · Pass · Profiler · Lönecheck

NIVÅ 3 — Objekt (öppnas i Object Hub, se Del 35)
Ett enskilt pass, en lönespec, en utgift
```

Allt har ETT naturligt hem. Om något inte passar i nivå 1–2 hör det hemma i
Inställningar. Regeln: **dagligt = Dashboard/nivå 1 · ibland = nivå 2 ·
sällan = Inställningar.**

## Vad användaren ser FÖRST (prioriteringsordning)

Dashboard laddar i denna prioritet (viktigast överst, kontextuellt):
1. **Idag** — datum, ev. dagens pass (start/slut/rast/lönevärde), nästa händelse
2. **Ekonomi just nu** — kvar att leva på till nästa lön, kontosaldo
3. **Att åtgärda** — Universal Inbox: max 3 viktigaste (missad rast, lönespec
   att kontrollera, räkning snart). Aldrig spam.
4. **Snabbknappar** (Quick Add) — alltid nåbara
5. Resten = valfria widgets användaren själv lägger till

Tomt tillstånd får aldrig vara tomt: visa "Så kommer du igång" (Lag 10).

## Widget-system

Dashboard är widget-baserad. Tillgängliga widgets (användaren väljer):
Idag-kort · Nästa pass · Kommande vecka · Månadens timmar · Beräknad lön ·
Nästa löneutbetalning · Budgetstatus · Kvar att leva på · Kontosaldo ·
Senaste utgifter · Senaste inkomster · Sparmål · Skulder · Prenumerationer ·
Att göra idag · Påminnelser · Kalender · Väder · Senaste dokument ·
Snabbanteckningar · Snabbstatistik · (Hälsa-widgets senare) · (AI-insikter
senare, valfritt).

Varje widget kan: **flyttas · döljas · förstoras · förminskas · sorteras ·
låsas.** Layout sparas per användare (och senare per enhet). Drag & drop.

## Quick Add (global +)

En stor + alltid nåbar (Dashboard + navigation). Öppnar:
+ Pass · + Importera schema · + Importera lönebesked · + Utgift · + Inkomst
· + Anteckning · + Skanna dokument · (+ Träning/Vikt när Hälsa finns).
Varje val öppnar minimalt formulär, inte en hel sida.

## Global sök + Command Palette (Cmd/Ctrl+K)

**Spotlight-känsla.** En sökruta överst, alltid. Söker: pass · utgifter ·
inkomster · dokument · anteckningar · arbetsplatser · personer · kategorier
· taggar · datum. Regelbaserat först (fungerar utan AI, Lag 3).

Samma fält är även **Command Palette** — skriv en åtgärd:
"lägg till pass" · "visa juli" · "visa löner" · "lägg till utgift" ·
"öppna dokument" · "gå till kalender" · "importera schema". Allt öppningsbart
därifrån. (Detta är Universal Search från Del 56 — samma motor, inte en ny.)

## Orientering — var är jag?

- **Breadcrumbs** på nivå 2–3: Dashboard › Arbete & Lön › Pass › 12 juli.
- **Logotyp = hem** (alltid tillbaka till Dashboard).
- **Bakåt/framåt-historik** (som webbläsare) + siffergenvägar på desktop
  (1=Dashboard, 2=Kalender…). (Redan i spec, behålls.)

## Konsekvent designsystem (gäller ALLT, även byggt)

Alla kort, knappar, formulär, tabeller följer SAMMA regler. Inga sidor
byggda på olika sätt. Tokens (redan definierade, Del 5):
- **Spacing:** 4/8/12/16/24/32/48/64 — inga godtyckliga värden
- **Border radius, shadow, typografi, färger, animationshastighet** — en källa
- **Ikoner:** ett bibliotek (lucide), samma stil överallt
- **Hover/fokus/aktiv:** samma beteende överallt
- **Ett komponentbibliotek:** Button, Card, Input, Table, Modal, Sheet,
  Badge, EmptyState — återanvänds, byggs aldrig om per sida (Lag 9, Lag 20)

**Retroaktiv regel:** när en gammal sida rörs, migrera den till
komponentbiblioteket. Ingen ny sida får införa egna marginaler/knappar.

## Vad som hör hemma VAR (IA-beslut)

Många saker ChatGPT listade är inte egna sidor — de är tvärsnitt som
Dashboard och Inbox redan täcker. Beslut:

| Funktion | Hör hemma |
|---|---|
| Notifications Center | Universal Inbox (Del 56) — inte egen sida |
| Activity Feed / Timeline | Life Feed-widget på Dashboard + per Object Hub |
| Favorites / Recently Used | Sök/Command Palette + Dashboard-widget |
| Quick Actions | Quick Add (global +) |
| Drafts | "Fortsätt där du slutade" på Dashboard (Draft Mode, Del 35) |
| Archive / Trash / Undo | Inställningar › Data (papperskorg 30 dgr) |
| Import History / Sync / Backup | Inställningar › System (Health Center, Del 56) |
| Daily/Weekly/Monthly Review | Genereras, visas i Inbox/Dashboard vid rätt tid |
| AI Suggestions | Valfri widget, tydligt märkt, avstängbar (Lag 3) |
| Upcoming Events | Kalender-widget |

Poängen: **fler funktioner ska INTE bli fler sidor.** De flesta blir widgets
eller lever i Inbox. Det håller appen lugn.

## ACCEPTANSKRITERIER (IA)

1. Logotyp leder alltid till Dashboard.
2. Max tre navigationsnivåer; allt har ett naturligt hem.
3. Dashboard visar det viktigaste utan att användaren letar.
4. Widgets kan flyttas/döljas/storleksändras/låsas; layout sparas.
5. Quick Add nåbar överallt.
6. Cmd/Ctrl+K öppnar sök + kommandon; hittar alla objekttyper.
7. Breadcrumbs på djupare nivåer; bakåt/framåt fungerar.
8. Alla sidor använder samma komponentbibliotek och tokens.
9. Inga tomma flikar för moduler som inte byggts än.
10. Nya funktioner blir widgets/Inbox-poster, inte nya sidor, när möjligt.

---

# DEL 62 — LÖNEPERIODMODELLEN (intjänat vs utbetalt + multiplikatorer)

> Två saker som förvirrar användare mest och som appen MÅSTE lösa glasklart.
> Detta är kärnlogik — bygg det i Fas 1 (Arbete & Lön). Prioritet: P0.

## Problem 1 — Lönen kommer för föregående period

Du får i månad N ut lön för arbete i månad N-1 (eller enligt profilens
period). Appen får ALDRIG blanda ihop "vad jag tjänar ihop nu" med "vad
som betalas ut nu". De visas som två tydligt åtskilda saker.

**Modell — tre begrepp, alltid åtskilda:**
```
INTJÄNAT (earned)     — lönevärde för pass i AKTUELL arbetsperiod.
                        "Så mycket har du jobbat ihop hittills denna period."
UTBETALT (paid)       — lön som landar på lönedagen, för en TIDIGARE period.
                        "Detta får du på kontot den 25:e."
PROGNOS (projected)   — earned + återstående planerade pass i perioden.
                        "Så mycket ser perioden ut att landa på."
```

**Varje work_profile definierar sin period och lönedag:**
- `pay_period_start_day` (t.ex. 16 → period 16→15)
- `payday_day` (t.ex. 25) + `payday_offset_months` (t.ex. 1 = betalas månaden efter)

Så systemet vet: "Pass 3–17 mars tillhör perioden 16 feb–15 mar, som betalas
25 mars." Ingen gissning.

**På Dashboard visas detta som två separata widgets, aldrig sammanblandat:**
- *"Intjänat denna period"* (växer när du jobbar) — knuten till aktuell period
- *"Nästa löneutbetalning: 25 mars, ~X kr"* — knuten till förra perioden,
  med tydlig etikett "avser 16 feb–15 mar"

När lönespec för förra perioden scannas (Del 59) kopplas den till RÄTT period
och jämförs mot den periodens intjänade — inte mot innevarande månad.

**Statistik:** intjänat bokförs på arbetsmånaden, utbetalt på utbetalningsmånaden.
Användaren kan växla vy: "visa efter arbetsperiod" / "visa efter utbetalning".
Förskott (t.ex. hela sommarlönen i juni) markeras explicit och sprids inte
felaktigt över månader (edge case redan i spec).

## Problem 2 — Extrapass har annan lön (t.ex. 2,4× )

Extrapass, storhelg, inbeordrad m.m. kan ge en helt annan ersättning — ibland
en ren multiplikator på hela passet (2,4×), ibland tillägg per timme. Detta
MÅSTE gå att fylla i, per pass och som regel.

**Modellen (bygger på ob_rules + shift_category från Del 59):**

Tre sätt att sätta ersättning, i tydlig prioritetsordning:
```
1. PER PASS (starkast) — användaren sätter på ett enskilt pass:
   pay_override_type = 'multiplier' | 'fixed_hourly' | 'fixed_total'
   pay_override_value = t.ex. 2.4
   → "Detta pass betalas 2,4× grundlön." Visas tydligt på passet.

2. REGEL PER KATEGORI — ob_rule med applies_to_category='extra' och
   is_addition=false + multiplier=2.4 → alla extra-pass får 2,4× automatiskt.

3. GRUNDPROFIL — vanlig timlön/OB-regler.
```

Ett per-pass-override slår alltid regeln. Lönemotorn visar ALLTID vilken
nivå som gällde: "2,4× (manuellt satt på detta pass)" eller "2,4× (regel:
extra-pass)". Aldrig svart låda (Lag 12).

**UI:** när användaren markerar ett pass som `shift_category='extra'` (eller
storhelg/inbeordrad), visas ett fält "Ersättning för detta pass" med val:
Använd regel · Multiplikator (t.ex. 2,4) · Fast timlön · Fast totalbelopp.
Timlön/multiplikator = alltid textfält, aldrig stepper (byggregel).

**Nya fält:**
```sql
ALTER TABLE work_shifts ADD COLUMN pay_override_type TEXT;   -- multiplier/fixed_hourly/fixed_total/NULL
ALTER TABLE work_shifts ADD COLUMN pay_override_value DECIMAL(10,3);
-- period-koppling
ALTER TABLE work_shifts ADD COLUMN pay_period_id UUID;       -- vilken löneperiod passet tillhör
ALTER TABLE work_profiles ADD COLUMN payday_day INTEGER;
ALTER TABLE work_profiles ADD COLUMN payday_offset_months INTEGER DEFAULT 1;
```

(En `pay_periods`-tabell kan härledas från profilen eller lagras explicit;
alpha kan börja med härledning och lägga tabell senare vid behov.)

## ACCEPTANSKRITERIER (löneperiod)

1. Dashboard visar "intjänat denna period" och "nästa utbetalning" som
   TVÅ separata saker, var och en med rätt periodetikett.
2. Ett pass kan sättas till annan ersättning (2,4× / fast) direkt på passet.
3. En regel kan ge alla extra-pass en multiplikator automatiskt.
4. Per-pass-override slår regeln; lönemotorn visar vilken som gällde.
5. Scannad lönespec kopplas till rätt period och jämförs mot den periodens
   intjänade — aldrig mot innevarande månad.
6. Statistik kan visas per arbetsperiod ELLER per utbetalning.
7. Förskottslön markeras och snedvrider inte månadsstatistiken.
8. Multiplikator/timlön fylls i som textfält, aldrig stepper.


---

---

# DEL 62B — KANONISKT LÖNEREGEL-BESLUT (löser ob_rules vs pay_rules)

> **Konflikt upptäckt vid granskning:** specen definierade löneregler på TVÅ
> sätt — `ob_rules` (kopplad till `work_profiles`) och `pay_rules` (kopplad
> till `pay_profiles` + `employers`). Det är samma koncept med två namn och
> två datamodeller. Detta skulle få Lovable att bygga fel. Här är det
> bindande beslutet. Vid varje konflikt i äldre delar: DENNA del gäller.

## Beslut: EN tabell heter `ob_rules`, kopplad till `work_profiles`

Namnen `pay_profiles`, `employers` och `pay_rules` UTGÅR. Använd:
- `work_profiles` (arbetsprofil = arbetsgivare/anställning) — inte `pay_profiles`
- `ob_rules` (alla löneregler: OB, övertid, jour, extra m.m.) — inte `pay_rules`

Anledning: `work_profiles`/`ob_rules` används i byggversionen, i scannern
(Del 59), i löneperiodmodellen (Del 62) och multi-tenant (Del 64). Att byta
till pay_profiles skulle kräva omskrivning av allt nyare. Men vi tar med de
BÄSTA fälten från pay_rules-designen (de var bättre):

## Kanoniskt `ob_rules`-schema (denna gäller, ersätter båda tidigare)

```sql
CREATE TABLE ob_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,          -- för RLS
  work_profile_id UUID REFERENCES work_profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,   -- base_hourly/base_monthly/ob/overtime/
                             -- additional_hours/on_call/standby/night/weekend/
                             -- holiday/vacation_pay/deduction/custom
  applies_to_category TEXT,  -- NULL=alla pass, annars ordinary/extra/overtime/... (Del 59)
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,  -- från pay_rules: historik
  valid_to DATE,                                  -- NULL = gäller tills vidare
  day_of_week INTEGER[],     -- 0=sön ... 6=lör
  start_time TIME,
  end_time TIME,
  holiday_type TEXT,         -- red_day/eve/special
  rate_type TEXT NOT NULL,   -- multiplier/fixed_addition/fixed_amount
  multiplier DECIMAL(5,3),
  fixed_amount DECIMAL(10,2),
  priority INTEGER DEFAULT 10,        -- från pay_rules: vilken regel vinner
  stacking_allowed BOOLEAN DEFAULT true,  -- från pay_rules: får regler staplas
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: USING (auth.uid() = user_id)
-- Lönemotorn visar ALLTID vilka regler (namn + priority) som gav vilket belopp.
```

Fält som försvinner jämfört med gamla ob_rules: `type` → heter nu `rule_type`.
`is_addition` (bool) → ersätts av `rate_type` (mer exakt: multiplier vs
fixed_addition vs fixed_amount).

## Var detta påverkar äldre delar

- Del 24/38 (rad ~797): `ob_rules (...multiplier...)` — uppdatera mentalt till ovan.
- Del 43 (rad ~2965): hela `pay_rules`-tabellen + `pay_profiles` + `employers`
  → ERSÄTTS av detta. Ignorera pay_profiles/employers som tabellnamn.
- Del 26/40: löneexempel som nämner pay_rules → läs som ob_rules.
- Byggversionen: uppdaterad till detta schema.

# DEL 63 — KANONISK MOTORKARTA (konsolidering av Gamma/Delta/Omega/Vault/Hub)

> Fem stora expansionsdokument (Universal Object Vault, System Architecture
> Expansion, Gamma, Delta, Omega, Universal Life Hub) föreslog tillsammans
> 100+ "motorer". Detta är den ärliga konsolideringen: de beskriver samma
> handfull idéer under olika namn. Denna del namnger den ENDA kärnan och
> mappar allt annat dit. **Regeln som alla fem dokument själva efterfrågar:
> färre men kraftfullare motorer, ingen dubblettlogik, allt utgår från
> Object Model.** Lägg aldrig till en "motor" utan att först kolla denna karta.

## Sanningen: ~10 kärnmotorer, inte 100

Allt i de fem dokumenten faller in i en av dessa. Kolumnen "kallades även"
visar alla alias som ska SLUTA användas som separata system.

### 1. OBJECT ENGINE (kärnan i allt)
Ett gemensamt objektschema för allt (pass, dokument, bil, hus, försäkring,
företag, person, produkt). Redan i spec: "Universal Object Metadata" (Del:
metadata-fälten), "Universal Object Hub" (Del 35).
- **Kallades även:** Universal Object Model · Object Schema Engine · Digital
  Twin 1.0/2.0 · Object Inspector · Universal Object Vault · Life Hub ·
  Universal Profile Engine (profiler = objekt) · Object Lifecycle Engine
  (status är ett fält på objektet).
- **Beslut:** ETT objektschema. Varje objekttyp lägger sina extrafält i sitt
  typ-schema — aldrig en parallell modell. En bil, ett hus, en TV är samma
  slags objekt med olika typfält. "Digital Twin" = att öppna ett objekt och
  se allt kopplat till det. Det är en VY, inte en motor.

### 2. RELATIONSHIP ENGINE
Kopplar objekt till objekt. Redan i spec: `object_relations`-tabellen (Del 35).
- **Kallades även:** Object Relationship Engine · Life Graph · Knowledge Graph
  · Object Dependency Engine · Receipt/Insurance Linking · Context Engine.
- **Beslut:** EN relationstabell. "Life Graph" = en visualisering av den.
  "Dependency" = att läsa relationerna baklänges innan radering. "Context
  Engine" = att fråga relationerna "vad hör till det här?". Allt är samma data.
- **KRITISKT (din poäng om Life Hub):** samma originalfil kopplas till FLERA
  objekt via relationer — laddas aldrig upp två gånger. Ett kvitto → produkt
  + garanti + transaktion + fastighet samtidigt. Detta är redan möjligt med
  `object_relations`; gör det till standard i UI.

### 3. EVENT ENGINE (nervsystemet)
Varje förändring skapar ett event. Redan i spec: Event Bus + eventkatalog
(Del 43).
- **Kallades även:** Universal Event Engine · Timeline · Object Timeline ·
  Activity Feed · Life Feed · Time Machine · History · Audit Log.
- **Beslut:** EN eventström. Timeline/Feed/History/Time Machine är alla
  VYER av samma events, filtrerade olika (per objekt, per dag, hela systemet
  bakåt). Bygg aldrig ett separat historiksystem.

### 4. VERSION ENGINE
Spara tidigare versioner + återställ. Redan i spec (versionspost i metadata).
- **Kallades även:** Universal Version Engine · Draft Engine · Undo Center.
- **Beslut:** version = en typ av event + en sparad tidigare kopia. Undo =
  återställ senaste version. Utkast = osparad version.

### 5. RULES & AUTOMATION ENGINE
OM trigger → villkor → action. Redan i spec (Rules Engine + Automation +
Event Bus, Del 56).
- **Kallades även:** Policy Engine · Workflow Engine · Smart Suggestion
  Engine · Rules Engine.
- **Beslut:** EN regelmotor. "Policy" = regler för behörighet/lagring.
  "Workflow" = en kedja av regler + checklista. "Suggestion" = en regel som
  föreslår istället för att agera. AI får förbättra förslag, aldrig krävas (Lag 3).

### 6. VALIDATION & HEALTH ENGINE
Kontrollerar data innan sparning + hittar problem i efterhand. Nytt men litet.
- **Kallades även:** Data Integrity Engine · System Health Score · Object
  Health Score · Validation Engine · Platform Diagnostics · Readiness Score ·
  Observability.
- **Beslut:** EN motor som kör regler mot data. "Validering" = regler före
  sparning. "Health Score" = samma regler körda mot befintlig data, summerat.
  Ändrar aldrig något automatiskt — visar bara.

### 7. IMPORT & DOCUMENT ENGINE (redan byggplanerad)
EN scanner, klassificera först. Redan i spec: Del 59 (Universal Scan Engine).
- **Kallades även:** Import Engine · Import History Center · OCR Engine ·
  Data Pipeline · Merge Engine (merge = import som matchar mot befintligt objekt).
- **Beslut:** allt detta ÄR Del 59. Merge = steget "matcha mot befintligt +
  visa skillnader + användaren väljer". Import History = listan av
  `import_batches`. Inget nytt system.

### 8. SEARCH & INDEX ENGINE
Global sök + Command Palette. Redan i spec: Universal Search (Del 56, Del 61).
- **Kallades även:** Universal Search · Universal Index · Command Center ·
  Discovery.
- **Beslut:** EN sök/kommando-yta (Cmd/K). Index = det som gör den snabb.
  Command Center = samma ruta som även kör åtgärder. Redan definierat.

### 9. DASHBOARD & WIDGET ENGINE
Widget-baserad startsida. Redan i spec: Del 61.
- **Kallades även:** Dashboard Engine 2.0 · Experience Engine · State Engine ·
  Adaptive Experience.
- **Beslut:** EN widget-modell. "State/Adaptive" = valfria regler som ändrar
  vilka widgets som visas efter kontext — bygg SIST, allt frivilligt (Lag 3, 11).

### 10. SECURITY & PERMISSION ENGINE
Auth, RLS, roller, behörigheter, kryptering, audit. Delvis i spec (Del 24, Fas 0).
- **Kallades även:** Universal Security Engine · Permission Engine · Policy
  (behörighetsdelen).
- **Beslut:** EN behörighetsmodell. **Detta är den motor som växer mest för
  din multi-tenant-vision — se Del 64.** Byggs på riktigt, inte promptas fram.

## Infrastruktur som INTE är egna produktmotorer

Delta-dokumentet listar Cache · Job · Resource · Performance · Connector ·
Configuration · Export Engine m.m. Dessa är **teknisk infrastruktur**, inte
funktioner att specificera nu. De löses av plattformsvalet (Supabase/ramverk)
och byggs när skalan kräver det. Att specificera dem nu är för tidigt och
tillför inget till bygget. Parkeras medvetet.

## Vad som faktiskt var NYTT och värt att behålla

Av alla fem dokument är detta det genuint nya som inte redan fanns:
1. **Room & Location-struktur** — fysiska objekt placeras i fastighet →
   rum → plats. Läggs till som fält/relation på fysiska objekt. (Litet, bra.)
2. **Samma fil kopplad till flera objekt** utan dubblett — görs till uttalad
   standard i Relationship Engine (punkt 2 ovan).
3. **Health Score per objekt** — "bilen saknar försäkring, service försenad".
   Bra, byggs som en enkel regeluppsättning i Validation & Health Engine (punkt 6).
4. **Multi-tenant / uthyrning** — den stora nya saken. Egen del: Del 64.

Allt annat = befintliga motorer under nya namn.

## ARBETSREGEL FRAMÖVER (viktigast i hela denna del)

Innan någon ny "motor", "engine" eller "modul" läggs till: sök i denna karta.
Om idén mappar till en befintlig motor → den byggs som en funktion DÄR, inte
som ett nytt system. Detta är enda sättet appen förblir byggbar. De fem
dokumenten ber själva om exakt detta.

---

# DEL 64 — MULTI-TENANT & UTHYRNING (din SaaS-vision)

> Målet: du äger plattformen och ser allt. Andra företag "hyr" den, har bara
> konton, ser bara sitt. Inom ett hyrande företag finns roller (ägare, chef,
> schemaläggare, anställd) med olika åtkomst och översikt. Detta är en RIKTIG
> arkitekturuppgift — den byggs inte i alpha, men datamodellen måste förberedas
> NU så vi slipper bygga om allt senare. Prioritet: arkitektur nu, bygg i V1/V2.

## Grundmodell: allt data hänger på en tenant

Varje rad i varje tabell får förutom `user_id` även `org_id` (tenant).
- **Du (plattformsägare):** en super-admin-nivå ovanför alla orgs. Ser allt,
  men det är en separat behörighetsnivå — inte "en användare med många rader".
- **Ett hyrande företag = en `org`** (tenant). All deras data har deras `org_id`.
- **RLS blir tvådimensionell:** en användare ser rader där `org_id` = hens org
  OCH behörigheten tillåter det. Ingen org kan någonsin se en annan orgs data.

```sql
CREATE TABLE organizations (
  id UUID PK, name, plan, owner_user_id, is_active, created_at
);
CREATE TABLE org_members (
  id UUID PK, org_id FK organizations, user_id FK auth.users,
  role TEXT,        -- owner/admin/manager/scheduler/employee
  is_active, invited_at, joined_at
);
-- Varje befintlig tabell får: ADD COLUMN org_id UUID REFERENCES organizations(id);
-- RLS uppdateras: USING (org_id IN (select org_id from org_members
--                 where user_id = auth.uid() and is_active));
```

## Roller och vad var och en ser (exempel)

- **Owner (företaget som hyr):** hela sin org — anställda, scheman, löner,
  ekonomi, rapporter. Kan bjuda in medlemmar, sätta roller.
- **Manager/chef:** sin avdelnings anställda, deras scheman och pass, översikt
  — men inte nödvändigtvis företagets totala ekonomi. Sätts av owner.
- **Scheduler/schemaläggare:** skapar och publicerar scheman, ser anställdas
  tillgänglighet och pass. Redigerar inte löneinställningar.
- **Employee/anställd:** ser bara sitt eget — sina pass, sin lön, sin
  tillgänglighet. (Detta är i princip hela nuvarande single-user-appen.)

Behörigheter sätts per: org → roll → modul → objekt. Systemet ska kunna
förklara varför någon har/saknar åtkomst (Omega punkt 12, bra krav).

## Varför detta byggs SENARE men förbereds NU

- **Nu (alpha):** bygg single-user (dig). Men lägg `org_id` på tabellerna
  och skriv RLS så att `org_id` finns från början. Då är varje rad redan
  tenant-märkt även om det bara finns en tenant.
- **V1:** organizations + org_members + roller + inbjudningar + rollbaserad RLS.
- **V2:** chefsöversikt, schemaläggarvy, avdelningar, anställd-självservice,
  fakturering av hyrande företag.

Att förbereda `org_id` nu kostar nästan inget. Att lägga till det efter att
appen har data är ett smärtsamt ombygge. Detta är den enda "framtidssaken"
värd att bygga in direkt.

## ACCEPTANSKRITERIER (multi-tenant, för V1)

1. En org kan aldrig se en annan orgs data (bevisas med test: användare i
   org A får tomt när de försöker läsa org B).
2. Plattformsägaren (du) har en separat super-admin-nivå.
3. Roller (owner/manager/scheduler/employee) ger olika vyer och åtkomst.
4. Owner kan bjuda in medlemmar och sätta roller.
5. Systemet kan förklara varför en användare har eller saknar en åtkomst.
6. Alpha-datan (single-user) migrerar rent in som "org med en medlem".


---

# DEL 65 — PRODUKTGRANSKNING: SKÄRM FÖR SKÄRM (chefsblicken)

> Detta är en genomgång ur ANVÄNDARENS ögon, inte kodarens. För varje skärm
> i alpha: vad förväntar sig användaren, vilka knappar/funktioner MÅSTE finnas,
> vad kopplas till vad, och vad saknas som logiskt borde vara där. Detta är
> kravspecen för hur appen KÄNNS. Bygg varje skärm mot sin checklista här.

## Global princip: "aldrig en återvändsgränd"

Från varje skärm ska användaren alltid kunna: komma hem (logotyp), söka
(Cmd/K), lägga till något (globalt +), och ta sig tillbaka (breadcrumb/bakåt).
Ingen skärm får vara en död yta. Varje tomt tillstånd förklarar nästa steg.

---

## SKÄRM 1 — DASHBOARD (startsidan)

**Vad användaren vill:** öppna appen och direkt förstå "vad gäller idag,
vad tjänar jag, vad måste jag göra". Utan att leta.

**Måste finnas:**
- Hälsning + dagens datum/tid
- "Idag"-kort: dagens pass (om något) med tid, rast, lönevärde. Om inget pass:
  "Ingen inbokad idag" + knapp "Lägg till pass".
- "Intjänat denna period" (växer) OCH "Nästa löneutbetalning" (separat, med
  periodetikett) — de två får ALDRIG stå som en siffra (Del 62).
- "Kvar att leva på till nästa lön"
- Att-göra/påminnelser (max 3 viktigaste)
- Globalt + (Quick Add) och sökfält alltid synliga
- Widgets som kan läggas till/tas bort

**Kopplas till:** varje kort är klickbart → leder till rätt sida (pass→Arbete,
lön→Lönecheck, utgift→Ekonomi). Dashboard visar, sidorna hanterar.

**Vanligt misstag att undvika:** att Dashboard blir en död "välkommen"-sida
med tomma rutor. Varje ruta ska visa riktig data eller en tydlig nästa-åtgärd.

---

## SKÄRM 2 — LÄGG TILL / REDIGERA PASS (mest använda skärmen)

**Vad användaren vill:** lägga in ett pass på under 10 sekunder.

**Måste finnas:**
- Datum (default idag), starttid, sluttid
- Arbetsprofil (om flera) — annars förvald
- Arbetsplats (om profilen har flera)
- Rast: auto enligt regel, men överskrivbar
- "Pass över midnatt" hanteras automatiskt när sluttid < starttid — visa en
  liten bekräftelse "Detta pass slutar 06:00 nästa dag", inte ett felmeddelande
- Passtyp/kategori: vanligt / extra / övertid / jour / beredskap
- **Om extra/övertid:** fält "Ersättning för detta pass" (använd regel /
  multiplikator t.ex. 2,4 / fast timlön / fast totalbelopp) — Del 62
- Status: planerat / utfört / sjuk / VAB / semester
- Anteckning (valfri)
- Live-förhandsvisning: "Detta pass ger ca X kr (grund Y + OB Z)" medan man fyller i
- Spara + Spara och lägg till nästa (för att fylla flera snabbt)

**Kopplas till:** passet syns direkt i kalender + räknas in i "intjänat denna
period" på Dashboard + i månadens timmar.

**Saknas ofta men borde finnas:** knapp "duplicera pass" och "upprepa varje
vecka" (de flesta jobbar återkommande mönster). Snabbval för vanliga tider.

---

## SKÄRM 3 — KALENDER / SCHEMA

**Vad användaren vill:** se sina pass som en översikt, klicka för att redigera.

**Måste finnas:**
- Vyer: månad / vecka / dag (agenda på mobil)
- Varje pass visas med tid + färg per profil/kategori
- Pass över midnatt visas snyggt över två dagar (men är EN post)
- Klick på pass → redigera. Klick på tom dag → nytt pass förifyllt med den dagen
- Månadssummor: totala timmar, intjänat hittills
- Knapp "Importera schema" (→ scanner)
- Filter: per arbetsprofil om flera

**Kopplas till:** samma data som Dashboard och lön. En ändring här syns överallt.

**Saknas ofta:** att kunna kopiera en hel vecka till nästa. Massredigering.

---

## SKÄRM 4 — ARBETSPROFILER & INSTÄLLNINGAR

**Vad användaren vill:** ställa in sin arbetsplats en gång, sen slippa tänka på det.

**Måste finnas per profil:**
- Namn, arbetsgivare, roll, timlön (TEXTFÄLT, aldrig stepper)
- Skattekolumn, semesterprocent (default 12%)
- Löneperiod: vilken dag den startar (t.ex. 16) + lönedag + hur många månader efter
- Arbetsplatser (flera): namn, adress, restid
- Rastregler: "30 min efter 5h" — användaren skapar egna
- OB-regler: kväll/natt/helg/storhelg — belopp eller multiplikator, per kategori
- Möjlighet att markera profil aktiv/inaktiv

**Kopplas till:** alla pass på profilen använder dessa regler. Lönespec-scan
kan FÖRESLÅ ändringar här (Del 59).

**Saknas ofta:** en "testa"-knapp: "ett pass 22–06 en lördag skulle ge X kr"
så användaren ser att reglerna stämmer innan de litar på dem.

---

## SKÄRM 5 — LÖNECHECK / PAYDAY CENTER

**Vad användaren vill:** "stämmer lönen jag fick?"

**Måste finnas:**
- Lista över perioder med: intjänat (appens uträkning) vs utbetalt (lönespec)
- Scanna lönespec-knapp → kopplar till rätt period
- Post-för-post-jämförelse: grundlön, OB, jour, semester, övertid
- Avvikelser markeras neutralt: "möjlig avvikelse — kontrollera" (ALDRIG
  "arbetsgivaren gjorde fel")
- Uträkningen visar vilka regler som gav vilket belopp (inte svart låda)

**Kopplas till:** pass (källan till uträkningen) + dokument (lönespecen sparas).

**Saknas ofta:** en enkel "detta ser rätt ut"-bekräftelse så användaren kan
bocka av en period som stämd.

---

## SKÄRM 6 — EKONOMI

**Vad användaren vill:** koll på vad som kommer in och går ut.

**Måste finnas:**
- Utgifter + inkomster, lägg till snabbt, kategorier
- Återkommande (prenumerationer, räkningar) markeras
- "Kvar att leva på" tydligt
- Skulder med ränta/månadskostnad
- Enkel månadsöversikt

**Kopplas till:** lön (inkomst) + Dashboard (budgetstatus) + dokument (kvitton).

**Saknas ofta:** att en scannad räkning/kvitto (Del 59) automatiskt föreslår
en utgiftspost. Påminnelse innan en räkning förfaller.

---

## SKÄRM 7 — DOKUMENT / VAULT

**Vad användaren vill:** hitta ett papper när det behövs.

**Måste finnas:**
- Alla uppladdade dokument, sökbara (även OCR-text)
- Kategorier: lönespec / schema / kvitto / avtal / garanti / försäkring / annat
- Klick → se original + extraherad data
- Utgångsdatum-bevakning (garanti/försäkring går ut → påminnelse)
- Scanna/ladda upp-knapp (→ samma scanner, Del 59)

**Kopplas till:** samma dokument kan kopplas till flera objekt utan dubblett
(ett kvitto → produkt + garanti + utgift) — Del 63.

**Saknas ofta:** knappar direkt på ett dokument: kopiera / skriv ut / dela /
exportera. Detta är litet men användare förväntar sig det.

---

## SKÄRM 8 — SÖK & KOMMANDO (Cmd/Ctrl+K)

**Vad användaren vill:** hitta vad som helst och göra vad som helst, snabbt.

**Måste finnas:**
- Sök: pass, utgifter, dokument, arbetsplatser, datum, taggar
- Kommandon: "lägg till pass", "visa juli", "importera schema", "gå till lön"
- Fungerar utan AI (regelbaserat först)
- Tangentbord på desktop, lätt nåbar knapp på mobil

**Saknas ofta:** senaste/favoriter högst upp när fältet öppnas tomt.

---

## GENERELLA KNAPPAR SOM MÅSTE FINNAS ÖVERALLT

Chefsblicken hittar dessa "självklara men lätt att glömma":
- **Ångra** efter varje kritisk åtgärd (radera, importera, massändra)
- **Papperskorg** (soft delete 30 dgr) nåbar från Inställningar
- **Redigera / duplicera / radera** på varje objekt (pass, utgift, dokument)
- **Exportera** (minst per modul: pass, ekonomi, dokument)
- **Tomt tillstånd med nästa steg** på varje lista ("Inga pass än — lägg till
  ditt första")
- **Laddningstillstånd** (skeleton), aldrig blank skärm
- **Felläge** som säger vad som hände + vägen framåt, aldrig bara "Error"
- **Bekräfta före destruktivt** ("Radera 12 pass? Detta kan ångras i 30 dgr")

---

## VAD SOM LOGISKT SAKNAS I ALPHA (prioriterade tillägg)

Genomgången hittade dessa luckor — funktioner användare rimligen förväntar sig:
1. **Duplicera/upprepa pass** — de flesta jobbar återkommande scheman. Hög prio.
2. **"Testa regeln"-knapp** på arbetsprofil — bygg förtroende för uträkningen.
3. **Dokumentknappar** (kopiera/skriv ut/dela/exportera) — förväntas.
4. **Scannat kvitto → föreslagen utgift** — stänger kedjan dokument↔ekonomi.
5. **Räkningspåminnelser** innan förfallodatum.
6. **"Period stämd"-bock** i Lönecheck.
7. **Live-lönevärde** medan man fyller i ett pass — omedelbar återkoppling.

Dessa läggs till kravregistret (Del 51/52) som UX-krav, ej nya moduler.


---

# DEL 65 — KANONISKT ALPHA-SCHEMA (EN SANNING FÖR KÄRNAN)

> **Detta är den bindande sanningen för alpha.** Vid varje konflikt med en
> tidigare del gäller DENNA. Löser de brister som hittades vid granskning:
> lön låg på fel tabell, löneperiod var halvfärdig, midnattslogik var luddig,
> OCR fanns i två lager. Efter denna del finns EN definition per tabell.
> All kod byggs mot detta — inget annat.

## BESLUT 1 — Lön hör till arbetsprofilen, ALDRIG till personen

`profiles` (personen) får INTE ha `hourly_rate` eller `tax_column`. En person
kan ha flera jobb med olika lön. Lön är en egenskap hos anställningen.

- `profiles`: bara identitet/preferenser (namn, avatar, språk, tidszon).
- `work_profiles`: all lön (timlön, månadslön, skattekolumn, semester%).

Detta uppfyller Lag 8 (One Source of Truth). Om äldre del visar
`profiles.hourly_rate` — det utgår.

## BESLUT 2 — Löneperiod är EXPLICIT, inte gissad

Problemet "intjänat ≠ utbetalt" kräver att varje pass vet vilken löneperiod
det tillhör. Beslut:

- `work_profiles` har `pay_period_start_day` (1–31, t.ex. 16 = period 16→15)
  och `payday_day` + `payday_offset_months` (utbetalning sker X månader senare).
- `work_shifts` har `pay_period_id` som pekar på en rad i `pay_periods`.
- `pay_periods` är en EGEN tabell (härleds inte on-the-fly) — så perioder är
  stabila, kan låsas när lön betalats, och en scannad lönespec kan kopplas
  till exakt rätt period.

## BESLUT 3 — Midnattspass har en järnhård regel

Ett pass är EN rad. Regeln för att räkna rätt:

- Om `end_time <= start_time` → passet korsar midnatt.
  Sätt `crosses_midnight = true` och `end_date = date + 1`.
- Om `end_time > start_time` → samma dag, `end_date = date`, `crosses_midnight = false`.
- Motorn räknar alltid faktisk tid som (end_date + end_time) − (date + start_time).
- Pass längre än 24h tillåts inte (validering); misstänkt lång tid = varning.

Detta gör 22:00→02:00 entydigt (4h över midnatt), aldrig tolkat som 20h.

## BESLUT 4 — OCR: två lager med tydlig roll

- `documents`: bär det ENKLA fältet — `ocr_status`, `ocr_text` (hela råtexten),
  `ocr_confidence` (dokumentnivå). Detta räcker för sök och enkel visning.
- `ocr_fields`: bär det DETALJERADE — ett fält per rad (field_name, raw_value,
  normalized_value, confidence, bounding_box, correction). Används av scannerns
  granskningsvy och lärande.
- Relation: `ocr_fields.document_id → documents.id`. `ocr_jobs` utgår som
  separat tabell i alpha — dokumentet självt bär status. (Färre tabeller,
  Lag 16.) Ett dokument kan ha många `ocr_fields`.

## DET KANONISKA ALPHA-SCHEMAT (körbar ordning)

Detta är de tabeller alpha byggs på. Ordningen är beroendeordning (skapa
uppifrån och ned). Alla har RLS `USING (auth.uid() = user_id)`. Soft delete
(`deleted_at`) där det står. Alla tider TIMESTAMPTZ i UTC.

```
profiles          — identitet: name, avatar_url, language, timezone. INGEN lön.
work_profiles     — anställning: employer, role, hourly_rate, monthly_salary,
                    tax_column, vacation_pay_percent, pay_period_start_day,
                    payday_day, payday_offset_months, is_active, deleted_at
workplaces        — arbetsplats under en work_profile: name, address,
                    travel_minutes, deleted_at
pay_periods       — löneperiod: work_profile_id, period_start, period_end,
                    payday_date, is_locked, deleted_at
break_rules       — rast per profil: after_hours, break_minutes, is_paid
ob_rules          — ALLA löneregler (se Del 62B kanoniskt schema):
                    rule_type, applies_to_category, valid_from/to, day_of_week[],
                    start_time, end_time, holiday_type, rate_type, multiplier,
                    fixed_amount, priority, stacking_allowed
holiday_rules     — röda dagar: date/name/holiday_type (rörliga: påsk osv.)
work_shifts       — pass (EN rad, även över midnatt): work_profile_id,
                    workplace_id, pay_period_id, date, start_time, end_time,
                    crosses_midnight, end_date, break_minutes, break_paid,
                    is_on_call, is_standby, overtime_minutes, shift_category,
                    status, shift_code, notes, source, import_batch_id, deleted_at
import_batches    — scan-import: document_id, detected_type, type_confidence,
                    confirmed_type, status, items_proposed/imported/skipped_dupe,
                    reverted_at
documents         — vault + enkel OCR: title, document_type, file_url, file_name,
                    file_size, mime_type, ocr_text, ocr_confidence, ocr_status,
                    ai_summary, metadata, tags[], expires_at, deleted_at
ocr_fields        — detaljerad OCR: document_id, field_name, raw_value,
                    normalized_value, confidence, bounding_box, is_verified,
                    corrected_value, correction_at
payslips          — lönespec: work_profile_id, pay_period_id, period_start/end,
                    gross/net/tax/ob/on_call/vacation/overtime amounts,
                    total_hours, document_id, ocr_raw, verified_at, deleted_at
expenses          — utgifter: amount, currency, category, subcategory, date,
                    expense_type, is_recurring, recurrence_interval, receipt_id,
                    notes, deleted_at
debts             — skulder: name, debt_type, original/current_amount,
                    interest_rate, monthly_payment, minimum_payment,
                    start/end_date, lender, notes, deleted_at
```

## VAD SOM ÄNDRADES MOT TIDIGARE (checklista för kod)

1. `profiles` tappar `hourly_rate` + `tax_column` (flyttat till work_profiles).
2. `work_profiles` får `payday_day`, `payday_offset_months` (period-modell).
3. Ny tabell `pay_periods` (explicit, ej härledd).
4. `work_shifts` får `pay_period_id` (koppling till rätt period).
5. Ny tabell `holiday_rules` (röda dagar påverkar OB).
6. `ob_rules` = kanoniska schemat från Del 62B (rule_type/rate_type/priority).
7. `ocr_jobs` utgår; `ocr_fields` pekar direkt på `documents`.
8. Midnattsregeln (Beslut 3) är bindande för motorn.

## BYGGORDNING FÖR KOD (Lager)

- **Lager 1 — Databas:** allt ovan som en SQL-migration (tabeller, index, RLS).
- **Lager 2 — Kärnlogik:** lönemotor (läser ob_rules/break_rules, respekterar
  midnattsregeln och pay_periods) + scanner (Del 59, skriver work_shifts som
  förslag). Ren TypeScript, testbar isolerat.
- **Lager 3 — UI:** komponenter mot färdig logik.

Detta är sanningen. Nästa steg: Lager 1 som körbar, testad SQL.

