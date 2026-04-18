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
  label: string;
  strapline: string;
  summary: string;
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
    label: "غاز SO₂",
    unit: "ppm",
    min: 0,
    max: 120,
    warningAt: 55,
    dangerAt: 72,
    description: "قياس مستمر للغازات عند مدخنة معالجة الفوسفات.",
  },
  phosphate: {
    key: "phosphate",
    label: "رذاذ الحمض والفوسفات",
    unit: "ملغ/م3",
    min: 0,
    max: 100,
    warningAt: 48,
    dangerAt: 68,
    description: "رذاذ حمضي وجزيئات فوسفات قرب مسار العادم.",
  },
  ph: {
    key: "ph",
    label: "حموضة التصريف",
    unit: "pH",
    min: 4.5,
    max: 8.5,
    warningAt: 6.5,
    dangerAt: 5.8,
    invert: true,
    description: "درجة الحموضة في حوض المعادلة قبل التصريف إلى البحر.",
  },
  water: {
    key: "water",
    label: "تلوث مياه البحر",
    unit: "ppm",
    min: 0,
    max: 100,
    warningAt: 40,
    dangerAt: 60,
    description: "مؤشر مركب يجمع المواد الصلبة والحموضة والعكارة.",
  },
};

const regionBlueprints: Array<
  Omit<Region, "pollution" | "severity">
