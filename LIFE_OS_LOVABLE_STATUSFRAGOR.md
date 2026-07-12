# LIFE OS — STATUSFRÅGOR TILL LOVABLE

> Klistra in HELA detta meddelande i Lovable. Syftet: få en exakt bild av
> var projektet står just nu, så nästa steg (Fas 1-prompterna) matchar
> verkligheten istället för antaganden. Be Lovable svara punkt för punkt,
> kort och konkret. Om något inte finns än — skriv "finns inte än", det är
> ett helt giltigt svar och exakt vad vi vill veta.

---

Hej! Innan vi bygger vidare behöver jag en exakt lägesrapport över
projektet. Svara kort och konkret på VARJE punkt nedan, i samma ordning.
Om något inte finns än, skriv "finns inte än". Gissa inte och bygg
ingenting nu — bara rapportera nuläget.

## A. PROJEKT & STACK
1. Vilket ramverk och språk körs projektet på (React? TypeScript eller JS? Vite?)
2. Är Supabase kopplat? Vilken Supabase-region/projekt (namnet räcker)?
3. Vilka större paket/bibliotek är redan installerade (t.ex. state, formulär,
   UI-komponenter, datum, ikoner)?
4. Finns Tailwind uppsatt? Finns ett komponentbibliotek (shadcn/ui eller annat)?

## B. DATABAS (viktigast)
5. Lista ALLA tabeller som finns i databasen just nu, med kolumnnamn och typ.
6. För varje tabell: har den Row Level Security (RLS) påslaget? Ja/nej per tabell.
7. Har tabellerna en `user_id`-kolumn kopplad till auth.users?
8. Finns `deleted_at` (soft delete) på någon tabell? Vilka?
9. Finns det någon tabell för arbetspass, arbetsprofiler, löneregler, raster
   eller lönespecar redan? Vad heter de i så fall och hur ser de ut?
10. Finns index på några tabeller? Vilka?

## C. AUTH & SÄKERHET
11. Är inloggning/registrering byggt? Vilken metod (e-post+lösenord, magic
    link, social login)?
12. Är e-postverifiering påslagen? Används Supabases default-SMTP eller egen?
13. Fungerar sessionen stabilt vid sidladdning (F5) — eller loggas man ut?
14. Finns "glömt lösenord"-flöde?
15. VIKTIGT: används service-role-nyckeln någonstans i frontend-koden? Sök och
    svara ärligt ja/nej + var i så fall.

## D. SIDOR & NAVIGATION
16. Vilka sidor/routes finns byggda just nu? Lista dem.
17. Finns en dashboard/startsida? Vad visar den?
18. Finns någon navigation (meny/flikar)? Hur ser den ut?
19. Vad händer när appen öppnas — vart landar en inloggad användare?

## E. FUNKTIONER SOM FAKTISKT FUNGERAR
20. Vilka funktioner kan en användare faktiskt använda idag, från start till
    slut? (t.ex. "kan skapa konto och logga in", "kan lägga till en utgift")
21. Vad är påbörjat men inte klart?
22. Finns det något som är trasigt eller buggigt just nu som du känner till?

## F. DESIGN
23. Finns ett genomgående designsystem (färger, spacing, typografi som
    återanvänds) eller är sidor byggda var för sig?
24. Är appen mobilanpassad?

## G. DIN BILD
25. Om du skulle rekommendera EN sak att bygga eller fixa härnäst — vad och varför?
26. Finns det något i projektet du tycker är byggt på ett sätt som borde göras
    om innan vi bygger vidare?

Svara på allt ovan så tar vi nästa steg utifrån din rapport. Bygg inget än.
