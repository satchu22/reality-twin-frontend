export type DecisionOption = {
  name: string;
  route_type: string;
  route: string;
  delay: number;
  cost: number;
  total_time: number;
  total_cost: number;
  risk: string;
  score?: number;
  explanation: string[];
  event_types: Array<"weather" | "traffic" | "satellite" | "global_event">;
  live_events_used: Array<{
    id: number;
    source: "weather" | "traffic" | "satellite" | "global_event";
    event_type: string;
    severity: "low" | "medium" | "high";
    description: string;
    confidence: number;
  }>;
};

type DecisionCardsProps = {
  options: DecisionOption[];
  bestOptionName?: string | null;
  onApproveDecision?: (option: DecisionOption) => void;
  approvalLoading?: boolean;
  approvedOptionName?: string | null;
  emptyMessage?: string;
};

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

  const bestOption = options.reduce<DecisionOption | null>((currentBest, option) => {
    if (!currentBest) {
      return option;
    }

    if (typeof option.score !== "number") {
      return currentBest;
    }

    if (
      typeof currentBest.score !== "number" ||
      option.score < currentBest.score
    ) {
      return option;
    }

    return currentBest;
  }, null);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {options.map((option) => {
        const isBest = (bestOptionName || bestOption?.name) === option.name;
        const isApproved = approvedOptionName === option.name;
        const iconMap = {
          weather: "⛈",
          traffic: "🚦",
          satellite: "🔥",
          global_event: "🌐",
        } as const;

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
              <h3 className="text-xl font-semibold capitalize text-white">
                {option.name}
              </h3>

              {isBest && (
                <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-950">
                  Best Option
                </span>
              )}
            </div>

            <div className="mt-6 space-y-3 text-sm text-slate-200">
              <div className="flex items-center justify-between rounded-2xl bg-slate-950/40 px-4 py-3">
                <span className="text-slate-400">Route Type</span>
                <span className="font-medium text-white">{option.route_type}</span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-slate-950/40 px-4 py-3">
                <span className="text-slate-400">Route</span>
                <span className="font-medium text-white">{option.route}</span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-slate-950/40 px-4 py-3">
                <span className="text-slate-400">Delay</span>
                <span className="font-medium text-white">{option.delay} days</span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-slate-950/40 px-4 py-3">
                <span className="text-slate-400">Cost</span>
                <span className="font-medium text-white">${option.cost}</span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-slate-950/40 px-4 py-3">
                <span className="text-slate-400">Total Time</span>
                <span className="font-medium text-white">{option.total_time} days</span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-slate-950/40 px-4 py-3">
                <span className="text-slate-400">Total Cost</span>
                <span className="font-medium text-white">${option.total_cost}</span>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-slate-950/40 px-4 py-3">
                <span className="text-slate-400">Risk Level</span>
                <span className="font-medium capitalize text-white">
                  {option.risk}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Explanation
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {option.event_types.map((eventType) => (
                  <span
                    key={`${option.name}-${eventType}`}
                    className="rounded-full bg-white/10 px-2 py-1 text-xs text-slate-200"
                  >
                    {iconMap[eventType]} {eventType}
                  </span>
                ))}
              </div>

              <div className="mt-3 space-y-2 text-sm text-slate-300">
                {option.explanation.map((line) => (
                  <p key={`${option.name}-${line}`}>• {line}</p>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Live Events Used
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                {option.live_events_used.length > 0 ? (
                  option.live_events_used.map((event) => (
                    <p key={`${option.name}-${event.id}`}>
                      {event.source} · {event.severity} · {event.description}
                    </p>
                  ))
                ) : (
                  <p>No live events were needed for this option.</p>
                )}
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
