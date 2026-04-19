import { STRINGS } from "../i18n/strings";
import { loc, same, type Locale, type LocalizedString } from "../i18n/types";
import type {
  Action,
  Advisory,
  Alert,
  FactoryUnit,
  Indicator,
  LossInfo,
  Prediction,
  PredictionPoint,
  Region,
  Scenario,
  Severity,
  SystemState,
} from "../types";
import { aggregateSeverity, classify } from "../utils/classify";

type IndicatorKey = Indicator["key"];

interface ScenarioDescriptor {
  label: LocalizedString;
  strapline: LocalizedString;
  summary: LocalizedString;
}

interface IndicatorProfile {
  base: number;
  amplitude: number;
}

interface ScenarioProfile {
  descriptor: ScenarioDescriptor;
  indicators: Record<IndicatorKey, IndicatorProfile>;
  windDirection: number;
  windSpeed: number;
  spreadKm: number;
  regionOffsets: Record<string, number>;
  unitOverrides: Record<string, Partial<FactoryUnit>>;
  loss: LossInfo;
}

const indicatorOrder: IndicatorKey[] = ["so2", "phosphate", "ph", "water"];

const indicatorBlueprints: Record<
  IndicatorKey,
  Omit<Indicator, "value" | "trend">
> = {
  so2: {
    key: "so2",
    label: loc("غاز SO₂", "SO₂ gas", "Gaz SO₂"),
    unit: "ppm",
    min: 0,
    max: 120,
    warningAt: 55,
    dangerAt: 72,
    description: loc(
      "قياس مستمر للغازات عند مدخنة معالجة الفوسفات.",
      "Continuous gas reading at the phosphate stack.",
      "Mesure continue des gaz à la cheminée du traitement de phosphate.",
    ),
  },
  phosphate: {
    key: "phosphate",
    label: loc("رذاذ الحمض والفوسفات", "Acid & phosphate mist", "Brouillard acide & phosphate"),
    unit: "mg/m³",
    min: 0,
    max: 100,
    warningAt: 48,
    dangerAt: 68,
    description: loc(
      "رذاذ حمضي وجزيئات فوسفات قرب مسار العادم.",
      "Acid mist and phosphate particles along the exhaust path.",
      "Brouillard acide et particules de phosphate le long de l'évacuation.",
    ),
  },
  ph: {
    key: "ph",
    label: loc("حموضة التصريف", "Discharge pH", "pH de rejet"),
    unit: "pH",
    min: 4.5,
    max: 8.5,
    warningAt: 6.5,
    dangerAt: 5.8,
    invert: true,
    description: loc(
      "درجة الحموضة في حوض المعادلة قبل التصريف إلى البحر.",
      "pH at the neutralization basin before sea discharge.",
      "pH au bassin de neutralisation avant rejet en mer.",
    ),
  },
  water: {
    key: "water",
    label: loc("تلوث مياه البحر", "Seawater contamination", "Contamination de l'eau de mer"),
    unit: "ppm",
    min: 0,
    max: 100,
    warningAt: 40,
    dangerAt: 60,
    description: loc(
      "مؤشر مركب يجمع المواد الصلبة والحموضة والعكارة.",
      "Composite index of solids, acidity and turbidity.",
      "Indice composite : solides, acidité et turbidité.",
    ),
  },
};

const regionBlueprints: Array<Omit<Region, "pollution" | "severity">> = [
  {
    id: "industrial-core",
    name: loc("المجمع الصناعي", "Industrial complex", "Complexe industriel"),
    population: 7400,
    path: "M118 168 L266 154 L302 224 L248 310 L126 286 L92 220 Z",
    centroid: [198, 228],
    distanceKm: 0.8,
    type: "industrial",
  },
  {
    id: "ghannouch-north",
    name: loc("غنوش الشمالية", "North Ghannouch", "Ghannouch Nord"),
    population: 18400,
    path: "M266 154 L410 144 L448 216 L302 224 Z",
    centroid: [360, 184],
    distanceKm: 4.2,
    type: "urban",
  },
  {
    id: "school-belt",
    name: loc("الحزام المدرسي", "School belt", "Ceinture scolaire"),
    population: 9600,
    path: "M410 144 L554 140 L566 220 L448 216 Z",
    centroid: [492, 182],
    distanceKm: 7.1,
    type: "school",
  },
  {
    id: "agri-basin",
    name: loc("الحوض الفلاحي", "Agricultural basin", "Bassin agricole"),
    population: 12600,
    path: "M126 286 L248 310 L246 404 L120 422 L82 340 Z",
    centroid: [176, 356],
    distanceKm: 3.8,
    type: "agricultural",
  },
  {
    id: "gabes-central",
    name: loc("وسط قابس", "Central Gabès", "Gabès Centre"),
    population: 26300,
    path: "M248 310 L392 296 L402 394 L246 404 Z",
    centroid: [324, 352],
    distanceKm: 5.6,
    type: "urban",
  },
  {
    id: "canal-mouth",
    name: loc("مصب القنال", "Canal mouth", "Embouchure du canal"),
    population: 11800,
    path: "M302 224 L448 216 L392 296 L248 310 Z",
    centroid: [344, 256],
    distanceKm: 4.8,
    type: "coastal",
  },
  {
    id: "south-coast",
    name: loc("الساحل الجنوبي", "South coast", "Côte Sud"),
    population: 15200,
    path: "M448 216 L566 220 L596 372 L402 394 L392 296 Z",
    centroid: [500, 306],
    distanceKm: 8.8,
    type: "coastal",
  },
];