> = [
  {
    id: "industrial-core",
    name: "المجمع الصناعي",
    population: 7400,
    path: "M118 168 L266 154 L302 224 L248 310 L126 286 L92 220 Z",
    centroid: [198, 228],
    distanceKm: 0.8,
    type: "industrial",
  },
  {
    id: "ghannouch-north",
    name: "غنوش الشمالية",
    population: 18400,
    path: "M266 154 L410 144 L448 216 L302 224 Z",
    centroid: [360, 184],
    distanceKm: 4.2,
    type: "urban",
  },
  {
    id: "school-belt",
    name: "الحزام المدرسي",
    population: 9600,
    path: "M410 144 L554 140 L566 220 L448 216 Z",
    centroid: [492, 182],
    distanceKm: 7.1,
    type: "school",
  },
  {
    id: "agri-basin",
    name: "الحوض الفلاحي",
    population: 12600,
    path: "M126 286 L248 310 L246 404 L120 422 L82 340 Z",
    centroid: [176, 356],
    distanceKm: 3.8,
    type: "agricultural",
  },
  {
    id: "gabes-central",
    name: "وسط قابس",
    population: 26300,
    path: "M248 310 L392 296 L402 394 L246 404 Z",
    centroid: [324, 352],
    distanceKm: 5.6,
    type: "urban",
  },
  {
    id: "canal-mouth",
    name: "مصب القنال",
    population: 11800,
    path: "M302 224 L448 216 L392 296 L248 310 Z",
    centroid: [344, 256],
    distanceKm: 4.8,
    type: "coastal",
  },
  {
    id: "south-coast",
    name: "الساحل الجنوبي",
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
    name: "خط التفاعل R-02",
    status: "online",
    load: 78,
    efficiency: 87,
    type: "reactor",
  },
  {
    id: "reactor-r03",
    name: "خط التفاعل R-03",
    status: "online",
    load: 72,
    efficiency: 83,
    type: "reactor",
  },
  {
    id: "scrubber-s01",
    name: "غاسلة الغاز S-01",
    status: "online",
    load: 76,
    efficiency: 91,
    type: "scrubber",
  },
  {
    id: "filter-f09",
    name: "المرشح الجاف F-09",
    status: "online",
    load: 68,
    efficiency: 88,
    type: "filter",
  },
  {
    id: "pump-p14",
    name: "مضخة التصريف P-14",
    status: "online",
    load: 64,
    efficiency: 90,
    type: "pump",
  },
  {
    id: "tank-a1",
    name: "خزان الحمض A1",
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
    label: "عادي",
    strapline: "تشغيل مستقر",
    summary: "كل وحدات التحكم شغالة، والتلوث البحري مازال داخل المجال المتوقع.",
  },
  leak: {
    label: "تسرب",
    strapline: "خلل في خط التحويل",
    summary: "ارتفاع مفاجئ في SO₂ والرذاذ الحمضي حول خط التحويل مع تأثير مباشر على المنطقة القريبة.",
  },
  high_pollution: {
    label: "تلوث مرتفع",
    strapline: "سحابة تلوث مستمرة",
    summary: "الانبعاثات المرتفعة مع الرياح نحو الداخل تدفع التلوث إلى المناطق السكنية.",
  },
  scrubber_failure: {
    label: "تعطل الغاسلة",
    strapline: "ضعف غسل الغاز",
    summary: "كفاءة الغاسلة تنهار والمدخنة تبدأ في إطلاق سحابة أشد من المعتاد.",
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

function unitStatusLabel(status: FactoryUnit["status"]): string {
  if (status === "offline") return "متوقفة";
  if (status === "degraded") return "متراجعة";
  if (status === "stopped") return "موقوفة";
  return "شغالة";
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
    return {
      t: -60 + index * 10,
      value,
    };
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
  const topZones =
    impactedZones.length > 0 ? impactedZones.join("، ") : "محيط المصنع";

  return {
    metric: "سحابة SO₂ باتجاه الرياح",
    unit: "ppm",
    history,
    forecast,
    confidence: scenario === "normal" ? 0.91 : scenario === "high_pollution" ? 0.82 : 0.76,
    rationale: `رياح بسرعة ${round(profile.windSpeed, 1)} م/ث نحو ${compassFromDegrees(profile.windDirection)} تدفع السحابة إلى ${topZones}. كفاءة الغاسلة ${scrubber.efficiency}%، لذلك تبقى الدقائق 30 إلى 60 القادمة مرتبطة باستقرار الغسل والتحكم في الخط.`,
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
      title: "تجاوز حد SO₂",
      detail: `تم تسجيل ${so2.value.toFixed(1)} ppm عند المدخنة الرئيسية، فوق هامش التحذير ${so2.warningAt} ppm.`,
      source: "منظومة القياس المستمر / القناة الشمالية",
    });
  }

  if (scenario === "leak" || so2Delta >= 8 || phosphateDelta >= 7) {
    alerts.push({
      id: "alert-leak-detected",
      ts: now - 70_000,
      type: "leak",
      severity: "danger",
      title: "رصد نمط تسرب",
      detail: `ارتفع SO₂ بمقدار ${so2Delta.toFixed(1)} ppm في دورة واحدة وارتفع الرذاذ الحمضي ${phosphateDelta.toFixed(1)} ملغ/م3، وهذا يتوافق مع تسرب في خط التحويل.`,
      source: "محرك ربط بيانات العملية",
    });
  }

  if (scrubber.status !== "online" || scrubber.efficiency <= 60) {
    alerts.push({
      id: "alert-scrubber-system",
      ts: now - 4 * 60_000,
      type: "system",
      severity: scrubber.status === "offline" ? "danger" : "warning",
      title: "تراجع أداء الغاسلة",
      detail: `غاسلة الغاز S-01 في حالة ${unitStatusLabel(scrubber.status)} بكفاءة ${scrubber.efficiency}%. غسل الغاز لم يعد كافيا للسيطرة على السحابة المتوقعة.`,
      source: "تشخيص المنظومة",
    });
  }

  if (dangerZones.length >= 2 || prediction.peakValue >= 84) {
    alerts.push({
      id: "alert-plume-spread",
      ts: now - 6 * 60_000,
      type: "spike",
      severity: "danger",
      title: "انتشار تلوث مرتفع نحو المناطق السكنية",
      detail: `${dangerZones.length} مناطق أصبحت في مستوى خطر، والنموذج يتوقع ذروة ${prediction.peakValue.toFixed(1)} ppm خلال ${prediction.peakInMinutes} دقيقة.`,
      source: "توقع قصير المدى",
    });
  }

  if (classify(ph) !== "normal" || classify(water) !== "normal") {
    alerts.push({
      id: "alert-water-chemistry",
      ts: now - 8 * 60_000,
      type: "threshold",
      severity: aggregateSeverity([classify(ph), classify(water)]),
      title: "اضطراب في كيمياء التصريف",
      detail: `حموضة التصريف ${ph.value.toFixed(2)} ومؤشر تلوث البحر ${water.value.toFixed(1)} ppm.`,
      source: "حوض المعادلة / مجس الشاطئ",
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
      title: "إيقاف الآلة وعزل خط التحويل A3",
      reason: `SO₂ بلغ ${so2.value.toFixed(1)} ppm مع ارتفاع مفاجئ واضح. إيقاف هذا الخط يعزل المصدر المحتمل للتسرب داخل المجمع الصناعي.`,
      target: "خط التحويل A3 / مضخة P-14",
      priority: "immediate",
      category: "stop",
      etaMinutes: 4,
      impact: "يوقف التسرب من المصدر ويمنع تضخم السحابة خلال الدقائق القادمة.",
    });
  } else if (scenario === "scrubber_failure") {
    actions.push({
      id: "action-stop-reactor",
      title: "إيقاف الآلة وتعليق خط التفاعل R-02",
      reason: `غاسلة الغاز S-01 متوقفة وكفاءة الإزالة ${scrubber.efficiency}%. إبقاء R-02 شغالا يحافظ على حمل غازي أعلى من المجال المقبول.`,
      target: "خط التفاعل R-02",
      priority: "immediate",
      category: "stop",
      etaMinutes: 6,
      impact: "يخفض الحمل على المدخنة إلى حين استرجاع أداء الغاسلة.",
    });
  }

  if (scrubber.efficiency <= 75 || classify(so2) === "danger") {
    actions.push({
      id: "action-scrubber",
      title: "تشغيل الغاسلة الاحتياطية",
      reason: `كفاءة غسل الغاز لا تتجاوز ${scrubber.efficiency}% بينما التوقع يشير إلى ذروة ${prediction.peakValue.toFixed(1)} ppm خلال ${prediction.peakInMinutes} دقيقة.`,
      target: "غاسلة الغاز S-01 / الدارة الاحتياطية",
      priority: "immediate",
      category: "scrubber",
      etaMinutes: 8,
      impact: "يخفض تركيز SO₂ قبل وصول السحابة إلى المناطق السكنية الساحلية.",
    });
  }

  if (classify(water) !== "normal" || classify(ph) !== "normal") {
    actions.push({
      id: "action-carbon",
      title: "إضافة فحم نشط إلى حوض المعالجة",
      reason: `تلوث المياه بلغ ${water.value.toFixed(1)} ppm وحموضة التصريف ${ph.value.toFixed(2)}. إضافة الفحم مع المعادلة تحد من أثر التصريف البحري أثناء استقرار العملية.`,
      target: "حوض المعالجة البحري B-02",
      priority: classify(water) === "danger" ? "immediate" : "recommended",
      category: "carbon",
      etaMinutes: 12,
      impact: "يمتص بقايا الأحماض ويخفض التلوث المتجه إلى القنال البحري.",
    });
  }

  actions.push({
    id: "action-adjust",
    title: "تعديل التشغيل وخفض تغذية الحمض",
    reason: `رذاذ الفوسفات وصل إلى ${phosphate.value.toFixed(1)} ملغ/م3 والمنطقة ${topRegion.name} بلغت ${topRegion.pollution}%. خفض التغذية وإعادة موازنة السحب يساعدان على تهدئة المنحنى خلال 30 دقيقة القادمة.`,
    target: "خطوط التفاعل / مراوح السحب",
    priority: scenario === "normal" ? "recommended" : "immediate",
    category: "adjust",
    etaMinutes: 10,
    impact: "يقلل تشكل الرذاذ الثانوي ويمنح وقتا لاسترجاع أداء الغاسلة.",
  });

  actions.push({
    id: "action-public",
    title: `حماية المنطقة المعرضة في ${topRegion.name}`,
    reason: `${topRegion.name} هي الأعلى تلوثا بنسبة ${topRegion.pollution}% وتقع مباشرة في اتجاه الرياح بسرعة ${prediction.windSpeed.toFixed(1)} م/ث.`,
    target: `${topRegion.name} / المحيط السكني والساحلي`,
    priority: topRegion.severity === "danger" ? "immediate" : "recommended",
    category: topRegion.type === "industrial" ? "monitor" : "evacuate",
    etaMinutes: 15,
    impact: "يخفض تعرض الأهالي إلى حين دخول إجراءات التحكم والمعادلة حيز التنفيذ.",
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

  return [
    {
      audience: "residents",
      level: urbanRegion.severity,
      message: `على السكان في ${urbanRegion.name} تقليل البقاء في الخارج. السحابة تتحرك نحو ${compassFromDegrees(prediction.windDirection)} وستبقى مرتفعة خلال الساعة القادمة.`,
      actions: ["إغلاق النوافذ وفتحات السطح", "تأجيل الأشغال الخارجية قرب الساحل"],
    },
    {
      audience: "fishermen",
      level: aggregateSeverity([coastalRegion.severity, classify(water)]),
      message: `على الصيادين قرب ${coastalRegion.name} تجنب المناطق المحاذية للقنال إلى أن تعود كيمياء الحوض إلى المستوى الطبيعي.`,
      actions: ["تأجيل الخروج من مصب القنال", "تجنب جمع الصدفيات قرب سحابة التصريف"],
    },
    {
      audience: "schools",
      level: schoolRegion.severity,
      message: `على المدارس في الحزام الشرقي إبقاء التلاميذ داخل الأقسام ما دام SO₂ عند ${so2.value.toFixed(1)} ppm والخطر في اتجاه الرياح مرتفعا.`,
      actions: ["إيقاف الأنشطة الرياضية الخارجية", "تشغيل التهوية على سحب مرشح"],
    },
    {
      audience: "hospitals",
      level: so2.value >= 70 ? "danger" : so2.value >= 55 ? "warning" : "normal",
      message: "على المستشفيات الاستعداد لاستقبال حالات تنفسية إضافية إذا ارتفعت الأعراض في الممر الساحلي.",
      actions: ["تجهيز مخزون الأكسجين وأجهزة الرذاذ", "التنسيق مع الحماية المدنية حول شكاوى التعرض"],
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

export function compassFromDegrees(degrees: number): string {
  const directions = [
    "الشمال",
    "الشمال الشرقي",
    "الشرق",
    "الجنوب الشرقي",
    "الجنوب",
    "الجنوب الغربي",
    "الغرب",
    "الشمال الغربي",
  ];
  return directions[Math.round(degrees / 45) % directions.length];
}

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
