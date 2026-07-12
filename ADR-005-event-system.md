# ADR-005: Event-system — ett nervsystem för hela OS

**Status:** Beslutad · **Datum:** 2026-07-11 · **Beslutsfattare:** teknisk ägare (Claude)

## Kontext — problem + vision

Spec (rad 268): "Event Engine (Event Bus) — Alla händelser skapar events,
nervsystem för hela OS." Automation Engine, Rules Engine, Notification Engine,
Life Feed och Signals bygger ALLA på detta.

Idag är `timeline_events` de facto detta, men byggt som en display-tabell:
- Varje modul (shift-service, finance-service, kalender ×2, reminders, absences)
  skriver egna rader med handrullad form → DUPLICERING (samma problem vi löst
  för pass och pengar).
- `kind` är ett hårdkodat ENUM → ny händelsetyp kräver migration (bryter
  data-inte-kod).
- Saknar `owner_context_id` (ADR-002).
- Write-only: inget kan REAGERA på händelser (ingen automation/regel/notis).

Om vi generaliserar detta nu blir fyra framtidssystem (Automation, Rules,
Notification, Life Feed) billiga. Annars bygger vi om timeline fyra gånger.

## Beslut — ett event-lager i tre delar

### 1. En emit-funktion (enda vägen att skapa events)
`core/events.ts` med `emit(event)`. Ingen modul skriver till timeline direkt.
Services (shift, finance, m.fl.) anropar `emit()`. Detta ger EN form, ETT ställe
att lägga till kontext/ägarskap/validering.

### 2. Event-typer som DATA, inte enum
`kind` blir fritext (behåll enum-värden som konvention men lås inte). Nya
domäner (health, travel, vehicle, project...) kan emitta utan migration.
En `event_types`-referenstabell (valfri) beskriver kända typer för UI/ikon/färg.

### 3. Förberett för reaktivitet (Event Bus, ej bara logg)
Events får `owner_context_id`, `actor_user_id`, och en `processed_at`-kolumn.
Detta gör att en framtida Automation/Rules Engine kan läsa OprocesSADE events
och agera — UTAN att timeline byggs om. Vi bygger INTE motorn nu, men datat är
redo (DEFERRED_ARCHITECTURE_READY).

`timeline_events` fortsätter vara läsvyn (Life Feed läser den). Vi byter alltså
inte tabellnamn — vi generaliserar hur den skrivs och utökar den för framtiden.

## Datamodell (utökning av timeline_events)

```sql
ALTER TABLE timeline_events
  ADD owner_context_id UUID -> owner_contexts,   -- ägarskap (ADR-002)
  ADD actor_user_id UUID,                         -- vem utlöste (audit)
  ADD processed_at TIMESTAMPTZ,                    -- för framtida event-bus
  ADD dedupe_key TEXT;                             -- idempotens (undvik dubletter)
-- kind: behåll kolumnen men sluta tvinga enum i nya inserts (via emit-lagret).
```

## Emit-kontrakt

```ts
emit({
  kind: "shift",              // fritext, konvention finns
  title, subtitle?, amount?,
  occursAt, endsAt?,
  sourceTable, sourceId,      // härkomst
  dedupeKey?,                 // om satt: skriv inte dubblett
  metadata?
})
// Sätter automatiskt owner_context_id + actor_user_id från session.
```

## Konsekvenser

**Positiva:** en sanning för händelser · nya domäner utan migration · ägarskap +
audit inbyggt · Life Feed, Signals, Notification, Automation, Rules bygger alla
på samma lager · idempotens via dedupe_key.

**Kostnad:** en migration + flytta ~6 direkt-inserts till emit(). Litet, och tar
bort duplicering.

**Framtidsvärde:** detta är det enskilt mest återanvändbara lagret i hela OS —
"nervsystemet" spec:en efterfrågar. Fyra planerade motorer aktiveras ovanpå det
utan kärnändring.

## Avvisat
- Egen separat event-tabell vid sidan av timeline: förkastat — skulle skapa två
  parallella händelseströmmar. Timeline ÄR händelseströmmen; vi generaliserar den.