const unitBlueprints: FactoryUnit[] = [
  {
    id: "reactor-r02",
    name: loc("خط التفاعل R-02", "Reactor line R-02", "Ligne réacteur R-02"),
    status: "online",
    load: 78,
    efficiency: 87,
    type: "reactor",
  },
  {
    id: "reactor-r03",
    name: loc("خط التفاعل R-03", "Reactor line R-03", "Ligne réacteur R-03"),
    status: "online",
    load: 72,
    efficiency: 83,
    type: "reactor",
  },
  {
    id: "scrubber-s01",
    name: loc("غاسلة الغاز S-01", "Gas scrubber S-01", "Laveur de gaz S-01"),
    status: "online",
    load: 76,
    efficiency: 91,
    type: "scrubber",
  },
  {
    id: "filter-f09",
    name: loc("المرشح الجاف F-09", "Dry filter F-09", "Filtre sec F-09"),
    status: "online",
    load: 68,
    efficiency: 88,
    type: "filter",
  },
  {
    id: "pump-p14",
    name: loc("مضخة التصريف P-14", "Discharge pump P-14", "Pompe de rejet P-14"),
    status: "online",
    load: 64,
    efficiency: 90,
    type: "pump",
  },
  {
    id: "tank-a1",
    name: loc("خزان الحمض A1", "Acid tank A1", "Réservoir d'acide A1"),
    status: "online",
    load: 70,
    efficiency: 85,
    type: "storage",
  },
];

export const scenarioOrder: Scenario[] = [
  "normal",
  "leak",
  "high_pollution",
  "scrubber_failure",
];

export const scenarioDescriptors: Record<Scenario, ScenarioDescriptor> = {
  normal: {
    label: STRINGS.scenario.label.normal,
    strapline: loc("تشغيل مستقر", "Stable operation", "Fonctionnement stable"),
    summary: loc(
      "كل وحدات التحكم شغالة، والتلوث البحري مازال داخل المجال المتوقع.",
      "All control units online; marine pollution stays within expected range.",
      "Toutes les unités opérationnelles ; pollution marine dans la plage attendue.",
    ),
  },
  leak: {
    label: STRINGS.scenario.label.leak,
    strapline: loc("خلل في خط التحويل", "Diversion line fault", "Défaut sur la ligne de dérivation"),
    summary: loc(
      "ارتفاع مفاجئ في SO₂ والرذاذ الحمضي حول خط التحويل مع تأثير مباشر على المنطقة القريبة.",
      "Sudden SO₂ and acid-mist surge around the diversion line, direct impact nearby.",
      "Pic soudain de SO₂ et de brouillard acide autour de la ligne, impact direct à proximité.",
    ),
  },
  high_pollution: {
    label: STRINGS.scenario.label.high_pollution,
    strapline: loc("سحابة تلوث مستمرة", "Sustained pollution plume", "Panache de pollution soutenu"),
    summary: loc(
      "الانبعاثات المرتفعة مع الرياح نحو الداخل تدفع التلوث إلى المناطق السكنية.",
      "Elevated emissions with onshore wind push pollution into residential zones.",
      "Émissions élevées et vent terrestre poussent la pollution vers les zones habitées.",
    ),
  },
  scrubber_failure: {
    label: STRINGS.scenario.label.scrubber_failure,
    strapline: loc("ضعف غسل الغاز", "Weak gas-washing", "Lavage de gaz affaibli"),
    summary: loc(
      "كفاءة الغاسلة تنهار والمدخنة تبدأ في إطلاق سحابة أشد من المعتاد.",
      "Scrubber efficiency collapses; the stack releases an unusually thick plume.",
      "L'efficacité du laveur s'effondre, la cheminée libère un panache plus dense.",
    ),
  },
};

const scenarioProfiles: Record<Scenario, ScenarioProfile> = {
  normal: {
    descriptor: scenarioDescriptors.normal,
    indicators: {
      so2: { base: 38, amplitude: 5 },
      phosphate: { base: 26, amplitude: 4 },
      ph: { base: 7.3, amplitude: 0.18 },
      water: { base: 28, amplitude: 4 },
    },
    windDirection: 102,
    windSpeed: 4.1,
    spreadKm: 4.6,
    regionOffsets: {
      "industrial-core": 42,
      "ghannouch-north": 34,
      "school-belt": 26,
      "agri-basin": 24,
      "gabes-central": 30,
      "canal-mouth": 36,
      "south-coast": 28,
    },
    unitOverrides: {
      "scrubber-s01": { efficiency: 91, status: "online", load: 76 },
      "reactor-r02": { load: 76, efficiency: 88 },
      "reactor-r03": { load: 70, efficiency: 84 },
    },
    loss: {
      acidLossKg: 120,
      acidLossRatePerHour: 42,
      estimatedCostUsd: 3100,
      fishImpactTons: 0.6,
      agriImpactHa: 1.3,
    },
  },
  leak: {
    descriptor: scenarioDescriptors.leak,
    indicators: {
      so2: { base: 74, amplitude: 11 },
      phosphate: { base: 64, amplitude: 10 },
      ph: { base: 6.0, amplitude: 0.28 },
      water: { base: 47, amplitude: 6 },
    },
    windDirection: 114,
    windSpeed: 6.4,
    spreadKm: 8.1,
    regionOffsets: {
      "industrial-core": 87,
      "ghannouch-north": 76,
      "school-belt": 58,
      "agri-basin": 48,
      "gabes-central": 54,
      "canal-mouth": 69,
      "south-coast": 57,
    },
    unitOverrides: {
      "scrubber-s01": { efficiency: 63, status: "degraded", load: 86 },
      "reactor-r02": { load: 90, efficiency: 74 },
      "pump-p14": { efficiency: 69, status: "degraded" },
      "tank-a1": { load: 82, efficiency: 71 },
    },
    loss: {
      acidLossKg: 860,
      acidLossRatePerHour: 460,
      estimatedCostUsd: 28100,
      fishImpactTons: 4.1,
      agriImpactHa: 7.4,
    },
  },
  high_pollution: {
    descriptor: scenarioDescriptors.high_pollution,
    indicators: {
      so2: { base: 66, amplitude: 7 },
      phosphate: { base: 57, amplitude: 6 },
      ph: { base: 6.25, amplitude: 0.2 },
      water: { base: 61, amplitude: 5 },
    },
    windDirection: 122,
    windSpeed: 7.8,
    spreadKm: 11.7,
    regionOffsets: {
      "industrial-core": 72,
      "ghannouch-north": 79,
      "school-belt": 76,
      "agri-basin": 52,
      "gabes-central": 68,
      "canal-mouth": 84,
      "south-coast": 81,
    },
    unitOverrides: {
      "scrubber-s01": { efficiency: 68, status: "degraded", load: 88 },
      "reactor-r02": { load: 86, efficiency: 79 },
      "reactor-r03": { load: 84, efficiency: 78 },
      "filter-f09": { efficiency: 74, status: "degraded" },
    },
    loss: {
      acidLossKg: 540,
      acidLossRatePerHour: 280,
      estimatedCostUsd: 19200,
      fishImpactTons: 6.2,
      agriImpactHa: 10.6,
    },
  },
  scrubber_failure: {
    descriptor: scenarioDescriptors.scrubber_failure,
    indicators: {
      so2: { base: 82, amplitude: 9 },
      phosphate: { base: 66, amplitude: 8 },
      ph: { base: 6.15, amplitude: 0.22 },
      water: { base: 55, amplitude: 4 },
    },
    windDirection: 112,
    windSpeed: 6.9,
    spreadKm: 9.8,
    regionOffsets: {
      "industrial-core": 84,
      "ghannouch-north": 73,
      "school-belt": 61,
      "agri-basin": 46,
      "gabes-central": 58,
      "canal-mouth": 72,
      "south-coast": 64,
    },
    unitOverrides: {
      "scrubber-s01": { efficiency: 41, status: "offline", load: 24 },
      "reactor-r02": { load: 84, efficiency: 65, status: "degraded" },
      "reactor-r03": { load: 78, efficiency: 71 },
      "filter-f09": { efficiency: 66, status: "degraded" },
    },
    loss: {
      acidLossKg: 730,
      acidLossRatePerHour: 330,
      estimatedCostUsd: 24700,
      fishImpactTons: 5.3,
      agriImpactHa: 8.7,
    },
  },
};

