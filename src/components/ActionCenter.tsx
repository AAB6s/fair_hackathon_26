import { motion } from "framer-motion";
import { priorityTone, severityTone } from "../theme/dashboardTheme";
import type { Action, Prediction, Severity } from "../types";
import { severityLabel } from "../utils/classify";

interface ActionCenterProps {
  actions: Action[];
  globalSeverity: Severity;
  prediction: Prediction;
}

const priorityLabel: Record<Action["priority"], string> = {
  immediate: "فوري",
  recommended: "موصى",
};

export function ActionCenter({
  actions,
  globalSeverity,
  prediction,
}: ActionCenterProps) {
  const severity = severityTone(globalSeverity);
  const visibleActions = actions.slice(0, 4);
  const immediateCount = actions.filter(
    (action) => action.priority === "immediate",
  ).length;

  return (
    <motion.aside
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel overflow-hidden"
    >
      <motion.div
        className={`absolute right-[8%] top-0 h-px w-[34%] ${severity.accent}`}
        animate={{ opacity: [0.25, 0.8, 0.25], scaleX: [0.88, 1, 0.88] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="panel-header">
        <div>
          <p className="panel-title">القرار</p>
          <h2 className="mt-1 font-display text-lg text-ink-primary">
            التنفيذ الآن
          </h2>
        </div>
        <span className={`chip border ${severity.chip}`}>
          {severityLabel(globalSeverity)}
        </span>
      </div>

      <div className="space-y-3 p-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="data-sweep rounded-2xl border border-white/8 bg-white/[0.04] p-3">
            <p className="panel-title mb-1">فوري</p>
            <p className="number text-2xl text-ink-primary">{immediateCount}</p>
          </div>
          <div className="data-sweep rounded-2xl border border-white/8 bg-white/[0.04] p-3">
            <p className="panel-title mb-1">30 د</p>
            <p className="number text-2xl text-ink-primary">
              {(
                prediction.forecast.find((point) => point.t === 30)?.value ??
                prediction.peakValue
              ).toFixed(0)}
              %
            </p>
          </div>
          <div className="data-sweep rounded-2xl border border-white/8 bg-white/[0.04] p-3">
            <p className="panel-title mb-1">ذروة</p>
            <p className="number text-2xl text-ink-primary">
              {prediction.peakInMinutes} د
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {visibleActions.map((action, index) => (
            <motion.div
              key={action.id}
              layout
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.025 }}
              className={`relative overflow-hidden rounded-2xl border p-3 ${
                priorityTone(action.priority).softPanel
              }`}
            >
              <motion.span
                className={`absolute inset-y-3 right-0 w-[0.24rem] rounded-full ${
                  priorityTone(action.priority).bar
                }`}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              />

              <div className="flex items-center justify-between gap-3">
                <h3 className="min-w-0 overflow-hidden font-display text-sm leading-5 text-ink-primary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                  {action.title}
                </h3>
                <span className={`chip border ${priorityTone(action.priority).chip}`}>
                  {priorityLabel[action.priority]}
                </span>
              </div>

              <p className="mt-2 text-[0.78rem] leading-5 text-ink-secondary">
                {action.reason}
              </p>

              <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
                <span className="truncate text-ink-muted">{action.target}</span>
                <span className="number text-ink-primary">{action.etaMinutes} د</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}
