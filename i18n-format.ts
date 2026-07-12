// =====================================================================
// core/i18n/format.ts — ENDA källan för formatering av tal/valuta/datum/tid.
// Locale-medveten (ADR-004). Defaultar perfekt till svenskt, men respekterar
// användarens inställning. Bygger på Intl.* (inbyggt, ingen bundle-kostnad).
//
// Svensk privatperson får IDENTISK output som förr. En användare med annan
// locale/valuta får rätt format automatiskt. Språk, region, valuta och
// tidszon är oberoende axlar.
// =====================================================================

export type LocaleSettings = {
  language: string;   // 'sv','en',...
  region: string;     // 'SE','NO','US',...
  currency: string;   // 'SEK','NOK','USD',...
  timezone: string;   // 'Europe/Stockholm'
};

export const DEFAULT_LOCALE: LocaleSettings = {
  language: "sv",
  region: "SE",
  currency: "SEK",
  timezone: "Europe/Stockholm",
};

/** BCP-47-tagg av språk+region, t.ex. 'sv-SE', 'en-US'. */
export function bcp47(l: LocaleSettings): string {
  return `${l.language}-${l.region}`;
}

/** Pengar i valfri valuta. Standard: användarens locale + currency. */
export function money(
  amount: number,
  l: LocaleSettings = DEFAULT_LOCALE,
  opts: { currency?: string; decimals?: number } = {}
): string {
  return new Intl.NumberFormat(bcp47(l), {
    style: "currency",
    currency: opts.currency ?? l.currency,
    maximumFractionDigits: opts.decimals ?? 0,
    minimumFractionDigits: opts.decimals ?? 0,
  }).format(amount);
}

/** Pengar med öre/cents (2 decimaler). */
export function moneyPrecise(
  amount: number,
  l: LocaleSettings = DEFAULT_LOCALE,
  currency?: string
): string {
  return money(amount, l, { currency, decimals: 2 });
}

/** Rena tal enligt locale (tusentalsavgränsare osv.). */
export function number(n: number, l: LocaleSettings = DEFAULT_LOCALE, digits = 0): string {
  return new Intl.NumberFormat(bcp47(l), { maximumFractionDigits: digits }).format(n);
}

/** Datum, locale- och tidszons-medvetet. */
export function date(
  d: Date | string,
  l: LocaleSettings = DEFAULT_LOCALE,
  opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }
): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(bcp47(l), { ...opts, timeZone: l.timezone }).format(dt);
}

/** Klockslag i användarens tidszon. */
export function time(d: Date | string, l: LocaleSettings = DEFAULT_LOCALE): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(bcp47(l), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: l.timezone,
  }).format(dt);
}

/** Veckostart för regionen (0=sön, 1=mån). SE/NO/FI=mån, US=sön. */
export function weekStart(l: LocaleSettings = DEFAULT_LOCALE): 0 | 1 {
  return ["US", "CA"].includes(l.region) ? 0 : 1;
}

// ---------------------------------------------------------------------
// Bakåtkompatibla svenska helpers (så befintlig kod inte bryts direkt).
// Dessa anropar den nya locale-medvetna kärnan med svenskt default.
// Migrera anropställen gradvis till money()/date()/time() med användarens locale.
// ---------------------------------------------------------------------
export const sek = (n: number) => money(n, DEFAULT_LOCALE);
export const sekPrecise = (n: number) => moneyPrecise(n, DEFAULT_LOCALE);
export const num = (n: number, digits = 0) => number(n, DEFAULT_LOCALE, digits);
export const sweDate = (d: Date | string) => date(d, DEFAULT_LOCALE);
export const sweTime = (d: Date | string) => time(d, DEFAULT_LOCALE);
