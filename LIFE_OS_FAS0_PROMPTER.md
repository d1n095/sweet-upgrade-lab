# LIFE OS — FAS 0: FÄRDIGA LOVABLE-PROMPTER

> Detta är de körklara prompterna för Fas 0 (blockers). Kör dem i ordning,
> en i taget. Vänta på "Klart:/Kvar:" och testa innan du går vidare.
> Klistra in prompten som den är. Byggversionen (LIFE_OS_BYGGVERSION.md)
> antas redan finnas i projektets kontext.

---

## FÖRE DU BÖRJAR — kontext att ge Lovable en gång

```
Vi bygger Life OS / My Money Master — en personlig livs- och löneapp på
React + Tailwind + Supabase. Svenskt UI, engelsk kod.

Följ alltid dessa regler:
- RLS på alla tabeller. Ingen service-role-nyckel i klientkoden.
- Soft delete (deleted_at) överallt, aldrig hård radering direkt.
- Detta projekt får ALDRIG blandas med 4ThePeople/Glow Up/webshop.
- Buggar före features. Rör aldrig fungerande kod utan instruktion.
- Commit efter varje delsteg. Rapportera "Klart:/Kvar:" och vänta.
- No mockups: allt som syns ska fungera.

Vi börjar med Fas 0 (auth + säkerhet). Bekräfta att du förstått, lista
sedan vad som redan finns i projektet (befintliga tabeller, auth-setup,
routes) innan vi ändrar något.
```

---

## PROMPT 1 — [SEC-001 + SEC-002] RLS-grund och säkerhetsaudit

```
[SEC-001][SEC-002] Säkerhetsgrund innan vi rör auth.

1. Lista alla befintliga Supabase-tabeller och visa om RLS är på eller av
   för var och en.

2. För varje tabell som saknar RLS: aktivera det och lägg till policyn
   (anpassa user_id-kolumnen om den heter något annat):

   ALTER TABLE <tabell> ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "own rows only" ON <tabell>
     FOR ALL USING (auth.uid() = user_id);

3. Sök igenom klientkoden efter service-role-nyckeln
   (SUPABASE_SERVICE_ROLE_KEY eller liknande). Om den finns någonstans i
   frontend-kod: ta bort den och rapportera exakt var den låg. Klienten
   ska ENDAST använda anon-nyckeln.

4. Bekräfta att .env-nycklar inte är hårdkodade i committad kod.

Ändra inga tabellscheman utöver att slå på RLS. Rapportera Klart:/Kvar:
och lista vilka tabeller som fick RLS påslagen.
```

**Testa efter:** logga in som testanvändare A, försök läsa användare B:s
rader via en query → ska ge tomt resultat.

---

## PROMPT 2 — [AUTH-001] E-postverifiering + SMTP

```
[AUTH-001] Få e-postverifiering att fungera.

1. Kontrollera nuvarande Supabase Auth-inställningar: är "Confirm email"
   påslaget? Vilken SMTP används (Supabase default eller egen)?

2. Konfigurera så att:
   - Nya användare får ett verifieringsmejl vid registrering.
   - Overifierade konton kan inte logga in (visa tydligt svenskt
     felmeddelande: "Bekräfta din e-post först. Kolla din inkorg.").
   - Det finns en "Skicka verifieringsmejl igen"-knapp på inloggnings-
     sidan för overifierade konton (rate-limitad, t.ex. max 1/min).

3. Om Supabases default-SMTP används: notera gränsen (låg volym, bara för
   test) och skriv en TODO om att koppla egen SMTP (t.ex. Resend/Postmark)
   före publik lansering. Konfigurera INTE egen SMTP nu om nycklar saknas —
   flagga bara att det behövs.

4. Verifieringsmejlets text ska vara på svenska och matcha appens namn
   (My Money Master / Life OS).

Rapportera Klart:/Kvar: och beskriv exakt hur jag testar flödet.
```

**Testa efter:** registrera med en riktig adress → mejl kommer → klick
verifierar → inlogg fungerar. Overifierat konto blockeras korrekt.

---

## PROMPT 3 — [AUTH-002] Stabil session

```
[AUTH-002] Sessionen ska vara stabil — användaren ska inte behöva logga
in om igen vid sidladdning eller efter kort inaktivitet.

1. Kontrollera hur Supabase-klienten är initierad. Säkerställ:
   - persistSession: true
   - autoRefreshToken: true
   - detectSessionInUrl: true

2. Lägg till en global auth-lyssnare (onAuthStateChange) som håller appens
   state i synk med sessionen. Vid TOKEN_REFRESHED ska inget hoppa till
   inloggningssidan.

3. Skydda routes med en tydlig laddningsfas: medan sessionen hämtas ska
   appen visa en spinner, INTE blinka förbi inloggningssidan för en redan
   inloggad användare.

4. Fixa eventuell bugg där en hård omladdning (F5) loggar ut användaren.

Rör inte UI utöver det som krävs. Rapportera Klart:/Kvar: och beskriv hur
jag testar (inkl. F5-test och att lämna fliken en stund).
```

**Testa efter:** logga in → F5 flera gånger → förblir inloggad. Lämna
fliken 10 min → tillbaka → fortfarande inloggad (ingen tvångs-relogin).

---

## PROMPT 4 — [AUTH-003] Glömt lösenord

```
[AUTH-003] Bygg ett komplett "glömt lösenord"-flöde.

1. På inloggningssidan: länk "Glömt lösenord?".

2. Sida där användaren anger e-post → skickar
   supabase.auth.resetPasswordForEmail med korrekt redirectTo.
   Visa alltid samma neutrala bekräftelse oavsett om adressen finns
   ("Om adressen finns hos oss har vi skickat en återställningslänk") —
   avslöja aldrig om ett konto existerar.

3. Återställningssidan (redirect-målet): låter användaren sätta nytt
   lösenord via supabase.auth.updateUser. Validera lösenordsstyrka med
   zod (minst 8 tecken). Vid klar → logga in och skicka till dashboard.

4. Allt UI på svenska. Tydliga fel- och lyckat-meddelanden.

Rapportera Klart:/Kvar: och beskriv hela testflödet steg för steg.
```

**Testa efter:** begär återställning → mejl → sätt nytt lösenord → logga
in med det nya. Gammalt lösenord ska inte längre fungera.

---

## NÄR FAS 0 ÄR KLAR

Kör en snabb slutkontroll:
```
Sammanfatta Fas 0-status: bekräfta att AUTH-001, AUTH-002, AUTH-003,
SEC-001, SEC-002 alla fungerar och är testade. Lista eventuella TODO
(t.ex. egen SMTP före lansering). Skapa inga nya features — bekräfta bara
att grunden är stabil så vi kan börja Fas 1 (Arbete & Lön).
```

Därefter går vi vidare till **Fas 1: Arbete & Lön** — arbetsprofiler,
pass (med `crosses_midnight`), rastregler och OB-regler som data. De
prompterna skriver vi när Fas 0 är grön.
