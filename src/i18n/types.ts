export type Locale = "ar" | "en" | "fr";

export const LOCALES: Locale[] = ["ar", "en", "fr"];

export type LocalizedString = Record<Locale, string>;

/** Convenience builder: `loc("ar","en","fr")` */
export function loc(ar: string, en: string, fr: string): LocalizedString {
  return { ar, en, fr };
}

/** Same string in every locale (for things like ppm, kg, etc.). */
export function same(value: string): LocalizedString {
  return { ar: value, en: value, fr: value };
}
