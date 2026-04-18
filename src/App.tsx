import { AnimatePresence, motion } from "framer-motion";
import { startTransition, useEffect } from "react";
import { ActionCenter } from "./components/ActionCenter";
import { GabesMap } from "./components/GabesMap";
import { MetricCard } from "./components/MetricCard";
import { PredictionPanel } from "./components/PredictionPanel";
import { StatusBadge } from "./components/StatusBadge";
import {
  compassFromDegrees,
  scenarioDescriptors,
  scenarioOrder,
} from "./data/scenarios";
import { useDashboardStore } from "./store/useDashboardStore";
import { dashboardTheme } from "./theme/dashboardTheme";
import type { FactoryUnit } from "./types";
import { classify } from "./utils/classify";

const unitTypeLabel: Record<FactoryUnit["type"], string> = {
  reactor: "تفاعل",
  scrubber: "غاسلة",
  filter: "ترشيح",
  pump: "ضخ",
  storage: "خزن",
};

const unitStatusLabel: Record<FactoryUnit["status"], string> = {
  online: "شغال",
  degraded: "متراجع",
  offline: "متوقف",
  stopped: "متوقف",
};

const advisoryAudienceLabel = {
  residents: "السكان",
  fishermen: "الصيادون",
  schools: "المدارس",
  hospitals: "المستشفيات",
} as const;

