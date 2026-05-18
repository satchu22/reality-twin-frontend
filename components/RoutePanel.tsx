"use client";

import AIInsights from "@/components/AIInsights";
import DecisionCards, { type DecisionOption } from "@/components/DecisionCards";
import { type SimulationMode } from "@/lib/simulate";

export type SelectedRoute = {
  routeId: number | string | null;
  name: string;
  distance: number | null;
  status: "best" | "high risk" | "medium risk" | "normal";
};

export type ShipmentProfileInput = {
  cargoType: string;
  goodsDescription: string;
  priority: "low" | "standard" | "high" | "critical";
  shipmentWeightKg: number;
  shipmentVolumeCbm: number;
  shipmentUnits: number;
  palletCount: number;
  hazardousMaterial: boolean;
  coldChainRequired: boolean;
};

type RoutePanelProps = {
  route: SelectedRoute | null;
  isOpen: boolean;
  simulationLoading: boolean;
  approvalLoading: boolean;
  simulationError: string | null;
  confirmationMessage: string | null;
  decisionOptions: DecisionOption[];
  focusedOption: DecisionOption | null;
  detectedEvents: DecisionOption["live_events_used"];
  bestOptionName: string | null;
  approvedOptionName: string | null;
  selectedOptionName: string | null;
  selectedMode: SimulationMode;
  shipmentProfile: ShipmentProfileInput;
  onClose: () => void;
  onSimulate: () => void;
  onSelectMode: (mode: SimulationMode) => void;
  onApprove: (option: DecisionOption) => void;
  onSelectOption: (option: DecisionOption) => void;
  onViewOption: (option: DecisionOption) => void;
  onShipmentFieldChange: (
    field: keyof ShipmentProfileInput,
    value: string | number | boolean,
  ) => void;
};

const MODE_CARDS: Array<{
  mode: SimulationMode;
  title: string;
  description: string;
}> = [
  {
    mode: "road",
    title: "Road",
    description: "Compare fastest, cheapest, and safest trucking paths.",
  },
  {
    mode: "air",
    title: "Air",
    description: "Simulate airport pickup, linehaul, and final delivery.",
  },
  {
    mode: "sea",
    title: "Sea",
    description: "Model port drayage, ocean linehaul, and final-mile delivery.",
  },
  {
    mode: "hybrid",
    title: "Hybrid",
    description: "Blend multiple modes to optimize time, cost, and risk.",
  },
];

