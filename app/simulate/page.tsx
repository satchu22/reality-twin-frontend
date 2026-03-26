"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SimulatePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    try {
      setLoading(true);

      const res = await fetch("http://localhost:8000/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query || "Run disruption simulation",
        }),
      });

      if (!res.ok) {
        throw new Error("Simulation failed");
      }

      const data = await res.json();

      // 🔥 KEEP UI RESULT
      setResult(data);

      // 🔥 STORE FOR MAP
      localStorage.setItem("simulation", JSON.stringify(data));

      // 🔥 OPTIONAL: trigger homepage refresh signal
      localStorage.setItem("last_simulation_time", Date.now().toString());

    } catch (error) {
      console.error("Simulation error:", error);
      alert("Simulation failed. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const handleShowMap = () => {
    if (result) {
      localStorage.setItem("simulation", JSON.stringify(result));
    }
    router.push("/map");
  };

  const affectedRoutesCount =
    (result?.impact?.high_risk?.length || 0) +
    (result?.impact?.medium_risk?.length || 0);

  const allImpactedRoutes = [
    ...(result?.impact?.high_risk || []),
    ...(result?.impact?.medium_risk || []),
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold mb-6">Simulation Engine</h1>

        <div className="flex gap-3 mb-8">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What happens if a major route is disrupted?"
            className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none"
          />
          <button
            onClick={handleSimulate}
            disabled={loading}
            className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-60"
          >
            {loading ? "Running..." : "Run Simulation"}
          </button>
        </div>

        {result?.error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
            {result.error}
          </div>
        )}

        {result?.impact && (
          <div className="space-y-8">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Impact Summary</h2>
                <button
                  onClick={handleShowMap}
                  className="rounded-xl bg-emerald-400 px-4 py-2 font-semibold text-slate-950"
                >
                  Show in Map
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-xl bg-white/5 p-4">
                  <p className="text-sm text-slate-400">Affected Routes</p>
                  <p className="mt-2 text-2xl font-bold">{affectedRoutesCount}</p>
                </div>

                <div className="rounded-xl bg-white/5 p-4">
                  <p className="text-sm text-slate-400">Avg Delay</p>
                  <p className="mt-2 text-2xl font-bold">
                    {result.impact.avg_delay_days} days
                  </p>
                </div>

                <div className="rounded-xl bg-white/5 p-4">
                  <p className="text-sm text-slate-400">Total Cost</p>
                  <p className="mt-2 text-2xl font-bold">
                    ${result.impact.total_cost}
                  </p>
                </div>

                <div className="rounded-xl bg-white/5 p-4">
                  <p className="text-sm text-slate-400">Best Option</p>
                  <p className="mt-2 text-base font-bold">
                    {result.best_option?.name || "N/A"}
                  </p>
                </div>
              </div>

              {allImpactedRoutes.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-sm text-slate-400">Impacted Route Names</p>

                  <div className="flex flex-wrap gap-2">
                    {allImpactedRoutes.map((route: string, idx: number) => {
                      const isHigh = result.impact.high_risk?.includes(route);

                      return (
                        <span
                          key={idx}
                          className={`rounded-full px-3 py-1 text-sm border ${
                            isHigh
                              ? "border-red-400/30 bg-red-400/10 text-red-300"
                              : "border-yellow-400/30 bg-yellow-400/10 text-yellow-300"
                          }`}
                        >
                          {route}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
              <h2 className="mb-4 text-xl font-semibold">Decision Options</h2>

              <div className="grid gap-4 md:grid-cols-3">
                {result.options?.map((option: any, idx: number) => {
                  const isBest = result.best_option?.name === option.name;

                  return (
                    <div
                      key={idx}
                      className={`rounded-2xl border p-5 ${
                        isBest
                          ? "border-cyan-400 bg-cyan-400/10"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{option.name}</h3>
                        {isBest && (
                          <span className="rounded-full bg-cyan-400 px-2 py-1 text-xs font-semibold text-slate-950">
                            Best
                          </span>
                        )}
                      </div>

                      <div className="mt-4 space-y-2 text-sm">
                        <p>⏱ Delay: {option.delay} days</p>
                        <p>💰 Cost: ${option.cost}</p>
                        <p>⚠️ Risk: {option.risk}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {result.best_option && (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-emerald-300">
                      Recommended Decision
                    </h2>
                    <p className="mt-3 text-white">
                      Best option:{" "}
                      <span className="font-semibold">{result.best_option.name}</span>
                    </p>
                    <p className="mt-2 text-slate-300">
                      This option balances delay, cost, and operational risk better
                      than the alternatives.
                    </p>
                  </div>

                  <button
                    onClick={handleShowMap}
                    className="rounded-xl bg-emerald-400 px-4 py-2 font-semibold text-slate-950"
                  >
                    Show in Map
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}