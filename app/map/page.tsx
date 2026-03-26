"use client";
import { useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken =
  "pk.eyJ1IjoicGFibG8tMjIxOTkiLCJhIjoiY21uNGQ5OGtnMWx6YTJycHl0MG9rZnZoYiJ9.9ok9u8FQp5FalPtlKyJrng";

export default function MapPage() {
  const [selectedRoute, setSelectedRoute] = useState<any>(null);

  const normalize = (str: string) =>
    str?.replace(/→|->/g, "").trim().toLowerCase();

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-95, 37],
      zoom: 3,
    });

    map.on("load", async () => {

      // 🔥 MANUAL ROUTE SUPPORT (ONLY ADDITION)
      const manual = localStorage.getItem("manual_route");

      if (manual) {
        const parsed = JSON.parse(manual);

        const getRoute = async (start: number[], end: number[]) => {
          try {
            const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&overview=full&steps=true&access_token=${mapboxgl.accessToken}`;

            const res = await fetch(url);
            const data = await res.json();

            if (!data.routes || data.routes.length === 0) {
              return [start, end];
            }

            return data.routes[0].geometry.coordinates;

          } catch (err) {
            console.error("Route error:", err);
            return [start, end];
          }
        };

        const coords = await getRoute(parsed.source, parsed.dest);

        map.addSource("manual-route", {
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
          id: "manual-layer",
          type: "line",
          source: "manual-route",
          paint: {
            "line-color": "#00ff00",
            "line-width": 6,
          },
        });

        new mapboxgl.Marker({ color: "#00ff00" })
          .setLngLat(parsed.source)
          .addTo(map);

        new mapboxgl.Marker({ color: "#00ff00" })
          .setLngLat(parsed.dest)
          .addTo(map);

        map.flyTo({
          center: parsed.source,
          zoom: 5,
        });

        localStorage.removeItem("manual_route");

        return; // 🔥 STOP original logic
      }

      let highRisk: string[] = [];
      let mediumRisk: string[] = [];
      let bestOption: string | null = null;

      try {
        const simulation = localStorage.getItem("simulation");
        if (simulation && simulation !== "undefined") {
          const parsed = JSON.parse(simulation);
          highRisk = parsed?.impact?.high_risk || [];
          mediumRisk = parsed?.impact?.medium_risk || [];
          bestOption = parsed?.best_option?.name || null;
        }
      } catch (e) {
        console.error(e);
      }

      const selectedBatch = localStorage.getItem("selected_batch");

      const routesRes = await fetch(
        selectedBatch
          ? `http://localhost:8000/batch-data?batch_id=${selectedBatch}`
          : "http://localhost:8000/routes"
      );

      const routes = await routesRes.json();

      const getRoute = async (start: number[], end: number[]) => {
        try {
          const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&overview=full&steps=true&access_token=${mapboxgl.accessToken}`;

          const res = await fetch(url);
          const data = await res.json();

          if (!data.routes || data.routes.length === 0) {
            return [start, end];
          }

          return data.routes[0].geometry.coordinates;

        } catch (err) {
          console.error("Route error:", err);
          return [start, end];
        }
      };

      const features = [];

      for (const r of routes) {
        const name = normalize(r.route_name || r.route);

        const isHigh = highRisk.map(normalize).includes(name);
        const isMedium = mediumRisk.map(normalize).includes(name);
        const isBest = bestOption
          ? normalize(bestOption).includes(name)
          : false;

        let color = "#00ffff";

        if (isBest) color = "#00ff00";
        else if (isHigh) color = "#ff0000";
        else if (isMedium) color = "#ffff00";

        const routeCoords = await getRoute(r.source, r.dest);

        features.push({
          type: "Feature",
          properties: {
            route_name: r.route_name || r.route,
            color: color,
          },
          geometry: {
            type: "LineString",
            coordinates: routeCoords,
          },
        });
      }

      const geojson = {
        type: "FeatureCollection",
        features,
      };

      map.addSource("routes", {
        type: "geojson",
        data: geojson,
      });

      map.addLayer({
        id: "routes-layer",
        type: "line",
        source: "routes",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 8,
          "line-opacity": 0.9,
        },
      });

      map.addLayer({
        id: "routes-layer-highlight",
        type: "line",
        source: "routes",
        paint: {
          "line-color": "#ffff00",
          "line-width": 10,
          "line-opacity": 1,
        },
        filter: ["==", ["get", "route_name"], ""],
      });

      map.on("mouseenter", "routes-layer", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "routes-layer", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "routes-layer", async (e) => {
        const feature = e.features?.[0];
        if (!feature) return;

        const routeName = feature.properties?.route_name;
        if (!routeName) return;

        map.setPaintProperty("routes-layer", "line-opacity", 0.3);

        map.setFilter("routes-layer-highlight", [
          "==",
          ["get", "route_name"],
          routeName,
        ]);

        const res = await fetch(
          `http://localhost:8000/route-details?route_name=${encodeURIComponent(routeName)}`
        );

        const data = await res.json();
        setSelectedRoute(data);
      });

      routes.forEach((r: any) => {
        const name = normalize(r.route_name || r.route);

        const isHigh = highRisk.map(normalize).includes(name);
        const isMedium = mediumRisk.map(normalize).includes(name);
        const isBest = bestOption
          ? normalize(bestOption).includes(name)
          : false;

        let markerColor = "#00ffff";

        if (isBest) markerColor = "#00ff00";
        else if (isHigh) markerColor = "#ff0000";
        else if (isMedium) markerColor = "#ffff00";

        new mapboxgl.Marker({ color: markerColor })
          .setLngLat(r.source)
          .addTo(map);

        new mapboxgl.Marker({ color: markerColor })
          .setLngLat(r.dest)
          .addTo(map);
      });
    });

    return () => map.remove();
  }, []);

  return (
    <div className="h-screen w-full relative">
      <div id="map" className="w-full h-full" />

      {selectedRoute && (
        <div className="absolute right-0 top-0 w-80 h-full bg-black text-white p-4 shadow-lg">
          <h2 className="text-xl font-bold mb-2">
            {selectedRoute.route}
          </h2>

          <p>⏱ Delay: {selectedRoute.delay} days</p>
          <p>💰 Cost Impact: ${selectedRoute.cost}</p>
          <p>⚠️ Risk: {selectedRoute.risk}</p>

          <p className="mt-2 text-sm text-gray-300">
            {selectedRoute.reason}
          </p>

          <h3 className="mt-4 font-semibold">Options:</h3>
          <ul className="mt-2 space-y-1">
            {Array.isArray(selectedRoute.recommendations) &&
              selectedRoute.recommendations.map((rec: string, i: number) => (
                <li key={i}>👉 {rec}</li>
              ))}
          </ul>

          <button
            onClick={() => setSelectedRoute(null)}
            className="mt-4 bg-red-500 px-3 py-1 rounded"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}