import { type SimulationOption } from "@/lib/simulate";

export type DecisionOption = SimulationOption;

type DecisionCardsProps = {
  options: DecisionOption[];
  bestOptionName?: string | null;
  onApproveDecision?: (option: DecisionOption) => void;
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
  onApproveDecision,
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

        return (
          <article
            key={option.name}
            className={`rounded-3xl border p-6 shadow-lg backdrop-blur transition ${
              isBest
                ? "border-emerald-400 bg-emerald-400/10"
                : "border-white/10 bg-white/5"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold capitalize text-white">
                  {option.route_type}
                </h3>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                  {option.label ?? option.name}
                </p>
              </div>

              {isBest && (
                <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-950">
                  Best Option
                </span>
              )}
            </div>

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
                <span className="text-slate-400">Score</span>
                <span className="font-medium text-white">{option.score.toFixed(3)}</span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Why Recommended
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                {option.explanations.map((line) => (
                  <p key={`${option.name}-${line}`}>• {line}</p>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Route Chain
              </p>
              <div className="mt-3 space-y-3">
                {option.steps.map((step, index) => (
                  <div
                    key={`${option.name}-${step.mode}-${index}`}
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

            <button
              type="button"
              disabled={approvalLoading || isApproved}
              onClick={() => onApproveDecision?.(option)}
              className="mt-6 w-full rounded-2xl border border-cyan-300/20 bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
            >
              {approvalLoading
                ? "Approving..."
                : isApproved
                  ? "Approved"
                  : "Approve Decision"}
            </button>
          </article>
        );
      })}
    </div>
  );
}
