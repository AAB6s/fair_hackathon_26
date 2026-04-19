import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { STRINGS } from "./strings";
import { LOCALES, type Locale, type LocalizedString } from "./types";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  autoCycle: boolean;
  setAutoCycle: (enabled: boolean) => void;
  /** Static UI lookup: `t("header.lastUpdated")` */
  t: (key: string) => string;
  /** Pick the right field from a LocalizedString or pass through a plain string. */
  tr: (value: LocalizedString | string | undefined | null) => string;
  dir: "rtl" | "ltr";
  /** BCP-47 tag, e.g. "ar-TN" / "en-US" / "fr-FR" — used for Intl + TTS. */
  bcp47: string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);
const STORAGE_KEY = "aegis-locale";
const AUTO_CYCLE_KEY = "aegis-auto-cycle";

// NOTE on Arabic: most desktop browsers/OSes ship `ar-SA` (or generic `ar`)
// rather than `ar-TN`. Using ar-SA gives the speech engine a real voice
// to attach to; the UI/translations remain Tunisian Darija.
const BCP47: Record<Locale, string> = {
  ar: "ar-SA",
  en: "en-US",
  fr: "fr-FR",
};

function readStored(): Locale | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "ar" || v === "en" || v === "fr") return v;
  } catch {
    /* ignore */
  }
  return null;
}

function detectLocale(): Locale {
  const stored = readStored();
  if (stored) return stored;
  if (typeof navigator !== "undefined") {
    const lang = navigator.language?.toLowerCase() ?? "";
    if (lang.startsWith("ar")) return "ar";
    if (lang.startsWith("fr")) return "fr";
    if (lang.startsWith("en")) return "en";
  }
  return "ar";
}

function readStoredAutoCycle(): boolean {
  try {
    return localStorage.getItem(AUTO_CYCLE_KEY) === "1";
  } catch {
    return false;
  }
}

function isLocalized(value: unknown): value is LocalizedString {
  return (
    typeof value === "object" &&
    value !== null &&
    "ar" in value &&
    "en" in value &&
    "fr" in value
  );
}

function lookupPath(root: unknown, parts: string[]): unknown {
  let node: unknown = root;
  for (const p of parts) {
    if (node && typeof node === "object" && p in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return node;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());
  const [autoCycle, setAutoCycleState] = useState<boolean>(() => readStoredAutoCycle());

  const setLocale = useCallback((next: Locale) => {
    if (!LOCALES.includes(next)) return;
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const setAutoCycle = useCallback((enabled: boolean) => {
    setAutoCycleState(enabled);
    try {
      localStorage.setItem(AUTO_CYCLE_KEY, enabled ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!autoCycle) return;

    const interval = window.setInterval(() => {
      setLocaleState((current) => {
        const next = LOCALES[(LOCALES.indexOf(current) + 1) % LOCALES.length];
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* ignore */
        }
        return next;
      });
    }, 20000);

    return () => window.clearInterval(interval);
  }, [autoCycle]);

  // Apply <html lang> + dir whenever locale changes
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => {
    const t = (key: string): string => {
      const node = lookupPath(STRINGS, key.split("."));
      if (isLocalized(node)) return node[locale];
      // Returning the key itself makes missing entries obvious in dev
      return key;
    };
    const tr = (val: LocalizedString | string | undefined | null): string => {
      if (val == null) return "";
      if (typeof val === "string") return val;
      return val[locale] ?? val.en ?? val.ar ?? "";
    };
    return {
      locale,
      setLocale,
      autoCycle,
      setAutoCycle,
      t,
      tr,
      dir: locale === "ar" ? "rtl" : "ltr",
      bcp47: BCP47[locale],
    };
  }, [autoCycle, locale, setAutoCycle, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside <LocaleProvider>");
  return ctx;
}

/** Standalone helper for places without React context (e.g. summary builder) */
export function pickLocalized(value: LocalizedString | string, locale: Locale): string {
  if (typeof value === "string") return value;
  return value[locale] ?? value.en ?? value.ar ?? "";
}
