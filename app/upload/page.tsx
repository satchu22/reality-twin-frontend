"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import UploadComponent from "@/components/UploadComponent";
import { geocodeLocationName, getMapboxToken } from "@/lib/mapbox";

type StoredLocation = {
  name: string;
  lat: number;
  lng: number;
  latitude: number;
  longitude: number;
};

export default function UploadPage() {
  const router = useRouter();
  const [originName, setOriginName] = useState("");
  const [destinationName, setDestinationName] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualMessage, setManualMessage] = useState<string | null>(null);

  function clearManualRouteSession() {
    if (typeof window === "undefined") {
      return;
    }

    sessionStorage.removeItem("routeOptions");
    sessionStorage.removeItem("routeSimulation");
    sessionStorage.removeItem("origin");
    sessionStorage.removeItem("destination");
    sessionStorage.setItem("routeMode", "batch");
  }

  async function handleGenerateRoute() {
    console.log("Generate clicked");

    if (!originName.trim() || !destinationName.trim()) {
      setManualError("Enter both an origin and destination.");
      setManualMessage(null);
      return;
    }

    if (!getMapboxToken()) {
      setManualError(
        "Mapbox token missing. Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to .env.local.",
      );
      setManualMessage(null);
      return;
    }

    setManualLoading(true);
    setManualError(null);
    setManualMessage("Converting location names to coordinates...");

    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("routeOptions");
        sessionStorage.removeItem("routeSimulation");
        sessionStorage.removeItem("origin");
        sessionStorage.removeItem("destination");
        sessionStorage.setItem("routeMode", "manual");
        window.localStorage.removeItem("selected_batch");
      }

      const [origin, destination] = await Promise.all([
        geocodeLocationName(originName.trim()),
        geocodeLocationName(destinationName.trim()),
      ]);

      const originCoords: StoredLocation = {
        name: origin.name,
        lat: origin.latitude,
        lng: origin.longitude,
        latitude: origin.latitude,
        longitude: origin.longitude,
      };

      const destCoords: StoredLocation = {
        name: destination.name,
        lat: destination.latitude,
        lng: destination.longitude,
        latitude: destination.latitude,
        longitude: destination.longitude,
      };

      console.log("Origin coords:", originCoords);
      console.log("Destination coords:", destCoords);

      setManualMessage("Saving route context...");

      sessionStorage.setItem("origin", JSON.stringify(originCoords));
      sessionStorage.setItem("destination", JSON.stringify(destCoords));

      console.log("Saved to sessionStorage");

      setManualMessage("Opening map...");
      router.push("/map");
    } catch (error) {
      console.error("Generate route failed", error);
      setManualError(
        error instanceof Error
          ? error.message
          : "Simulation failed. Please try again.",
      );
      setManualMessage(null);
    } finally {
      setManualLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-semibold">Upload CSV / Destination</h1>
          <p className="mt-2 text-slate-400">
            Upload a CSV or generate a route from two location names.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <UploadComponent onUploadSuccess={clearManualRouteSession} />

          <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white">
                Manual Entry
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Enter place names and RealityTwin will geocode them before opening
                the map.
              </p>
            </div>

            <div className="space-y-4">
              <input
                placeholder="Origin Name"
                value={originName}
                onChange={(event) => setOriginName(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-slate-200"
              />

              <input
                placeholder="Destination Name"
                value={destinationName}
                onChange={(event) => setDestinationName(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-slate-200"
              />

              {manualMessage && (
                <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
                  {manualMessage}
                </p>
              )}

              {manualError && (
                <p className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
                  {manualError}
                </p>
              )}

              <button
                type="button"
                onClick={handleGenerateRoute}
                disabled={manualLoading}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {manualLoading && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/40 border-t-slate-950" />
                )}
                <span>
                  {manualLoading ? "Generating..." : "Generate Simulation"}
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