function formatClock(timestamp: number): string {
  return new Intl.DateTimeFormat("ar-TN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

function formatAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 5) return "الآن";
  if (seconds < 60) return `${seconds} ث`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} د`;
}

function unitTone(unit: FactoryUnit): string {
  if (
    unit.status === "offline" ||
    unit.status === "stopped" ||
    unit.efficiency < 55
  ) {
    return "border-status-danger/25 bg-status-danger/10";
  }
  if (unit.status === "degraded" || unit.efficiency < 75) {
    return "border-status-warning/25 bg-status-warning/10";
  }
  return "border-white/8 bg-white/[0.04]";
}

function unitBarTone(unit: FactoryUnit): string {
  if (
    unit.status === "offline" ||
    unit.status === "stopped" ||
    unit.efficiency < 55
  ) {
    return "bg-status-danger";
  }
  if (unit.status === "degraded" || unit.efficiency < 75) {
    return "bg-status-warning";
  }
  return "bg-status-normal";
}

function alertTone(severity: "normal" | "warning" | "danger"): string {
  if (severity === "danger") return "border-status-danger/25 bg-status-danger/10";
  if (severity === "warning") {
    return "border-status-warning/25 bg-status-warning/10";
  }
  return "border-status-normal/25 bg-status-normal/10";
}

export default function App() {
  const state = useDashboardStore((store) => store.state);
  const selectedRegionId = useDashboardStore((store) => store.selectedRegionId);
  const tick = useDashboardStore((store) => store.tick);
  const setScenario = useDashboardStore((store) => store.setScenario);
  const selectRegion = useDashboardStore((store) => store.selectRegion);

  useEffect(() => {
    const interval = window.setInterval(() => {
      tick();
    }, 3500);

    return () => window.clearInterval(interval);
  }, [tick]);

  const selectedRegion =
    state.regions.find((region) => region.id === selectedRegionId) ??
    state.regions[0];
  const immediateActions = state.actions.filter(
    (action) => action.priority === "immediate",
  );
  const warningIndicators = state.indicators.filter(
    (indicator) => classify(indicator) === "warning",
  ).length;
  const dangerIndicators = state.indicators.filter(
    (indicator) => classify(indicator) === "danger",
  ).length;
  const dangerZones = state.regions.filter(
    (region) => region.severity === "danger",
  ).length;
  const affectedPopulation = state.regions
    .filter((region) => region.severity !== "normal")
    .reduce((sum, region) => sum + region.population, 0);
  const activeAlerts = state.alerts.slice(0, 3);
  const scenarioMeta = scenarioDescriptors[state.scenario];
  const summaryCards = [
    { label: "خطر", value: `${dangerIndicators}` },
    { label: "تحذير", value: `${warningIndicators}` },
    { label: "مناطق", value: `${dangerZones}` },
    { label: "فوري", value: `${immediateActions.length}` },
  ];

  return (
    <div
      dir="rtl"
      className="min-h-screen text-ink-primary"
      style={dashboardTheme.cssVars}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute left-[-8%] top-[-12%] h-[28rem] w-[28rem] rounded-full blur-[120px]"
          style={{
            background: `rgba(${dashboardTheme.palette.brandRgb}, 0.1)`,
          }}
        />
        <div
          className="absolute bottom-[-16%] right-[-6%] h-[24rem] w-[24rem] rounded-full blur-[120px]"
          style={{
            background: `rgba(${dashboardTheme.palette.severity.warningRgb}, 0.1)`,
          }}
        />
      </div>

      <main className={dashboardTheme.layout.shell}>
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dashboardTheme.motion.panelEnter }}
          className="panel overflow-hidden p-[1%]"
        >
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(120deg, rgba(${dashboardTheme.palette.brandRgb}, 0.05), transparent 42%, rgba(${dashboardTheme.palette.severity.warningRgb}, 0.05))`,
            }}
          />
          <motion.div
            className="absolute bottom-0 left-[8%] h-px w-[24%] bg-[linear-gradient(90deg,transparent,var(--accent-line),transparent)]"
            animate={{ x: ["0%", "210%", "0%"], opacity: [0.35, 0.9, 0.35] }}
            transition={{
              duration: dashboardTheme.motion.mapSweep,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ ["--accent-line" as string]: dashboardTheme.palette.brandLine }}
          />

          <div
            className={`relative grid gap-3 ${dashboardTheme.layout.headerGrid} xl:items-center`}
          >
            <div className="xl:justify-self-start">
              <p className="panel-title">منصة قابس البيئية</p>
              <h1 className="mt-2 font-display text-[clamp(1.75rem,2.5vw,2.2rem)] leading-tight text-ink-primary">
                شاشة القرار المباشر
              </h1>

              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge
                  severity={state.globalSeverity}
                  pulse={state.globalSeverity === "danger"}
                />
                <span className="chip border border-brand/20 bg-brand/10 text-brand">
                  {scenarioMeta.label}
                </span>
                <span className="chip border border-white/10 bg-white/[0.04] text-ink-secondary">
                  {scenarioMeta.strapline}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="chip border border-white/10 bg-white/[0.04] text-ink-secondary">
                  آخر تحديث
                  <span className="number text-ink-primary">
                    {formatClock(state.lastUpdated)}
                  </span>
                </span>
                <span className="chip border border-white/10 bg-white/[0.04] text-ink-secondary">
                  رياح
                  <span className="number text-ink-primary">
                    {state.prediction.windSpeed.toFixed(1)} م/ث
                  </span>
                  <span>{compassFromDegrees(state.prediction.windDirection)}</span>
                </span>
                <span className="chip border border-white/10 bg-white/[0.04] text-ink-secondary">
                  سكان
                  <span className="number text-ink-primary">
                    {affectedPopulation.toLocaleString("en-US")}
                  </span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:justify-self-center xl:w-full">
              {summaryCards.map((card, index) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + index * 0.04, duration: 0.35 }}
                  className="rounded-[1rem] border border-white/8 bg-white/[0.04] px-3 py-2.5"
                >
                  <p className="panel-title mb-1">{card.label}</p>
                  <p className="number text-[clamp(1.5rem,2vw,1.9rem)] leading-none text-ink-primary">
                    {card.value}
                  </p>
                </motion.div>
              ))}
            </div>

            <div className="xl:justify-self-end xl:text-right">
              <div className="flex flex-wrap gap-2 xl:justify-end">
                {scenarioOrder.map((scenario) => {
                  const active = scenario === state.scenario;
                  const item = scenarioDescriptors[scenario];

                  return (
                    <motion.button
                      key={scenario}
                      type="button"
                      onClick={() => {
                        startTransition(() => {
                          setScenario(scenario);
                        });
                      }}
                      animate={{
                        scale: active ? 1.02 : 1,
                        y: active ? -2 : 0,
                      }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      whileTap={{ scale: 0.98 }}
                      className={`rounded-full border px-3 py-2 text-[0.92rem] transition ${
                        active
                          ? dashboardTheme.classes.scenarioActive
                          : dashboardTheme.classes.scenarioIdle
                      }`}
                    >
                      <span className="font-display">{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.header>

        <section
          className={`grid items-start gap-[1.1%] ${dashboardTheme.layout.primaryGrid}`}
        >
          <section className="panel overflow-hidden">
            <div className="panel-header">
              <div>
                <p className="panel-title">الرصد</p>
                <h2 className="mt-1 font-display text-lg text-ink-primary">
                  المؤشرات
                </h2>
              </div>
              <span className="chip border border-white/10 bg-white/[0.04] text-ink-secondary">
                {formatAgo(state.lastUpdated)}
              </span>
            </div>

            <div className={`grid ${dashboardTheme.layout.indicatorGrid}`}>
              {state.indicators.map((indicator) => (
                <MetricCard key={indicator.key} indicator={indicator} />
              ))}
            </div>
          </section>

          <GabesMap
            regions={state.regions}
            indicators={state.indicators}
            actions={state.actions}
            prediction={state.prediction}
            selectedRegionId={selectedRegion.id}
            onSelect={(regionId) => {
              startTransition(() => {
                selectRegion(regionId);
              });
            }}
          />

          <div className="grid content-start gap-[1.1%]">
            <ActionCenter
              actions={state.actions}
              globalSeverity={state.globalSeverity}
              prediction={state.prediction}
            />

            <section className="panel overflow-hidden">
              <div className="panel-header">
                <div>
                  <p className="panel-title">الإنذارات</p>
                  <h2 className="mt-1 font-display text-lg text-ink-primary">
                    النشط الآن
                  </h2>
                </div>
                <span className="chip border border-white/10 bg-white/[0.04] text-ink-secondary">
                  {state.alerts.length}
                </span>
              </div>

              <div className="space-y-2 p-3">
                <AnimatePresence initial={false}>
                  {activeAlerts.map((alert) => (
                    <motion.article
                      key={alert.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className={`rounded-[1.1rem] border p-3 ${alertTone(alert.severity)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display text-sm text-ink-primary">
                            {alert.title}
                          </p>
                          <p className="mt-1 overflow-hidden text-xs leading-5 text-ink-secondary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                            {alert.detail}
                          </p>
                        </div>
                        <StatusBadge severity={alert.severity} compact />
                      </div>
                    </motion.article>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          </div>
        </section>

        <section
          className={`grid items-start gap-[1.1%] ${dashboardTheme.layout.secondaryGrid}`}
        >
          <PredictionPanel prediction={state.prediction} />

          <section className="panel overflow-hidden">
            <div className="panel-header">
              <div>
                <p className="panel-title">المصنع</p>
                <h2 className="mt-1 font-display text-lg text-ink-primary">
                  الوحدات والخسائر
                </h2>
              </div>
              <span className="chip border border-white/10 bg-white/[0.04] text-ink-secondary">
                {scenarioMeta.label}
              </span>
            </div>

            <div className="space-y-3 p-3">
              <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
                <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.04] p-3">
                  <p className="panel-title mb-1">حمض</p>
                  <p className="number text-[1.7rem] leading-none text-ink-primary">
                    {state.loss.acidLossKg.toLocaleString("en-US")} كغ
                  </p>
                </div>
                <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.04] p-3">
                  <p className="panel-title mb-1">كلفة</p>
                  <p className="number text-[1.7rem] leading-none text-ink-primary">
                    ${state.loss.estimatedCostUsd.toLocaleString("en-US")}
                  </p>
                </div>
                <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.04] p-3">
                  <p className="panel-title mb-1">صيد</p>
                  <p className="number text-[1.7rem] leading-none text-ink-primary">
                    {state.loss.fishImpactTons.toFixed(1)} طن
                  </p>
                </div>
                <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.04] p-3">
                  <p className="panel-title mb-1">فلاحة</p>
                  <p className="number text-[1.7rem] leading-none text-ink-primary">
                    {state.loss.agriImpactHa.toFixed(1)} هك
                  </p>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {state.units.map((unit) => (
                  <article
                    key={unit.id}
                    className={`rounded-[1.1rem] border p-3 ${unitTone(unit)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-sm text-ink-primary">
                          {unit.name}
                        </p>
                        <p className="mt-1 text-[0.72rem] text-ink-muted">
                          {unitTypeLabel[unit.type]}
                        </p>
                      </div>
                      <span
                        className={`chip border ${
                          unit.status === "offline" || unit.status === "stopped"
                            ? "border-status-danger/30 bg-status-danger/12 text-status-danger"
                            : unit.status === "degraded"
                            ? "border-status-warning/30 bg-status-warning/12 text-status-warning"
                            : "border-status-normal/30 bg-status-normal/12 text-status-normal"
                        }`}
                      >
                        {unitStatusLabel[unit.status]}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[0.76rem] text-ink-secondary">
                      <span>
                        حمل <span className="number text-ink-primary">{unit.load}%</span>
                      </span>
                      <span>
                        كفاءة{" "}
                        <span className="number text-ink-primary">
                          {unit.efficiency}%
                        </span>
                      </span>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className={`h-full rounded-full ${unitBarTone(unit)}`}
                        style={{ width: `${unit.efficiency}%` }}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="panel-header">
              <div>
                <p className="panel-title">الإرشاد العام</p>
                <h2 className="mt-1 font-display text-lg text-ink-primary">
                  الفئات
                </h2>
              </div>
              <span className="chip border border-white/10 bg-white/[0.04] text-ink-secondary">
                {selectedRegion.name}
              </span>
            </div>

            <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-1">
              {state.advisories.map((advisory) => (
                <article
                  key={advisory.audience}
                  className="rounded-[1.1rem] border border-white/8 bg-white/[0.04] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-sm text-ink-primary">
                      {advisoryAudienceLabel[advisory.audience]}
                    </p>
                    <StatusBadge severity={advisory.level} compact />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {advisory.actions.slice(0, 2).map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-white/8 bg-black/10 px-3 py-1.5 text-[0.76rem] text-ink-primary"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
