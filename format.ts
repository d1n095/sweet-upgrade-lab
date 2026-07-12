// =====================================================================
// lib/format.ts — RE-EXPORT av den locale-medvetna formateringen.
// Historiskt låg formateringen här (hårdkodad sv-SE/SEK). Den bor nu i
// core/i18n/format.ts (ADR-004). Denna fil re-exporterar de svenska
// helpers så alla befintliga imports fortsätter fungera oförändrat,
// men får den locale-medvetna kärnan under huven.
//
// Migrera gradvis anropställen till money()/date()/time() med användarens
// locale (via useSession/useLocale) för full internationalisering.
// =====================================================================

export { sek, sekPrecise, num, sweDate, sweTime, money, moneyPrecise,
         number, date, time, weekStart, bcp47, DEFAULT_LOCALE,
         type LocaleSettings } from "@/modules/core/i18n/format";
