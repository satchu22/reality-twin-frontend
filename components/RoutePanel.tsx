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
  commodityType:
    | "general"
    | "electronics"
    | "food"
    | "pharma"
    | "documents"
    | "automotive"
    | "machinery"
    | "apparel"
    | "perishable"
    | "hazardous";
  goodsDescription: string;
  priority: "cheapest" | "fastest" | "safest" | "balanced";
  weightKg: number;
  volumeCbm: number;
  pieces: number;
  declaredValueUsd: number;
  palletCount: number;
  temperatureControlled: boolean;
  fragile: boolean;
  hazardous: boolean;
  serviceLevel: "standard" | "express" | "economy";
  insuranceRequired: boolean;
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
  const feasibility = focusedOption?.air_feasibility ?? focusedOption?.feasibility;
  const costBreakdown =
    focusedOption?.air_freight_cost_breakdown ?? focusedOption?.cost_breakdown;
  const timeBreakdown = focusedOption?.air_time_breakdown;
  const chargeableWeight =
    focusedOption?.chargeable_weight ?? focusedOption?.shipment_assumptions;

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
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
              <span className="font-medium text-white">Shipment Details</span>
              <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Configure
              </span>
            </summary>
            <div className="mt-4 grid gap-3">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Goods Type
                </span>
                <select
                  value={shipmentProfile.commodityType}
                  onChange={(event) =>
                    onShipmentFieldChange("commodityType", event.target.value)
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                >
                  {[
                    "general",
                    "electronics",
                    "food",
                    "pharma",
                    "documents",
                    "automotive",
                    "machinery",
                    "apparel",
                    "perishable",
                    "hazardous",
                  ].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
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
                    {["cheapest", "balanced", "fastest", "safest"].map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    Service Level
                  </span>
                  <select
                    value={shipmentProfile.serviceLevel}
                    onChange={(event) =>
                      onShipmentFieldChange("serviceLevel", event.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                  >
                    {["standard", "express", "economy"].map((serviceLevel) => (
                      <option key={serviceLevel} value={serviceLevel}>
                        {serviceLevel}
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
                    value={shipmentProfile.weightKg}
                    onChange={(event) =>
                      onShipmentFieldChange("weightKg", Number(event.target.value))
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
                    value={shipmentProfile.volumeCbm}
                    onChange={(event) =>
                      onShipmentFieldChange("volumeCbm", Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    Number of Pieces
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={shipmentProfile.pieces}
                    onChange={(event) =>
                      onShipmentFieldChange("pieces", Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    Declared Value (USD)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={shipmentProfile.declaredValueUsd}
                    onChange={(event) =>
                      onShipmentFieldChange("declaredValueUsd", Number(event.target.value))
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
                      onShipmentFieldChange("palletCount", Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={shipmentProfile.temperatureControlled}
                    onChange={(event) =>
                      onShipmentFieldChange("temperatureControlled", event.target.checked)
                    }
                  />
                  Temperature Controlled
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={shipmentProfile.fragile}
                    onChange={(event) =>
                      onShipmentFieldChange("fragile", event.target.checked)
                    }
                  />
                  Fragile
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={shipmentProfile.hazardous}
                    onChange={(event) =>
                      onShipmentFieldChange("hazardous", event.target.checked)
                    }
                  />
                  Hazardous
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={shipmentProfile.insuranceRequired}
                    onChange={(event) =>
                      onShipmentFieldChange("insuranceRequired", event.target.checked)
                    }
                  />
                  Insurance Required
                </label>
              </div>
            </div>
          </details>
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

            {focusedOption?.mode === "air" && (
              <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-sm font-semibold text-white">Shipment Summary</p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                    <p>{focusedOption.shipment?.goods_description ?? "General freight"}</p>
                    <p className="capitalize">
                      Goods type:{" "}
                      {focusedOption.shipment?.commodity_type ??
                        focusedOption.shipment_assumptions?.commodity_type ??
                        "general"}
                    </p>
                    <p>
                      Weight:{" "}
                      {focusedOption.shipment?.weight_kg ??
                        focusedOption.shipment_assumptions?.weight_kg ??
                        0}{" "}
                      kg
                    </p>
                    <p>
                      Volume:{" "}
                      {focusedOption.shipment?.volume_cbm ??
                        focusedOption.shipment_assumptions?.volume_cbm ??
                        0}{" "}
                      cbm
                    </p>
                    <p>
                      Chargeable weight:{" "}
                      {chargeableWeight?.chargeable_weight_kg ?? "Unavailable"} kg
                    </p>
                    <p className="capitalize">
                      Service level: {focusedOption.shipment?.service_level ?? "standard"}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-sm font-semibold text-white">Airport Selection Reasoning</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <p>
                      Airport pair:{" "}
                      {focusedOption.selected_origin_airport ?? "Origin"} →{" "}
                      {focusedOption.selected_destination_airport ?? "Destination"}
                    </p>
                    <p>
                      Airline/carrier: {focusedOption.airline ?? focusedOption.carrier ?? "Estimated multi-carrier capacity"}
                    </p>
                    <p>
                      Service level: {focusedOption.shipment?.service_level ?? "standard"}
                    </p>
                    <p>{focusedOption.recommendation_reason}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-sm font-semibold text-white">Route Validation</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <p>{focusedOption.route_possibility ?? "Estimated freight model"}</p>
                    <p>
                      Source: {focusedOption.route_validation?.source ?? "estimated"} ·{" "}
                      {focusedOption.route_validation?.direct_route_known
                        ? "Direct route known"
                        : `${focusedOption.route_validation?.stops ?? 0} stop assumption`}
                    </p>
                    {focusedOption.route_validation?.possible_airlines?.length ? (
                      <p>
                        Possible airlines:{" "}
                        {focusedOption.route_validation.possible_airlines.join(", ")}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-400">
                      Estimated freight model for shipment planning and simulation.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-sm font-semibold text-white">Chargeable Weight Calculation</p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                    <p>
                      Actual Weight:{" "}
                      {chargeableWeight?.actual_weight_kg ??
                        focusedOption.shipment?.weight_kg ??
                        0}{" "}
                      kg
                    </p>
                    <p>
                      Volume:{" "}
                      {chargeableWeight?.volume_cbm ??
                        focusedOption.shipment?.volume_cbm ??
                        0}{" "}
                      cbm
                    </p>
                    <p>
                      Dimensional Weight:{" "}
                      {chargeableWeight?.dimensional_weight_kg ?? "Unavailable"} kg
                    </p>
                    <p>
                      Chargeable Weight:{" "}
                      {chargeableWeight?.chargeable_weight_kg ?? "Unavailable"} kg
                    </p>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    {chargeableWeight?.calculation_note ??
                      "Chargeable weight is the greater of actual weight and dimensional weight."}
                  </p>
                </div>

                {costBreakdown && (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-sm font-semibold text-white">Cost Breakdown</p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                      <p>Pickup road: ${costBreakdown.pickup_road_cost}</p>
                      <p>Air linehaul: ${costBreakdown.air_linehaul_cost}</p>
                      <p>Origin handling: ${costBreakdown.origin_airport_handling}</p>
                      <p>Destination handling: ${costBreakdown.destination_airport_handling}</p>
                      <p>Security fee: ${costBreakdown.security_fee}</p>
                      <p>Fuel surcharge: ${costBreakdown.fuel_surcharge}</p>
                      <p>Risk surcharge: ${costBreakdown.risk_surcharge}</p>
                      <p>Insurance: ${costBreakdown.insurance_cost}</p>
                      <p>Special handling: ${costBreakdown.special_handling}</p>
                      <p>Final delivery: ${costBreakdown.final_delivery_cost}</p>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-white">
                      Total estimated cost: ${costBreakdown.total_estimated_cost_usd}
                    </p>
                  </div>
                )}

                {timeBreakdown && (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-sm font-semibold text-white">Time Breakdown</p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                      <p>Pickup road: {timeBreakdown.pickup_road_time} h</p>
                      <p>Origin processing: {timeBreakdown.airport_processing_time_origin} h</p>
                      <p>Air flight: {timeBreakdown.air_flight_time} h</p>
                      <p>Transfer: {timeBreakdown.transfer_time_if_any} h</p>
                      <p>Destination processing: {timeBreakdown.destination_airport_processing_time} h</p>
                      <p>Final delivery: {timeBreakdown.final_delivery_road_time} h</p>
                      <p>Weather delay: {timeBreakdown.weather_delay} h</p>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-white">
                      Total estimated time: {timeBreakdown.total_time_hours} h
                    </p>
                  </div>
                )}
              </section>
            )}

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

            {focusedOption?.mode === "air" && feasibility && (
              <section className="space-y-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                <div>
                  <p className="text-sm font-semibold text-white">Feasibility Warnings</p>
                  <p className="mt-2 text-sm text-amber-100">
                    {feasibility.feasible
                      ? `Feasible with confidence score ${Math.round(feasibility.confidence_score)}.`
                      : `Needs review with confidence score ${Math.round(feasibility.confidence_score)}.`}
                  </p>
                </div>
                {feasibility.warnings.length > 0 && (
                  <div className="space-y-2 text-sm text-amber-50/90">
                    {feasibility.warnings.map((warning, warningIndex) => (
                      <p
                        key={`${selectedOptionKey}-air-warning-${warningIndex}`}
                        className="rounded-xl border border-white/10 bg-slate-950/30 p-3"
                      >
                        {warning}
                      </p>
                    ))}
                  </div>
                )}
                {feasibility.blocking_issues.length > 0 && (
                  <div className="space-y-2 text-sm text-red-100">
                    {feasibility.blocking_issues.map((issue, issueIndex) => (
                      <p
                        key={`${selectedOptionKey}-air-blocker-${issueIndex}`}
                        className="rounded-xl border border-red-400/20 bg-red-400/10 p-3"
                      >
                        {issue}
                      </p>
                    ))}
                  </div>
                )}
              </section>
            )}

            {focusedOption?.mode === "air" && (
              <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-sm font-semibold text-white">Final Recommendation</p>
                <p className="mt-2 text-sm text-emerald-50/90">
                  {focusedOption.recommendation_reason}
                </p>
                <p className="mt-3 text-xs text-emerald-50/80">
                  Estimated freight model for shipment planning and simulation.
                </p>
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
