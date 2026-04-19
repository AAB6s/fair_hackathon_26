import { motion } from "framer-motion";
import { useLocale } from "../i18n/LocaleContext";
import type { LocalizedString } from "../i18n/types";
import { glowShadow, severityTone } from "../theme/dashboardTheme";
import type { Severity } from "../types";
import { severityLabel } from "../utils/classify";

interface StatusBadgeProps {
  severity: Severity;
  label?: LocalizedString | string;
  pulse?: boolean;
  compact?: boolean;
}

const iconMap: Record<Severity, string> = {
  normal: "●",
  warning: "▲",
  danger: "■",
};

export function StatusBadge({
  severity,
  label,
  pulse = false,
  compact = false,
}: StatusBadgeProps) {
  const { tr } = useLocale();
  const tone = severityTone(severity);

  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{
        opacity: 1,
        scale: 1,
        boxShadow: glowShadow(severity, pulse),
      }}
      className={`chip border ${tone.chip} ${compact ? "px-2 py-1 text-[0.62rem]" : ""}`}
      transition={
        pulse
          ? { duration: 1.8, repeat: Infinity }
          : { duration: 0.2, ease: "easeOut" }
      }
    >
      <span
        className={`text-[0.7rem] leading-none ${pulse ? "radar" : ""}`}
        aria-hidden="true"
        style={{ color: tone.color }}
      >
        {iconMap[severity]}
      </span>
      {tr(label ?? severityLabel(severity))}
    </motion.span>
  );
}
