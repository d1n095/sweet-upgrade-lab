# Minska credit-förbrukning

Förbrukningen denna period är ~32 credits, fördelat så här:

- **Build mode messages: 25.5** (chattmeddelanden till mig när du bygger)
- **Cloud compute pico: 5.27** (databasen står på och kör hela tiden)
- Plan mode: 1.0, Cloud functions: 0.21, Egress: 0.03, Storage: ~0

De två stora hinkarna är alltså **mina byggmeddelanden** och **Cloud compute**. Här är planen för båda.

---

## Del 1 – Minska byggcredits (när du chattar med mig)

Det här är inga kodändringar — det är arbetssätt. Jag listar dem så du kan välja vilka du vill att jag följer som regel.

1. **En sak per meddelande, kort instruktion.** Långa "gör 5 saker"-meddelanden = stora svar = fler credits. Vi har redan kört "1, 2, 3, 4" i taget vilket är bra.
2. **Använd "Try to fix" istället för att skriva fel manuellt.** Try-to-fix kostar 0 credits.
3. **Plan mode innan stora ändringar.** 1 credit för en plan kan spara 5–10 credits i felbygg.
4. **Sätt ett månatligt member credit-tak** i Settings → People (du som workspace-ägare). Då kan du inte råka bränna allt på en kväll.
5. **Undvik "kolla hela kodbasen / sammanfatta allt"-frågor** — det tvingar mig läsa massor av filer.

Vill du att jag sätter ett credit-tak åt dig och i så fall på vilken nivå?

---

## Del 2 – Minska driftcredits (Cloud compute + functions)

Här finns faktiska kodändringar att göra. Snabbgenomgång visade flera polling-loopar och bakgrundsjobb som tickar hela tiden även när ingen tittar på sidan.

### A. Stäng av admin-pollers när fliken inte är synlig
Idag pollar dessa varannan/var fjärde sekund **även när admin har fliken i bakgrunden**:

- `src/lib/scanEngine.ts` – `setInterval(pollScanRun, 2000)` (2 ställen)
- `src/components/admin/ScanProgress.tsx` – 2s
- `src/components/admin/ExecutionGovernorPanel.tsx` – 2s
- `src/components/admin/ScanEngineStatus.tsx`
- `src/components/admin/MinimalModePanel.tsx` – 4s
- `src/components/admin/HardStateLockPanel.tsx` – 4s
- `src/hooks/useUiStateSync.ts`

**Fix:** Wrappa alla i ett gemensamt `useVisiblePolling(fn, ms)`-hook som pausar vid `document.visibilityState === 'hidden'` och vid `navigator.onLine === false`. Höj också intervallen där 2s är overkill (scan-progress räcker med 5s, status-paneler med 10–15s).

### B. React Query – höj `staleTime` och stäng av refetchOnWindowFocus globalt
Default i React Query refetchar varje gång du byter flik tillbaka. Sätt globalt i `src/App.tsx` (eller där `QueryClient` skapas):

```ts
defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, refetchOnReconnect: false } }
```

Sparar massor av onödiga Supabase-anrop.

### C. Inaktivera "scanner/evolution/self-healing"-loopar i produktion
Mappen `src/core/evolution/*` och `src/core/scanner/*` (>60 filer: `evolutionLoop`, `autoReorganizer`, `architectureWatchdog`, `selfHealingEngine`, m.fl.) är dev-/admin-verktyg men kan starta automatiskt. **Verifiera och gate:a** så de aldrig kör utanför `/admin/*` eller utanför dev-builds:

```ts
if (import.meta.env.PROD && !location.pathname.startsWith('/admin')) return;
```

Detta är troligen den största enskilda besparingen om någon av dessa startar `setInterval` eller subscribar på Supabase realtime vid sid-laddning.

### D. Realtime-prenumerationer
Kolla `useAdminRealtime` och liknande – håll bara aktiva prenumerationer på den admin-sida som faktiskt visar datan, unsubscribe vid unmount.

### E. Cloud compute-instansen
Om 5 credits/månad i compute är OK lämnar vi den. Om du vill ner ytterligare: kontrollera att du kör minsta instansstorleken i **Backend → Advanced settings**. Du verkar redan ligga på "pico" (minsta) så här finns inget mer att vinna utan att försämra prestanda.

---

## Förslag på ordning att implementera

1. **(snabbt, stor effekt)** B – React Query defaults
2. **(snabbt, stor effekt)** C – gate:a evolution/scanner-loopar till admin+dev
3. **(medel)** A – `useVisiblePolling` + höjda intervaller
4. **(medel)** D – revidera realtime-subscriptions
5. **(arbetsätt)** Del 1-reglerna ovan + valfritt credit-tak

Säg vilken/vilka steg du vill köra så börjar vi med en i taget som vanligt.
