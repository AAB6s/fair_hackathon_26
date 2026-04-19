import { motion } from "framer-motion";
import { useLocale } from "../i18n/LocaleContext";
import { dashboardTheme } from "../theme/dashboardTheme";
import type { TreatmentRecommendation } from "../types";

interface TreatmentOptimizerPanelProps {
  recommendation: TreatmentRecommendation;
  regionName: string;
}

function averageR2(recommendation: TreatmentRecommendation): string | null {
  if (!recommendation.metrics) return null;
  const values = Object.values(recommendation.metrics).map((metric) => metric.r2);
  if (values.length === 0) return null;
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2);
}

export function TreatmentOptimizerPanel({
  recommendation,
  regionName,
}: TreatmentOptimizerPanelProps) {
  const { t } = useLocale();
  const apiLive = recommendation.source === "api";
  const meanR2 = averageR2(recommendation);
  const metricCards = [
    {
      key: "lime_milk_kg_per_ton",
      label: t("treatment.metrics.lime"),
      unit: t("treatment.units.kgPerTon"),
    },
    {
      key: "washing_time_min",
      label: t("treatment.metrics.washTime"),
      unit: t("time.minutes"),
    },
    {
      key: "P2O5_recovery_percent",
      label: t("treatment.metrics.recovery"),
      unit: "%",
    },
    {
      key: "final_pH",
      label: t("treatment.metrics.finalPh"),
      unit: "",
    },
    {
      key: "treatment_cost_USD_per_ton",
      label: t("treatment.metrics.cost"),
      unit: t("treatment.units.usdPerTon"),
    },
  ] as const;

  return (
    <section className="data-sweep rounded-[1.2rem] border border-white/8 bg-white/[0.04] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="panel-title">{t("treatment.title")}</p>
          <h3 className="mt-1 font-display text-base text-ink-primary">
            {t("treatment.subtitle")}
          </h3>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <span
            className={`chip border ${
              apiLive
                ? "border-status-normal/30 bg-status-normal/12 text-status-normal"
                : "border-status-warning/30 bg-status-warning/12 text-status-warning"
            }`}
          >
            {apiLive ? t("treatment.api") : t("treatment.fallback")}
          </span>
          {meanR2 ? (
            <span className="chip border border-brand/20 bg-brand/10 text-brand">
              R² {meanR2}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3 2xl:grid-cols-5">
        {metricCards.map((card, index) => {
          const value = recommendation.output[card.key];

          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 + index * 0.03, duration: 0.28 }}
              className={`${dashboardTheme.classes.insetCard} p-3`}
            >
              <p className="panel-title mb-1">{card.label}</p>
              <div className="flex items-end gap-1.5">
                <p className="number text-[1.65rem] leading-none text-ink-primary">
                  {value.toFixed(card.key === "final_pH" ? 2 : card.key === "washing_time_min" ? 1 : 1)}
                </p>
                {card.unit ? (
                  <span className="text-[0.74rem] text-ink-secondary">{card.unit}</span>
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-3 text-sm leading-6 text-ink-secondary">
        {recommendation.note}
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-[0.76rem] text-ink-secondary">
        <span className="chip border border-white/10 bg-black/10">
          {t("treatment.inputs.region")}
          <span className="font-display text-ink-primary">{regionName}</span>
        </span>
        <span className="chip border border-white/10 bg-black/10">
          {t("treatment.inputs.initialPh")}
          <span className="number text-ink-primary">
            {recommendation.input.pH_initial.toFixed(2)}
          </span>
        </span>
        <span className="chip border border-white/10 bg-black/10">
          {t("treatment.inputs.fluoride")}
          <span className="number text-ink-primary">
            {recommendation.input.F_percent.toFixed(2)}%
          </span>
        </span>
        <span className="chip border border-white/10 bg-black/10">
          Ra-226
          <span className="number text-ink-primary">
            {recommendation.input.Ra226_Bq_per_kg.toFixed(0)}
          </span>
        </span>
      </div>

      {recommendation.error && !apiLive ? (
        <p className="mt-2 text-[0.72rem] text-status-warning">
          {t("treatment.fallbackNote")}
        </p>
      ) : null}
    </section>
  );
}