const factoryAnchor: [number, number] = [218, 230];
const TAU = Math.PI * 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function unitStatusLocalized(status: FactoryUnit["status"]): LocalizedString {
  if (status === "offline") return loc("متوقفة", "Offline", "Hors service");
  if (status === "degraded") return loc("متراجعة", "Degraded", "Dégradée");
  if (status === "stopped") return loc("موقوفة", "Stopped", "Arrêtée");
  return loc("شغالة", "Online", "En service");
}

function wave(seed: number, step: number): number {
  return (
    Math.sin(step * 0.56 + seed * 0.83) * 0.72 +
    Math.cos(step * 0.22 + seed * 1.47) * 0.28
  );
}

function incidentPulse(scenario: Scenario, key: IndicatorKey, step: number): number {
  const harmonic = Math.max(0, Math.sin(step * 0.82 + key.length));

  if (scenario === "leak") {
    if (key === "so2") return harmonic * 14 + 6;
    if (key === "phosphate") return harmonic * 11 + 4;
    if (key === "ph") return -(harmonic * 0.24 + 0.06);
    if (key === "water") return harmonic * 4;
  }

  if (scenario === "high_pollution") {
    if (key === "so2" || key === "water") return harmonic * 6 + 2;
    if (key === "phosphate") return harmonic * 4 + 1.5;
    if (key === "ph") return -(harmonic * 0.1 + 0.04);
  }

  if (scenario === "scrubber_failure") {
    if (key === "so2") return harmonic * 10 + 8;
    if (key === "phosphate") return harmonic * 7 + 3;
    if (key === "ph") return -(harmonic * 0.12 + 0.03);
    if (key === "water") return harmonic * 3 + 1;
  }

  return 0;
}

function buildIndicatorValue(
  scenario: Scenario,
  key: IndicatorKey,
  step: number,
): number {
  const blueprint = indicatorBlueprints[key];
  const profile = scenarioProfiles[scenario].indicators[key];
  const dynamic = profile.base + wave(indicatorOrder.indexOf(key) + 1, step) * profile.amplitude;
  const incident = incidentPulse(scenario, key, step);
  return round(clamp(dynamic + incident, blueprint.min, blueprint.max), key === "ph" ? 2 : 1);
}

function buildTrend(key: IndicatorKey, scenario: Scenario, step: number): number[] {
  return Array.from({ length: 14 }, (_, index) =>
    buildIndicatorValue(scenario, key, step - (13 - index) * 0.45),
  );
}

function buildIndicators(scenario: Scenario, step: number): Indicator[] {
  return indicatorOrder.map((key) => ({
    ...indicatorBlueprints[key],
    value: buildIndicatorValue(scenario, key, step),
    trend: buildTrend(key, scenario, step),
  }));
}

function regionAngle(region: Pick<Region, "centroid">): number {
  const dx = region.centroid[0] - factoryAnchor[0];
  const dy = factoryAnchor[1] - region.centroid[1];
  let angle = (Math.atan2(dx, dy) / TAU) * 360;
  if (angle < 0) angle += 360;
  return angle;
}

