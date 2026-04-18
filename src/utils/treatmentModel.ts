import type {
  Region,
  SystemState,
  TreatmentModelInput,
  TreatmentModelOutput,
} from "../types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function severityFactor(severity: SystemState["globalSeverity"]): number {
  if (severity === "danger") return 1;
  if (severity === "warning") return 0.55;
  return 0.15;
}

export function buildTreatmentInput(
  state: SystemState,
  selectedRegion: Region,
): TreatmentModelInput {
  const so2 = state.indicators.find((indicator) => indicator.key === "so2")!;
  const phosphate = state.indicators.find(
    (indicator) => indicator.key === "phosphate",
  )!;
  const ph = state.indicators.find((indicator) => indicator.key === "ph")!;
  const water = state.indicators.find((indicator) => indicator.key === "water")!;
  const scrubber = state.units.find((unit) => unit.type === "scrubber")!;
  const severity = severityFactor(state.globalSeverity);

  const sampleAcidity = clamp(
    5.4 - (ph.value - 4.5) * 0.72 - severity * 0.55,
    2.5,
    5.5,
  );

  return {
    P2O5_percent: round(
      clamp(0.8 + phosphate.value * 0.041 + selectedRegion.pollution * 0.011, 0.5, 5),
    ),
    CaO_percent: round(
      clamp(28.6 + scrubber.efficiency * 0.03 - so2.value * 0.012, 28, 33),
    ),
    SO3_percent: round(
      clamp(40.2 + so2.value * 0.058 + phosphate.value * 0.018, 40, 46),
    ),
    F_percent: round(
      clamp(0.24 + phosphate.value * 0.018 + so2.value * 0.0035, 0.2, 2),
    ),
    SiO2_percent: round(
      clamp(0.9 + water.value * 0.023 + selectedRegion.pollution * 0.014, 0.5, 5),
    ),
    Fe2O3_percent: round(
      clamp(0.08 + selectedRegion.pollution * 0.0024 + severity * 0.08, 0.05, 0.8),
    ),
    Al2O3_percent: round(
      clamp(0.07 + phosphate.value * 0.002 + severity * 0.05, 0.05, 0.5),
    ),
    MgO_percent: round(clamp(0.03 + water.value * 0.0018, 0.01, 0.3)),
    Na2O_percent: round(
      clamp(0.05 + state.prediction.windSpeed * 0.015 + water.value * 0.0016, 0.05, 0.4),
    ),
    K2O_percent: round(
      clamp(0.015 + state.prediction.spreadKm * 0.0068, 0.01, 0.2),
    ),
    Cd_ppm: round(
      clamp(1.2 + phosphate.value * 0.11 + selectedRegion.pollution * 0.05, 0.5, 15),
    ),
    Pb_ppm: round(
      clamp(2.5 + water.value * 0.17 + selectedRegion.pollution * 0.075, 1, 25),
    ),
    Zn_ppm: round(clamp(18 + phosphate.value * 1.15 + so2.value * 0.48, 10, 200)),
    As_ppm: round(clamp(0.8 + water.value * 0.11 + so2.value * 0.038, 0.5, 20)),
    Ra226_Bq_per_kg: round(
      clamp(
        140 + selectedRegion.pollution * 5.2 + state.loss.acidLossKg * 0.085,
        100,
        1000,
      ),
    ),
    moisture_percent: round(
      clamp(10.6 + water.value * 0.11 + state.prediction.spreadKm * 0.28, 10, 25),
    ),
    pH_initial: round(sampleAcidity),
    temperature_C: round(
      clamp(18 + state.prediction.windSpeed * 0.75 + so2.value * 0.052, 15, 45),
    ),
  };
}

export function fallbackTreatmentPrediction(
  input: TreatmentModelInput,
): TreatmentModelOutput {
  const acidityFactor = (5.5 - input.pH_initial) / 3.0;
  const impurityLoad =
    input.SiO2_percent +
    input.Fe2O3_percent +
    input.Al2O3_percent +
    (input.Cd_ppm + input.Pb_ppm + input.As_ppm) / 50.0;

  const limeMilk = clamp(
    15 +
      8 * input.P2O5_percent +
      12 * input.F_percent +
      25 * acidityFactor +
      0.3 * input.SiO2_percent +
      0.05 * (input.temperature_C - 25),
    5,
    120,
  );

  const washingTime = clamp(
    20 +
      4 * impurityLoad +
      0.5 * input.moisture_percent +
      3 * input.F_percent +
      2 * input.P2O5_percent -
      0.1 * input.temperature_C,
    10,
    120,
  );

  const recovery = clamp(
    60 +
      5 * input.P2O5_percent -
      2 * input.F_percent -
      0.002 * input.Ra226_Bq_per_kg +
      0.1 * washingTime +
      0.05 * limeMilk +
      0.2 * (input.temperature_C - 20),
    40,
    98,
  );

  const cost = clamp(
    5 +
      limeMilk * 0.15 +
      washingTime * 0.08 +
      0.02 * (input.Cd_ppm + input.Pb_ppm + input.As_ppm) +
      0.005 * input.Ra226_Bq_per_kg,
    5,
    60,
  );

  const finalPh = clamp(6.5 + (limeMilk - 30) * 0.03, 5.5, 9.0);

  return {
    lime_milk_kg_per_ton: round(limeMilk, 2),
    washing_time_min: round(washingTime, 1),
    P2O5_recovery_percent: round(recovery, 2),
    treatment_cost_USD_per_ton: round(cost, 2),
    final_pH: round(finalPh, 2),
  };
}

export function buildTreatmentNote(
  output: TreatmentModelOutput,
  source: "api" | "fallback",
): string {
  const sourceLabel = source === "api" ? "النموذج المباشر" : "الاحتياطي المحلي";
  return `${sourceLabel}: اضبط حليب الجير على ${output.lime_milk_kg_per_ton.toFixed(
    1,
  )} كغ/طن وشغّل الغسل ${output.washing_time_min.toFixed(
    1,
  )} دقيقة للوصول إلى pH نهائي ${output.final_pH.toFixed(
    2,
  )} مع استرجاع P₂O₅ متوقع ${output.P2O5_recovery_percent.toFixed(1)}%.`;
}
