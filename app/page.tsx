"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { buildApiUrl } from "@/lib/api";

type OverviewResponse = {
  status?: string;
  product?: string;
  active_routes?: number;
  risk_alerts?: number;
  cost_exposure?: number;
  best_action?: string;
  summary?: {
    active_simulations?: number;
    supported_modes?: string[];
    risk_signals?: string[];
    system_health?: string;
  };
};

type Overview = {
  active_routes: number;
  risk_alerts: number;
  cost_exposure: number;
  best_action: string;
  status: string;
  product: string;
  summary: {
    active_simulations: number;
    supported_modes: string[];
    risk_signals: string[];
    system_health: string;
  };
};

const DEFAULT_OVERVIEW: Overview = {
  active_routes: 0,
  risk_alerts: 0,
  cost_exposure: 0,
  best_action: "Start FastAPI to load live overview data.",
  status: "offline",
  product: "RealityTwin",
  summary: {
    active_simulations: 0,
    supported_modes: ["road", "air", "sea", "hybrid"],
    risk_signals: ["weather"],
    system_health: "local-dev",
  },
};

function normalizeOverview(data: OverviewResponse | null | undefined): Overview {
  return {
    active_routes: data?.active_routes ?? 0,
    risk_alerts: data?.risk_alerts ?? 0,
    cost_exposure: data?.cost_exposure ?? 0,
    best_action: data?.best_action ?? DEFAULT_OVERVIEW.best_action,
    status: data?.status ?? DEFAULT_OVERVIEW.status,
    product: data?.product ?? DEFAULT_OVERVIEW.product,
    summary: {
      active_simulations:
        data?.summary?.active_simulations ??
        DEFAULT_OVERVIEW.summary.active_simulations,
      supported_modes:
        data?.summary?.supported_modes ??
        DEFAULT_OVERVIEW.summary.supported_modes,
      risk_signals:
        data?.summary?.risk_signals ?? DEFAULT_OVERVIEW.summary.risk_signals,
      system_health:
        data?.summary?.system_health ?? DEFAULT_OVERVIEW.summary.system_health,
    },
  };
}