function angleDiff(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

function zoneSeverity(pollution: number): Severity {
  if (pollution >= 72) return "danger";
  if (pollution >= 45) return "warning";
  return "normal";
}

function buildRegions(
  scenario: Scenario,
  step: number,
  indicators: Indicator[],
): Region[] {
  const profile = scenarioProfiles[scenario];
  const water = indicators.find((indicator) => indicator.key === "water");

  return regionBlueprints.map((region, index) => {
    const base = profile.regionOffsets[region.id] ?? 32;
    const downwindGain = Math.max(
      0,
      Math.cos((angleDiff(regionAngle(region), profile.windDirection) * Math.PI) / 180),
    ) * 18;
    const coastalGain = region.type === "coastal" ? (water?.value ?? 0) * 0.18 : 0;
    const drift = wave(index + 4, step) * 5;
    const attenuation = region.distanceKm * 1.6;
    const pollution = round(clamp(base + downwindGain + coastalGain + drift - attenuation, 12, 98), 0);
    return {
      ...region,
      pollution,
      severity: zoneSeverity(pollution),
    };
  });
}

function buildUnits(scenario: Scenario, step: number): FactoryUnit[] {
  const profile = scenarioProfiles[scenario];

  return unitBlueprints.map((unit, index) => {
    const override = profile.unitOverrides[unit.id] ?? {};
    const loadBase = override.load ?? unit.load;
    const efficiencyBase = override.efficiency ?? unit.efficiency;
    const loadDrift = wave(index + 7, step) * 3;
    const efficiencyDrift = wave(index + 11, step) * 2.2;

    return {
      ...unit,
      ...override,
      load: round(clamp(loadBase + loadDrift, 10, 98), 0),
      efficiency: round(clamp(efficiencyBase + efficiencyDrift, 20, 98), 0),
    };
  });
}

function joinRegionNames(names: LocalizedString[]): LocalizedString {
  if (names.length === 0)
    return loc("محيط المصنع", "factory perimeter", "périmètre de l'usine");
  return {
    ar: names.map((n) => n.ar).join("، "),
    en: names.map((n) => n.en).join(", "),
    fr: names.map((n) => n.fr).join(", "),
  };
}

function buildPrediction(
  scenario: Scenario,
  step: number,
  indicators: Indicator[],
  regions: Region[],
  units: FactoryUnit[],
): Prediction {
  const profile = scenarioProfiles[scenario];
  const so2 = indicators.find((indicator) => indicator.key === "so2")!;
  const scrubber = units.find((unit) => unit.type === "scrubber")!;
  const impactedZones = regions
    .filter((region) => region.pollution >= 60)
    .sort((left, right) => right.pollution - left.pollution)
    .slice(0, 3)
    .map((region) => region.name);

  const history: PredictionPoint[] = Array.from({ length: 7 }, (_, index) => {
    const sample = so2.trend[Math.floor((index / 6) * (so2.trend.length - 1))];
    const value = round(sample + profile.windSpeed * 0.9 - scrubber.efficiency * 0.02, 1);
    return { t: -60 + index * 10, value };
  });

  const forecast: PredictionPoint[] = Array.from({ length: 7 }, (_, index) => {
    const minutes = index * 10;
    const surge =
      scenario === "leak"
        ? Math.max(0, 16 - Math.abs(minutes - 20) * 0.55)
        : scenario === "scrubber_failure"
        ? minutes * 0.22
        : scenario === "high_pollution"
        ? 6 + minutes * 0.06
        : -minutes * 0.08;
    const value = round(
      clamp(
        so2.value + surge + profile.windSpeed * 0.75 - scrubber.efficiency * 0.018 + wave(21, step + index) * 2.4,
        16,
        130,
      ),
      1,
    );
    const uncertainty = 4 + minutes * 0.08;
    return {
      t: minutes,
      value,
      band: [round(Math.max(0, value - uncertainty), 1), round(value + uncertainty, 1)],
    };
  });

  const peakPoint = forecast.reduce((peak, point) => (point.value > peak.value ? point : peak), forecast[0]);
  const topZones = joinRegionNames(impactedZones);
  const dir = compassLocalized(profile.windDirection);
  const speed = round(profile.windSpeed, 1);

  const rationale: LocalizedString = {
    ar: `رياح بسرعة ${speed} م/ث نحو ${dir.ar} تدفع السحابة إلى ${topZones.ar}. كفاءة الغاسلة ${scrubber.efficiency}%، لذلك تبقى الدقائق 30 إلى 60 القادمة مرتبطة باستقرار الغسل والتحكم في الخط.`,
    en: `Wind at ${speed} m/s from the ${dir.en} pushes the plume toward ${topZones.en}. Scrubber efficiency is ${scrubber.efficiency}%, so the next 30–60 minutes hinge on stable washing and line control.`,
    fr: `Vent à ${speed} m/s en provenance du ${dir.fr} pousse le panache vers ${topZones.fr}. Efficacité du laveur ${scrubber.efficiency}%, donc les 30–60 prochaines minutes dépendent d'un lavage stable et du contrôle de la ligne.`,
  };

  return {
    metric: loc("سحابة SO₂ باتجاه الرياح", "Down-wind SO₂ plume", "Panache SO₂ sous le vent"),
    unit: "ppm",
    history,
    forecast,
    confidence: scenario === "normal" ? 0.91 : scenario === "high_pollution" ? 0.82 : 0.76,
    rationale,
    peakInMinutes: peakPoint.t,
    peakValue: peakPoint.value,
    windDirection: profile.windDirection,
    windSpeed: round(profile.windSpeed + wave(16, step) * 0.4, 1),
    spreadKm: round(profile.spreadKm + wave(17, step) * 0.6, 1),
  };
}

function buildAlerts(
  scenario: Scenario,
  indicators: Indicator[],
  prediction: Prediction,
  units: FactoryUnit[],
  regions: Region[],
): Alert[] {
  const now = Date.now();
  const so2 = indicators.find((indicator) => indicator.key === "so2")!;
  const phosphate = indicators.find((indicator) => indicator.key === "phosphate")!;
  const ph = indicators.find((indicator) => indicator.key === "ph")!;
  const water = indicators.find((indicator) => indicator.key === "water")!;
  const scrubber = units.find((unit) => unit.type === "scrubber")!;
  const so2Delta = round(so2.trend.at(-1)! - so2.trend.at(-2)!, 1);
  const phosphateDelta = round(phosphate.trend.at(-1)! - phosphate.trend.at(-2)!, 1);
  const dangerZones = regions.filter((region) => region.severity === "danger");

  const alerts: Alert[] = [];

  if (classify(so2) !== "normal") {
    alerts.push({
      id: "alert-so2-threshold",
      ts: now - 2 * 60_000,
      type: "threshold",
      severity: classify(so2),
      title: loc("تجاوز حد SO₂", "SO₂ threshold exceeded", "Seuil SO₂ dépassé"),
      detail: {
        ar: `تم تسجيل ${so2.value.toFixed(1)} ppm عند المدخنة الرئيسية، فوق هامش التحذير ${so2.warningAt} ppm.`,
        en: `${so2.value.toFixed(1)} ppm recorded at the main stack, above the warning margin of ${so2.warningAt} ppm.`,
        fr: `${so2.value.toFixed(1)} ppm relevés à la cheminée principale, au-dessus du seuil de ${so2.warningAt} ppm.`,
      },
      source: loc("منظومة القياس المستمر / القناة الشمالية", "CEMS / North channel", "SACS / canal nord"),
    });
  }

  if (scenario === "leak" || so2Delta >= 8 || phosphateDelta >= 7) {
    alerts.push({
      id: "alert-leak-detected",
      ts: now - 70_000,
      type: "leak",
      severity: "danger",
      title: loc("رصد نمط تسرب", "Leak pattern detected", "Schéma de fuite détecté"),
      detail: {
        ar: `ارتفع SO₂ بمقدار ${so2Delta.toFixed(1)} ppm في دورة واحدة وارتفع الرذاذ الحمضي ${phosphateDelta.toFixed(1)} ملغ/م3، وهذا يتوافق مع تسرب في خط التحويل.`,
        en: `SO₂ rose ${so2Delta.toFixed(1)} ppm in a single cycle and acid mist rose ${phosphateDelta.toFixed(1)} mg/m³ — consistent with a diversion-line leak.`,
        fr: `SO₂ a augmenté de ${so2Delta.toFixed(1)} ppm en un cycle et le brouillard acide de ${phosphateDelta.toFixed(1)} mg/m³ — compatible avec une fuite sur la ligne de dérivation.`,
      },
      source: loc("محرك ربط بيانات العملية", "Process-data correlation engine", "Moteur de corrélation procédé"),
    });
  }

  if (scrubber.status !== "online" || scrubber.efficiency <= 60) {
    alerts.push({
      id: "alert-scrubber-system",
      ts: now - 4 * 60_000,
      type: "system",
      severity: scrubber.status === "offline" ? "danger" : "warning",
      title: loc("تراجع أداء الغاسلة", "Scrubber performance degraded", "Performance laveur dégradée"),
      detail: (() => {
        const status = unitStatusLocalized(scrubber.status);
        return {
          ar: `غاسلة الغاز S-01 في حالة ${status.ar} بكفاءة ${scrubber.efficiency}%. غسل الغاز لم يعد كافيا للسيطرة على السحابة المتوقعة.`,
          en: `Scrubber S-01 is ${status.en.toLowerCase()} at ${scrubber.efficiency}% efficiency. Gas washing is no longer enough to contain the forecast plume.`,
          fr: `Laveur S-01 ${status.fr.toLowerCase()} à ${scrubber.efficiency}% d'efficacité. Le lavage ne suffit plus à contenir le panache prévu.`,
        };
      })(),
      source: loc("تشخيص المنظومة", "System diagnostic", "Diagnostic système"),
    });
  }

  if (dangerZones.length >= 2 || prediction.peakValue >= 84) {
    alerts.push({
      id: "alert-plume-spread",
      ts: now - 6 * 60_000,
      type: "spike",
      severity: "danger",
      title: loc(
        "انتشار تلوث مرتفع نحو المناطق السكنية",
        "High pollution spreading toward residential zones",
        "Pollution élevée vers les zones habitées",
      ),
      detail: {
        ar: `${dangerZones.length} مناطق أصبحت في مستوى خطر، والنموذج يتوقع ذروة ${prediction.peakValue.toFixed(1)} ppm خلال ${prediction.peakInMinutes} دقيقة.`,
        en: `${dangerZones.length} zones now at danger level; model forecasts a peak of ${prediction.peakValue.toFixed(1)} ppm within ${prediction.peakInMinutes} min.`,
        fr: `${dangerZones.length} zones en danger ; le modèle prévoit un pic de ${prediction.peakValue.toFixed(1)} ppm dans ${prediction.peakInMinutes} min.`,
      },
      source: loc("توقع قصير المدى", "Short-term forecast", "Prévision court terme"),
    });
  }

  if (classify(ph) !== "normal" || classify(water) !== "normal") {
    alerts.push({
      id: "alert-water-chemistry",
      ts: now - 8 * 60_000,
      type: "threshold",
      severity: aggregateSeverity([classify(ph), classify(water)]),
      title: loc(
        "اضطراب في كيمياء التصريف",
        "Discharge chemistry disturbance",
        "Perturbation de la chimie du rejet",
      ),
      detail: {
        ar: `حموضة التصريف ${ph.value.toFixed(2)} ومؤشر تلوث البحر ${water.value.toFixed(1)} ppm.`,
        en: `Discharge pH ${ph.value.toFixed(2)} and seawater pollution index ${water.value.toFixed(1)} ppm.`,
        fr: `pH de rejet ${ph.value.toFixed(2)} et indice de pollution marine ${water.value.toFixed(1)} ppm.`,
      },
      source: loc("حوض المعادلة / مجس الشاطئ", "Neutralization basin / shore probe", "Bassin neutralisation / sonde côtière"),
    });
  }

  return alerts.sort((left, right) => right.ts - left.ts);
}

function buildActions(
  scenario: Scenario,
  indicators: Indicator[],
  units: FactoryUnit[],
  regions: Region[],
  prediction: Prediction,
): Action[] {
  const so2 = indicators.find((indicator) => indicator.key === "so2")!;
  const phosphate = indicators.find((indicator) => indicator.key === "phosphate")!;
  const ph = indicators.find((indicator) => indicator.key === "ph")!;
  const water = indicators.find((indicator) => indicator.key === "water")!;
  const scrubber = units.find((unit) => unit.type === "scrubber")!;
  const topRegion = [...regions].sort((left, right) => right.pollution - left.pollution)[0];

  const actions: Action[] = [];

  if (scenario === "leak" || so2.trend.at(-1)! - so2.trend.at(-2)! >= 8) {
    actions.push({
      id: "action-stop-line",
      title: loc(
        "إيقاف الآلة وعزل خط التحويل A3",
        "Stop machine and isolate diversion line A3",
        "Arrêter et isoler la ligne de dérivation A3",
      ),
      reason: {
        ar: `SO₂ بلغ ${so2.value.toFixed(1)} ppm مع ارتفاع مفاجئ واضح. إيقاف هذا الخط يعزل المصدر المحتمل للتسرب داخل المجمع الصناعي.`,
        en: `SO₂ reached ${so2.value.toFixed(1)} ppm with a clear sudden surge. Shutting this line isolates the likely leak source inside the complex.`,
        fr: `SO₂ a atteint ${so2.value.toFixed(1)} ppm avec un pic net. Arrêter cette ligne isole la source probable de fuite dans le complexe.`,
      },
      target: loc("خط التحويل A3 / مضخة P-14", "Diversion line A3 / pump P-14", "Ligne A3 / pompe P-14"),
      priority: "immediate",
      category: "stop",
      etaMinutes: 4,
      impact: loc(
        "يوقف التسرب من المصدر ويمنع تضخم السحابة خلال الدقائق القادمة.",
        "Cuts the leak at its source and prevents plume growth in the next minutes.",
        "Coupe la fuite à la source et empêche la croissance du panache.",
      ),
    });
  } else if (scenario === "scrubber_failure") {
    actions.push({
      id: "action-stop-reactor",
      title: loc(
        "إيقاف الآلة وتعليق خط التفاعل R-02",
        "Stop machine and suspend reactor line R-02",
        "Arrêter et suspendre la ligne réacteur R-02",
      ),
      reason: {
        ar: `غاسلة الغاز S-01 متوقفة وكفاءة الإزالة ${scrubber.efficiency}%. إبقاء R-02 شغالا يحافظ على حمل غازي أعلى من المجال المقبول.`,
        en: `Scrubber S-01 is offline at ${scrubber.efficiency}% efficiency. Keeping R-02 running pushes the gas load above the acceptable range.`,
        fr: `Laveur S-01 hors service à ${scrubber.efficiency}% d'efficacité. Maintenir R-02 maintient une charge gazeuse hors plage acceptable.`,
      },
      target: loc("خط التفاعل R-02", "Reactor line R-02", "Ligne réacteur R-02"),
      priority: "immediate",
      category: "stop",
      etaMinutes: 6,
      impact: loc(
        "يخفض الحمل على المدخنة إلى حين استرجاع أداء الغاسلة.",
        "Reduces stack load until scrubber performance is restored.",
        "Réduit la charge cheminée le temps de restaurer le laveur.",
      ),
    });
  }

  if (scrubber.efficiency <= 75 || classify(so2) === "danger") {
    actions.push({
      id: "action-scrubber",
      title: loc(
        "تشغيل الغاسلة الاحتياطية",
        "Activate the backup scrubber",
        "Activer le laveur de secours",
      ),
      reason: {
        ar: `كفاءة غسل الغاز لا تتجاوز ${scrubber.efficiency}% بينما التوقع يشير إلى ذروة ${prediction.peakValue.toFixed(1)} ppm خلال ${prediction.peakInMinutes} دقيقة.`,
        en: `Gas-washing efficiency only ${scrubber.efficiency}% while the forecast peaks at ${prediction.peakValue.toFixed(1)} ppm within ${prediction.peakInMinutes} min.`,
        fr: `Efficacité de lavage à ${scrubber.efficiency}% alors que le pic prévu est ${prediction.peakValue.toFixed(1)} ppm dans ${prediction.peakInMinutes} min.`,
      },
      target: loc(
        "غاسلة الغاز S-01 / الدارة الاحتياطية",
        "Scrubber S-01 / backup loop",
        "Laveur S-01 / boucle de secours",
      ),
      priority: "immediate",
      category: "scrubber",
      etaMinutes: 8,
      impact: loc(
        "يخفض تركيز SO₂ قبل وصول السحابة إلى المناطق السكنية الساحلية.",
        "Cuts SO₂ before the plume reaches coastal residential zones.",
        "Réduit le SO₂ avant que le panache n'atteigne les zones côtières.",
      ),
    });
  }

  if (classify(water) !== "normal" || classify(ph) !== "normal") {
    actions.push({
      id: "action-carbon",
      title: loc(
        "إضافة فحم نشط إلى حوض المعالجة",
        "Add activated carbon to the treatment basin",
        "Ajouter du charbon actif au bassin",
      ),
      reason: {
        ar: `تلوث المياه بلغ ${water.value.toFixed(1)} ppm وحموضة التصريف ${ph.value.toFixed(2)}. إضافة الفحم مع المعادلة تحد من أثر التصريف البحري أثناء استقرار العملية.`,
        en: `Water pollution at ${water.value.toFixed(1)} ppm and discharge pH ${ph.value.toFixed(2)}. Adding carbon with neutralization limits marine impact while the process stabilizes.`,
        fr: `Pollution eau ${water.value.toFixed(1)} ppm et pH de rejet ${ph.value.toFixed(2)}. L'ajout de charbon limite l'impact marin pendant la stabilisation.`,
      },
      target: loc("حوض المعالجة البحري B-02", "Marine treatment basin B-02", "Bassin marin B-02"),
      priority: classify(water) === "danger" ? "immediate" : "recommended",
      category: "carbon",
      etaMinutes: 12,
      impact: loc(
        "يمتص بقايا الأحماض ويخفض التلوث المتجه إلى القنال البحري.",
        "Absorbs residual acids and lowers pollution heading to the sea canal.",
        "Absorbe les acides résiduels et réduit la pollution vers le canal marin.",
      ),
    });
  }

  actions.push({
    id: "action-adjust",
    title: loc(
      "تعديل التشغيل وخفض تغذية الحمض",
      "Tune operation and lower acid feed",
      "Ajuster l'exploitation et baisser l'alimentation acide",
    ),
    reason: {
      ar: `رذاذ الفوسفات وصل إلى ${phosphate.value.toFixed(1)} ملغ/م3 والمنطقة ${topRegion.name.ar} بلغت ${topRegion.pollution}%. خفض التغذية وإعادة موازنة السحب يساعدان على تهدئة المنحنى خلال 30 دقيقة القادمة.`,
      en: `Phosphate mist hit ${phosphate.value.toFixed(1)} mg/m³ and zone ${topRegion.name.en} reached ${topRegion.pollution}%. Reducing feed and rebalancing draft will calm the curve within 30 min.`,
      fr: `Brouillard de phosphate à ${phosphate.value.toFixed(1)} mg/m³ et zone ${topRegion.name.fr} à ${topRegion.pollution}%. Réduire l'alimentation et rééquilibrer le tirage apaisera la courbe en 30 min.`,
    },
    target: loc("خطوط التفاعل / مراوح السحب", "Reactor lines / draft fans", "Lignes réacteur / ventilateurs"),
    priority: scenario === "normal" ? "recommended" : "immediate",
    category: "adjust",
    etaMinutes: 10,
    impact: loc(
      "يقلل تشكل الرذاذ الثانوي ويمنح وقتا لاسترجاع أداء الغاسلة.",
      "Reduces secondary mist and buys time for scrubber recovery.",
      "Réduit le brouillard secondaire et laisse le temps de restaurer le laveur.",
    ),
  });

  actions.push({
    id: "action-public",
    title: {
      ar: `حماية المنطقة المعرضة في ${topRegion.name.ar}`,
      en: `Protect the exposed area in ${topRegion.name.en}`,
      fr: `Protéger la zone exposée à ${topRegion.name.fr}`,
    },
    reason: {
      ar: `${topRegion.name.ar} هي الأعلى تلوثا بنسبة ${topRegion.pollution}% وتقع مباشرة في اتجاه الرياح بسرعة ${prediction.windSpeed.toFixed(1)} م/ث.`,
      en: `${topRegion.name.en} is the most polluted at ${topRegion.pollution}% and sits directly downwind at ${prediction.windSpeed.toFixed(1)} m/s.`,
      fr: `${topRegion.name.fr} est la plus polluée (${topRegion.pollution}%) et se trouve directement sous le vent (${prediction.windSpeed.toFixed(1)} m/s).`,
    },
    target: {
      ar: `${topRegion.name.ar} / المحيط السكني والساحلي`,
      en: `${topRegion.name.en} / residential & coastal perimeter`,
      fr: `${topRegion.name.fr} / périmètre résidentiel & côtier`,
    },
    priority: topRegion.severity === "danger" ? "immediate" : "recommended",
    category: topRegion.type === "industrial" ? "monitor" : "evacuate",
    etaMinutes: 15,
    impact: loc(
      "يخفض تعرض الأهالي إلى حين دخول إجراءات التحكم والمعادلة حيز التنفيذ.",
      "Reduces resident exposure until control & neutralization measures take effect.",
      "Réduit l'exposition des habitants en attendant l'effet des mesures de contrôle.",
    ),
  });

  return actions;
}

function buildAdvisories(
  indicators: Indicator[],
  regions: Region[],
  prediction: Prediction,
): Advisory[] {
  const so2 = indicators.find((indicator) => indicator.key === "so2")!;
  const water = indicators.find((indicator) => indicator.key === "water")!;
  const schoolRegion = regions.find((region) => region.type === "school")!;
  const coastalRegion = regions.find((region) => region.id === "south-coast")!;
  const urbanRegion = regions.find((region) => region.id === "ghannouch-north")!;
  const dir = compassLocalized(prediction.windDirection);

  return [
    {
      audience: "residents",
      level: urbanRegion.severity,
      message: {
        ar: `على السكان في ${urbanRegion.name.ar} تقليل البقاء في الخارج. السحابة تتحرك نحو ${dir.ar} وستبقى مرتفعة خلال الساعة القادمة.`,
        en: `Residents in ${urbanRegion.name.en} should limit time outdoors. The plume is drifting ${dir.en} and will stay elevated for the next hour.`,
        fr: `Habitants de ${urbanRegion.name.fr} : limitez le temps en extérieur. Le panache dérive vers le ${dir.fr} et restera élevé l'heure prochaine.`,
      },
      actions: [
        loc("إغلاق النوافذ وفتحات السطح", "Close windows and roof vents", "Fermer fenêtres et bouches de toit"),
        loc("تأجيل الأشغال الخارجية قرب الساحل", "Postpone outdoor work near the coast", "Reporter les travaux extérieurs côtiers"),
      ],
    },
    {
      audience: "fishermen",
      level: aggregateSeverity([coastalRegion.severity, classify(water)]),
      message: {
        ar: `على الصيادين قرب ${coastalRegion.name.ar} تجنب المناطق المحاذية للقنال إلى أن تعود كيمياء الحوض إلى المستوى الطبيعي.`,
        en: `Fishermen near ${coastalRegion.name.en} should avoid waters along the canal until basin chemistry returns to normal.`,
        fr: `Pêcheurs près de ${coastalRegion.name.fr} : évitez les eaux longeant le canal jusqu'au retour à la normale.`,
      },
      actions: [
        loc("تأجيل الخروج من مصب القنال", "Postpone departures from the canal mouth", "Reporter les sorties depuis l'embouchure"),
        loc("تجنب جمع الصدفيات قرب سحابة التصريف", "Avoid shellfish near the discharge plume", "Éviter la récolte de coquillages près du panache"),
      ],
    },
    {
      audience: "schools",
      level: schoolRegion.severity,
      message: {
        ar: `على المدارس في الحزام الشرقي إبقاء التلاميذ داخل الأقسام ما دام SO₂ عند ${so2.value.toFixed(1)} ppm والخطر في اتجاه الرياح مرتفعا.`,
        en: `Schools in the eastern belt should keep pupils indoors while SO₂ stays at ${so2.value.toFixed(1)} ppm and downwind risk is high.`,
        fr: `Les écoles de la ceinture est doivent garder les élèves à l'intérieur tant que SO₂ reste à ${so2.value.toFixed(1)} ppm.`,
      },
      actions: [
        loc("إيقاف الأنشطة الرياضية الخارجية", "Stop outdoor sports activities", "Arrêter les activités sportives extérieures"),
        loc("تشغيل التهوية على سحب مرشح", "Run ventilation on filtered intake", "Activer la ventilation sur prise filtrée"),
      ],
    },
    {
      audience: "hospitals",
      level: so2.value >= 70 ? "danger" : so2.value >= 55 ? "warning" : "normal",
      message: loc(
        "على المستشفيات الاستعداد لاستقبال حالات تنفسية إضافية إذا ارتفعت الأعراض في الممر الساحلي.",
        "Hospitals should prepare for additional respiratory cases if symptoms rise along the coastal corridor.",
        "Les hôpitaux doivent se préparer à des cas respiratoires supplémentaires en cas de symptômes côtiers.",
      ),
      actions: [
        loc(
          "تجهيز مخزون الأكسجين وأجهزة الرذاذ",
          "Prepare oxygen stock and nebulizers",
          "Préparer stock d'oxygène et nébuliseurs",
        ),
        loc(
          "التنسيق مع الحماية المدنية حول شكاوى التعرض",
          "Coordinate with civil protection on exposure complaints",
          "Coordonner avec la protection civile sur les plaintes",
        ),
      ],
    },
  ];
}

function buildLoss(scenario: Scenario, step: number): LossInfo {
  const base = scenarioProfiles[scenario].loss;
  return {
    acidLossKg: round(base.acidLossKg + wave(27, step) * base.acidLossKg * 0.06, 0),
    acidLossRatePerHour: round(base.acidLossRatePerHour + wave(28, step) * 18, 0),
    estimatedCostUsd: round(base.estimatedCostUsd + wave(29, step) * base.estimatedCostUsd * 0.08, 0),
    fishImpactTons: round(base.fishImpactTons + wave(30, step) * 0.5, 1),
    agriImpactHa: round(base.agriImpactHa + wave(31, step) * 0.7, 1),
  };
}

const COMPASS_LOCALIZED: LocalizedString[] = [
  loc("الشمال", "north", "nord"),
  loc("الشمال الشرقي", "northeast", "nord-est"),
  loc("الشرق", "east", "est"),
  loc("الجنوب الشرقي", "southeast", "sud-est"),
  loc("الجنوب", "south", "sud"),
  loc("الجنوب الغربي", "southwest", "sud-ouest"),
  loc("الغرب", "west", "ouest"),
  loc("الشمال الغربي", "northwest", "nord-ouest"),
];

export function compassLocalized(degrees: number): LocalizedString {
  const idx = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
  return COMPASS_LOCALIZED[idx];
}

/** Backwards-compat helper: returns the right field for the given locale. */
export function compassFromDegrees(degrees: number, locale: Locale = "ar"): string {
  return compassLocalized(degrees)[locale];
}

/** Re-export so other files can keep importing the helper. */
export { unitStatusLocalized };

// Used by `same()` to keep tree-shake friendly silence.
void same;

export function getPrimaryRegionId(state: Pick<SystemState, "regions">): string {
  return [...state.regions].sort((left, right) => right.pollution - left.pollution)[0]?.id ?? "industrial-core";
}

export function buildSystemState(
  scenario: Scenario,
  step: number,
  startedAt = Date.now() - step * 4_000,
): SystemState {
  const indicators = buildIndicators(scenario, step);
  const regions = buildRegions(scenario, step, indicators);
  const units = buildUnits(scenario, step);
  const prediction = buildPrediction(scenario, step, indicators, regions, units);
  const alerts = buildAlerts(scenario, indicators, prediction, units, regions);
  const actions = buildActions(scenario, indicators, units, regions, prediction);
  const advisories = buildAdvisories(indicators, regions, prediction);
  const severity = aggregateSeverity([
    ...indicators.map((indicator) => classify(indicator)),
    ...regions.map((region) => region.severity),
    ...alerts.map((alert) => alert.severity),
  ]);

  return {
    scenario,
    lastUpdated: Date.now(),
    indicators,
    regions,
    alerts,
    actions,
    prediction,
    units,
    loss: buildLoss(scenario, step),
    advisories,
    globalSeverity: severity,
    uptimeSec: Math.max(0, Math.floor((Date.now() - startedAt) / 1_000)),
  };
}
