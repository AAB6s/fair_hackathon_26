import type { Indicator, Severity } from "../types";
import { dashboardTheme } from "../theme/dashboardTheme";

export const severityRank: Record<Severity, number> = {
  normal: 0,
  warning: 1,
  danger: 2,
};

export function classify(ind: Indicator): Severity {
  const { value, warningAt, dangerAt, invert } = ind;
  if (invert) {
    if (value <= dangerAt) return "danger";
    if (value <= warningAt) return "warning";
    return "normal";
  }
  if (value >= dangerAt) return "danger";
  if (value >= warningAt) return "warning";
  return "normal";
}

export function aggregateSeverity(items: Severity[]): Severity {
  let max: Severity = "normal";
  for (const s of items) if (severityRank[s] > severityRank[max]) max = s;
  return max;
}

export function severityColor(s: Severity): string {
  return s === "danger"
    ? dashboardTheme.palette.severity.danger
    : s === "warning"
    ? dashboardTheme.palette.severity.warning
    : dashboardTheme.palette.severity.normal;
}

export function severityBg(s: Severity): string {
  return s === "danger"
    ? `rgba(${dashboardTheme.palette.severity.dangerRgb}, 0.12)`
    : s === "warning"
    ? `rgba(${dashboardTheme.palette.severity.warningRgb}, 0.12)`
    : `rgba(${dashboardTheme.palette.severity.normalRgb}, 0.12)`;
}

export function severityLabel(s: Severity): string {
  return s === "danger" ? "خطر" : s === "warning" ? "تحذير" : "طبيعي";
}
