"use client";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    fetch("http://localhost:8000/batches")
      .then(res => res.json())
      .then(setBatches);
  }, []);

  const loadBatch = async (batchId: number) => {
    const res = await fetch(
      `http://localhost:8000/batch-data?batch_id=${batchId}`
    );
    const result = await res.json();

    setSelectedBatch(batchId);
    setData(result);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white px-6 py-12">
      <div className="mx-auto max-w-7xl">

        {/* 🔥 HEADER */}
        <div className="mb-10">
          <h1 className="text-4xl font-semibold">
            Shipment History Dashboard
          </h1>
          <p className="text-slate-400 mt-2">
            Explore uploaded datasets and track shipment history across batches.
          </p>
        </div>

        {/* 🔥 DATASETS */}
        <div className="mb-12">
          <h2 className="text-xl mb-4 text-slate-300">Datasets</h2>

          <div className="grid md:grid-cols-3 gap-5">
            {batches.map((b) => (
              <div
                key={b.batch_id}
                onClick={() => loadBatch(b.batch_id)}
                className={`rounded-3xl border p-6 cursor-pointer transition-all ${
                  selectedBatch === b.batch_id
                    ? "border-cyan-400 bg-cyan-400/10 shadow-lg"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <p className="text-lg font-semibold">
                  Batch #{b.batch_id}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {b.total_shipments} shipments
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 🔥 SHIPMENT TABLE */}
        {selectedBatch && (
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur shadow-xl">

            <h2 className="text-xl font-semibold mb-6">
              Batch {selectedBatch} Shipments
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">

                <thead>
                  <tr className="text-left text-slate-400 border-b border-white/10">
                    <th className="p-4">Route</th>
                    <th className="p-4">Cost</th>
                    <th className="p-4">Distance</th>
                    <th className="p-4">Source</th>
                    <th className="p-4">Destination</th>
                  </tr>
                </thead>

                <tbody>
                  {data.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-white/5 hover:bg-white/5 transition"
                    >
                      <td className="p-4 font-medium text-white">
                        {row.route}
                      </td>

                      <td className="p-4 text-green-300">
                        ${row.cost}
                      </td>

                      <td className="p-4 text-cyan-300">
                        {row.distance} km
                      </td>

                      <td className="p-4 text-slate-300">
                        {row.source[1]}, {row.source[0]}
                      </td>

                      <td className="p-4 text-slate-300">
                        {row.dest[1]}, {row.dest[0]}
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}