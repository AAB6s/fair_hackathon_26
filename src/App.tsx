import { AnimatePresence, motion } from "framer-motion";
import { startTransition, useEffect, useState } from "react";
import { AccessibilityHub } from "./components/AccessibilityHub";
import { ActionCenter } from "./components/ActionCenter";
import { GabesMap } from "./components/GabesMap";
import { MetricCard } from "./components/MetricCard";
import { PredictionPanel } from "./components/PredictionPanel";
import { StatusBadge } from "./components/StatusBadge";
import { TreatmentOptimizerPanel } from "./components/TreatmentOptimizerPanel";
import {
  compassLocalized,
  scenarioDescriptors,
  scenarioOrder,
} from "./data/scenarios";
import { useTreatmentRecommendation } from "./hooks/useTreatmentRecommendation";
import { useLocale } from "./i18n/LocaleContext";
import type { Locale } from "./i18n/types";
import { useDashboardStore } from "./store/useDashboardStore";
import { dashboardTheme } from "./theme/dashboardTheme";
import type { FactoryUnit } from "./types";
import { classify } from "./utils/classify";

const LANGUAGE_OPTIONS: { code: Locale; label: string }[] = [
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
];

function ArabicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="#C62828" />
      <circle cx="12" cy="12" r="6.1" fill="none" stroke="#FFF7E7" strokeWidth="1.6" />
      <path
        d="M8.3 14.9c1.2-3 3.2-4.6 5.8-4.6 1.2 0 2.1.3 2.9.8-.6 1.4-1.6 2.5-2.9 3.3-1 .6-2.3.9-3.8.9Z"
        fill="#FFF7E7"
      />
    </svg>
  );
}

function EnglishIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="#0D47A1" />
      <path d="M12 4v16M4 12h16" stroke="#FFF7E7" strokeWidth="2" />
      <path d="m6.2 6.2 11.6 11.6M17.8 6.2 6.2 17.8" stroke="#FFF7E7" strokeWidth="1.6" />
      <path d="M12 4v16M4 12h16" stroke="#D32F2F" strokeWidth="1" />
    </svg>
  );
}

function FrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="#F5F7FA" />
      <path d="M3 12a9 9 0 0 1 9-9v18a9 9 0 0 1-9-9Z" fill="#1E3A8A" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="#C62828" />
    </svg>
  );
}

function AutoCycleIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M7 7h9l-2.2-2.2M17 17H8l2.2 2.2"
        stroke={active ? "currentColor" : "currentColor"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 7a6 6 0 0 1 1 8.6M8 17a6 6 0 0 1-1-8.6"
        stroke={active ? "currentColor" : "currentColor"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {active ? <circle cx="18.5" cy="6.5" r="2" fill="currentColor" /> : null}
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4Z" />
      <path d="M15.5 9a4 4 0 0 1 0 6" />
      <path d="M18.5 6a8 8 0 0 1 0 12" />
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4Z" />
      <path d="M15.5 9a4 4 0 0 1 0 6" />
      <path d="M22 9 16 15" />
      <path d="M16 9 22 15" />
    </svg>
  );
}

function LocaleIcon({ code }: { code: Locale }) {
  if (code === "ar") return <ArabicIcon />;
  if (code === "fr") return <FrenchIcon />;
  return <EnglishIcon />;
}

function unitTone(unit: FactoryUnit): string {
  if (unit.status === "offline" || unit.status === "stopped" || unit.efficiency < 55) {
    return "border-status-danger/25 bg-status-danger/10";
  }
  if (unit.status === "degraded" || unit.efficiency < 75) {
    return "border-status-warning/25 bg-status-warning/10";
  }
  return "border-white/8 bg-white/[0.04]";
}

function unitBarTone(unit: FactoryUnit): string {
  if (unit.status === "offline" || unit.status === "stopped" || unit.efficiency < 55) {
    return "bg-status-danger";
  }
  if (unit.status === "degraded" || unit.efficiency < 75) {
    return "bg-status-warning";
  }
  return "bg-status-normal";
}

