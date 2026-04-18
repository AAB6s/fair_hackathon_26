import { useEffect, useState } from "react";
import type { Region, SystemState, TreatmentRecommendation } from "../types";
import {
  buildTreatmentInput,
  buildTreatmentNote,
  fallbackTreatmentPrediction,
} from "../utils/treatmentModel";

const MODEL_API_BASE =
  (
    (import.meta as ImportMeta & {
      env?: Record<string, string | undefined>;
    }).env?.VITE_MODEL_API_URL
  )?.replace(/\/$/, "") ?? "/api/phosphogypsum";

interface ApiMetric {
  algorithm: string;
  r2: number;
  mae: number;
  rmse: number;
}

interface ApiResponse {
  input: TreatmentRecommendation["input"];
  output: TreatmentRecommendation["output"];
  metrics: Record<string, ApiMetric>;
}

export function useTreatmentRecommendation(
  state: SystemState,
  selectedRegion: Region,
) {
  const [recommendation, setRecommendation] = useState<TreatmentRecommendation>(() => {
    const input = buildTreatmentInput(state, selectedRegion);
    const output = fallbackTreatmentPrediction(input);
    return {
      input,
      output,
      source: "fallback",
      loading: true,
      lastUpdated: Date.now(),
      note: buildTreatmentNote(output, "fallback"),
    };
  });

  useEffect(() => {
    const input = buildTreatmentInput(state, selectedRegion);
    const fallbackOutput = fallbackTreatmentPrediction(input);
    const fallbackState: TreatmentRecommendation = {
      input,
      output: fallbackOutput,
      source: "fallback",
      loading: false,
      lastUpdated: Date.now(),
      note: buildTreatmentNote(fallbackOutput, "fallback"),
      error: "تعذر الوصول إلى خدمة النموذج.",
    };

    const controller = new AbortController();

    setRecommendation((current) => ({
      ...current,
      input,
      loading: true,
      error: undefined,
    }));

    fetch(`${MODEL_API_BASE}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Model API returned ${response.status}`);
        }
        return (await response.json()) as ApiResponse;
      })
      .then((payload) => {
        setRecommendation({
          input: payload.input,
          output: payload.output,
          source: "api",
          loading: false,
          lastUpdated: Date.now(),
          note: buildTreatmentNote(payload.output, "api"),
          metrics: payload.metrics,
        });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        setRecommendation({
          ...fallbackState,
          error: error.message,
        });
      });

    return () => controller.abort();
  }, [state, selectedRegion]);

  return recommendation;
}
