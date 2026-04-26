"use client";

import { useEffect, useState } from "react";

import { buildApiUrl } from "@/lib/api";

type Batch = {
  batch_id: number;
  total_shipments: number;
  created_at: string;
};

type BatchRow = {
  route: string;
  cost: number;
  distance: number;
};

type RouteHistoryItem = {
  id: string;
  created_at: string;
  origin: string;
  destination: string;
  selected_option: string;
  total_time: number;
  total_cost: number;
  risk: "low" | "medium" | "high" | string;
};

export default function HistoryPage() {
  const [history] = useState<RouteHistoryItem[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      return JSON.parse(sessionStorage.getItem("routeHistory") ?? "[]") as RouteHistoryItem[];
    } catch {
      return [];
    }
  });
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [data, setData] = useState<BatchRow[]>([]);

  useEffect(() => {
    fetch(buildApiUrl("/batches"))
      .then((res) => res.json())
      .then(setBatches)
      .catch(() => setBatches([]));
  }, []);

  async function loadBatch(batchId: number) {
    const res = await fetch(buildApiUrl(`/batch-data?batch_id=${batchId}`));
    const result = await res.json();
    setSelectedBatch(batchId);
    setData(result);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl space-y-10">
        <section>
          <h1 className="text-4xl font-semibold">View History</h1>
          <p className="mt-2 text-slate-400">
            Review past route simulations and uploaded shipment datasets.
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white">Past Route Simulations</h2>
            <p className="mt-2 text-sm text-slate-400">
              Recent manual route generations saved from this browser session.
            </p>
          </div>

          {history.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
              No route simulations saved yet.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {history.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 p-5"
                >
                  <p className="text-sm text-cyan-300">
                    {item.origin} → {item.destination}
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {item.selected_option}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm text-slate-300">
                    <div>
                      <p className="text-slate-500">Time</p>
                      <p>{item.total_time} days</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Cost</p>
                      <p>${item.total_cost}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Risk</p>
                      <p className="capitalize">{item.risk}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white">Uploaded Dataset History</h2>
            <p className="mt-2 text-sm text-slate-400">
              Existing backend batch history remains available here.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {batches.map((batch) => (
              <button
                key={batch.batch_id}
                type="button"
                onClick={() => loadBatch(batch.batch_id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  selectedBatch === batch.batch_id
                    ? "border-cyan-400 bg-cyan-400/10"
                    : "border-white/10 bg-slate-950/40 hover:bg-white/10"
                }`}
              >
                <p className="font-semibold text-white">Batch #{batch.batch_id}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {batch.total_shipments} shipments
                </p>
              </button>
            ))}
          </div>

          {selectedBatch && (
            <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/60 text-slate-400">
                  <tr>
                    <th className="p-4">Route</th>
                    <th className="p-4">Cost</th>
                    <th className="p-4">Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, index) => (
                    <tr key={`${row.route}-${index}`} className="border-t border-white/10">
                      <td className="p-4 text-white">{row.route}</td>
                      <td className="p-4 text-slate-300">${row.cost}</td>
                      <td className="p-4 text-slate-300">{row.distance} km</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