function alertTone(severity: "normal" | "warning" | "danger"): string {
  if (severity === "danger") return "border-status-danger/25 bg-status-danger/10";
  if (severity === "warning") return "border-status-warning/25 bg-status-warning/10";
  return "border-status-normal/25 bg-status-normal/10";
}

export default function App() {
  const { locale, setLocale, autoCycle, setAutoCycle, t, tr, dir, bcp47 } = useLocale();
  const state = useDashboardStore((store) => store.state);
  const selectedRegionId = useDashboardStore((store) => store.selectedRegionId);
  const tick = useDashboardStore((store) => store.tick);
  const setScenario = useDashboardStore((store) => store.setScenario);
  const selectRegion = useDashboardStore((store) => store.selectRegion);

  const [isMuted, setIsMuted] = useState(false);
  const [speechSupported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);

  useEffect(() => {
    const interval = window.setInterval(() => {
      tick();
    }, 3500);
    return () => window.clearInterval(interval);
  }, [tick]);

  const toggleMute = () => {
    setIsMuted(prev => {
      const newMuted = !prev;
      if (newMuted && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return newMuted;
    });
  };

  const selectedRegion =
    state.regions.find((region) => region.id === selectedRegionId) ?? state.regions[0];
  const immediateActions = state.actions.filter((action) => action.priority === "immediate");
  const warningIndicators = state.indicators.filter((ind) => classify(ind) === "warning").length;
  const dangerIndicators = state.indicators.filter((ind) => classify(ind) === "danger").length;
  const dangerZones = state.regions.filter((region) => region.severity === "danger").length;
  const affectedPopulation = state.regions
    .filter((region) => region.severity !== "normal")
    .reduce((sum, region) => sum + region.population, 0);
  const activeAlerts = state.alerts.slice(0, 3);
  const scenarioMeta = scenarioDescriptors[state.scenario];
  const treatmentRecommendation = useTreatmentRecommendation(state, selectedRegion);
  const summaryCards = [
    { label: t("header.summary.danger"), value: `${dangerIndicators}` },
    { label: t("header.summary.warning"), value: `${warningIndicators}` },
    { label: t("header.summary.zones"), value: `${dangerZones}` },
    { label: t("header.summary.immediate"), value: `${immediateActions.length}` },
  ];

  const numberLocale = bcp47;
  const fmtTime = new Intl.DateTimeFormat(numberLocale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const formatClock = (timestamp: number) => fmtTime.format(timestamp);
  const formatAgo = (timestamp: number): string => {
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 5) return t("time.now");
    if (seconds < 60) return `${seconds} ${t("time.seconds")}`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes} ${t("time.minutes")}`;
  };

  return (
    <div
      dir={dir}
      lang={locale}
      className="min-h-screen text-ink-primary"
      style={dashboardTheme.cssVars}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute left-[-8%] top-[-12%] h-[28rem] w-[28rem] rounded-full blur-[120px]"
          style={{ background: `rgba(${dashboardTheme.palette.brandRgb}, 0.1)` }}
        />
        <div
          className="absolute bottom-[-16%] right-[-6%] h-[24rem] w-[24rem] rounded-full blur-[120px]"
          style={{ background: `rgba(${dashboardTheme.palette.severity.warningRgb}, 0.1)` }}
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
            className={`absolute bottom-0 ${dir === "rtl" ? "right-[8%]" : "left-[8%]"} h-px w-[24%] bg-[linear-gradient(90deg,transparent,var(--accent-line),transparent)]`}
            animate={{ x: ["0%", "210%", "0%"], opacity: [0.35, 0.9, 0.35] }}
            transition={{
              duration: dashboardTheme.motion.mapSweep,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ ["--accent-line" as string]: dashboardTheme.palette.brandLine }}
          />

          <div className={`relative grid gap-3 ${dashboardTheme.layout.headerGrid} xl:items-center`}>
            <div className="xl:justify-self-start">
              <p className="panel-title">{t("app.platform")}</p>
              <h1 className="mt-2 font-display text-[clamp(1.75rem,2.5vw,2.2rem)] leading-tight text-ink-primary">
                {t("app.title")}
              </h1>

              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge severity={state.globalSeverity} pulse={state.globalSeverity === "danger"} />
                <span className="chip border border-brand/20 bg-brand/10 text-brand">
                  {tr(scenarioMeta.label)}
                </span>
                <span className="chip border border-white/10 bg-white/[0.04] text-ink-secondary">
                  {tr(scenarioMeta.strapline)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="chip border border-white/10 bg-white/[0.04] text-ink-secondary">
                  {t("header.lastUpdated")}
                  <span className="number text-ink-primary">{formatClock(state.lastUpdated)}</span>
                </span>
                <span className="chip border border-white/10 bg-white/[0.04] text-ink-secondary">
                  {t("header.wind")}
                  <span className="number text-ink-primary">{state.prediction.windSpeed.toFixed(1)} m/s</span>
                  <span>{tr(compassLocalized(state.prediction.windDirection))}</span>
                </span>
                <span className="chip border border-white/10 bg-white/[0.04] text-ink-secondary">
                  {t("header.affected")}
                  <span className="number text-ink-primary">
                    {affectedPopulation.toLocaleString(numberLocale)}
                  </span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:justify-self-center xl:w-full">
              {summaryCards.map((card, index) => (
                <motion.div
                  key={card.label + index}
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

            <div className="space-y-2 xl:justify-self-end xl:text-right">
              <div className="inline-flex items-center gap-1 xl:float-right">
                <div
                  role="radiogroup"
                  aria-label={t("header.language")}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1"
                >
                  {LANGUAGE_OPTIONS.map((opt) => {
                    const active = opt.code === locale;
                    return (
                      <button
                        key={opt.code}
                        role="radio"
                        aria-checked={active}
                        onClick={() => setLocale(opt.code)}
                        aria-label={opt.label}
                        title={opt.label}
                        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                          active
                            ? "border-brand/45 bg-brand/18 text-ink-primary shadow-glow ring-1 ring-brand/20"
                            : "border-white/10 bg-white/[0.02] text-ink-secondary hover:border-brand/20 hover:text-ink-primary"
                        }`}
                      >
                        <LocaleIcon code={opt.code} />
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setAutoCycle(!autoCycle)}
                    aria-pressed={autoCycle}
                    aria-label={t("header.autoCycle")}
                    title={t("header.autoCycle")}
                    className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                      autoCycle
                        ? "border-status-warning/40 bg-status-warning/14 text-status-warning ring-1 ring-status-warning/25"
                        : "border-white/10 bg-white/[0.02] text-ink-secondary hover:border-status-warning/25 hover:text-ink-primary"
                    }`}
                  >
                    <AutoCycleIcon active={autoCycle} />
                  </button>
                </div>

                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? "Unmute audio" : "Mute audio"}
                    title={isMuted ? "Unmute audio" : "Mute audio"}
                    className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                      isMuted
                        ? "border-status-danger/40 bg-status-danger/14 text-status-danger ring-1 ring-status-danger/25"
                        : "border-brand/30 bg-brand/12 text-brand hover:bg-brand/20"
                    }`}
                  >
                    {isMuted ? <MutedIcon /> : <SpeakerIcon />}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 xl:justify-end xl:clear-both">
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
                      animate={{ scale: active ? 1.02 : 1, y: active ? -2 : 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      whileTap={{ scale: 0.98 }}
                      className={`rounded-full border px-3 py-2 text-[0.92rem] transition ${
                        active ? dashboardTheme.classes.scenarioActive : dashboardTheme.classes.scenarioIdle
                      }`}
                    >
                      <span className="font-display">{tr(item.label)}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dashboardTheme.motion.panelEnter, delay: 0.05 }}
        >
          <AccessibilityHub state={state} isMuted={isMuted} />
        </motion.div>

        <section className={`grid items-start gap-[1.1%] ${dashboardTheme.layout.primaryGrid}`}>
          <section className="panel overflow-hidden">
            <div className="panel-header">
              <div>
                <p className="panel-title">{t("panels.monitoring")}</p>
                <h2 className="mt-1 font-display text-lg text-ink-primary">
                  {t("panels.indicators")}
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
                  <p className="panel-title">{t("panels.alerts")}</p>
                  <h2 className="mt-1 font-display text-lg text-ink-primary">
                    {t("panels.alertsActive")}
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
                            {tr(alert.title)}
                          </p>
                          <p className="mt-1 overflow-hidden text-xs leading-5 text-ink-secondary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                            {tr(alert.detail)}
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

        <section className={`grid items-start gap-[1.1%] ${dashboardTheme.layout.secondaryGrid}`}>
          <PredictionPanel prediction={state.prediction} />

          <section className="panel overflow-hidden">
            <div className="panel-header">
              <div>
                <p className="panel-title">{t("panels.factory")}</p>
                <h2 className="mt-1 font-display text-lg text-ink-primary">
                  {t("panels.factoryUnits")}
                </h2>
              </div>
              <span className="chip border border-white/10 bg-white/[0.04] text-ink-secondary">
                {tr(scenarioMeta.label)}
              </span>
            </div>

            <div className="space-y-3 p-3">
              <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
                <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.04] p-3">
                  <p className="panel-title mb-1">{t("loss.acid")}</p>
                  <p className="number text-[1.7rem] leading-none text-ink-primary">
                    {state.loss.acidLossKg.toLocaleString(numberLocale)} {t("loss.units.kg")}
                  </p>
                </div>
                <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.04] p-3">
                  <p className="panel-title mb-1">{t("loss.cost")}</p>
                  <p className="number text-[1.7rem] leading-none text-ink-primary">
                    ${state.loss.estimatedCostUsd.toLocaleString(numberLocale)}
                  </p>
                </div>
                <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.04] p-3">
                  <p className="panel-title mb-1">{t("loss.fish")}</p>
                  <p className="number text-[1.7rem] leading-none text-ink-primary">
                    {state.loss.fishImpactTons.toFixed(1)} {t("loss.units.tons")}
                  </p>
                </div>
                <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.04] p-3">
                  <p className="panel-title mb-1">{t("loss.agri")}</p>
                  <p className="number text-[1.7rem] leading-none text-ink-primary">
                    {state.loss.agriImpactHa.toFixed(1)} {t("loss.units.hectares")}
                  </p>
                </div>
              </div>

              <TreatmentOptimizerPanel
                recommendation={treatmentRecommendation}
                regionName={tr(selectedRegion.name)}
              />

              <div className="grid gap-2 md:grid-cols-2">
                {state.units.map((unit) => (
                  <article
                    key={unit.id}
                    className={`rounded-[1.1rem] border p-3 ${unitTone(unit)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-sm text-ink-primary">{tr(unit.name)}</p>
                        <p className="mt-1 text-[0.72rem] text-ink-muted">
                          {t(`unit.type.${unit.type}`)}
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
                        {t(`unit.status.${unit.status}`)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[0.76rem] text-ink-secondary">
                      <span>
                        {t("unit.load")} <span className="number text-ink-primary">{unit.load}%</span>
                      </span>
                      <span>
                        {t("unit.efficiency")}{" "}
                        <span className="number text-ink-primary">{unit.efficiency}%</span>
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
                <p className="panel-title">{t("panels.advisory")}</p>
                <h2 className="mt-1 font-display text-lg text-ink-primary">
                  {t("panels.advisoryAudience")}
                </h2>
              </div>
              <span className="chip border border-white/10 bg-white/[0.04] text-ink-secondary">
                {tr(selectedRegion.name)}
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
                      {t(`audience.${advisory.audience}`)}
                    </p>
                    <StatusBadge severity={advisory.level} compact />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {advisory.actions.slice(0, 2).map((item, idx) => (
                      <span
                        key={idx}
                        className="rounded-full border border-white/8 bg-black/10 px-3 py-1.5 text-[0.76rem] text-ink-primary"
                      >
                        {tr(item)}
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