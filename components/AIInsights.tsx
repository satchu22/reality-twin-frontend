"use client";

import { useState } from "react";

import { fetchAIExplanation, type AIExplainableRouteOption, type AIInsightEvent } from "@/lib/ai";

type AIInsightsProps = {
  routeOptions: AIExplainableRouteOption[];
  events: AIInsightEvent[];
};

export default function AIInsights({ routeOptions, events }: AIInsightsProps) {
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);

  async function handleLoadInsights() {
    if (loading || routeOptions.length === 0) {
      return;
    }

    setLoading(true);
    setHasAttempted(true);
    setIsUnavailable(false);

    try {
      const nextExplanation = await fetchAIExplanation(routeOptions, events);
      setExplanation(nextExplanation);
      setIsUnavailable(!nextExplanation);
    } catch (error) {
      console.error("AI insights unavailable", error);
      setExplanation("");
      setIsUnavailable(true);
    } finally {
      setLoading(false);
    }
  }

  if (routeOptions.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-violet-400/20 bg-violet-400/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-violet-200">
            AI Insights
          </p>
          <p className="mt-1 text-sm text-violet-100/80">
            Get a simple comparison of the best route, tradeoffs, and risks.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLoadInsights}
          disabled={loading}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-200/20 bg-violet-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/40 border-t-slate-950" />
          )}
          <span>{loading ? "Loading..." : "AI Insights"}</span>
        </button>
      </div>

      {loading && (
        <div className="mt-3 text-sm text-violet-100">
          Summarizing route tradeoffs...
        </div>
      )}

      {!loading && isUnavailable && (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/20 p-3 text-sm text-violet-50">
          Insights unavailable
        </div>
      )}

      {!loading && explanation && (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/20 p-4">
          <div className="space-y-3 text-sm leading-6 text-violet-50">
            {explanation.split("\n\n").map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      )}

      {!loading && !hasAttempted && (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/20 p-3 text-sm text-violet-50">
          AI is used only for explanation, not route logic.
        </div>
      )}
    </section>
  );
}
