"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken =
  "pk.eyJ1IjoicGFibG8tMjIxOTkiLCJhIjoiY21uNGQ5OGtnMWx6YTJycHl0MG9rZnZoYiJ9.9ok9u8FQp5FalPtlKyJrng";

export default function UploadPage() {
  const router = useRouter();

  const mapRef = useRef<mapboxgl.Map | null>(null); // 🔥 NEW

  const [mode, setMode] = useState<"file" | "manual">("file");

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [source, setSource] = useState("");
  const [dest, setDest] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [previewRoute, setPreviewRoute] = useState<any>(null);

  // CSV UPLOAD
  const handleUpload = async () => {
    if (!file) {
      setError("Please select a CSV file first");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      setMessage("Upload successful 🚀");

      setTimeout(() => {
        router.push("/dashboard");
      }, 1200);
    } catch (err) {
      console.error(err);
      setError("Upload failed. Check backend.");
    } finally {
      setLoading(false);
    }
  };

  // MANUAL ROUTE
  const handleManual = async () => {
    if (!source || !dest) {
      setError("Please enter both source and destination");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/manual-route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source, dest }),
      });

      if (!res.ok) throw new Error("Manual route failed");

      const data = await res.json();

      setPreviewRoute(data);
      setMessage("Route preview ready 🚀");
    } catch (err) {
      console.error(err);
      setError("Failed to create route");
    } finally {
      setLoading(false);
    }
  };

  // 🔥 FINAL MAP FIX
  useEffect(() => {
    if (!previewRoute) return;

    const container = document.getElementById("preview-map");
    if (!container) return;

    // 🔥 remove old map instance
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = new mapboxgl.Map({
      container: container,
      style: "mapbox://styles/mapbox/dark-v11",
      center: previewRoute.source,
      zoom: 4,
    });

    mapRef.current = map;

    map.on("load", async () => {
      map.resize(); // 🔥 critical

      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${previewRoute.source[0]},${previewRoute.source[1]};${previewRoute.dest[0]},${previewRoute.dest[1]}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;

      const res = await fetch(url);
      const data = await res.json();

      const coords =
        data.routes?.[0]?.geometry?.coordinates ||
        [previewRoute.source, previewRoute.dest];

      map.addSource("preview", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: coords,
          },
        },
      });

      map.addLayer({
        id: "preview-line",
        type: "line",
        source: "preview",
        paint: {
          "line-color": "#00ff00",
          "line-width": 5,
        },
      });

      new mapboxgl.Marker({ color: "#00ff00" })
        .setLngLat(previewRoute.source)
        .addTo(map);

      new mapboxgl.Marker({ color: "#00ff00" })
        .setLngLat(previewRoute.dest)
        .addTo(map);
    });

    return () => {
      map.remove();
    };
  }, [previewRoute]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-2xl">

        <div className="mb-8 text-center">
          <h1 className="text-4xl font-semibold">Data Input</h1>
          <p className="text-slate-400 mt-2">
            Upload bulk data or create routes manually
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl">

          <div className="flex justify-center mb-6">
            <div className="flex w-full max-w-md bg-white/5 rounded-lg overflow-hidden">
              <button
                onClick={() => setMode("file")}
                className={`flex-1 py-2 text-sm font-semibold ${
                  mode === "file"
                    ? "bg-cyan-400 text-black"
                    : "text-slate-300"
                }`}
              >
                Upload CSV
              </button>

              <button
                onClick={() => setMode("manual")}
                className={`flex-1 py-2 text-sm font-semibold ${
                  mode === "manual"
                    ? "bg-cyan-400 text-black"
                    : "text-slate-300"
                }`}
              >
                Manual Entry
              </button>
            </div>
          </div>

          {mode === "file" && (
            <div className="mb-6">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full rounded-xl bg-slate-900 p-3"
              />
            </div>
          )}

          {mode === "manual" && (
            <div className="space-y-4 mb-6">
              <input
                placeholder="Source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-xl bg-slate-900 p-3"
              />

              <input
                placeholder="Destination"
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                className="w-full rounded-xl bg-slate-900 p-3"
              />
            </div>
          )}

          {message && <div className="mb-4 text-emerald-400">{message}</div>}
          {error && <div className="mb-4 text-red-400">{error}</div>}

          <div className="flex gap-4">
            <button
              onClick={mode === "file" ? handleUpload : handleManual}
              disabled={loading}
              className="flex-1 rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-black hover:bg-cyan-300 transition"
            >
              {loading ? "Processing..." : "Create Route"}
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="flex-1 rounded-xl border border-white/20 px-6 py-3 font-semibold hover:bg-white/10"
            >
              View History
            </button>
          </div>
        </div>

        {previewRoute && (
          <div className="mt-10">
            <h2 className="text-lg mb-4 text-slate-300 text-center">
              Route Preview
            </h2>

            <div className="flex justify-center">
              <div
                id="preview-map"
                className="w-full max-w-3xl h-[400px] rounded-2xl border border-white/10 overflow-hidden"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}