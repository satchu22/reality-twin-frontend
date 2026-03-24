"use client";
import { useState } from "react";

export default function SimulatePage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);

  const handleSimulate = () => {
    setResult({
      delay: "3 days",
      cost: "$120,000",
      recommendation: "Reroute via Los Angeles to reduce delay by 40%"
    });
  };

  return (
    <div className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl font-bold mb-6">Simulation Engine</h1>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="What if a port closes?"
        className="w-full p-4 rounded-xl bg-gray-900 border border-gray-700"
      />

      <button
        onClick={handleSimulate}
        className="mt-4 px-6 py-3 bg-cyan-400 text-black rounded-xl"
      >
        Run Simulation
      </button>

      {result && (
        <div className="mt-8 p-6 bg-gray-900 rounded-xl">
          <p>Delay: {result.delay}</p>
          <p>Cost Impact: {result.cost}</p>
          <p className="mt-2 text-cyan-300">
            Recommendation: {result.recommendation}
          </p>
        </div>
      )}
    </div>
  );
}