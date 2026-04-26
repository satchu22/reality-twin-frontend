"use client";

import AIInsights from "@/components/AIInsights";
import DecisionCards, { type DecisionOption } from "@/components/DecisionCards";

export type SelectedRoute = {
  routeId: number;
  name: string;
  distance: number | null;
  status: "best" | "high risk" | "medium risk" | "normal";
};

type RoutePanelProps = {
  route: SelectedRoute | null;
  isOpen: boolean;
  simulationLoading: boolean;
  approvalLoading: boolean;
  simulationError: string | null;
  confirmationMessage: string | null;
  decisionOptions: DecisionOption[];
  detectedEvents: DecisionOption["live_events_used"];
  bestOptionName: string | null;
  approvedOptionName: string | null;
  onClose: () => void;
  onSimulate: () => void;
  onApprove: (option: DecisionOption) => void;
};

export default function RoutePanel({
  route,
  isOpen,
  simulationLoading,
  approvalLoading,
  simulationError,
  confirmationMessage,
  decisionOptions,
  detectedEvents,
  bestOptionName,
  approvedOptionName,
  onClose,
  onSimulate,
  onApprove,
}: RoutePanelProps) {
  if (!route || !isOpen) {
    return null;
  }

  return (
    <aside className="fixed right-0 top-0 z-10 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-slate-950/95 p-6 text-white shadow-2xl backdrop-blur md:w-96">
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

      <div className="mt-8 space-y-4">
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
      </div>

      <div className="mt-auto pt-8">
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
            {simulationLoading ? "Running simulation..." : "Simulate Disruption"}
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
              {bestOptionName ? `Best option: ${bestOptionName}` : "Run a simulation to compare options."}
            </p>
          </div>

          <AIInsights
            routeOptions={decisionOptions}
            events={detectedEvents}
          />

          <DecisionCards
            options={decisionOptions}
            bestOptionName={bestOptionName}
            onApproveDecision={onApprove}
            approvalLoading={approvalLoading}
            approvedOptionName={approvedOptionName}
            emptyMessage="No simulation results yet. Select this route and run a disruption simulation."
          />
        </div>
      </div>
    </aside>
  );
}
