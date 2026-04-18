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
