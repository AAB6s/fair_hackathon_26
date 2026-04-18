import { motion } from "framer-motion";
import { useState } from "react";
import { gabesReferenceMap } from "../data/gabesReferenceMap";
import { dashboardTheme } from "../theme/dashboardTheme";
import type { Action, Indicator, Prediction, Region } from "../types";
import { StatusBadge } from "./StatusBadge";

interface GabesMapProps {
  regions: Region[];
  indicators: Indicator[];
  actions: Action[];
  prediction: Prediction;
  selectedRegionId: string;
  onSelect: (regionId: string) => void;
}

type MapLegendItem =
  | { label: string; swatch: string; dots?: boolean; line?: never }
  | { label: string; line: string; swatch?: never; dots?: never };

const mapLegend: MapLegendItem[] = [
  { label: "نسيج عمراني", swatch: dashboardTheme.palette.map.urban },
  { label: "واحات", swatch: dashboardTheme.palette.map.oasis },
  { label: "منشآت صناعية", swatch: dashboardTheme.palette.map.industrial },
  { label: "فوسفوجيبس", swatch: dashboardTheme.palette.map.phosphogypsum, dots: true },
  { label: "طرق", line: dashboardTheme.palette.map.road },
  { label: "سكة", line: dashboardTheme.palette.map.rail },
];

