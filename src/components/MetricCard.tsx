import { motion } from "framer-motion";
import { dashboardTheme, severityTone } from "../theme/dashboardTheme";
import type { Indicator } from "../types";
import { classify } from "../utils/classify";
import { StatusBadge } from "./StatusBadge";

interface MetricCardProps {
  indicator: Indicator;
}

const compactLabel: Record<Indicator["key"], string> = {
  so2: "SO₂",
  phosphate: "فوسفات",
  ph: "pH",
  water: "البحر",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildPoints(values: number[], min: number, max: number): string {
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / Math.max(max - min, 1)) * 100;
      return `${x},${clamp(y, 6, 94)}`;
    })
    .join(" ");
}

export function MetricCard({ indicator }: MetricCardProps) {
  const severity = classify(indicator);
  const tone = severityTone(severity);
  const previous = indicator.trend.at(-2) ?? indicator.value;
  const normalized =
    ((indicator.value - indicator.min) /
      Math.max(indicator.max - indicator.min, 1)) *
    100;
  const load = indicator.invert ? 100 - normalized : normalized;
  const deltaPercent =
    previous === 0 ? 0 : ((indicator.value - previous) / previous) * 100;
  const warningMark =
    ((indicator.warningAt - indicator.min) /
      Math.max(indicator.max - indicator.min, 1)) *
    100;
  const dangerMark =
    ((indicator.dangerAt - indicator.min) /
      Math.max(indicator.max - indicator.min, 1)) *
    100;
  const label = compactLabel[indicator.key];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`panel overflow-hidden p-3 ${tone.glowClass ?? ""}`}
    >
      <motion.div
        className={`absolute inset-x-[8%] top-0 h-px ${tone.accent}`}
        animate={{ opacity: [0.3, 0.9, 0.3], scaleX: [0.9, 1, 0.9] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="panel-title truncate">{label}</p>
        </div>
        <StatusBadge severity={severity} compact />
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <div className="flex min-w-0 items-end gap-1.5">
          <span className="number text-[clamp(1.9rem,2vw,2.2rem)] font-semibold leading-none text-ink-primary">
            {indicator.value.toFixed(indicator.key === "ph" ? 2 : 1)}
          </span>
          <span className="text-[clamp(0.82rem,0.95vw,0.95rem)] text-ink-secondary">
            {indicator.unit}
          </span>
        </div>

        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-[0.68rem] font-semibold ${
            deltaPercent >= 0
              ? "border-status-danger/25 bg-status-danger/10 text-status-danger"
              : "border-brand/25 bg-brand/10 text-brand"
          }`}
        >
          <span className="number">
            {deltaPercent >= 0 ? "+" : ""}
            {deltaPercent.toFixed(1)}%
          </span>
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between text-[0.72rem] text-ink-secondary">
        <span>
          حمل <span className="number text-ink-primary">{Math.round(load)}%</span>
        </span>
        <span className="number">
          {indicator.min.toFixed(indicator.key === "ph" ? 1 : 0)} -{" "}
          {indicator.max.toFixed(indicator.key === "ph" ? 1 : 0)}
        </span>
      </div>

      <div className="data-sweep mt-2 rounded-[1rem] border border-white/8 bg-black/10 px-2.5 py-2">
        <div className="mb-2 flex items-center justify-between text-[0.72rem] text-ink-muted">
          <span>المسار</span>
          <span className="number text-ink-primary">{Math.round(load)}%</span>
        </div>

        <svg viewBox="0 0 100 42" className="h-12 w-full">
          <defs>
            <linearGradient id={`metric-fill-${indicator.key}`} x1="0" x2="1">
              <stop
                offset="0%"
                stopColor={dashboardTheme.palette.brand}
                stopOpacity="0.18"
              />
                <stop
                  offset="100%"
                  stopColor={
                    severity === "danger"
                    ? dashboardTheme.palette.severity.danger
                    : severity === "warning"
                    ? dashboardTheme.palette.severity.warning
                    : dashboardTheme.palette.brand
                  }
                  stopOpacity="0.1"
                />
            </linearGradient>
          </defs>
          <polyline
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={buildPoints(indicator.trend, indicator.min, indicator.max)}
          />
          <motion.polyline
            fill="none"
            stroke={`url(#metric-fill-${indicator.key})`}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={buildPoints(indicator.trend, indicator.min, indicator.max)}
            initial={{ pathLength: 0.15, opacity: 0.2 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
          <motion.polyline
            fill="none"
            stroke={
              severity === "danger"
                ? dashboardTheme.palette.severity.danger
                : severity === "warning"
                ? dashboardTheme.palette.severity.warning
                : dashboardTheme.palette.brand
            }
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={buildPoints(indicator.trend, indicator.min, indicator.max)}
            initial={{ pathLength: 0.15, opacity: 0.3 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.75, delay: 0.05, ease: "easeOut" }}
          />
        </svg>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className={`h-full rounded-full ${tone.bar}`}
          initial={{ width: "0%" }}
          animate={{ width: `${clamp(normalized, 0, 100)}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>

      <div className="relative mt-1 h-3">
        <span
          className="absolute top-0 h-3 w-px bg-status-warning/80"
          style={{ left: `${clamp(warningMark, 0, 100)}%` }}
        />
        <span
          className="absolute top-0 h-3 w-px bg-status-danger/90"
          style={{ left: `${clamp(dangerMark, 0, 100)}%` }}
        />
      </div>
    </motion.article>
  );
}
