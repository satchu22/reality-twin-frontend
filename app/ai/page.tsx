"use client";

import { useMemo, useState } from "react";

import { type SimulationOption } from "@/lib/simulate";

function generateInsight(routes: SimulationOption[]) {
  if (routes.length === 0) {
    return null;
  }

  const bestRoute = [...routes].sort((left, right) => {
    const leftScore =
      (typeof left.score === "number" ? left.score : left.total_cost + left.total_time) ??
      Number.POSITIVE_INFINITY;
    const rightScore =
      (typeof right.score === "number" ? right.score : right.total_cost + right.total_time) ??
      Number.POSITIVE_INFINITY;

    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    return (left.total_cost + left.total_time) - (right.total_cost + right.total_time);
  })[0];

  return {
    bestRoute,
    explanation:
      `${bestRoute.route_type} route is recommended because it balances cost and time while avoiding high-risk conditions.`,
    comparison: routes.map((route) => ({
      name: route.route_type,
      totalTime: route.total_time,
      totalCost: route.total_cost,
      risk: route.risk,
    })),
  };
}

export default function AIPage() {
  const [routeOptions] = useState<SimulationOption[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      return JSON.parse(sessionStorage.getItem("routeOptions") ?? "[]") as SimulationOption[];
    } catch {
      return [];
    }
  });

  const insight = useMemo(() => generateInsight(routeOptions), [routeOptions]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <section>
          <h1 className="text-4xl font-semibold">AI Insights</h1>
          <p className="mt-2 text-slate-400">
            Simple route analysis based on your latest simulation results.
          </p>
        </section>

        {!insight ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm text-slate-300">
              No simulation data available. Please generate a route first.
            </div>
          </section>
        ) : (
          <section className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">
                Best Route
              </p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {insight.bestRoute.route_type}
              </p>
              <p className="mt-2 text-sm text-emerald-50">
                {insight.bestRoute.route}
              </p>
            </div>

            <div className="rounded-2xl border border-violet-400/20 bg-violet-400/10 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-violet-200">
                Explanation
              </p>
              <p className="mt-3 text-sm leading-7 text-violet-50">
                {insight.explanation}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Comparison
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {insight.comparison.map((route) => (
                  <article
                    key={route.name}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <p className="text-lg font-semibold text-white">{route.name}</p>
                    <p className="mt-3 text-sm text-slate-300">
                      Time: {route.totalTime} days
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      Cost: ${route.totalCost}
                    </p>
                    <p className="mt-1 text-sm capitalize text-slate-300">
                      Risk: {route.risk}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
