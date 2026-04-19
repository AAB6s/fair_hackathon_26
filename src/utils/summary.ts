import { pickLocalized } from "../i18n/LocaleContext";
import type { Locale, LocalizedString } from "../i18n/types";
import type { Indicator, Region, Severity, SystemState } from "../types";
import { classify } from "./classify";

export interface SummarySegment {
  id: string;
  text: LocalizedString;
  weight?: "headline" | "alert" | "action" | "info";
}

const indicatorLabel: Record<Indicator["key"], LocalizedString> = {
  so2: { ar: "ثاني أكسيد الكبريت", en: "Sulfur dioxide", fr: "Dioxyde de soufre" },
  phosphate: { ar: "الفسفاط", en: "Phosphate", fr: "Phosphate" },
  ph: { ar: "درجة الحموضة", en: "Acidity (pH)", fr: "Acidite (pH)" },
  water: { ar: "تلوث الماء", en: "Water contamination", fr: "Contamination de l'eau" },
};

const severityWord: Record<Severity, LocalizedString> = {
  normal: { ar: "طبيعي", en: "normal", fr: "normal" },
  warning: { ar: "تحذير", en: "warning", fr: "alerte" },
  danger: { ar: "خطر", en: "danger", fr: "danger" },
};

const compass = (deg: number): LocalizedString => {
  const dirs: LocalizedString[] = [
    { ar: "الشمال", en: "north", fr: "nord" },
    { ar: "الشمال الشرقي", en: "northeast", fr: "nord-est" },
    { ar: "الشرق", en: "east", fr: "est" },
    { ar: "الجنوب الشرقي", en: "southeast", fr: "sud-est" },
    { ar: "الجنوب", en: "south", fr: "sud" },
    { ar: "الجنوب الغربي", en: "southwest", fr: "sud-ouest" },
    { ar: "الغرب", en: "west", fr: "ouest" },
    { ar: "الشمال الغربي", en: "northwest", fr: "nord-ouest" },
  ];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
};

