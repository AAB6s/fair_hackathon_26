import type { Action, Severity } from "../types";

const palette = {
  bg: {
    base: "#071319",
    topGlowRgb: "98, 182, 232",
    bottomGlowRgb: "242, 169, 59",
    cardShadowRgb: "0, 0, 0",
    border: "#27414C",
  },
  ink: {
    primary: "#F3F7FA",
    secondary: "#C2D0D8",
    muted: "#8EA2AD",
  },
  brand: "#62B6E8",
  brandRgb: "98, 182, 232",
  brandSoft: "rgba(98, 182, 232, 0.16)",
  brandLine: "rgba(98, 182, 232, 0.78)",
  surfaceTop: "rgba(255, 255, 255, 0.055)",
  surfaceBottom: "rgba(255, 255, 255, 0)",
  severity: {
    normal: "#18A999",
    normalRgb: "24, 169, 153",
    warning: "#F2B544",
    warningRgb: "242, 181, 68",
    danger: "#E56B6F",
    dangerRgb: "229, 107, 111",
  },
  map: {
    sheet: "#F6F1E4",
    sea: "#A7D0EB",
    coast: "#F9FBFF",
    urban: "#DDB28E",
    oasis: "#9CC57C",
    industrial: "#7E7D83",
    phosphogypsum: "#2F2A2B",
    road: "#3F4149",
    rail: "#CFA6C8",
    label: "#3C3A38",
    minorLabel: "#6C6966",
    selectedStroke: "#FEFEFF",
    overlayNormal: "rgba(24, 169, 153, 0.54)",
    overlayWarning: "rgba(242, 181, 68, 0.6)",
    overlayDanger: "rgba(229, 107, 111, 0.66)",
  },
} as const;

const severityStyles: Record<
  Severity,
  {
    color: string;
    rgb: string;
    chip: string;
    softPanel: string;
    accent: string;
    bar: string;
    glowClass?: string;
  }
> = {
  normal: {
    color: palette.severity.normal,
    rgb: palette.severity.normalRgb,
    chip: "border-status-normal/30 bg-status-normal/12 text-status-normal",
    softPanel: "border-status-normal/22 bg-status-normal/[0.08]",
    accent: "bg-status-normal/75",
    bar: "bg-status-normal",
  },
  warning: {
    color: palette.severity.warning,
    rgb: palette.severity.warningRgb,
    chip: "border-status-warning/35 border-dashed bg-status-warning/12 text-status-warning",
    softPanel: "border-status-warning/22 bg-status-warning/[0.08]",
    accent: "bg-status-warning/75",
    bar: "bg-status-warning",
    glowClass: "panel-glow-warn",
  },
  danger: {
    color: palette.severity.danger,
    rgb: palette.severity.dangerRgb,
    chip: "border-status-danger/30 bg-status-danger/12 text-status-danger",
    softPanel: "border-status-danger/22 bg-status-danger/[0.08]",
    accent: "bg-status-danger/75",
    bar: "bg-status-danger",
    glowClass: "panel-glow-danger",
  },
};

export const dashboardTheme = {
  layout: {
    shell:
      "relative mx-auto flex min-h-screen w-[96%] flex-col gap-[1.1%] py-[1.1%] md:w-[94%] xl:w-[92%]",
    headerGrid: "xl:grid-cols-[35%_23%_42%]",
    primaryGrid: "xl:grid-cols-[24%_50%_26%]",
    secondaryGrid: "xl:grid-cols-[31%_41%_28%]",
    indicatorGrid: "grid-cols-1 gap-2 p-3 2xl:grid-cols-2",
  },
  motion: {
    panelEnter: 0.38,
    shimmer: 6.2,
    pulse: 2.8,
    mapSweep: 9.2,
    plume: 5.6,
    rail: 4.8,
  },
  palette,
  cssVars: {
    "--theme-bg-base": palette.bg.base,
    "--theme-bg-top-rgb": palette.bg.topGlowRgb,
    "--theme-bg-bottom-rgb": palette.bg.bottomGlowRgb,
    "--theme-card-shadow-rgb": palette.bg.cardShadowRgb,
    "--theme-border": palette.bg.border,
    "--theme-ink-primary": palette.ink.primary,
    "--theme-ink-secondary": palette.ink.secondary,
    "--theme-ink-muted": palette.ink.muted,
    "--theme-brand": palette.brand,
    "--theme-brand-rgb": palette.brandRgb,
    "--theme-brand-soft": palette.brandSoft,
    "--theme-brand-line": palette.brandLine,
    "--theme-normal": palette.severity.normal,
    "--theme-normal-rgb": palette.severity.normalRgb,
    "--theme-warning": palette.severity.warning,
    "--theme-warning-rgb": palette.severity.warningRgb,
    "--theme-danger": palette.severity.danger,
    "--theme-danger-rgb": palette.severity.dangerRgb,
    "--theme-surface-top": palette.surfaceTop,
    "--theme-surface-bottom": palette.surfaceBottom,
  } as Record<string, string>,
  classes: {
    scenarioActive:
      "border-brand/40 bg-brand/15 text-ink-primary shadow-glow ring-1 ring-brand/20",
    scenarioIdle:
      "border-white/8 bg-white/[0.03] text-ink-secondary hover:border-brand/20 hover:bg-white/[0.05]",
    insetCard:
      "rounded-[1.1rem] border border-white/8 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  },
} as const;

export function severityTone(severity: Severity) {
  return severityStyles[severity];
}

export function priorityTone(priority: Action["priority"]) {
  return severityStyles[priority === "immediate" ? "danger" : "warning"];
}

export function glowShadow(severity: Severity, pulse = false): string | string[] {
  const tone = severityStyles[severity];
  if (pulse) {
    return [
      "0 0 0 rgba(0,0,0,0)",
      `0 0 1.25rem rgba(${tone.rgb}, 0.18)`,
      "0 0 0 rgba(0,0,0,0)",
    ];
  }
  return `0 0 1.05rem rgba(${tone.rgb}, 0.1)`;
}

export type DashboardTheme = typeof dashboardTheme;
