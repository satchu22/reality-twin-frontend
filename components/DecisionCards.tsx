import { type SimulationOption } from "@/lib/simulate";

export type DecisionOption = SimulationOption;

type DecisionCardsProps = {
  options: DecisionOption[];
  bestOptionName?: string | null;
  selectedOptionName?: string | null;
  onSelectOption?: (option: DecisionOption) => void;
  onApproveDecision?: (option: DecisionOption) => void;
  onViewOption?: (option: DecisionOption) => void;
  approvalLoading?: boolean;
  approvedOptionName?: string | null;
  emptyMessage?: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatHours(value: number) {
  const days = value / 24;
  return `${value.toFixed(1)} h (${days.toFixed(1)} d)`;
}

export default function DecisionCards({
  options,
  bestOptionName,
  selectedOptionName = null,
  onSelectOption,
  onApproveDecision,
  onViewOption,
  approvalLoading = false,
  approvedOptionName = null,
  emptyMessage = "No decision options available.",
}: DecisionCardsProps) {
  if (options.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
      <div className="grid gap-4 xl:grid-cols-3">
      {options.map((option) => {
        const isBest = (bestOptionName || options[0]?.name) === option.name;
        const isApproved = approvedOptionName === option.name;
        const isSelected = selectedOptionName === option.name;
        const optionKey = option.id ?? option.name;

        return (
          <article
            key={optionKey}
            role="button"
            tabIndex={0}
            onClick={() => onSelectOption?.(option)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectOption?.(option);
              }
            }}
            className={`cursor-pointer rounded-3xl border p-6 shadow-lg backdrop-blur transition ${
              isSelected
                ? "border-cyan-300 bg-cyan-400/10"
                : isBest
                ? "border-emerald-400 bg-emerald-400/10"
                : "border-white/10 bg-white/5"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-white">{option.name}</h3>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                  {option.mode}
                </p>
              </div>

              {isBest && (
                <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-950">
                  Best Option
                </span>
              )}
            </div>

            {isSelected && (
              <div className="mt-3">
                <span className="rounded-full border border-cyan-300/40 bg-cyan-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-100">
                  Selected Route
                </span>
              </div>
            )}

            <div className="mt-6 space-y-3 text-sm text-slate-200">
              <div className="flex items-center justify-between rounded-2xl bg-slate-950/40 px-4 py-3">
                <span className="text-slate-400">Total Time</span>
                <span className="font-medium text-white">
                  {formatHours(option.total_time_hours)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-slate-950/40 px-4 py-3">
                <span className="text-slate-400">Total Cost</span>
                <span className="font-medium text-white">
                  {formatCurrency(option.total_cost_usd)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-slate-950/40 px-4 py-3">
                <span className="text-slate-400">Risk Level</span>
                <span className="font-medium capitalize text-white">
                  {option.risk_level}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-slate-950/40 px-4 py-3">
                <span className="text-slate-400">Risk Score</span>
                <span className="font-medium text-white">{option.risk_score}</span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-slate-950/40 px-4 py-3">
                <span className="text-slate-400">Weather Risk</span>
                <span className="font-medium capitalize text-white">
                  {option.weather_risk?.risk_level ?? "unknown"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-slate-950/40 px-4 py-3">
                <span className="text-slate-400">Weather Delay</span>
                <span className="font-medium text-white">
                  +{(option.weather_risk?.delay_hours ?? 0).toFixed(1)} h
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Why Recommended
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <p>{option.recommendation_reason}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Weather Summary
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <p>{option.weather_risk?.summary ?? "Forecast-based estimate unavailable."}</p>
              </div>
            </div>

            {option.mode === "air" && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Air Freight Detail
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <p>
                    {option.selected_origin_airport ?? "Origin airport"} (
                    {option.selected_origin_airport_name ?? "Unknown"})
                    {" -> "}
                    {option.selected_destination_airport ?? "Destination airport"} (
                    {option.selected_destination_airport_name ?? "Unknown"})
                  </p>
                  <p>
                    Airport pair:{" "}
                    {option.selected_origin_airport ?? "Origin"} →{" "}
                    {option.selected_destination_airport ?? "Destination"}
                  </p>
                  <p className="capitalize">
                    Service level: {option.shipment?.service_level ?? "standard"}
                  </p>
                  <p className="capitalize">
                    Goods type:{" "}
                    {option.shipment?.commodity_type ??
                      option.shipment_assumptions?.commodity_type ??
                      "general"}
                  </p>
                  <p>
                    Actual weight:{" "}
                    {option.chargeable_weight?.actual_weight_kg ??
                      option.shipment_assumptions?.actual_weight_kg ??
                      option.shipment?.weight_kg ??
                      "Unavailable"}{" "}
                    kg
                  </p>
                  <p>
                    Volume:{" "}
                    {option.chargeable_weight?.volume_cbm ??
                      option.shipment?.volume_cbm ??
                      option.shipment_assumptions?.volume_cbm ??
                      "Unavailable"}{" "}
                    cbm
                  </p>
                  <p>
                    Chargeable weight:{" "}
                    {option.chargeable_weight?.chargeable_weight_kg ??
                      option.shipment_assumptions?.chargeable_weight_kg ??
                      "Unavailable"}{" "}
                    kg
                  </p>
                  <p>
                    Route possibility: {option.route_possibility ?? option.air_route_validation ?? "estimated_air_pair"}
                  </p>
                  {option.route_validation && (
                    <p>
                      Validation: {option.route_validation.source} ·{" "}
                      {option.route_validation.direct_route_known ? "direct" : `${option.route_validation.stops} stop`}
                    </p>
                  )}
                  {option.route_validation?.possible_airlines?.length ? (
                    <p>
                      Possible airlines:{" "}
                      {option.route_validation.possible_airlines.slice(0, 3).join(", ")}
                    </p>
                  ) : null}
                  <p>
                    Feasibility:{" "}
                    {option.feasibility?.feasible ? "Feasible" : "Needs review"} ·
                    Confidence{" "}
                    {Math.round(
                      option.confidence_score ??
                        option.feasibility?.confidence_score ??
                        0,
                    )}
                  </p>
                  <p>
                    Stops: {option.stops ?? 0} · Handling:{" "}
                    {option.airport_handling_cost !== undefined
                      ? formatCurrency(option.airport_handling_cost)
                      : "Included in total"}
                  </p>
                  <p className="text-xs text-slate-400">
                    Estimated freight model for shipment planning and simulation.
                  </p>
                </div>
              </div>
            )}

            {option.shipment_assumptions && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Shipment Assumptions
                </p>
                <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  <p>{option.shipment_assumptions.goods_description}</p>
                  <p className="capitalize">
                    Priority: {option.shipment_assumptions.priority}
                  </p>
                  <p>{option.shipment_assumptions.weight_kg} kg</p>
                  <p>{option.shipment_assumptions.volume_cbm} cbm</p>
                  <p>{option.shipment_assumptions.pieces} pieces</p>
                  <p>{option.shipment_assumptions.pallet_count} pallets</p>
                  <p>${option.shipment_assumptions.declared_value_usd} declared</p>
                  <p className="capitalize">
                    Service: {option.shipment_assumptions.service_level}
                  </p>
                  <p>
                    Chargeable: {option.shipment_assumptions.chargeable_weight_kg} kg
                  </p>
                  <p>
                    Capacity use:{" "}
                    {(option.shipment_assumptions.capacity_utilization_estimate * 100).toFixed(0)}%
                  </p>
                  <p>
                    Temp: {option.shipment_assumptions.temperature_controlled ? "Yes" : "No"}
                  </p>
                  <p>Fragile: {option.shipment_assumptions.fragile ? "Yes" : "No"}</p>
                  <p>Hazardous: {option.shipment_assumptions.hazardous ? "Yes" : "No"}</p>
                  <p>
                    Insurance: {option.shipment_assumptions.insurance_required ? "Yes" : "No"}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Route Chain
              </p>
              <div className="mt-3 space-y-3">
                {option.legs.map((step, index) => (
                  <div
                    key={`${optionKey}-leg-${index}-${step.mode}`}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold capitalize text-white">
                        {step.mode}
                      </span>
                      <span className="text-xs text-slate-400">
                        {step.distance_km.toFixed(1)} km
                      </span>
                    </div>
                    <p className="mt-2 text-slate-200">
                      {step.from} → {step.to}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{step.purpose}</p>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span>{step.time_hours.toFixed(1)} h</span>
                      <span>{formatCurrency(step.cost_usd)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onViewOption?.(option);
                }}
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                View On Map
              </button>

              <button
                type="button"
                disabled={approvalLoading || isApproved}
                onClick={(event) => {
                  event.stopPropagation();
                  onApproveDecision?.(option);
                }}
                className="w-full rounded-2xl border border-cyan-300/20 bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
              >
                {approvalLoading
                  ? "Approving..."
                  : isApproved
                    ? "Approved"
                    : "Approve Decision"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