function fmtNumber(n: number, fractionDigits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function joinNames(names: LocalizedString[]): LocalizedString {
  return {
    ar: names.map((n) => n.ar).join("، "),
    en: names.map((n) => n.en).join(", "),
    fr: names.map((n) => n.fr).join(", "),
  };
}

export function buildDashboardSummary(state: SystemState): SummarySegment[] {
  const segments: SummarySegment[] = [];
  const sev = state.globalSeverity;
  const sevWord = severityWord[sev];

  segments.push({
    id: "headline",
    weight: "headline",
    text: {
      ar: `الوضع العام في قابس: ${sevWord.ar}.`,
      en: `Overall status for Gabes: ${sevWord.en}.`,
      fr: `Etat general a Gabes : ${sevWord.fr}.`,
    },
  });

  const ranked = [...state.indicators].sort((a, b) => {
    const score = (s: Severity) => (s === "danger" ? 2 : s === "warning" ? 1 : 0);
    return score(classify(b)) - score(classify(a));
  });

  for (const ind of ranked.slice(0, 3)) {
    const status = classify(ind);
    const label = indicatorLabel[ind.key];
    const sw = severityWord[status];
    const v = fmtNumber(ind.value, ind.key === "ph" ? 1 : 0);

    segments.push({
      id: `ind-${ind.key}`,
      weight: status === "normal" ? "info" : "alert",
      text: status === "normal"
        ? {
            ar: `${label.ar} ${v} ${ind.unit} ضمن الحدود الطبيعية.`,
            en: `${label.en} at ${v} ${ind.unit} is within normal range.`,
            fr: `${label.fr} a ${v} ${ind.unit} dans la plage normale.`,
          }
        : {
            ar: `${label.ar} وصل إلى ${v} ${ind.unit} - حالة ${sw.ar}.`,
            en: `${label.en} reached ${v} ${ind.unit} - ${sw.en}.`,
            fr: `${label.fr} atteint ${v} ${ind.unit} - ${sw.fr}.`,
          },
    });
  }

  const dangerRegions: Region[] = state.regions.filter((r) => r.severity === "danger");
  const warnRegions: Region[] = state.regions.filter((r) => r.severity === "warning");
  if (dangerRegions.length > 0) {
    const names = joinNames(dangerRegions.slice(0, 3).map((r) => r.name));
    segments.push({
      id: "regions-danger",
      weight: "alert",
      text: {
        ar: `مناطق في خطر: ${names.ar}.`,
        en: `Critical zones: ${names.en}.`,
        fr: `Zones critiques : ${names.fr}.`,
      },
    });
  } else if (warnRegions.length > 0) {
    const names = joinNames(warnRegions.slice(0, 3).map((r) => r.name));
    segments.push({
      id: "regions-warn",
      weight: "info",
      text: {
        ar: `مناطق تحت المراقبة: ${names.ar}.`,
        en: `Zones under watch: ${names.en}.`,
        fr: `Zones sous surveillance : ${names.fr}.`,
      },
    });
  }

  const affected = state.regions
    .filter((r) => r.severity !== "normal")
    .reduce((sum, r) => sum + r.population, 0);
  if (affected > 0) {
    segments.push({
      id: "population",
      weight: "info",
      text: {
        ar: `عدد السكان المتأثرين تقريبا ${fmtNumber(affected)}.`,
        en: `Approximately ${fmtNumber(affected)} residents are exposed.`,
        fr: `Environ ${fmtNumber(affected)} habitants exposes.`,
      },
    });
  }

  const dir = compass(state.prediction.windDirection);
  const ws = state.prediction.windSpeed.toFixed(1);
  const sp = state.prediction.spreadKm.toFixed(1);
  segments.push({
    id: "wind",
    weight: "info",
    text: {
      ar: `الرياح من ${dir.ar} بسرعة ${ws} متر في الثانية، والسحابة تتمدد على مسافة ${sp} كيلومتر.`,
      en: `Wind from the ${dir.en} at ${ws} meters per second, plume spreading ${sp} kilometers.`,
      fr: `Vent du ${dir.fr} a ${ws} metres par seconde, panache sur ${sp} kilometres.`,
    },
  });

  segments.push({
    id: "forecast",
    weight: "info",
    text: {
      ar: `التوقع: الذروة بعد ${Math.round(state.prediction.peakInMinutes)} دقيقة عند ${fmtNumber(state.prediction.peakValue, 0)} ${state.prediction.unit}.`,
      en: `Forecast: peak in ${Math.round(state.prediction.peakInMinutes)} minutes at ${fmtNumber(state.prediction.peakValue, 0)} ${state.prediction.unit}.`,
      fr: `Prevision : pic dans ${Math.round(state.prediction.peakInMinutes)} minutes a ${fmtNumber(state.prediction.peakValue, 0)} ${state.prediction.unit}.`,
    },
  });

  const topAlerts = state.alerts.slice(0, 2);
  for (const a of topAlerts) {
    segments.push({
      id: `alert-${a.id}`,
      weight: "alert",
      text: {
        ar: `إنذار: ${a.title.ar}. ${a.detail.ar}`,
        en: `Alert: ${a.title.en}. ${a.detail.en}`,
        fr: `Alerte : ${a.title.fr}. ${a.detail.fr}`,
      },
    });
  }

  const immediate = state.actions.filter((a) => a.priority === "immediate");
  if (immediate.length > 0) {
    segments.push({
      id: "actions-headline",
      weight: "action",
      text: {
        ar: `إجراءات فورية مطلوبة (${immediate.length}):`,
        en: `Immediate actions required (${immediate.length}):`,
        fr: `Actions immediates requises (${immediate.length}) :`,
      },
    });

    for (const action of immediate.slice(0, 3)) {
      segments.push({
        id: `action-${action.id}`,
        weight: "action",
        text: {
          ar: `${action.title.ar} على ${action.target.ar}. السبب: ${action.reason.ar}`,
          en: `${action.title.en} on ${action.target.en}. Reason: ${action.reason.en}`,
          fr: `${action.title.fr} sur ${action.target.fr}. Raison : ${action.reason.fr}`,
        },
      });
    }
  } else {
    segments.push({
      id: "actions-none",
      weight: "info",
      text: {
        ar: "لا توجد إجراءات فورية في هذه اللحظة.",
        en: "No immediate actions required at this moment.",
        fr: "Aucune action immediate requise.",
      },
    });
  }

  segments.push({
    id: "loss",
    weight: "info",
    text: {
      ar: `الخسائر: ${fmtNumber(state.loss.acidLossKg)} كيلوغرام حمض، التكلفة التقديرية ${fmtNumber(state.loss.estimatedCostUsd)} دولار.`,
      en: `Losses: ${fmtNumber(state.loss.acidLossKg)} kilograms of acid, estimated cost ${fmtNumber(state.loss.estimatedCostUsd)} dollars.`,
      fr: `Pertes : ${fmtNumber(state.loss.acidLossKg)} kilogrammes d'acide, cout estime ${fmtNumber(state.loss.estimatedCostUsd)} dollars.`,
    },
  });

  return segments;
}

export function summaryToPlain(segments: SummarySegment[], locale: Locale): string {
  return segments.map((s) => pickLocalized(s.text, locale)).join(" ");
}

const signSeverityGloss: Record<Severity, string> = {
  normal: "واضح",
  warning: "تحذير",
  danger: "خطر",
};

function pushGloss(target: string[], ...glosses: Array<string | false | null | undefined>) {
  glosses.forEach((gloss) => {
    if (!gloss) return;
    if (target[target.length - 1] === gloss) return;
    target.push(gloss);
  });
}

function maxSeverity(values: Severity[]): Severity {
  if (values.includes("danger")) return "danger";
  if (values.includes("warning")) return "warning";
  return "normal";
}

export function buildDashboardSignSummary(state: SystemState): string {
  const glosses: string[] = [];
  const airSeverity = maxSeverity(
    state.indicators
      .filter((indicator) => indicator.key === "so2" || indicator.key === "phosphate")
      .map((indicator) => classify(indicator)),
  );
  const waterSeverity = maxSeverity(
    state.indicators
      .filter((indicator) => indicator.key === "water" || indicator.key === "ph")
      .map((indicator) => classify(indicator)),
  );
  const schoolSeverity = maxSeverity(
    state.regions
      .filter((region) => region.type === "school" && region.severity !== "normal")
      .map((region) => region.severity),
  );
  const immediateActions = state.actions.filter((action) => action.priority === "immediate");
  const hasSystemIssue = state.alerts.some((alert) => alert.type === "system");

  pushGloss(glosses, "إعلان عام", signSeverityGloss[state.globalSeverity], "الآن");

  if (airSeverity !== "normal") {
    pushGloss(glosses, "هواء", signSeverityGloss[airSeverity]);
  }

  if (waterSeverity !== "normal") {
    pushGloss(glosses, "ماء", signSeverityGloss[waterSeverity]);
  }

  if (schoolSeverity !== "normal") {
    pushGloss(glosses, "مدرسة", signSeverityGloss[schoolSeverity], "هنا");
  }

  if (state.prediction.windSpeed >= 7) {
    pushGloss(glosses, "هواء", "قوي");
  }

  if (state.alerts.length > 0) {
    pushGloss(glosses, hasSystemIssue ? "خطأ" : "مشكلة");
  }

  if (immediateActions.length > 0) {
    pushGloss(glosses, "إجراء", "مهم");

    immediateActions.slice(0, 2).forEach((action) => {
      if (action.category === "stop") {
        pushGloss(glosses, "توقف", "مباشرة");
        return;
      }

      if (action.category === "scrubber") {
        pushGloss(glosses, "مغسلة", "يغسل", "مباشرة");
        return;
      }

      pushGloss(glosses, "يراقب", "يفحص");
    });
  } else {
    pushGloss(glosses, "يراقب", "يفحص");
  }

  if (state.prediction.peakInMinutes <= 45) {
    pushGloss(glosses, "قريبا");
  }

  pushGloss(glosses, "اليوم");

  return glosses.join(" ");
}
