"use client";

import { FormEvent, useEffect, useState } from "react";

import AIInsights from "@/components/AIInsights";
import DecisionCards, { type DecisionOption } from "@/components/DecisionCards";
import { useRealtime } from "@/components/RealtimeProvider";
import {
  approveSimulationDecision,
  type DisruptionType,
  type SimulationResponse,
  simulateRoute,
} from "@/lib/simulate";

const disruptionOptions: DisruptionType[] = [
  "port_closure",
  "weather",
  "congestion",
  "breakdown",
];

export default function SimulatePage() {
  const { latestSimulationUpdate } = useRealtime();
  const [prompt, setPrompt] = useState("");
  const [routeId, setRouteId] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [disruptionType, setDisruptionType] =
    useState<DisruptionType>("weather");
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvedOptionName, setApprovedOptionName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const detectedEvents = result
    ? Array.from(
        new Map(
          result.options
            .flatMap((option) => option.live_events_used)
            .map((event) => [event.id, event]),
        ).values(),
      )
    : [];

  async function runSimulation(
    nextRouteId: string,
    nextDistanceKm: string,
    nextDisruptionType: DisruptionType,
  ) {
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);
    setApprovedOptionName(null);

    try {
      const simulationResult = await simulateRoute({
        route_id: nextRouteId,
        distance_km: Number(nextDistanceKm),
        disruption_type: nextDisruptionType,
      });

      console.log("Simulation response", simulationResult);
      setResult(simulationResult);
      if (!simulationResult.options || simulationResult.options.length === 0) {
        setError("Simulation completed but returned no decision options.");
      }
    } catch (simulationError) {
      console.error("Simulation page request failed", simulationError);
      setResult(null);
      setError(
        simulationError instanceof Error
          ? simulationError.message
          : "Simulation failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveDecision(option: DecisionOption) {
    if (approvalLoading || !routeId) {
      return;
    }

    setApprovalLoading(true);
    setError(null);

    try {
      const approvalResult = await approveSimulationDecision(routeId, option.name);
      console.log("Approved option", option.name);
      console.log("Approval response", approvalResult);
      setApprovedOptionName(option.name);
    } catch (approvalError) {
      setError(
        approvalError instanceof Error
          ? approvalError.message
          : "Decision approval failed",
      );
    } finally {
      setApprovalLoading(false);
    }
  }

  async function handleSimulate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSimulation(routeId, distanceKm, disruptionType);
  }

  function parsePrompt(value: string) {
    const normalizedPrompt = value.toLowerCase();
    const routeMatch = normalizedPrompt.match(/route\s+([a-z0-9-]+)/i);

    let parsedDisruptionType: DisruptionType = "weather";

    if (
      normalizedPrompt.includes("port closure") ||
      normalizedPrompt.includes("port_closure")
    ) {
      parsedDisruptionType = "port_closure";
    } else if (normalizedPrompt.includes("congestion")) {
      parsedDisruptionType = "congestion";
    } else if (normalizedPrompt.includes("breakdown")) {
      parsedDisruptionType = "breakdown";
    } else if (normalizedPrompt.includes("weather")) {
      parsedDisruptionType = "weather";
    }

    return {
      routeId: routeMatch ? routeMatch[1] : "",
      disruptionType: parsedDisruptionType,
    };
  }

  async function handlePromptSimulation() {
    if (loading) {
      return;
    }

    const parsed = parsePrompt(prompt);

    if (!parsed.routeId) {
      setError("Could not extract a route_id from the prompt.");
      setResult(null);
      return;
    }

    if (!distanceKm) {
      setError("Enter a distance before running prompt-based simulation.");
      setResult(null);
      return;
    }

    setRouteId(parsed.routeId);
    setDisruptionType(parsed.disruptionType);
    await runSimulation(parsed.routeId, distanceKm, parsed.disruptionType);
  }

  useEffect(() => {
    if (
      !latestSimulationUpdate?.route_id ||
      String(latestSimulationUpdate.route_id) !== routeId
    ) {
      return;
    }

    if (latestSimulationUpdate.options && latestSimulationUpdate.best_option) {
      setResult({
        route: latestSimulationUpdate.route ?? routeId,
        total_time: latestSimulationUpdate.options[0]?.total_time ?? 0,
        total_cost: latestSimulationUpdate.options[0]?.total_cost ?? 0,
        risk: latestSimulationUpdate.risk ?? "medium",
        explanation: latestSimulationUpdate.explanation ?? [],
        options: latestSimulationUpdate.options,
        best_option: latestSimulationUpdate.best_option,
      });
    }

    if (latestSimulationUpdate.approved_option) {
      setApprovedOptionName(latestSimulationUpdate.approved_option);
    }
  }, [latestSimulationUpdate, routeId]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-3xl font-bold">Simulation Engine</h1>

        <div className="mb-6 rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <p className="text-sm font-medium text-slate-300">Natural Language Input</p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder='What if route 3 is disrupted by weather?'
              className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
            />
            <button
              type="button"
              onClick={handlePromptSimulation}
              disabled={loading}
              className="rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-60"
            >
              {loading ? "Running..." : "Parse & Simulate"}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Extracts `route_id` and `disruption_type` from the prompt and uses the
            distance value below for the API call.
          </p>
        </div>

        <form
          onSubmit={handleSimulate}
          className="rounded-2xl border border-white/10 bg-slate-900/70 p-6"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Route ID</span>
              <input
                value={routeId}
                onChange={(event) => setRouteId(event.target.value)}
                placeholder="RT-001"
                required
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-slate-300">Distance (km)</span>
              <input
                value={distanceKm}
                onChange={(event) => setDistanceKm(event.target.value)}
                type="number"
                min="0"
                step="0.01"
                placeholder="7000"
                required
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-slate-300">Disruption Type</span>
              <select
                value={disruptionType}
                onChange={(event) =>
                  setDisruptionType(event.target.value as DisruptionType)
                }
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
              >
                {disruptionOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-60"
            >
              {loading ? "Running..." : "Run Simulation"}
            </button>

            {error && (
              <p className="text-sm text-red-300" role="alert">
                {error}
              </p>
            )}
          </div>
        </form>

        {result && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/70 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Decision Options</h2>
              <p className="text-sm text-slate-300">
                Best option:{" "}
                <span className="font-semibold text-white">{result.best_option}</span>
              </p>
            </div>

            <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <p className="font-medium text-white">{result.route}</p>
              <p className="mt-2">
                Total time: {result.total_time} days · Total cost: ${result.total_cost} · Risk:{" "}
                <span className="capitalize">{result.risk}</span>
              </p>
              <div className="mt-3 space-y-2">
                {result.explanation.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>

            <DecisionCards
              options={result.options ?? []}
              bestOptionName={result.best_option}
              onApproveDecision={handleApproveDecision}
              approvalLoading={approvalLoading}
              approvedOptionName={approvedOptionName}
              emptyMessage="Simulation completed but returned no decision options."
            />

            <div className="mt-6">
              <AIInsights
                routeOptions={result.options ?? []}
                events={detectedEvents}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
