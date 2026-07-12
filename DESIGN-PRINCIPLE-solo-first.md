# DESIGNPRINCIP: Solo-First (privatpersonen kompromissas aldrig)

**Status:** Bindande regel för all utveckling.

## Regeln

Privatpersonen är alltid huvudmålet. Arkitekturen bär hela visionen (hushåll,
familj, LSS, kommun, företag), men den komplexiteten får ALDRIG synas eller
kännas för en ensam användare.

## Konkret vad detta betyder i kod & UX

1. **Ingen kontext-väljare för solo.** En användare med bara sin personliga
   kontext ser aldrig en "välj kontext"-meny. Den dyker upp FÖRST när de faktiskt
   har fler än en kontext (gått med i ett hushåll etc.).

2. **Inga tomma tenant-fält.** Roll, behörighet, organisation osv. syns inte i
   UI för en privatperson. Standard är osynligt.

3. **Standardvärden fyller allt.** Personlig kontext skapas automatiskt vid
   registrering. Användaren behöver aldrig "skapa en kontext".

4. **Delning är opt-in, inte närvarande.** Delningsfunktioner introduceras bara
   när användaren aktivt vill dela — aldrig som default-brus.

5. **Språket är personligt.** "Min ekonomi", inte "Organisationens transaktioner".
   Företags-/vård-terminologi aktiveras bara i de kontexterna.

## Test för varje ny funktion

Fråga alltid: "Om jag är en ensam förälder som bara vill kolla min lön — ser jag
något av det här tenant-maskineriet?" Om ja → göm det bakom kontext-typ.

Arkitekturen är kraftfull under ytan. Ytan är enkel.
