"use client";
import { useEffect, useState } from "react";

export default function HistoryPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
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
    const data = await res.json();

    setSelectedBatch(batchId);
    setData(data);
  };

  return (
    <div className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl font-bold mb-6">
        Shipment History
      </h1>

      {/* BATCH LIST */}
      <div className="mb-10">
        <h2 className="text-xl mb-4">Datasets</h2>

        <div className="grid grid-cols-3 gap-4">
          {batches.map((b) => (
            <div
              key={b.batch_id}
              onClick={() => loadBatch(b.batch_id)}
              className="bg-gray-800 p-4 rounded cursor-pointer hover:bg-gray-700"
            >
              <p>Batch #{b.batch_id}</p>
              <p>{b.total_shipments} shipments</p>
            </div>
          ))}
        </div>
      </div>

      {/* DATA VIEW */}
      {selectedBatch && (
        <div>
          <h2 className="text-xl mb-4">
            Batch {selectedBatch} Details
          </h2>

          <table className="w-full border border-gray-700">
            <thead>
              <tr className="bg-gray-800">
                <th className="p-2">Route</th>
                <th className="p-2">Cost</th>
                <th className="p-2">Distance</th>
              </tr>
            </thead>

            <tbody>
              {data.map((d, i) => (
                <tr key={i} className="border-t border-gray-700">
                  <td className="p-2">{d.route}</td>
                  <td className="p-2">${d.cost}</td>
                  <td className="p-2">{d.distance} km</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}