const zoneTypeLabel: Record<Region["type"], string> = {
  industrial: "صناعي",
  urban: "عمراني",
  coastal: "ساحلي",
  agricultural: "فلاحي",
  school: "مدارس",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function regionGeometry(region: Region) {
  const override = gabesReferenceMap.regionLayouts[region.id];
  if (override) {
    return override;
  }

  return {
    path: region.path,
    centroid: region.centroid,
  };
}

function severityOverlayFill(region: Region): string {
  if (region.severity === "danger") return dashboardTheme.palette.map.overlayDanger;
  if (region.severity === "warning") {
    return dashboardTheme.palette.map.overlayWarning;
  }
  return dashboardTheme.palette.map.overlayNormal;
}

function severityStroke(region: Region, selected: boolean): string {
  if (selected) return dashboardTheme.palette.map.selectedStroke;
  if (region.severity === "danger") return dashboardTheme.palette.severity.danger;
  if (region.severity === "warning") return dashboardTheme.palette.severity.warning;
  return "rgba(47, 42, 43, 0.34)";
}

function zoneMetrics(
  region: Region,
  indicators: Indicator[],
  prediction: Prediction,
) {
  const water = indicators.find((indicator) => indicator.key === "water")!;
  const air = clamp(
    Math.round(region.pollution * 0.9 + prediction.windSpeed * 2.2),
    8,
    99,
  );
  const waterRisk = clamp(
    Math.round(
      region.pollution * 0.55 +
        water.value * (region.type === "coastal" ? 0.6 : 0.25),
    ),
    6,
    99,
  );
  const in30 = clamp(
    Math.round(
      region.pollution +
        (prediction.peakInMinutes <= 30 ? 8 : 4) -
        region.distanceKm * 0.8,
    ),
    4,
    99,
  );
  const in60 = clamp(
    Math.round(
      region.pollution + prediction.spreadKm * 0.9 - region.distanceKm * 0.55,
    ),
    4,
    99,
  );

  return { air, waterRisk, in30, in60 };
}

function pickZoneAction(region: Region, actions: Action[]): Action {
  if (region.type === "industrial") {
    return actions.find((action) => action.category === "stop") ?? actions[0];
  }
  if (region.type === "coastal") {
    return (
      actions.find(
        (action) =>
          action.category === "evacuate" || action.category === "carbon",
      ) ?? actions[0]
    );
  }
  if (region.type === "school") {
    return (
      actions.find(
        (action) =>
          action.category === "evacuate" || action.category === "monitor",
      ) ?? actions[0]
    );
  }
  return (
    actions.find(
      (action) =>
        action.category === "adjust" || action.category === "monitor",
    ) ?? actions[0]
  );
}

function labelFill(tone: "major" | "minor" | "water" = "major"): string {
  if (tone === "minor") return dashboardTheme.palette.map.minorLabel;
  if (tone === "water") return dashboardTheme.palette.brand;
  return dashboardTheme.palette.map.label;
}

function hasSwatch(item: MapLegendItem): item is Extract<MapLegendItem, { swatch: string }> {
  return "swatch" in item;
}

export function GabesMap({
  regions,
  indicators,
  actions,
  prediction,
  selectedRegionId,
  onSelect,
}: GabesMapProps) {
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  const selectedRegion =
    regions.find((region) => region.id === selectedRegionId) ?? regions[0];
  const hoveredRegion =
    regions.find((region) => region.id === hoveredRegionId) ?? null;
  const metrics = zoneMetrics(selectedRegion, indicators, prediction);
  const zoneAction = pickZoneAction(selectedRegion, actions);
  const priorityLabel =
    zoneAction.priority === "immediate" ? "فوري" : "موصى";

  const windRad = ((prediction.windDirection - 90) * Math.PI) / 180;
  const plumeDistance = 44 + prediction.spreadKm * 7.5;
  const windX = 438 + Math.cos(windRad) * plumeDistance;
  const windY = 178 + Math.sin(windRad) * plumeDistance;
  const windCtrlX = 438 + Math.cos(windRad) * (plumeDistance * 0.56);
  const windCtrlY = 178 + Math.sin(windRad) * (plumeDistance * 0.24) - 14;
  const windPath = `M438 178 Q ${windCtrlX} ${windCtrlY} ${windX} ${windY}`;

  return (
    <section className="panel overflow-hidden">
      <div className="panel-header">
        <div>
          <p className="panel-title">الخريطة المرجعية</p>
          <h2 className="mt-1 font-display text-lg text-ink-primary">
            قابس
          </h2>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="chip border border-white/10 bg-white/[0.04] text-ink-secondary">
            رياح {prediction.windSpeed.toFixed(1)} م/ث
          </span>
          <span className="chip border border-white/10 bg-white/[0.04] text-ink-secondary">
            انتشار {prediction.spreadKm.toFixed(1)} كم
          </span>
          <span className="chip border border-white/10 bg-white/[0.04] text-ink-secondary">
            اتجاه {prediction.windDirection.toFixed(0)}°
          </span>
        </div>
      </div>

      <div className="grid items-start gap-3 p-3 xl:grid-cols-[74%_26%]">
        <div
          className="relative overflow-hidden rounded-[1.55rem] border border-white/10 p-2"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
          }}
          onMouseLeave={() => setHoveredRegionId(null)}
        >
          <motion.div
            className="pointer-events-none absolute inset-y-[10%] left-[-12%] z-[1] w-[18%] blur-xl"
            style={{
              background: `linear-gradient(90deg, transparent, rgba(${dashboardTheme.palette.brandRgb}, 0.16), transparent)`,
            }}
            animate={{ x: ["0%", "560%"] }}
            transition={{
              duration: dashboardTheme.motion.mapSweep,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          <div className="absolute right-4 top-4 z-[3] rounded-[1rem] border border-black/8 bg-white/84 px-3 py-2 shadow-[0_12px_28px_-20px_rgba(0,0,0,0.55)] backdrop-blur-sm">
            <p
              className="mb-2 text-[0.74rem] font-semibold"
              style={{ color: dashboardTheme.palette.map.label }}
            >
              مفتاح الخريطة
            </p>
            <div className="space-y-1.5">
              {mapLegend.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 text-[0.72rem]"
                  style={{ color: "#55534F" }}
                >
                  <span>{item.label}</span>
                  {hasSwatch(item) ? (
                    <span className="inline-flex h-3.5 w-5 items-center justify-center rounded-[0.25rem] border border-black/8 bg-white">
                      {item.dots ? (
                        <span
                          className="h-2.5 w-4 rounded-[0.2rem]"
                          style={{
                            backgroundImage:
                              "radial-gradient(circle, rgba(47, 42, 43, 0.88) 0 20%, transparent 24% 100%)",
                            backgroundSize: "6px 6px",
                          }}
                        />
                      ) : (
                        <span
                          className="h-2.5 w-4 rounded-[0.2rem]"
                          style={{ backgroundColor: item.swatch }}
                        />
                      )}
                    </span>
                  ) : (
                    <span className="inline-flex h-3.5 w-5 items-center justify-center">
                      <span
                        className="h-[2px] w-5 rounded-full"
                        style={{ backgroundColor: item.line }}
                      />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <svg
            viewBox={gabesReferenceMap.viewBox}
            className="relative z-[2] aspect-[15/10] w-full rounded-[1.2rem]"
          >
            <defs>
              <filter id="map-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow
                  dx="0"
                  dy="16"
                  stdDeviation="16"
                  floodColor="rgba(15, 18, 24, 0.22)"
                />
              </filter>
              <filter id="selected-region" x="-20%" y="-20%" width="160%" height="160%">
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="8"
                  floodColor="rgba(255, 255, 255, 0.7)"
                />
              </filter>
              <radialGradient id="industrial-glow" cx="42%" cy="36%" r="24%">
                <stop
                  offset="0%"
                  stopColor={`rgba(${dashboardTheme.palette.severity.warningRgb}, 0.32)`}
                />
                <stop
                  offset="100%"
                  stopColor={`rgba(${dashboardTheme.palette.severity.warningRgb}, 0)`}
                />
              </radialGradient>
              <radialGradient id="sea-glow" cx="82%" cy="46%" r="34%">
                <stop
                  offset="0%"
                  stopColor={`rgba(${dashboardTheme.palette.brandRgb}, 0.12)`}
                />
                <stop
                  offset="100%"
                  stopColor={`rgba(${dashboardTheme.palette.brandRgb}, 0)`}
                />
              </radialGradient>
            </defs>

            <rect
              x="8"
              y="8"
              width="764"
              height="524"
              rx="24"
              fill={dashboardTheme.palette.map.sheet}
              filter="url(#map-shadow)"
            />
            <rect
              x="8"
              y="8"
              width="764"
              height="524"
              rx="24"
              fill="url(#sea-glow)"
              opacity="0.55"
            />

            <path d={gabesReferenceMap.seaPath} fill={dashboardTheme.palette.map.sea} />
            <path
              d={gabesReferenceMap.seaPath}
              fill="none"
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="1.4"
            />

            {gabesReferenceMap.oasisPatches.map((patch) => (
              <path
                key={patch.id}
                d={patch.path}
                fill={dashboardTheme.palette.map.oasis}
                opacity="0.95"
              />
            ))}

            {gabesReferenceMap.urbanPatches.map((patch) => (
              <path
                key={patch.id}
                d={patch.path}
                fill={dashboardTheme.palette.map.urban}
                opacity="0.96"
              />
            ))}

            {gabesReferenceMap.industrialPatches.map((patch) => (
              <path
                key={patch.id}
                d={patch.path}
                fill={dashboardTheme.palette.map.industrial}
                opacity="0.96"
              />
            ))}

            <path d="M366 110 L510 110 L580 246 L528 314 L430 240 Z" fill="url(#industrial-glow)" />

            <motion.g
              animate={{ opacity: [0.35, 0.85, 0.35], y: [0, 1.5, 0] }}
              transition={{
                duration: dashboardTheme.motion.plume,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {gabesReferenceMap.phosphogypsumDots.map((dot, index) => (
                <circle
                  key={`${dot.x}-${dot.y}-${index}`}
                  cx={dot.x}
                  cy={dot.y}
                  r={dot.r}
                  fill={dashboardTheme.palette.map.phosphogypsum}
                  opacity="0.85"
                />
              ))}
            </motion.g>

            {gabesReferenceMap.roads.map((road) => (
              <path
                key={road.id}
                d={road.path}
                fill="none"
                stroke={dashboardTheme.palette.map.road}
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
            ))}

            {gabesReferenceMap.railways.map((rail) => (
              <path
                key={rail.id}
                d={rail.path}
                fill="none"
                stroke={dashboardTheme.palette.map.rail}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
            ))}

            <motion.path
              d={gabesReferenceMap.coastPath}
              fill="none"
              stroke={dashboardTheme.palette.map.coast}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              animate={{ opacity: [0.88, 1, 0.88] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
            />

            <motion.path
              d={windPath}
              fill="none"
              stroke={dashboardTheme.palette.brand}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeDasharray="8 8"
              animate={{ pathLength: [0.1, 1], opacity: [0.12, 0.78, 0.12] }}
              transition={{
                duration: dashboardTheme.motion.rail,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {regions.map((region, index) => {
              const geometry = regionGeometry(region);
              const selected = region.id === selectedRegionId;
              const hovered = region.id === hoveredRegionId;
              const pollutionChipWidth = Math.max(
                40,
                String(region.pollution).length * 12 + 20,
              );

              return (
                <g key={region.id}>
                  <motion.path
                    d={geometry.path}
                    fill={severityOverlayFill(region)}
                    stroke={severityStroke(region, selected)}
                    strokeWidth={selected ? 3 : hovered ? 2.2 : 1.5}
                    opacity={selected ? 0.96 : hovered ? 0.9 : 0.76}
                    filter={selected ? "url(#selected-region)" : undefined}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: selected ? 0.96 : hovered ? 0.9 : 0.76, scale: 1 }}
                    transition={{ delay: index * 0.02, duration: 0.35 }}
                    onMouseEnter={() => setHoveredRegionId(region.id)}
                    onMouseMove={(event) => {
                      const bounds =
                        event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                      if (!bounds) return;
                      setPointer({
                        x: event.clientX - bounds.left,
                        y: event.clientY - bounds.top,
                      });
                    }}
                    onClick={() => onSelect(region.id)}
                    className="region-path"
                  />

                  <g transform={`translate(${geometry.centroid[0]} ${geometry.centroid[1]})`}>
                    <rect
                      x={-pollutionChipWidth / 2}
                      y="-14"
                      width={pollutionChipWidth}
                      height="24"
                      rx="12"
                      fill="rgba(15, 18, 24, 0.62)"
                      stroke="rgba(255, 255, 255, 0.16)"
                    />
                    <text
                      y="2"
                      textAnchor="middle"
                      className="fill-white font-mono text-[13px]"
                    >
                      {region.pollution}%
                    </text>
                  </g>
                </g>
              );
            })}

            {gabesReferenceMap.labels.map((label) => (
              <text
                key={label.id}
                x={label.x}
                y={label.y}
                textAnchor={label.anchor ?? "middle"}
                fill={labelFill(label.tone)}
                fontSize={label.size ?? (label.tone === "major" ? 18 : 13)}
                className={label.tone === "major" ? "font-display" : ""}
                opacity={label.tone === "water" ? 0.84 : 0.92}
              >
                {label.text}
              </text>
            ))}

            <g transform={`translate(${gabesReferenceMap.northArrow.x} ${gabesReferenceMap.northArrow.y})`}>
              <path d="M0 26 L14 -8 L28 26 Z" fill={dashboardTheme.palette.map.label} />
              <path d="M14 -8 L22 26 L14 20 L6 26 Z" fill={dashboardTheme.palette.map.sheet} />
            </g>
            <g transform={`translate(${gabesReferenceMap.scale.x} ${gabesReferenceMap.scale.y})`}>
              <line x1="0" y1="0" x2="38" y2="0" stroke={dashboardTheme.palette.map.label} strokeWidth="2" />
              <line x1="0" y1="-8" x2="0" y2="2" stroke={dashboardTheme.palette.map.label} strokeWidth="2" />
              <line x1="38" y1="-8" x2="38" y2="2" stroke={dashboardTheme.palette.map.label} strokeWidth="2" />
              <text x="52" y="4" fill={dashboardTheme.palette.map.label} fontSize="12">
                1 كم
              </text>
            </g>

            <motion.circle
              cx="438"
              cy="178"
              r="6.5"
              fill={dashboardTheme.palette.brand}
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: dashboardTheme.motion.pulse, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: "438px 178px" }}
            />
            <motion.circle
              cx="438"
              cy="178"
              r="16"
              fill="none"
              stroke={`rgba(${dashboardTheme.palette.brandRgb}, 0.42)`}
              strokeWidth="2.4"
              animate={{ scale: [0.9, 1.55], opacity: [0.52, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
              style={{ transformOrigin: "438px 178px" }}
            />
            <text
              x="438"
              y="154"
              textAnchor="middle"
              fill={dashboardTheme.palette.brand}
              fontSize="13"
              className="font-display"
            >
              المصنع
            </text>
          </svg>

          {hoveredRegion ? (
            <div
              className="pointer-events-none absolute z-[4] rounded-[1rem] border border-white/12 bg-bg-surface/92 px-3 py-2 text-sm shadow-[0_16px_30px_-24px_rgba(0,0,0,0.7)] backdrop-blur-md"
              style={{
                left: clamp(pointer.x + 24, 18, 520),
                top: clamp(pointer.y + 18, 18, 356),
              }}
            >
              <p className="font-display text-sm text-ink-primary">
                {hoveredRegion.name}
              </p>
              <p className="mt-1 text-[0.72rem] text-ink-secondary">
                {zoneTypeLabel[hoveredRegion.type]}
              </p>
              <p className="number mt-1 text-brand">{hoveredRegion.pollution}%</p>
            </div>
          ) : null}
        </div>

        <motion.div
          layout
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: dashboardTheme.motion.panelEnter }}
          className="space-y-2.5 rounded-[1.45rem] border border-white/8 p-3"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="panel-title">المنطقة المحددة</p>
              <h3 className="mt-1 font-display text-[1.35rem] text-ink-primary">
                {selectedRegion.name}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="chip border border-white/10 bg-white/5 text-ink-secondary">
                  {zoneTypeLabel[selectedRegion.type]}
                </span>
                <span className="chip border border-white/10 bg-white/5 text-ink-secondary">
                  <span className="number text-ink-primary">
                    {selectedRegion.distanceKm.toFixed(1)} كم
                  </span>
                </span>
              </div>
            </div>
            <StatusBadge
              severity={selectedRegion.severity}
              pulse={selectedRegion.severity === "danger"}
              compact
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "هواء", value: `${metrics.air}%` },
              { label: "ماء", value: `${metrics.waterRisk}%` },
              { label: "بعد 30 د", value: `${metrics.in30}%` },
              { label: "بعد 60 د", value: `${metrics.in60}%` },
            ].map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + index * 0.04, duration: 0.28 }}
                className={`${dashboardTheme.classes.insetCard} bg-black/10 p-3`}
              >
                <p className="panel-title mb-1">{item.label}</p>
                <p className="number text-[1.9rem] leading-none text-ink-primary">
                  {item.value}
                </p>
              </motion.div>
            ))}
          </div>

          <div
            className="rounded-[1.2rem] border border-white/8 p-3"
            style={{
              background: `linear-gradient(180deg, rgba(221, 178, 142, 0.08), rgba(${dashboardTheme.palette.brandRgb}, 0.06))`,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="panel-title">الإجراء المقترح</p>
                <h4 className="mt-1 font-display text-base text-ink-primary">
                  {zoneAction.title}
                </h4>
              </div>
              <StatusBadge
                severity={
                  zoneAction.priority === "immediate" ? "danger" : "warning"
                }
                label={priorityLabel}
                compact
              />
            </div>

            <p className="mt-2 text-sm leading-6 text-ink-secondary">
              {zoneAction.target}
            </p>

            <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
              <span className="text-ink-muted">زمن التنفيذ</span>
              <span className="number text-brand">{zoneAction.etaMinutes} د</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
