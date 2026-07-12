# ADR-002: Ägarskaps- & tenancy-modell — grunden för hela visionen

**Status:** Beslutad · **Datum:** 2026-07-11 · **Beslutsfattare:** teknisk ägare (Claude), mandat från dd

## Kontext

Nuvarande modell: varje rad ägs av `auth.uid() = user_id`. Perfekt för en
privatperson, men visionen kräver:
- Hushåll/familj som delar ekonomi och dokument
- LSS/vård: personal ser brukares data med behörighet
- Kommun/organisation: hierarki, avdelningar, roller
- Företag: team, delade objekt

"En rad = en användare" kan INTE uttrycka detta. Att lägga till delning senare
skulle kräva omskrivning av RLS på varje tabell, migrering av all data och
ändring av varje query — exakt den ombyggnad vi vill undvika.

## Beslut: Ägarskap via kontext, inte via användare

Vi inför en abstraktion mellan *objekt* och *människa*:

```
owner_contexts        — VEM äger data (person / household / organization)
  id, type, name, created_at
    type: 'personal' | 'household' | 'organization'

context_members       — vilka användare hör till en kontext + deras roll
  context_id, user_id, role, status, invited_by, joined_at
    role: 'owner' | 'admin' | 'member' | 'staff' | 'viewer' | 'subject'
      (subject = brukare vars data hanteras; egen integritet, se nedan)

  Varje objekt-tabell får: owner_context_id  (istället för/utöver user_id)
```

**Varje användare får automatiskt en personlig kontext** vid registrering
(type='personal', de själva som 'owner'). För en privatperson är detta
osynligt — allt fungerar precis som förut. Men grunden bär resten.

### RLS blir kontext-baserad
Istället för `auth.uid() = user_id`:
```sql
USING (owner_context_id IN (
  SELECT context_id FROM context_members
  WHERE user_id = auth.uid() AND status = 'active'
))
```
Detta ger delning, roller och organisationer UTAN att röra tabellstrukturen igen.
En hjälpfunktion `auth_context_ids()` cachar detta för prestanda.

### Roller & behörigheter (capability-baserat, inte hårdkodat)
En roll ger *capabilities* (t.ex. `shifts.read`, `salary.write`,
`documents.read`). Capabilities definieras i data (`role_capabilities`), så nya
roller/behörigheter kan läggas till utan kodändring. Detta bär LSS-scenariot:
personal får `subject.care.read` men inte `subject.finance.read`.

### Brukarintegritet (Privacy Wall — Del 58)
En 'subject' (brukare) äger sin egen integritet. Personal ser bara det deras
capabilities tillåter. Brukaren (eller god man) kan styra vad som delas. Detta
är inbyggt i capability-modellen från dag ett, inte påklistrat.

## Migrationsstrategi (denna dev-kopia, ingen bakåtkompatibilitet)

Eftersom detta är en fristående utvecklingskopia bygger vi det RÄTT direkt:
1. Skapa owner_contexts + context_members + roll/capability-tabeller.
2. Ge varje befintlig användare en personlig kontext.
3. Lägg `owner_context_id` på alla objekt-tabeller, backfilla från user_id.
4. Byt RLS till kontext-baserad.
5. `user_id` behålls som "skapad av" (audit), men ÄGARSKAP går via kontext.

## Konsekvenser

**Positiva:** En modell bär privatperson → hushåll → företag → kommun utan
ombyggnad. Delning, roller, Privacy Wall, multi-tenant blir konfiguration, inte
omskrivning. Detta är hur man skulle byggt från dag ett med dagens kunskap.

**Kostnad:** Större migration nu + alla queries måste gå via kontext. Men detta
är engångskostnaden som köper hela den kommersiella visionen.

**Detta är den enskilt viktigaste arkitektursbeslutet i projektet.** Allt annat
bygger ovanpå det.

## Avvisat alternativ
"Bygg per-user nu, lägg till tenancy senare" — förkastat: det är den ombyggnad
mandatet uttryckligen säger att vi ska undvika.
