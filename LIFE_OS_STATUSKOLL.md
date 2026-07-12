# LIFE OS — STATUSKOLL (kör detta FÖRST, innan någon ny prompt)

> Syfte: veta exakt var projektet står innan vi bygger vidare, så inget
> krockar med det som redan finns. Denna prompt ÄNDRAR INGENTING — den bara
> läser av och rapporterar. Klistra in den som den är i Lovable.
> Klistra sedan tillbaka Lovables svar till mig, så vet vi båda nuläget.

---

## PROMPT — LÄGESRAPPORT (read-only, ändra inget)

```
Innan vi bygger vidare vill jag ha en komplett lägesrapport av projektet.
ÄNDRA INGENTING i detta steg — skapa inga tabeller, ingen kod, inga
migreringar. Bara läs av och rapportera. Om du är osäker, skriv "vet ej"
hellre än att gissa.

Rapportera under dessa rubriker:

1. DATABAS (Supabase)
   - Lista ALLA tabeller som finns just nu.
   - För varje tabell: kolumnnamn + om RLS är PÅ eller AV.
   - Finns dessa tabeller? profiles, work_profiles, work_shifts,
     break_rules, ob_rules, payslips, expenses, debts, documents,
     workplaces, import_batches, ocr_jobs, ocr_fields.
   - Finns dessa kolumner på work_shifts? crosses_midnight, end_date,
     shift_category, workplace_id, import_batch_id, status, source.

2. AUTH & SÄKERHET
   - Är e-postverifiering (Confirm email) på eller av?
   - Vilken SMTP används (Supabase default eller egen)?
   - Finns ett "glömt lösenord"-flöde?
   - Är sessionen konfigurerad med persistSession + autoRefreshToken?
   - Ligger service-role-nyckeln någonstans i klientkoden? (ja/nej + var)

3. ROUTES & SIDOR
   - Lista alla routes/sidor som finns.
   - Vilka är byggda och fungerar vs. tomma/platshållare?

4. FUNKTIONER SOM FAKTISKT FUNGERAR
   - Vad kan en användare göra i appen just nu, från start till slut?
   - Vad ser ut att vara påbörjat men inte klart?

5. SCANNER / OCR
   - Finns någon uppladdning eller OCR byggd? I så fall vad?

6. RISKER / KROCKAR
   - Finns halvfärdig kod, dubbletter av tabeller/komponenter, eller något
     som skulle krocka om vi bygger vidare på auth, arbete/lön eller scanner?

7. 4THEPEOPLE-KONTROLL
   - Finns någon kod, tabell eller komponent i detta projekt som hör till
     4ThePeople / Glow Up / en webshop? (Det får INTE finnas här.) Ja/nej + var.

Avsluta med en kort sammanfattning: "Projektet är i fas X, redo för Y,
med dessa öppna punkter: …". Ändra fortfarande ingenting.
```

---

## NÄR DU FÅTT SVARET

Klistra tillbaka Lovables hela svar till mig. Då gör jag:
1. Stämmer av svaret mot spec:en och byggversionen.
2. Säger exakt vilken fas vi står i och vad nästa prompt ska vara.
3. Justerar prompterna så de matchar det som redan finns — inga dubbletter,
   inga krockar.

Först då kör vi nästa bygg-prompt (Fas 0, 1 eller 3 beroende på var vi står).
