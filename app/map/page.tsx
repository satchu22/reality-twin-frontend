"use client";

import { Suspense, useEffect, useEffectEvent, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { type DecisionOption } from "@/components/DecisionCards";
import MapRouteDetails from "@/components/MapRouteDetails";
import { useRealtime } from "@/components/RealtimeProvider";
import RoutePanel, { type SelectedRoute } from "@/components/RoutePanel";
import { fetchEvents, type LiveEvent } from "@/lib/events";
import { getMapboxToken } from "@/lib/mapbox";
import { fetchRoutes, type RouteRecord } from "@/lib/routes";
import {
  approveSimulationDecision,
  simulateRoute,
  type SimulationResponse,
  type SimulationOption,
} from "@/lib/simulate";

const mapboxToken = getMapboxToken();

if (mapboxToken) {
  mapboxgl.accessToken = mapboxToken;
}

type RouteStatus = SelectedRoute["status"];

type RouteFeature = Omit<GeoJSON.Feature<GeoJSON.LineString>, "properties"> & {
  properties: {
    route_id: number;
    route_name: string;
    distance: number | null;
    color: string;
    status: RouteStatus;
  };
};

type RouteFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.LineString> & {
  features: RouteFeature[];
};

type DecisionOverlay = {
  layerIds: string[];
  sourceIds: string[];
  markers: mapboxgl.Marker[];
  option: SimulationOption;
  baseWidth: number;
};

type StoredLocation = {
  name: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
};

const EMPTY_FEATURE_COLLECTION: RouteFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const DECISION_ROUTE_STYLES = [
  { color: "#22c55e", width: 6, label: "Best Route" },
  { color: "#facc15", width: 4, label: "Alternative" },
  { color: "#ef4444", width: 3, label: "High Risk" },
] as const;

function routeModeColor(mode: "road" | "air" | "sea" | "handling") {
  if (mode === "road") {
    return "#3b82f6";
  }
  if (mode === "air") {
    return "#22d3ee";
  }
  if (mode === "sea") {
    return "#14b8a6";
  }
  return "#e2e8f0";
}

function parseRouteDistance(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseQueryCoordinate(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getStoredLatitude(location: StoredLocation | null): number | null {
  if (!location) {
    return null;
  }

  const value = location.latitude ?? location.lat;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStoredLongitude(location: StoredLocation | null): number | null {
  if (!location) {
    return null;
  }

  const value = location.longitude ?? location.lng;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function eventColor(source: LiveEvent["source"]) {
  return {
    weather: "#3b82f6",
    traffic: "#f97316",
    satellite: "#ef4444",
    global_event: "#a855f7",
  }[source];
}

function buildLineStringFeature(coordinates: [number, number][]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates,
    },
  };
}

async function getRouteGeometry(
  start: [number, number],
  end: [number, number],
): Promise<[number, number][]> {
  if (!mapboxToken) {
    return [start, end];
  }

  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&overview=full&steps=true&access_token=${mapboxToken}`;
    const response = await fetch(url);
    const result = await response.json();
    return result.routes?.[0]?.geometry?.coordinates ?? [start, end];
  } catch (error) {
    console.error("Route geometry error:", error);
    return [start, end];
  }
}

function parseStoredItem<T>(key: string): T | null {
  const rawValue = sessionStorage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.error(`Failed to parse ${key} from sessionStorage`, error);
    return null;
  }
}

function getStepEndpoints(step: SimulationOption["steps"][number]) {
  if (!Array.isArray(step.geometry) || step.geometry.length < 2) {
    return null;
  }

  const start = step.geometry[0];
  const end = step.geometry[step.geometry.length - 1];
  return [start, end] as [[number, number], [number, number]];
}

async function buildRouteFeatureCollection(
  batchId?: number | null,
): Promise<RouteFeatureCollection> {
  const routes = await fetchRoutes(batchId);
  if (routes.length === 0) {
    return EMPTY_FEATURE_COLLECTION;
  }

  const features: RouteFeature[] = await Promise.all(
    routes.map(async (route: RouteRecord) => {
      const routeName = route.route_name ?? route.route ?? `Route ${route.route_id}`;
      const distance = parseRouteDistance(route.distance);
      const coordinates = await getRouteGeometry(route.source, route.dest);

      return {
        type: "Feature",
        properties: {
          route_id: route.route_id,
          route_name: routeName,
          distance,
          color: "#22d3ee",
          status: "normal",
        },
        geometry: {
          type: "LineString",
          coordinates,
        },
      };
    }),
  );

  return {
    type: "FeatureCollection",
    features,
  };
}

function MapPageContent() {
  const searchParams = useSearchParams();
  const { isPollingFallback, latestRouteUpdate, latestSimulationUpdate, pollTick } =
    useRealtime();
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const eventMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const routesDataRef = useRef<RouteFeatureCollection>(EMPTY_FEATURE_COLLECTION);
  const manualMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const decisionPopupRef = useRef<mapboxgl.Popup | null>(null);
  const decisionOverlaysRef = useRef<DecisionOverlay[]>([]);

  const [selectedRoute, setSelectedRoute] = useState<SelectedRoute | null>(null);
  const [isRoutePanelOpen, setIsRoutePanelOpen] = useState(false);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [simulationResult, setSimulationResult] =
    useState<SimulationResponse | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [approvedOptionName, setApprovedOptionName] = useState<string | null>(null);
  const [storedOrigin, setStoredOrigin] = useState<StoredLocation | null>(null);
  const [storedDestination, setStoredDestination] = useState<StoredLocation | null>(null);

  const queryOriginLat = parseQueryCoordinate(searchParams.get("origin_lat"));
  const queryOriginLng = parseQueryCoordinate(searchParams.get("origin_lng"));
  const queryDestLat = parseQueryCoordinate(searchParams.get("dest_lat"));
  const queryDestLng = parseQueryCoordinate(searchParams.get("dest_lng"));
  const queryOriginName = searchParams.get("origin_name");
  const queryDestName = searchParams.get("dest_name");
  const originLat = queryOriginLat ?? getStoredLatitude(storedOrigin);
  const originLng = queryOriginLng ?? getStoredLongitude(storedOrigin);
  const destLat = queryDestLat ?? getStoredLatitude(storedDestination);
  const destLng = queryDestLng ?? getStoredLongitude(storedDestination);
  const originName = queryOriginName ?? storedOrigin?.name ?? null;
  const destName = queryDestName ?? storedDestination?.name ?? null;
  const hasManualRoute =
    originLat !== null &&
    originLng !== null &&
    destLat !== null &&
    destLng !== null;
  const detectedEvents = simulationResult
    ? Array.from(
        new Map(
          simulationResult.options
            .flatMap((option) => option.live_events_used)
            .map((event) => [event.id, event]),
        ).values(),
      )
    : [];

  useEffect(() => {
    const parsedRoutes = parseStoredItem<SimulationOption[]>("routeOptions");
    const parsedOrigin = parseStoredItem<StoredLocation>("origin");
    const parsedDestination = parseStoredItem<StoredLocation>("destination");
    const parsedSimulation = parseStoredItem<SimulationResponse>("routeSimulation");

    console.log("Loaded origin:", parsedOrigin);
    console.log("Loaded destination:", parsedDestination);
    console.log("Loaded routes:", parsedRoutes);
    console.log("Map loaded route data", {
      origin: parsedOrigin,
      destination: parsedDestination,
      routes: parsedRoutes,
    });

    if (parsedOrigin) {
      setStoredOrigin(parsedOrigin);
    }

    if (parsedDestination) {
      setStoredDestination(parsedDestination);
    }

    if (parsedSimulation) {
      if (Array.isArray(parsedSimulation.options) && parsedSimulation.options.length > 0) {
        setSimulationResult(parsedSimulation);
        console.log("Routes loaded in map", parsedSimulation.options);
        return;
      }
    }

    if (parsedRoutes) {
      console.log("Routes loaded in map", parsedRoutes);

      if (!Array.isArray(parsedRoutes) || parsedRoutes.length === 0) {
        return;
      }

      const bestOption = [...parsedRoutes].sort(
        (left, right) => (left.score ?? Number.POSITIVE_INFINITY) - (right.score ?? Number.POSITIVE_INFINITY),
      )[0];

      setSimulationResult({
        route:
          parsedOrigin && parsedDestination
            ? `${parsedOrigin.name} → ${parsedDestination.name}`
            : bestOption?.route ?? "Generated routes",
        total_time: bestOption?.total_time ?? 0,
        total_cost: bestOption?.total_cost ?? 0,
        risk: bestOption?.risk ?? "medium",
        explanation: bestOption?.explanation ?? [],
        options: parsedRoutes,
        best_option: bestOption?.name ?? "",
      });
    }
  }, []);

  function clearRerouteLayer() {
    const rerouteSource = mapRef.current?.getSource("reroute-route") as
      | mapboxgl.GeoJSONSource
      | undefined;
    rerouteSource?.setData(EMPTY_FEATURE_COLLECTION);
  }

  function resetSelectionVisuals() {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (map.getLayer("routes-layer")) {
      map.setPaintProperty("routes-layer", "line-opacity", 0.9);
    }

    if (map.getLayer("routes-layer-highlight")) {
      map.setFilter("routes-layer-highlight", ["==", ["get", "route_name"], ""]);
    }
  }

  function updateRoutesSource(featureCollection: RouteFeatureCollection) {
    routesDataRef.current = featureCollection;
    const source = mapRef.current?.getSource("routes") as
      | mapboxgl.GeoJSONSource
      | undefined;
    source?.setData(featureCollection);
  }

  function clearEventMarkers() {
    for (const marker of eventMarkersRef.current) {
      marker.remove();
    }
    eventMarkersRef.current = [];
  }

  function clearManualMarkers() {
    for (const marker of manualMarkersRef.current) {
      marker.remove();
    }
    manualMarkersRef.current = [];
  }

  function removeDecisionRouteOverlays() {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    decisionPopupRef.current?.remove();
    decisionPopupRef.current = null;

    for (const overlay of decisionOverlaysRef.current) {
      for (const marker of overlay.markers) {
        marker.remove();
      }
      for (const layerId of overlay.layerIds) {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      }
      for (const sourceId of overlay.sourceIds) {
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      }
    }

    decisionOverlaysRef.current = [];
  }

  function updateEventsSource(events: LiveEvent[]) {
    setLiveEvents(events);

    const map = mapRef.current;
    if (!map) {
      return;
    }

    const source = map.getSource("live-events") as mapboxgl.GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: events.map((event) => ({
        type: "Feature" as const,
        properties: {
          id: event.id,
          source: event.source,
          severity: event.severity,
          description: event.description,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [event.lng, event.lat],
        },
      })),
    });

    clearEventMarkers();
    eventMarkersRef.current = events.map((event) => {
      const element = document.createElement("div");
      element.className =
        "h-4 w-4 rounded-full border-2 border-white shadow-lg ring-4 ring-white/10";
      element.style.backgroundColor = eventColor(event.source);
      element.title = `${event.source}: ${event.description}`;

      return new mapboxgl.Marker({ element })
        .setLngLat([event.lng, event.lat])
        .addTo(map);
    });
  }

  function applyDecisionRouteSelection(optionName: string | null) {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    for (const overlay of decisionOverlaysRef.current) {
      for (const layerId of overlay.layerIds) {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(
            layerId,
            "line-width",
            optionName === overlay.option.name ? overlay.baseWidth + 2 : overlay.baseWidth,
          );
          map.setPaintProperty(
            layerId,
            "line-opacity",
            optionName && optionName !== overlay.option.name ? 0.45 : 0.85,
          );
        }
      }
    }
  }

  const drawDecisionRouteOverlays = useEffectEvent(async (options: SimulationOption[]) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    console.log("Drawing overlays", options);

    removeDecisionRouteOverlays();

    if (options.length === 0) {
      return;
    }

    const sortedOptions = [...options].sort((left, right) => {
      const leftScore = typeof left.score === "number" ? left.score : Number.POSITIVE_INFINITY;
      const rightScore = typeof right.score === "number" ? right.score : Number.POSITIVE_INFINITY;
      return leftScore - rightScore;
    });

    const overlays: DecisionOverlay[] = [];
    const bounds = new mapboxgl.LngLatBounds();

    for (const [index, option] of sortedOptions.slice(0, 3).entries()) {
      const style =
        DECISION_ROUTE_STYLES[index] ?? DECISION_ROUTE_STYLES[DECISION_ROUTE_STYLES.length - 1];
      const layerIds: string[] = [];
      const sourceIds: string[] = [];
      const markers: mapboxgl.Marker[] = [];

      const stepGeometries = await Promise.all(
        option.steps.map(async (step) => {
          if (step.mode === "handling") {
            return null;
          }

          const endpoints = getStepEndpoints(step);
          if (!endpoints) {
            return null;
          }

          if (step.mode === "road") {
            return getRouteGeometry(endpoints[0], endpoints[1]);
          }

          return step.geometry;
        }),
      );

      option.steps.forEach((step, stepIndex) => {
        if (step.mode === "handling") {
          const endpoints = getStepEndpoints(step);
          if (!endpoints) {
            return;
          }

          const element = document.createElement("div");
          element.className = "h-3 w-3 rounded-full border border-white shadow";
          element.style.backgroundColor = style.color;

          const marker = new mapboxgl.Marker({ element })
            .setLngLat(endpoints[0])
            .setPopup(
              new mapboxgl.Popup({ offset: 16 }).setHTML(
                `<div style="min-width: 180px; color: #0f172a;">
                  <div style="font-weight: 700; margin-bottom: 6px;">Handling Hub</div>
                  <div style="font-size: 12px;">${step.from}</div>
                  <div style="margin-top: 6px; font-size: 12px; color: #334155;">${step.purpose}</div>
                </div>`,
              ),
            )
            .addTo(map);
          markers.push(marker);
          bounds.extend(endpoints[0]);
          return;
        }

        const geometry = stepGeometries[stepIndex];
        if (!geometry || geometry.length < 2) {
          return;
        }

        const sourceId = `decision-route-${index}-${stepIndex}`;
        const layerId = `${sourceId}-line`;

        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }

        map.addSource(sourceId, {
          type: "geojson",
          data: buildLineStringFeature(geometry),
        });

        map.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": routeModeColor(step.mode),
            "line-width": style.width,
            "line-opacity": 0.85,
            ...(step.mode === "air"
              ? { "line-dasharray": [2, 2] }
              : step.mode === "sea"
                ? { "line-dasharray": [3, 2] }
                : {}),
          },
        });

        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
        });

        map.on("click", layerId, (event) => {
          applyDecisionRouteSelection(option.name);

          const popupCoordinate =
            event.lngLat ??
            new mapboxgl.LngLat(
              geometry[Math.floor(geometry.length / 2)][0],
              geometry[Math.floor(geometry.length / 2)][1],
            );

          decisionPopupRef.current?.remove();
          decisionPopupRef.current = new mapboxgl.Popup({ offset: 18 })
            .setLngLat(popupCoordinate)
            .setHTML(
              `
                <div style="min-width: 240px; color: #0f172a;">
                  <div style="font-weight: 700; margin-bottom: 8px; text-transform: capitalize;">${option.route_type}</div>
                  <div>Total Time: ${option.total_time_hours.toFixed(1)} hours</div>
                  <div>Total Cost: $${option.total_cost_usd}</div>
                  <div>Risk: ${option.risk_level}</div>
                  <div style="margin-top: 8px; font-size: 12px;">${step.from} → ${step.to}</div>
                  <div style="margin-top: 4px; font-size: 12px; color: #334155;">${step.purpose}</div>
                </div>
              `,
            )
            .addTo(map);
        });

        for (const coordinate of geometry) {
          bounds.extend(coordinate);
        }
        sourceIds.push(sourceId);
        layerIds.push(layerId);
      });

      overlays.push({
        layerIds,
        sourceIds,
        markers,
        option,
        baseWidth: style.width,
      });
    }

    decisionOverlaysRef.current = overlays;
    applyDecisionRouteSelection(sortedOptions[0]?.name ?? null);

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 80, maxZoom: 8 });
    }
  });

  const loadRoutes = useEffectEvent(async () => {
    setRoutesLoading(true);
    setRoutesError(null);

    try {
      const selectedBatch = window.localStorage.getItem("selected_batch");
      const parsedBatchId = selectedBatch ? Number(selectedBatch) : null;
      const featureCollection = await buildRouteFeatureCollection(
        Number.isFinite(parsedBatchId) ? parsedBatchId : null,
      );
      updateRoutesSource(featureCollection);
    } catch (routeError) {
      setRoutesError(
        routeError instanceof Error ? routeError.message : "Failed to load routes",
      );
      updateRoutesSource(EMPTY_FEATURE_COLLECTION);
    } finally {
      setRoutesLoading(false);
    }
  });

  const loadEvents = useEffectEvent(async () => {
    try {
      const events = await fetchEvents();
      updateEventsSource(events);
    } catch (eventError) {
      console.error("Failed to load live events", eventError);
    }
  });

  const loadManualRouteOverlay = useEffectEvent(async () => {
    const map = mapRef.current;
    if (!map || !hasManualRoute) {
      return;
    }

    const origin: [number, number] = [originLng as number, originLat as number];
    const destination: [number, number] = [destLng as number, destLat as number];
    const coordinates = await getRouteGeometry(origin, destination);
    const routeSource = map.getSource("manual-route") as mapboxgl.GeoJSONSource | undefined;

    routeSource?.setData({
      type: "Feature",
      properties: {
        route_name: `${originName ?? "Origin"}-${destName ?? "Destination"}`,
      },
      geometry: {
        type: "LineString",
        coordinates,
      },
    });

    clearManualMarkers();

    manualMarkersRef.current = [
      new mapboxgl.Marker({ color: "#22c55e" })
        .setLngLat(origin)
        .setPopup(new mapboxgl.Popup({ offset: 20 }).setText(originName ?? "Origin"))
        .addTo(map),
      new mapboxgl.Marker({ color: "#ef4444" })
        .setLngLat(destination)
        .setPopup(new mapboxgl.Popup({ offset: 20 }).setText(destName ?? "Destination"))
        .addTo(map),
    ];

    if (!simulationResult?.options?.length) {
      map.fitBounds([origin, destination], { padding: 80, maxZoom: 8 });
    }
  });

  useEffect(() => {
    if (!mapboxToken) {
      console.warn("Map disabled. Please configure Mapbox token.");
      setRoutesLoading(false);
      return;
    }
const container = document.getElementById("map");
if (!container) return;

if (container.childNodes.length > 0) return;

if (typeof window === "undefined") return;

if (!mapboxgl.supported()) {
  console.error("WebGL not supported");
  return;
}

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

const map = new mapboxgl.Map({
  container: container,
  style: "mapbox://styles/mapbox/dark-v11",
  center: [-95, 37],
  zoom: 3,
});

    mapRef.current = map;

    map.on("load", () => {
      map.addSource("routes", {
        type: "geojson",
        data: EMPTY_FEATURE_COLLECTION,
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
          "line-color": "#facc15",
          "line-width": 10,
          "line-opacity": 1,
        },
        filter: ["==", ["get", "route_name"], ""],
      });

      map.addSource("reroute-route", {
        type: "geojson",
        data: EMPTY_FEATURE_COLLECTION,
      });

      map.addLayer({
        id: "reroute-route-layer",
        type: "line",
        source: "reroute-route",
        paint: {
          "line-color": "#f59e0b",
          "line-width": 5,
          "line-dasharray": [2, 2],
          "line-opacity": 0.95,
        },
      });

      map.addSource("live-events", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addSource("manual-route", {
        type: "geojson",
        data: EMPTY_FEATURE_COLLECTION,
      });

      map.addLayer({
        id: "live-events-layer",
        type: "circle",
        source: "live-events",
        paint: {
          "circle-radius": [
            "match",
            ["get", "severity"],
            "high",
            30,
            "medium",
            22,
            16,
          ],
          "circle-color": [
            "match",
            ["get", "source"],
            "weather",
            "#3b82f6",
            "traffic",
            "#f97316",
            "satellite",
            "#ef4444",
            "#a855f7",
          ],
          "circle-opacity": 0.18,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "manual-route-layer",
        type: "line",
        source: "manual-route",
        paint: {
          "line-color": "#3b82f6",
          "line-width": 6,
          "line-opacity": 0.95,
        },
      });

      map.on("mouseenter", "routes-layer", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "routes-layer", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "routes-layer", (event) => {
        const feature = event.features?.[0];
        const routeName = feature?.properties?.route_name;
        if (!feature || !routeName) {
          return;
        }

        map.setPaintProperty("routes-layer", "line-opacity", 0.3);
        map.setFilter("routes-layer-highlight", [
          "==",
          ["get", "route_name"],
          routeName,
        ]);

        setSimulationResult(null);
        setSimulationError(null);
        setConfirmationMessage(null);
        setApprovedOptionName(null);
        removeDecisionRouteOverlays();
        clearRerouteLayer();

        setSelectedRoute({
          routeId: Number(feature.properties?.route_id),
          name: routeName,
          distance: parseRouteDistance(feature.properties?.distance),
          status: (feature.properties?.status as RouteStatus) ?? "normal",
        });
        setIsRoutePanelOpen(true);
      });

      void loadRoutes();
      void loadEvents();
      void loadManualRouteOverlay();
    });

    return () => {
      clearEventMarkers();
      clearManualMarkers();
      removeDecisionRouteOverlays();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapboxToken || !mapRef.current || !hasManualRoute) {
      return;
    }

    void loadManualRouteOverlay();
  }, [
    hasManualRoute,
    originLat,
    originLng,
    destLat,
    destLng,
    originName,
    destName,
    simulationResult,
  ]);

  useEffect(() => {
    if (latestRouteUpdate?.status === "events_refreshed") {
      void loadEvents();
      return;
    }

    if (!latestRouteUpdate?.route_id) {
      return;
    }

    const routeId = Number(latestRouteUpdate.route_id);
    const updatedFeatures = routesDataRef.current.features.map<RouteFeature>((feature) => {
      const properties = feature.properties as RouteFeature["properties"];
      if (properties.route_id !== routeId) {
        return feature as RouteFeature;
      }

      return {
        ...feature,
        properties: {
          ...properties,
          color: latestRouteUpdate.status === "high risk" ? "#ef4444" : "#22d3ee",
          status: latestRouteUpdate.status === "high risk" ? "high risk" : "normal",
        },
      };
    });

    updateRoutesSource({
      ...routesDataRef.current,
      features: updatedFeatures,
    });
  }, [latestRouteUpdate]);

  useEffect(() => {
    if (!latestSimulationUpdate?.route_id) {
      return;
    }

    const routeId = Number(latestSimulationUpdate.route_id);
    const isSelectedRoute = selectedRoute?.routeId === routeId;

    if (isSelectedRoute && latestSimulationUpdate.options?.length) {
      setSimulationResult({
        route: latestSimulationUpdate.route ?? selectedRoute?.name ?? "",
        total_time: latestSimulationUpdate.options[0]?.total_time ?? selectedRoute?.distance ?? 0,
        total_cost: latestSimulationUpdate.options[0]?.total_cost ?? 0,
        risk: latestSimulationUpdate.risk ?? "medium",
        explanation: latestSimulationUpdate.explanation ?? [],
        options: latestSimulationUpdate.options,
        best_option: latestSimulationUpdate.best_option ?? "",
      });
      setApprovedOptionName(null);
      setSimulationError(null);
    }

    if (isSelectedRoute && latestSimulationUpdate.approved_option) {
      setApprovedOptionName(latestSimulationUpdate.approved_option);
      setConfirmationMessage(
        latestSimulationUpdate.message ?? "Simulation decision approved successfully",
      );
    }
  }, [latestSimulationUpdate, selectedRoute]);

  useEffect(() => {
    if (!isPollingFallback || pollTick === 0) {
      return;
    }

    void loadRoutes();
    void loadEvents();
  }, [isPollingFallback, pollTick]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    if (!simulationResult?.options?.length) {
      removeDecisionRouteOverlays();
      return;
    }

    void drawDecisionRouteOverlays(simulationResult.options);
  }, [simulationResult]);

  async function handleSimulateDisruption() {
    if (!selectedRoute || simulationLoading) {
      return;
    }

    if (selectedRoute.distance === null || selectedRoute.distance <= 0) {
      setSimulationError("Route distance is unavailable for simulation.");
      return;
    }

    setSimulationLoading(true);
    setSimulationError(null);
    setConfirmationMessage(null);
    setApprovedOptionName(null);

    try {
      const result = await simulateRoute({
        route_id: selectedRoute.routeId,
        distance_km: selectedRoute.distance,
        disruption_type: "weather",
      });

      const updatedFeatures = routesDataRef.current.features.map<RouteFeature>((feature) => {
        const properties = feature.properties as RouteFeature["properties"];

        if (properties.route_id !== selectedRoute.routeId) {
          return feature as RouteFeature;
        }

        return {
          ...feature,
          properties: {
            ...properties,
            color: "#ef4444",
            status: "high risk" as const,
          },
        };
      });

      updateRoutesSource({
        ...routesDataRef.current,
        features: updatedFeatures,
      });

      mapRef.current?.setPaintProperty("routes-layer-highlight", "line-color", "#ef4444");
      setSelectedRoute((currentRoute) =>
        currentRoute
          ? {
              ...currentRoute,
              status: "high risk",
            }
          : currentRoute,
      );
      setSimulationResult(result);
    } catch (error) {
      console.error("Map simulation request failed", error);
      setSimulationResult(null);
      setSimulationError(
        error instanceof Error ? error.message : "Simulation failed. Please try again.",
      );
    } finally {
      setSimulationLoading(false);
    }
  }

  async function handleApproveDecision(option: DecisionOption) {
    if (!selectedRoute || approvalLoading) {
      return;
    }

    setApprovalLoading(true);
    setSimulationError(null);
    setConfirmationMessage(null);

    try {
      const approvalResult = await approveSimulationDecision(selectedRoute.routeId, option.name);
      setApprovedOptionName(option.name);
      setConfirmationMessage(approvalResult.message);
      applyDecisionRouteSelection(option.name);
    } catch (error) {
      setSimulationError(
        error instanceof Error ? error.message : "Decision approval failed",
      );
    } finally {
      setApprovalLoading(false);
    }
  }

  function handleClosePanel() {
    setIsRoutePanelOpen(false);
    setSelectedRoute(null);
    setSimulationResult(null);
    setSimulationError(null);
    setConfirmationMessage(null);
    setApprovedOptionName(null);
    removeDecisionRouteOverlays();
    resetSelectionVisuals();
    clearRerouteLayer();
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-950">
      {mapboxToken ? (
        <div id="map" className="h-full w-full" />
      ) : (
        <div className="flex h-full items-center justify-center px-6">
          <div className="max-w-xl rounded-3xl border border-amber-400/20 bg-amber-400/10 p-6 text-amber-100">
            Map disabled. Please configure Mapbox token.
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute left-6 top-6 z-10 max-w-md space-y-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white shadow-xl backdrop-blur">
          <p className="text-sm font-semibold text-cyan-300">Route Workflow</p>
          <p className="mt-1 text-sm text-slate-300">
            Click a route to open details, generate logistics route options, and approve the best
            decision.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur">
          <p className="font-semibold text-white">Event Legend</p>
          <div className="mt-2 space-y-1">
            <p>Blue = weather</p>
            <p>Orange = traffic</p>
            <p>Red = satellite hazard</p>
            <p>Purple = global event</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur">
          <p className="font-semibold text-white">Decision Legend</p>
          <div className="mt-2 space-y-1">
            <p>Blue solid = road legs</p>
            <p>Cyan dashed = air legs</p>
            <p>Teal dashed = sea legs</p>
            <p>Small hub markers = handling points</p>
          </div>
        </div>

        <MapRouteDetails
          routes={simulationResult?.options ?? []}
          bestRouteName={simulationResult?.best_option ?? null}
        />

        {routesLoading && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur">
            Loading routes...
          </div>
        )}

        {!routesLoading && routesDataRef.current.features.length === 0 && !routesError && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur">
            No routes available yet. Use Upload CSV / Destination first.
          </div>
        )}

        {routesError && (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200 shadow-xl backdrop-blur">
            {routesError}
          </div>
        )}

        {liveEvents.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur">
            <p className="font-semibold text-white">Live Events Used</p>
            <div className="mt-2 space-y-2">
              {liveEvents.slice(0, 4).map((event) => (
                <p key={event.id}>
                  {event.source} · {event.description}
                </p>
              ))}
            </div>
          </div>
        )}

        {!hasManualRoute && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur">
            No route data found. Please simulate first.
          </div>
        )}

        {hasManualRoute && (
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 shadow-xl backdrop-blur">
            <p className="font-semibold text-white">Manual Route</p>
            <p className="mt-1">Origin: {originName ?? "Origin"}</p>
            <p>Destination: {destName ?? "Destination"}</p>
            <p className="mt-2 text-xs text-cyan-200">
              Green marker = origin, red marker = destination, blue line = route.
            </p>
          </div>
        )}

        {simulationResult && simulationResult.options.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur">
            No route options available
          </div>
        )}
      </div>

      <RoutePanel
        route={selectedRoute}
        isOpen={isRoutePanelOpen}
        simulationLoading={simulationLoading}
        approvalLoading={approvalLoading}
        simulationError={simulationError}
        confirmationMessage={confirmationMessage}
        decisionOptions={simulationResult?.options ?? []}
        detectedEvents={detectedEvents}
        bestOptionName={simulationResult?.best_option ?? null}
        approvedOptionName={approvedOptionName}
        onClose={handleClosePanel}
        onSimulate={handleSimulateDisruption}
        onApprove={handleApproveDecision}
      />
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
          Loading map...
        </div>
      }
    >
      <MapPageContent />
    </Suspense>
  );
}
