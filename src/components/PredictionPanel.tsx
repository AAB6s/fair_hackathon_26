import { motion } from "framer-motion";
import { useLocale } from "../i18n/LocaleContext";
import { dashboardTheme } from "../theme/dashboardTheme";
import type { Prediction } from "../types";

interface PredictionPanelProps {
  prediction: Prediction;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function pointsToPath(points: Array<{ x: number; y: number }>): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

export function PredictionPanel({ prediction }: PredictionPanelProps) {
  const { t, tr } = useLocale();
  const merged = [...prediction.history, ...prediction.forecast.slice(1)];
  const values = merged.flatMap((point) => [
    point.value,
    point.band?.[0] ?? point.value,
    point.band?.[1] ?? point.value,
  ]);
  const min = Math.min(...values) - 4;
  const max = Math.max(...values) + 4;

  const project = (value: number, t: number) => {
    const x = ((t + 60) / 120) * 100;
    const y = 100 - ((value - min) / Math.max(max - min, 1)) * 100;
    return { x, y: clamp(y, 4, 96) };
  };

  const historyPoints = prediction.history.map((point) =>
    project(point.value, point.t),
  );
  const forecastPoints = prediction.forecast.map((point) =>
    project(point.value, point.t),
  );
  const upperBand = prediction.forecast.map((point) =>
    project(point.band?.[1] ?? point.value, point.t),
  );
  const lowerBand = [...prediction.forecast]
    .reverse()
    .map((point) => project(point.band?.[0] ?? point.value, point.t));
  const bandPath = `${pointsToPath(upperBand)} ${lowerBand
    .map((point) => `L ${point.x} ${point.y}`)
    .join(" ")} Z`;

  const value30 =
    prediction.forecast.find((point) => point.t === 30)?.value ??
    prediction.peakValue;
  const value60 = prediction.forecast.at(-1)?.value ?? prediction.peakValue;
  const peakPoint = forecastPoints.reduce((maxPoint, point, index) => {
    if (prediction.forecast[index].value > (prediction.forecast[maxPoint.index]?.value ?? -Infinity)) {
      return { point, index };
    }
    return maxPoint;
  }, { point: forecastPoints[0], index: 0 });

  return (
    <section className="panel overflow-hidden">
      <div className="panel-header">
        <div>
          <p className="panel-title">{t("panels.forecast")}</p>
          <h2 className="mt-1 font-display text-lg text-ink-primary">
            {tr(prediction.metric)}
          </h2>
        </div>
        <span className="chip border border-brand/25 bg-brand/10 text-brand">
          {Math.round(prediction.confidence * 100)}%
        </span>
      </div>

      <div className="space-y-3 p-3">
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04, duration: 0.3 }}
            className="data-sweep rounded-2xl border border-white/8 bg-white/[0.04] p-3"
          >
            <p className="panel-title mb-1">30 {t("time.minutes")}</p>
            <p className="number text-2xl text-ink-primary">
              {value30.toFixed(0)}%
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.3 }}
            className="data-sweep rounded-2xl border border-white/8 bg-white/[0.04] p-3"
          >
            <p className="panel-title mb-1">60 {t("time.minutes")}</p>
            <p className="number text-2xl text-ink-primary">
              {value60.toFixed(0)}%
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.3 }}
            className="data-sweep rounded-2xl border border-white/8 bg-white/[0.04] p-3"
          >
            <p className="panel-title mb-1">{t("prediction.peakIn")}</p>
            <p className="number text-2xl text-ink-primary">
              {prediction.peakValue.toFixed(0)}%
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.3 }}
            className="data-sweep rounded-2xl border border-white/8 bg-white/[0.04] p-3"
          >
            <p className="panel-title mb-1">{t("prediction.spread")}</p>
            <p className="number text-2xl text-ink-primary">
              {prediction.spreadKm.toFixed(1)} {t("map.distanceUnit")}
            </p>
          </motion.div>
        </div>

        <div className="rounded-[1rem] border border-white/8 bg-white/[0.035] px-3 py-2.5 text-sm leading-6 text-ink-secondary">
          <span className="panel-title me-2">{t("prediction.rationale")}</span>
          {tr(prediction.rationale)}
        </div>

        <div className="data-sweep rounded-[1.4rem] border border-white/8 bg-[linear-gradient(180deg,rgba(6,12,26,0.88),rgba(12,18,32,0.82))] p-3">
          <svg viewBox="0 0 100 100" className="h-40 w-full">
            <defs>
              <linearGradient id="forecast-band" x1="0" x2="1">
                <stop
                  offset="0%"
                  stopColor={dashboardTheme.palette.brand}
                  stopOpacity="0.05"
                />
                <stop
                  offset="100%"
                  stopColor={dashboardTheme.palette.severity.danger}
                  stopOpacity="0.14"
                />
              </linearGradient>
              <linearGradient id="forecast-line" x1="0" x2="1">
                <stop offset="0%" stopColor={dashboardTheme.palette.brand} />
                <stop
                  offset="100%"
                  stopColor={dashboardTheme.palette.severity.danger}
                />
              </linearGradient>
            </defs>

            {[20, 40, 60, 80].map((y) => (
              <line
                key={y}
                x1="0"
                x2="100"
                y1={y}
                y2={y}
                stroke="rgba(148,163,184,0.12)"
                strokeWidth="0.4"
              />
            ))}
            {[0, 25, 50, 75, 100].map((x) => (
              <line
                key={x}
                x1={x}
                x2={x}
                y1="0"
                y2="100"
                stroke="rgba(148,163,184,0.08)"
                strokeWidth="0.35"
              />
            ))}

            <motion.path
              d={bandPath}
              fill="url(#forecast-band)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45 }}
            />

            <motion.path
              d={pointsToPath(historyPoints)}
              fill="none"
              stroke={`rgba(${dashboardTheme.palette.brandRgb}, 0.58)`}
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0.1, opacity: 0.15 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.75, ease: "easeOut" }}
            />
            <motion.path
              d={pointsToPath(forecastPoints)}
              fill="none"
              stroke="url(#forecast-line)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0.1, opacity: 0.2 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.08, ease: "easeOut" }}
            />

            <line
              x1="50"
              x2="50"
              y1="0"
              y2="100"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />

            {forecastPoints.map((point, index) => (
              <motion.circle
                key={`${point.x}-${point.y}`}
                cx={point.x}
                cy={point.y}
                r={index === 0 ? 2 : 1.1}
                fill={
                  index === 0
                    ? dashboardTheme.palette.severity.danger
                    : dashboardTheme.palette.brand
                }
                initial={{ scale: 0.75, opacity: 0.4 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.02 }}
              />
            ))}

            <motion.circle
              cx={peakPoint.point.x}
              cy={peakPoint.point.y}
              r="3"
              fill="none"
              stroke={dashboardTheme.palette.severity.danger}
              strokeWidth="0.9"
              animate={{ scale: [0.9, 1.45, 0.9], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: `${peakPoint.point.x}px ${peakPoint.point.y}px` }}
            />

            <text x="2" y="95" className="fill-white/45 font-display text-[5px]">
              {t("time.now")}
            </text>
            <text x="90" y="95" className="fill-white/45 font-display text-[5px]">
              +60
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}
