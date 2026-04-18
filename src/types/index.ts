export type Severity = "normal" | "warning" | "danger";

export type Scenario = "normal" | "leak" | "high_pollution" | "scrubber_failure";

export interface Indicator {
  key: "so2" | "phosphate" | "ph" | "water";
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  warningAt: number;
  dangerAt: number;
  /** Lower-better thresholds (e.g. pH below 6.5 is bad) */
  invert?: boolean;
  trend: number[]; // recent samples for sparkline
  description: string;
}

export interface Region {
  id: string;
  name: string;
  population: number;
  /** SVG polygon points (viewBox 0 0 600 480) */
  path: string;
  /** Approximate centroid for labels */
  centroid: [number, number];
  /** Distance from factory in km */
  distanceKm: number;
  /** Pollution intensity 0-100 */
  pollution: number;
  severity: Severity;
  type: "industrial" | "urban" | "coastal" | "agricultural" | "school";
}

export interface Alert {
  id: string;
  ts: number;
  type: "threshold" | "leak" | "spike" | "system";
  severity: Severity;
  title: string;
  detail: string;
  source: string;
}

export interface Action {
  id: string;
  title: string;
  reason: string;
  target: string;
  priority: "immediate" | "recommended";
  category: "stop" | "scrubber" | "carbon" | "adjust" | "evacuate" | "monitor";
  etaMinutes: number;
  impact: string;
}

export interface PredictionPoint {
  t: number; // minutes offset from now (negative = past)
  value: number;
  band?: [number, number]; // confidence band
}

export interface Prediction {
  metric: string;
  unit: string;
  history: PredictionPoint[];
  forecast: PredictionPoint[];
  confidence: number; // 0..1
  rationale: string;
  peakInMinutes: number;
  peakValue: number;
  windDirection: number; // degrees, 0 = north
  windSpeed: number; // m/s
  spreadKm: number;
}

export interface FactoryUnit {
  id: string;
  name: string;
  status: "online" | "degraded" | "offline" | "stopped";
  load: number; // 0-100
  efficiency: number; // 0-100
  type: "reactor" | "scrubber" | "filter" | "pump" | "storage";
}

export interface LossInfo {
  acidLossKg: number;
  acidLossRatePerHour: number;
  estimatedCostUsd: number;
  fishImpactTons: number;
  agriImpactHa: number;
}

export interface Advisory {
  audience: "residents" | "fishermen" | "schools" | "hospitals";
  level: Severity;
  message: string;
  actions: string[];
}

export interface TreatmentModelInput {
  P2O5_percent: number;
  CaO_percent: number;
  SO3_percent: number;
  F_percent: number;
  SiO2_percent: number;
  Fe2O3_percent: number;
  Al2O3_percent: number;
  MgO_percent: number;
  Na2O_percent: number;
  K2O_percent: number;
  Cd_ppm: number;
  Pb_ppm: number;
  Zn_ppm: number;
  As_ppm: number;
  Ra226_Bq_per_kg: number;
  moisture_percent: number;
  pH_initial: number;
  temperature_C: number;
}

export interface TreatmentModelOutput {
  lime_milk_kg_per_ton: number;
  washing_time_min: number;
  P2O5_recovery_percent: number;
  treatment_cost_USD_per_ton: number;
  final_pH: number;
}

export interface TreatmentMetric {
  algorithm: string;
  r2: number;
  mae: number;
  rmse: number;
}

export interface TreatmentRecommendation {
  input: TreatmentModelInput;
  output: TreatmentModelOutput;
  source: "api" | "fallback";
  loading: boolean;
  lastUpdated: number;
  note: string;
  metrics?: Partial<Record<keyof TreatmentModelOutput, TreatmentMetric>>;
  error?: string;
}

export interface SystemState {
  scenario: Scenario;
  lastUpdated: number;
  indicators: Indicator[];
  regions: Region[];
  alerts: Alert[];
  actions: Action[];
  prediction: Prediction;
  units: FactoryUnit[];
  loss: LossInfo;
  advisories: Advisory[];
  globalSeverity: Severity;
  uptimeSec: number;
}