export default function RealityTwinFrontPage() {
  const [overview, setOverview] = useState<Overview>(DEFAULT_OVERVIEW);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewMessage, setOverviewMessage] = useState<string | null>(null);
  const warnedRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOverview() {
      try {
        const response = await fetch(buildApiUrl("/overview"), {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Overview request failed with status ${response.status}`);
        }

        const data = (await response.json()) as OverviewResponse;
        setOverview(normalizeOverview(data));
        setOverviewMessage(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setOverview(DEFAULT_OVERVIEW);
        setOverviewMessage(
          "Backend overview unavailable. Start FastAPI on localhost:8000.",
        );

        if (!warnedRef.current) {
          console.warn("RealityTwin overview unavailable.", error);
          warnedRef.current = true;
        }
      } finally {
        if (!controller.signal.aborted) {
          setOverviewLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_20%_80%,rgba(168,85,247,0.12),transparent_28%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-6 lg:px-8">
          <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/20 text-lg font-bold text-cyan-300">
                R
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide text-white">
                  RealityTwin
                </p>
                <p className="text-xs text-slate-400">Decision Simulation OS</p>
              </div>
            </div>
            <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
              <a href="#product" className="transition hover:text-white">
                Product
              </a>
              <a href="#how-it-works" className="transition hover:text-white">
                How it works
              </a>
              <a href="#use-cases" className="transition hover:text-white">
                Use cases
              </a>
              <a href="#contact" className="transition hover:text-white">
                Contact
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <button className="hidden rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10 md:block">
                Book demo
              </button>
              <button className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
                Join waitlist
              </button>
            </div>
          </header>

          <div className="grid items-center gap-14 py-20 lg:grid-cols-2 lg:py-28">
            <div>
              <div className="mb-5 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-medium text-cyan-200">
                Predict disruptions before they cost millions
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Rehearse reality before your business acts in it.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                RealityTwin turns live operational data into a simulation layer
                for logistics, manufacturing, infrastructure, and energy teams
                so they can test decisions, compare outcomes, and choose the best
                move before disruptions hit the real world.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/dashboard">
                  <button className="rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                    Dashboard
                  </button>
                </Link>
                <Link href="/map">
                  <button className="rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                    Open Map
                  </button>
                </Link>
                <Link href="/simulate">
                  <button className="rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950">
                    Simulate Route
                  </button>
                </Link>
                <Link href="/upload">
                  <button className="rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                    Upload CSV / Destination
                  </button>
                </Link>
              </div>
              <div className="mt-10 grid max-w-xl grid-cols-3 gap-4 text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-2xl font-semibold text-white">10x</div>
                  <div className="mt-1 text-slate-400">
                    faster scenario analysis
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-2xl font-semibold text-white">24/7</div>
                  <div className="mt-1 text-slate-400">risk monitoring</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-2xl font-semibold text-white">$M+</div>
                  <div className="mt-1 text-slate-400">
                    costly mistakes avoided
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 rounded-[2rem] bg-cyan-400/10 blur-3xl" />
              <div className="relative rounded-[2rem] border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-cyan-500/10 backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-300">
                      World State Overview
                    </p>
                    <p className="text-xs text-slate-500">
                      {overviewLoading
                        ? "Loading local overview"
                        : `${overview.product} · ${overview.summary.system_health}`}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-300">
                    {overviewLoading ? "Loading" : "Live"}
                  </span>
                </div>

                {overviewMessage && (
                  <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                    {overviewMessage}
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="text-xs text-slate-400">Active routes</p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {overviewLoading ? "..." : overview.active_routes}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="text-xs text-slate-400">Risk alerts</p>
                      <p className="mt-2 text-2xl font-semibold text-amber-300">
                        {overviewLoading ? "..." : overview.risk_alerts}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="text-xs text-slate-400">Cost exposure</p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {overviewLoading
                          ? "..."
                          : `$${overview.cost_exposure}`}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="text-xs text-slate-400">Best action saved</p>
                      <p className="mt-2 text-sm font-semibold text-cyan-300">
                        {overviewLoading ? "..." : overview.best_action}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
                      Simulation query
                    </p>
                    <p className="mt-3 text-sm text-white">
                      What happens if the Port of Oakland closes for 48 hours?
                    </p>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-xl bg-slate-950/60 p-3">
                        <p className="text-xs text-slate-400">
                          Predicted impact
                        </p>
                        <p className="mt-1 text-sm text-white">
                          {overviewMessage
                            ? "The homepage is using a safe local fallback until the backend overview endpoint is available."
                            : "Latest shipping activity and operational exposure are now pulled from your live backend."}
                        </p>
                      </div>
                      <div className="rounded-xl bg-emerald-400/10 p-3">
                        <p className="text-xs text-emerald-300">
                          Recommended action
                        </p>
                        <p className="mt-1 text-sm text-white">
                          {overviewLoading ? "..." : overview.best_action}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="product" className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Ingest your world",
              desc: "Connect ERP, sensor, route, weather, and operational data into one live system state.",
            },
            {
              title: "Simulate what-if scenarios",
              desc: "Ask natural-language questions and instantly see delays, cost exposure, and downstream impact.",
            },
            {
              title: "Decide with confidence",
              desc: "Get ranked recommendations, confidence scores, and a clear path to approve the best action.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <div className="mb-4 h-12 w-12 rounded-2xl bg-cyan-400/10" />
              <h3 className="text-xl font-semibold text-white">{item.title}</h3>
              <p className="mt-3 leading-7 text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="how-it-works"
        className="mx-auto max-w-7xl px-6 py-14 lg:px-8"
      >
        <div className="mb-10 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
            From raw operational data to the best next action.
          </h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-4">
          {[
            "Connect live data sources and historical records.",
            "Build a living model of routes, assets, and dependencies.",
            "Run simulations on disruptions, failures, and demand shifts.",
            "Approve the recommended action and improve future predictions.",
          ].map((step, index) => (
            <div
              key={step}
              className="rounded-3xl border border-white/10 bg-slate-900/70 p-6"
            >
              <div className="mb-5 text-sm font-semibold text-cyan-300">
                0{index + 1}
              </div>
              <p className="text-base leading-7 text-slate-200">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="use-cases" className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Use cases
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
                Built for teams where one bad decision gets expensive fast.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                "Logistics & supply chain",
                "Manufacturing operations",
                "Energy & grid resilience",
                "Smart infrastructure & cities",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 text-slate-200"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="contact"
        className="mx-auto max-w-5xl px-6 py-16 text-center lg:px-8"
      >
        <div className="rounded-[2rem] border border-cyan-400/20 bg-cyan-400/10 p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
            Start with one scenario
          </p>
          <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
            See what your business should do before disruption hits.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            Book a demo to map one real-world decision, simulate the impact, and
            see how RealityTwin can reduce operational risk.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <button className="rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
              Request demo
            </button>
            <button className="rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              Download overview
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