function dedupeWeatherAlerts(alerts: NonNullable<DecisionOption["weather_risk"]>["alerts"]) {
  const seen = new Set<string>();

  return alerts.filter((alert) => {
    const key =
      alert.id ||
      alert.event_id ||
      alert.url ||
      alert.headline ||
      alert.description ||
      alert.event ||
      JSON.stringify(alert);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export default function RoutePanel({
  route,
  isOpen,
  simulationLoading,
  approvalLoading,
  simulationError,
  confirmationMessage,
  decisionOptions,
  focusedOption,
  detectedEvents,
  bestOptionName,
  approvedOptionName,
  selectedOptionName,
  selectedMode,
  shipmentProfile,
  onClose,
  onSimulate,
  onSelectMode,
  onApprove,
  onSelectOption,
  onViewOption,
  onShipmentFieldChange,
}: RoutePanelProps) {
  if (!route || !isOpen) {
    return null;
  }

  const weatherSamples = focusedOption?.weather_risk?.sampled_locations ?? [];
  const riskExplanation = focusedOption?.weather_risk?.risk_explanation ?? [];
  const dedupedWeatherAlerts = focusedOption?.weather_risk
    ? dedupeWeatherAlerts(focusedOption.weather_risk.alerts).slice(0, 4)
    : [];
  const selectedOptionKey = focusedOption?.id ?? focusedOption?.name ?? "route-option";

  return (
    <aside
      className="pointer-events-auto fixed inset-y-0 right-0 z-10 flex h-full w-full max-w-sm min-h-0 flex-col overflow-hidden border-l border-white/10 bg-slate-950/95 p-6 text-white shadow-2xl backdrop-blur md:w-96"
      onWheelCapture={(event) => event.stopPropagation()}
      onTouchMoveCapture={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">
            Route Details
          </p>
          <h2 className="mt-3 text-2xl font-semibold">{route.name}</h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300 transition hover:bg-white/10"
        >
          Close
        </button>
      </div>

      <div className="mt-8 flex-1 min-h-0 space-y-4 overflow-y-auto overscroll-contain pr-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Route Name</p>
          <p className="mt-2 text-lg font-medium text-white">{route.name}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Distance</p>
          <p className="mt-2 text-lg font-medium text-white">
            {route.distance !== null ? `${route.distance} km` : "Unavailable"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Status</p>
          <p className="mt-2 text-lg font-medium capitalize text-white">
            {route.status}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Simulation Mode</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {MODE_CARDS.map((modeCard) => {
              const isSelected = selectedMode === modeCard.mode;

              return (
                <button
                  key={modeCard.mode}
                  type="button"
                  onClick={() => onSelectMode(modeCard.mode)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? "border-cyan-300 bg-cyan-400/15"
                      : "border-white/10 bg-slate-950/50 hover:bg-white/10"
                  }`}
                >
                  <p className="font-semibold text-white">{modeCard.title}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-300">
                    {modeCard.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Shipment Profile</p>
          <div className="mt-4 grid gap-3">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Cargo Type
              </span>
              <input
                value={shipmentProfile.cargoType}
                onChange={(event) =>
                  onShipmentFieldChange("cargoType", event.target.value)
                }
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Goods Description
              </span>
              <input
                value={shipmentProfile.goodsDescription}
                onChange={(event) =>
                  onShipmentFieldChange("goodsDescription", event.target.value)
                }
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Priority
                </span>
                <select
                  value={shipmentProfile.priority}
                  onChange={(event) =>
                    onShipmentFieldChange("priority", event.target.value)
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                >
                  {["low", "standard", "high", "critical"].map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Weight (kg)
                </span>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={shipmentProfile.shipmentWeightKg}
                  onChange={(event) =>
                    onShipmentFieldChange(
                      "shipmentWeightKg",
                      Number(event.target.value),
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Volume (cbm)
                </span>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={shipmentProfile.shipmentVolumeCbm}
                  onChange={(event) =>
                    onShipmentFieldChange(
                      "shipmentVolumeCbm",
                      Number(event.target.value),
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Units
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={shipmentProfile.shipmentUnits}
                  onChange={(event) =>
                    onShipmentFieldChange(
                      "shipmentUnits",
                      Number(event.target.value),
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Pallets
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={shipmentProfile.palletCount}
                  onChange={(event) =>
                    onShipmentFieldChange(
                      "palletCount",
                      Number(event.target.value),
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={shipmentProfile.hazardousMaterial}
                  onChange={(event) =>
                    onShipmentFieldChange(
                      "hazardousMaterial",
                      event.target.checked,
                    )
                  }
                />
                Hazardous Material
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={shipmentProfile.coldChainRequired}
                  onChange={(event) =>
                    onShipmentFieldChange(
                      "coldChainRequired",
                      event.target.checked,
                    )
                  }
                />
                Cold Chain Required
              </label>
            </div>
          </div>
        </div>
        <div className="pt-4">
          <button
            type="button"
            onClick={onSimulate}
            disabled={simulationLoading || route.distance === null}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-cyan-400 px-5 py-4 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
          >
            {simulationLoading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/40 border-t-slate-950" />
            )}
            <span>
              {simulationLoading
                ? "Generating simulation..."
                : `Generate ${selectedMode[0].toUpperCase()}${selectedMode.slice(1)} Simulation`}
            </span>
          </button>

          {simulationError && (
            <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
              {simulationError}
            </p>
          )}

          {confirmationMessage && (
            <p className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
              {confirmationMessage}
            </p>
          )}

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
              <p className="text-sm text-slate-300">Decision Options</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {bestOptionName
                  ? `Best option: ${bestOptionName}`
                  : "Generate simulation options for this route."}
              </p>
            </div>

            <AIInsights
              routeOptions={decisionOptions}
              events={detectedEvents}
            />

            {focusedOption?.weather_risk && (
              <section className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                <p className="text-sm font-semibold text-white">
                  Weather Signals Used
                </p>
                <p className="mt-2 text-sm text-sky-100">
                  {focusedOption.weather_risk.summary}
                </p>
                <div className="mt-3 grid gap-2 text-xs text-sky-50/90">
                  {weatherSamples.map((sample, sampleIndex) => (
                    <div
                      key={`${selectedOptionKey}-weather-point-${sampleIndex}`}
                      className="rounded-xl border border-white/10 bg-slate-950/30 p-3"
                    >
                      <p>
                        {sample.lat.toFixed(2)}, {sample.lng.toFixed(2)}
                      </p>
                      <p className="mt-1">{sample.summary}</p>
                    </div>
                  ))}
                </div>
                {riskExplanation.length > 0 && (
                  <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-slate-950/30 p-3 text-xs text-sky-50/90">
                    {riskExplanation.map((line, lineIndex) => (
                      <p
                        key={`${selectedOptionKey}-risk-explanation-${lineIndex}`}
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                )}
                {dedupedWeatherAlerts.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {dedupedWeatherAlerts.map((alert, alertIndex) => (
                      <div
                        key={`${selectedOptionKey}-weather-alert-${alert.id ?? alert.event_id ?? alert.url ?? alertIndex}`}
                        className="rounded-xl border border-white/10 bg-slate-950/30 p-3 text-xs text-sky-50/90"
                      >
                        <p className="font-semibold text-white">
                          {alert.event ?? "Weather Alert"}
                        </p>
                        <p className="mt-1">
                          {alert.headline ?? alert.description ?? ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            <DecisionCards
              options={decisionOptions}
              bestOptionName={bestOptionName}
              selectedOptionName={selectedOptionName}
              onSelectOption={onSelectOption}
              onApproveDecision={onApprove}
              onViewOption={onViewOption}
              approvalLoading={approvalLoading}
              approvedOptionName={approvedOptionName}
              emptyMessage="No route options yet. Generate simulation options for this route."
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
