"use client";
import { useEffect } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = "pk.eyJ1IjoicGFibG8tMjIxOTkiLCJhIjoiY21uNGQ5OGtnMWx6YTJycHl0MG9rZnZoYiJ9.9ok9u8FQp5FalPtlKyJrng";

export default function MapPage() {
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-95, 37],
      zoom: 3
    });

    map.on("load", async () => {
      // 🔥 Fetch routes from backend
      const routesRes = await fetch("http://127.0.0.1:8000/routes");
      const routes = await routesRes.json();

      // 🔴 Fetch disruptions
      const disruptionRes = await fetch("http://127.0.0.1:8000/disruptions");
      const disruptions = await disruptionRes.json();

      routes.forEach((r: any, i: number) => {
        // 🔥 Check if disrupted
        const isDisrupted = disruptions.some(
          (d: any) => d.route === r.route_name
        );

        const color = isDisrupted ? "#ff0000" : "#00ffff";

        const routeData = {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [r.source, r.dest]
          }
        };

        const id = "route-" + i;

        // Add route
        map.addSource(id, {
          type: "geojson",
          data: routeData
        });

        map.addLayer({
          id: id,
          type: "line",
          source: id,
          paint: {
            "line-color": color,
            "line-width": 4
          }
        });

        // 📍 Markers
        new mapboxgl.Marker({ color })
          .setLngLat(r.source)
          .addTo(map);

        new mapboxgl.Marker({ color })
          .setLngLat(r.dest)
          .addTo(map);
      });
    });

    return () => map.remove();
  }, []);

  return (
    <div className="h-screen w-full">
      <div id="map" className="w-full h-full" />
    </div>
  );
}