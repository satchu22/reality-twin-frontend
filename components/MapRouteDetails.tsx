"use client";

import { type SimulationOption } from "@/lib/simulate";

type MapRouteDetailsProps = {
  routes: SimulationOption[];
  bestRouteName?: string | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatHours(value: number) {
  return `${value.toFixed(1)} h / ${(value / 24).toFixed(1)} d`;
}

export default function MapRouteDetails({
  routes,
  bestRouteName = null,
}: MapRouteDetailsProps) {
  if (routes.length === 0) {
    return null;
  }

  const fallbackBestRoute = routes.reduce<SimulationOption | null>((best, route) => {
    if (!best) {
      return route;
    }

    return route.score < best.score ? route : best;
  }, null);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur">
      <p className="font-semibold text-white">Route Details</p>
      <div className="mt-3 space-y-3">
        {routes.slice(0, 3).map((route) => {
          const isBest = (bestRouteName || fallbackBestRoute?.name) === route.name;

          return (
            <article
              key={route.name}
              className={`rounded-2xl border px-4 py-3 transition ${
                isBest
                  ? "border-emerald-400/50 bg-emerald-400/10"
                  : "border-white/10 bg-slate-950/40"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold capitalize text-white">{route.route_type}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    {route.name}
                  </p>
                </div>
                {isBest && (
                  <span className="rounded-full bg-emerald-400 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-950">
                    Best Route
                  </span>
                )}
              </div>

                <div className="mt-3 grid gap-2 text-xs text-slate-300">
                  <div className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2">
                  <span>total_time_hours</span>
                  <span className="font-medium text-white">
                    {formatHours(route.total_time_hours)}
                  </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2">
                  <span>total_cost_usd</span>
                  <span className="font-medium text-white">
                    {formatCurrency(route.total_cost_usd)}
                  </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2">
                  <span>risk_level</span>
                  <span className="font-medium capitalize text-white">{route.risk_level}</span>
                  </div>
                </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
