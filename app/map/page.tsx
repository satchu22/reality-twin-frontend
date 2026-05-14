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
  type SimulationMode,
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

type RouteMode = "batch" | "manual";

const EMPTY_FEATURE_COLLECTION: RouteFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const DECISION_ROUTE_STYLES = [
  { color: "#22c55e", width: 6, label: "Best Route" },
  { color: "#facc15", width: 4, label: "Alternative" },
  { color: "#ef4444", width: 3, label: "High Risk" },
] as const;

const ROUTE_EVENT_RADIUS_KM = 250;

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

function haversineDistanceKm(
  start: [number, number],
  end: [number, number],
): number {
  const earthRadiusKm = 6371;
  const startLat = (start[1] * Math.PI) / 180;
  const endLat = (end[1] * Math.PI) / 180;
  const deltaLat = ((end[1] - start[1]) * Math.PI) / 180;
  const deltaLng = ((end[0] - start[0]) * Math.PI) / 180;
  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(startLat) *
      Math.cos(endLat) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadiusKm * arc;
}

function formatManualRouteName(origin: string | null, destination: string | null) {
  return `${origin ?? "Origin"} → ${destination ?? "Destination"}`;
}

function buildRouteSamples(coordinates: [number, number][]) {
  const samples: [number, number][] = [];

  coordinates.forEach((coordinate, index) => {
    samples.push(coordinate);

    const next = coordinates[index + 1];
    if (!next) {
      return;
    }

    samples.push([
      (coordinate[0] + next[0]) / 2,
      (coordinate[1] + next[1]) / 2,
    ]);
  });

  return samples;
}

function filterEventsNearRoute(
  events: LiveEvent[],
  coordinates: [number, number][],
) {
  if (coordinates.length < 2) {
    return events;
  }

  const routeSamples = buildRouteSamples(coordinates);
  return events.filter((event) => {
    const eventPoint: [number, number] = [event.lng, event.lat];
    const threshold = Math.max(ROUTE_EVENT_RADIUS_KM, event.radius_km);
    return routeSamples.some(
      (sample) => haversineDistanceKm(sample, eventPoint) <= threshold,
    );
  });
}

function findBestOption(
  options: SimulationOption[],
  bestOptionName?: string | null,
) {
  return (
    options.find(
      (option) =>
        option.name === bestOptionName ||
        option.route_type === bestOptionName ||
        option.label === bestOptionName,
    ) ??
    options.find((option) => option.best) ??
    [...options].sort(
      (left, right) =>
        (left.score ?? Number.POSITIVE_INFINITY) -
        (right.score ?? Number.POSITIVE_INFINITY),
    )[0] ??
    null
  );
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
  const mapLoadedRef = useRef(false);
  const eventMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const weatherMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const allEventsRef = useRef<LiveEvent[]>([]);
  const activeRouteGeometryRef = useRef<[number, number][]>([]);
  const routesDataRef = useRef<RouteFeatureCollection>(EMPTY_FEATURE_COLLECTION);
  const manualMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const decisionPopupRef = useRef<mapboxgl.Popup | null>(null);
  const decisionOverlaysRef = useRef<DecisionOverlay[]>([]);

  const [selectedRoute, setSelectedRoute] = useState<SelectedRoute | null>(null);
  const [isRoutePanelOpen, setIsRoutePanelOpen] = useState(false);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [showLiveEvents, setShowLiveEvents] = useState(false);
  const [showWeatherRisk, setShowWeatherRisk] = useState(false);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [simulationResult, setSimulationResult] =
    useState<SimulationResponse | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [approvedOptionName, setApprovedOptionName] = useState<string | null>(null);
  const [focusedOptionName, setFocusedOptionName] = useState<string | null>(null);
  const [storedOrigin, setStoredOrigin] = useState<StoredLocation | null>(null);
  const [storedDestination, setStoredDestination] = useState<StoredLocation | null>(null);
  const [selectedSimulationMode, setSelectedSimulationMode] =
    useState<SimulationMode>("road");
  const [routeMode, setRouteMode] = useState<RouteMode>("batch");
  const [storageReady, setStorageReady] = useState(false);

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
  const manualRouteName = formatManualRouteName(originName, destName);
  const hasManualRoute =
    originLat !== null &&
    originLng !== null &&
    destLat !== null &&
    destLng !== null;
  const isManualMode = storageReady && routeMode === "manual" && hasManualRoute;
  const detectedEvents = simulationResult
    ? Array.from(
        new Map(
          simulationResult.options
            .flatMap((option) => option.live_events_used)
            .map((event) => [event.id, event]),
        ).values(),
      )
    : [];
  const focusedOption =
    simulationResult?.options.find((option) => option.name === focusedOptionName) ??
    findBestOption(simulationResult?.options ?? [], simulationResult?.best_option ?? null) ??
    null;

  // The map instance is initialized once and torn down on unmount.
  useEffect(() => {
    const parsedRoutes = parseStoredItem<SimulationOption[]>("routeOptions");
    const parsedOrigin = parseStoredItem<StoredLocation>("origin");
    const parsedDestination = parseStoredItem<StoredLocation>("destination");
    const parsedSimulation = parseStoredItem<SimulationResponse>("routeSimulation");
    const storedRouteMode =
      sessionStorage.getItem("routeMode") === "manual" ? "manual" : "batch";

    setRouteMode(
      storedRouteMode === "manual" || (parsedOrigin && parsedDestination)
        ? "manual"
        : "batch",
    );

    if (parsedOrigin) {
      setStoredOrigin(parsedOrigin);
    }

    if (parsedDestination) {
      setStoredDestination(parsedDestination);
    }

    if (parsedSimulation) {
      if (Array.isArray(parsedSimulation.options) && parsedSimulation.options.length > 0) {
        if (parsedSimulation.selected_mode) {
          setSelectedSimulationMode(parsedSimulation.selected_mode);
        }
        setSimulationResult(parsedSimulation);
        setStorageReady(true);
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
      if (bestOption?.mode) {
        setSelectedSimulationMode(bestOption.mode);
      }

      setSimulationResult({
        route:
          parsedOrigin && parsedDestination
            ? formatManualRouteName(parsedOrigin.name, parsedDestination.name)
            : bestOption?.route ?? "Generated routes",
        total_time: bestOption?.total_time ?? 0,
        total_cost: bestOption?.total_cost ?? 0,
        risk: bestOption?.risk ?? "medium",
        explanation: bestOption?.explanation ?? [],
        options: parsedRoutes,
        best_option: bestOption?.name ?? "",
      });
    }

    setStorageReady(true);
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

  function clearWeatherMarkers() {
    for (const marker of weatherMarkersRef.current) {
      marker.remove();
    }
    weatherMarkersRef.current = [];
  }

  function clearManualMarkers() {
    for (const marker of manualMarkersRef.current) {
      marker.remove();
    }
    manualMarkersRef.current = [];
  }

  function clearManualRouteOverlay() {
    clearManualMarkers();
    clearWeatherMarkers();
    activeRouteGeometryRef.current = [];

    const source = mapRef.current?.getSource("manual-route") as
      | mapboxgl.GeoJSONSource
      | undefined;
    source?.setData(EMPTY_FEATURE_COLLECTION);
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

  function refreshWeatherMarkers(option: SimulationOption | null) {
    clearWeatherMarkers();

    if (!showWeatherRisk || !option?.weather_risk?.sampled_locations?.length || !mapRef.current) {
      return;
    }

    weatherMarkersRef.current = option.weather_risk.sampled_locations.map((sample) => {
      const element = document.createElement("div");
      element.className =
        "h-4 w-4 rounded-full border-2 border-white shadow-lg ring-4 ring-sky-200/10";
      element.style.backgroundColor =
        sample.risk_score > 60 ? "#ef4444" : sample.risk_score > 25 ? "#f59e0b" : "#38bdf8";
      element.title = `Forecast-based estimate: ${sample.summary}`;

      return new mapboxgl.Marker({ element })
        .setLngLat([sample.lng, sample.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 16 }).setHTML(
            `<div style="min-width: 200px; color: #0f172a;">
              <div style="font-weight: 700; margin-bottom: 6px;">Weather Risk</div>
              <div style="font-size: 12px;">${sample.summary}</div>
              <div style="margin-top: 6px; font-size: 12px; color: #334155;">Risk score: ${sample.risk_score.toFixed(1)}</div>
            </div>`,
          ),
        )
        .addTo(mapRef.current!);
    });
  }

  function refreshVisibleEvents(events = allEventsRef.current) {
    if (!mapLoadedRef.current) {
      return;
    }

    if (!showLiveEvents) {
      updateEventsSource([]);
      return;
    }

    if (isManualMode) {
      updateEventsSource(
        filterEventsNearRoute(events, activeRouteGeometryRef.current),
      );
      return;
    }

    updateEventsSource(events);
  }

  function buildOptionColorMap(options: SimulationOption[], bestOptionName?: string | null) {
    const colorMap = new Map<string, string>();
    const bestOption = findBestOption(options, bestOptionName);
    const fastestOption = [...options].sort(
      (left, right) => left.total_time_hours - right.total_time_hours,
    )[0];
    const cheapestOption = [...options].sort(
      (left, right) => left.total_cost_usd - right.total_cost_usd,
    )[0];

    if (bestOption) {
      colorMap.set(bestOption.name, "#22c55e");
    }

    if (fastestOption && !colorMap.has(fastestOption.name)) {
      colorMap.set(fastestOption.name, "#3b82f6");
    }

    if (cheapestOption && !colorMap.has(cheapestOption.name)) {
      colorMap.set(cheapestOption.name, "#f59e0b");
    }

    for (const option of options) {
      if (option.risk_level === "high") {
        colorMap.set(option.name, "#ef4444");
        continue;
      }

      if (!colorMap.has(option.name)) {
        colorMap.set(option.name, "#22c55e");
      }
    }

    return colorMap;
  }

  function fitMapToCoordinates(coordinates: [number, number][]) {
    const map = mapRef.current;
    if (!map || coordinates.length < 2) {
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    for (const coordinate of coordinates) {
      bounds.extend(coordinate);
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 80, maxZoom: 8 });
    }
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

    setFocusedOptionName(optionName);
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
    const optionColors = buildOptionColorMap(sortedOptions, simulationResult?.best_option ?? null);

    const overlays: DecisionOverlay[] = [];
    const bounds = new mapboxgl.LngLatBounds();

    for (const [index, option] of sortedOptions.slice(0, 3).entries()) {
      const style =
        DECISION_ROUTE_STYLES[index] ?? DECISION_ROUTE_STYLES[DECISION_ROUTE_STYLES.length - 1];
      const optionColor = optionColors.get(option.name) ?? style.color;
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
          element.style.backgroundColor = optionColor;

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
            "line-color": optionColor,
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
                  <div style="font-weight: 700; margin-bottom: 8px;">${option.name}</div>
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
    const nextFocusedName =
      focusedOptionName && sortedOptions.some((option) => option.name === focusedOptionName)
        ? focusedOptionName
        : findBestOption(sortedOptions, simulationResult?.best_option ?? null)?.name ?? null;
    applyDecisionRouteSelection(nextFocusedName);

    const bestOption =
      sortedOptions.find((option) => option.name === nextFocusedName) ??
      findBestOption(sortedOptions, simulationResult?.best_option ?? null);
    activeRouteGeometryRef.current = bestOption?.geometry ?? [];
    refreshVisibleEvents();
    refreshWeatherMarkers(bestOption ?? null);

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 80, maxZoom: 8 });
    }
  });

  const loadRoutes = useEffectEvent(async () => {
    if (isManualMode) {
      updateRoutesSource(EMPTY_FEATURE_COLLECTION);
      setRoutesLoading(false);
      setRoutesError(null);
      return;
    }

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
      allEventsRef.current = events;
      refreshVisibleEvents(events);
    } catch (eventError) {
      console.error("Failed to load live events", eventError);
    }
  });

  const loadManualRouteOverlay = useEffectEvent(async () => {
    const map = mapRef.current;
    if (!map || !isManualMode) {
      clearManualRouteOverlay();
      return;
    }

    const origin: [number, number] = [originLng as number, originLat as number];
    const destination: [number, number] = [destLng as number, destLat as number];
    const coordinates = await getRouteGeometry(origin, destination);
    activeRouteGeometryRef.current =
      simulationResult?.options && simulationResult.options.length > 0
        ? findBestOption(simulationResult.options, simulationResult.best_option)?.geometry ??
          coordinates
        : coordinates;

    const routeSource = map.getSource("manual-route") as mapboxgl.GeoJSONSource | undefined;

    routeSource?.setData(
      simulationResult?.options?.length
        ? EMPTY_FEATURE_COLLECTION
        : {
            type: "Feature",
            properties: {
              route_name: manualRouteName,
            },
            geometry: {
              type: "LineString",
              coordinates,
            },
          },
    );

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

    refreshVisibleEvents();
  });

  // `loadRoutes` and `loadManualRouteOverlay` are useEffectEvent handlers.
  /* eslint-disable react-hooks/exhaustive-deps */
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
      mapLoadedRef.current = true;
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
        if (isManualMode) {
          return;
        }

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
    });

    return () => {
      clearEventMarkers();
      clearWeatherMarkers();
      clearManualRouteOverlay();
      removeDecisionRouteOverlays();
      mapLoadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  // `loadManualRouteOverlay` and `loadRoutes` are useEffectEvent handlers.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!storageReady || !mapLoadedRef.current) {
      return;
    }

    if (isManualMode) {
      updateRoutesSource(EMPTY_FEATURE_COLLECTION);
      resetSelectionVisuals();
      void loadManualRouteOverlay();
      setRoutesLoading(false);
      setRoutesError(null);
      return;
    }

    clearManualRouteOverlay();
    void loadRoutes();
  }, [
    destLat,
    destLng,
    destName,
    hasManualRoute,
    isManualMode,
    originLat,
    originLng,
    originName,
    simulationResult,
    storageReady,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // `loadEvents` is a useEffectEvent handler.
  useEffect(() => {
    if (!storageReady || !mapLoadedRef.current) {
      return;
    }

    void loadEvents();
  }, [isManualMode, storageReady]);

  // `loadRoutes` and `loadEvents` are useEffectEvent handlers.
  useEffect(() => {
    if (!storageReady) {
      return;
    }

    setShowLiveEvents(!isManualMode);
  }, [isManualMode, storageReady]);

  // `refreshVisibleEvents` is driven by refs plus current toggle state.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    refreshVisibleEvents();
  }, [isManualMode, showLiveEvents]);
  /* eslint-enable react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    refreshWeatherMarkers(focusedOption);
  }, [focusedOption, showWeatherRisk]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // `loadRoutes` and `loadEvents` are useEffectEvent handlers.
  useEffect(() => {
    if (!isManualMode || !storageReady) {
      return;
    }

    const currentManualRoute = formatManualRouteName(originName, destName);
    if (
      simulationResult &&
      simulationResult.route &&
      simulationResult.route !== currentManualRoute
    ) {
      setSimulationResult(null);
      setApprovedOptionName(null);
      setFocusedOptionName(null);
      clearWeatherMarkers();
      removeDecisionRouteOverlays();
      return;
    }

    const derivedDistance =
      simulationResult?.distance_km ??
      haversineDistanceKm(
        [originLng as number, originLat as number],
        [destLng as number, destLat as number],
      );

    setSelectedRoute({
      routeId: simulationResult?.route_id ?? null,
      name: simulationResult?.route ?? currentManualRoute,
      distance: Number.isFinite(derivedDistance) ? Number(derivedDistance.toFixed(1)) : null,
      status:
        simulationResult?.risk === "high"
          ? "high risk"
          : simulationResult?.best_option
            ? "best"
            : "normal",
    });
    setIsRoutePanelOpen(true);
  }, [
    destName,
    destLat,
    destLng,
    originName,
    isManualMode,
    manualRouteName,
    originLat,
    originLng,
    simulationResult,
    storageReady,
  ]);

  useEffect(() => {
    if (latestRouteUpdate?.status === "events_refreshed") {
      void loadEvents();
      return;
    }

    if (isManualMode) {
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
  }, [isManualMode, latestRouteUpdate]);

  useEffect(() => {
    if (isManualMode) {
      return;
    }

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
  }, [isManualMode, latestSimulationUpdate, selectedRoute]);

  useEffect(() => {
    if (!isPollingFallback || pollTick === 0) {
      return;
    }

    if (!isManualMode) {
      void loadRoutes();
    }

    void loadEvents();
  }, [isManualMode, isPollingFallback, pollTick]);

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

  async function handleSimulateDisruption(modeOverride?: SimulationMode) {
    if (!selectedRoute || simulationLoading) {
      return;
    }

    if (!isManualMode && (selectedRoute.distance === null || selectedRoute.distance <= 0)) {
      setSimulationError("Route distance is unavailable for simulation.");
      return;
    }

    setSimulationLoading(true);
    setSimulationError(null);
    setConfirmationMessage(null);
    setApprovedOptionName(null);
    setFocusedOptionName(null);
    clearWeatherMarkers();
    removeDecisionRouteOverlays();

    try {
      const simulationMode = modeOverride ?? selectedSimulationMode;
      setSelectedSimulationMode(simulationMode);
      const result = await simulateRoute(
        isManualMode
          ? {
              disruption_type: "weather",
              selected_mode: simulationMode,
              origin_name: originName ?? "Origin",
              destination_name: destName ?? "Destination",
              origin_lat: originLat as number,
              origin_lng: originLng as number,
              destination_lat: destLat as number,
              destination_lng: destLng as number,
            }
          : {
              route_id:
                typeof selectedRoute.routeId === "number" ? selectedRoute.routeId : undefined,
              distance_km: selectedRoute.distance ?? undefined,
              disruption_type: "weather",
              selected_mode: simulationMode,
            },
      );

      if (typeof window !== "undefined") {
        sessionStorage.setItem("routeOptions", JSON.stringify(result.options));
        sessionStorage.setItem("routeSimulation", JSON.stringify(result));
      }

      if (result.selected_mode) {
        setSelectedSimulationMode(result.selected_mode);
      }

      if (!isManualMode) {
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
      }

      setSelectedRoute((currentRoute) =>
        currentRoute
          ? {
              ...currentRoute,
              status: result.risk === "high" ? "high risk" : "best",
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

  function handleSelectSimulationMode(mode: SimulationMode) {
    setSelectedSimulationMode(mode);
    void handleSimulateDisruption(mode);
  }

  async function handleApproveDecision(option: DecisionOption) {
    if (!selectedRoute || approvalLoading) {
      return;
    }

    setApprovalLoading(true);
    setSimulationError(null);
    setConfirmationMessage(null);

    try {
      const approvalTarget =
        selectedRoute.routeId ?? simulationResult?.route_id ?? selectedRoute.name;
      const approvalResult = await approveSimulationDecision(approvalTarget, option.name);
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

  function handleViewOption(option: DecisionOption) {
    applyDecisionRouteSelection(option.name);
    activeRouteGeometryRef.current = option.geometry ?? [];
    fitMapToCoordinates(option.geometry ?? []);
    refreshVisibleEvents();
    refreshWeatherMarkers(option);
  }

  function handleClosePanel() {
    setIsRoutePanelOpen(false);
    setSelectedRoute(null);
    setSimulationResult(null);
    setSimulationError(null);
    setConfirmationMessage(null);
    setApprovedOptionName(null);
    clearWeatherMarkers();
    removeDecisionRouteOverlays();
    resetSelectionVisuals();
    clearRerouteLayer();
    if (!isManualMode) {
      clearManualRouteOverlay();
    }
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
            {isManualMode
              ? "Select Road, Air, Sea, or Hybrid to generate clean simulation options for the current origin and destination."
              : "Click a route to open details, generate simulation options, and approve the best decision."}
          </p>
        </div>

        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-white">Live Events</p>
              <p className="mt-1 text-xs text-slate-400">
                {isManualMode
                  ? "Show only live events near the current route corridor."
                  : "Show all live events on the map."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLiveEvents((currentValue) => !currentValue)}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                showLiveEvents
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              {showLiveEvents ? "On" : "Off"}
            </button>
          </div>
        </div>

        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-white">Show Weather Risk</p>
              <p className="mt-1 text-xs text-slate-400">
                Forecast-based estimate markers for the current simulation only.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowWeatherRisk((currentValue) => !currentValue)}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                showWeatherRisk
                  ? "bg-sky-400 text-slate-950"
                  : "border border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              {showWeatherRisk ? "On" : "Off"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur">
          <p className="font-semibold text-white">Decision Legend</p>
          <div className="mt-2 space-y-1">
            <p>Green = recommended option</p>
            <p>Blue = fastest option</p>
            <p>Orange = cheapest option</p>
            <p>Red = highest risk option</p>
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

        {!isManualMode &&
          !routesLoading &&
          routesDataRef.current.features.length === 0 &&
          !routesError && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur">
            No routes available yet. Use Upload CSV / Destination first.
          </div>
        )}

        {routesError && (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200 shadow-xl backdrop-blur">
            {routesError}
          </div>
        )}

        {showLiveEvents && liveEvents.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur">
            <p className="font-semibold text-white">
              {isManualMode ? "Route Corridor Events" : "Live Events Used"}
            </p>
            <div className="mt-2 space-y-2">
              {liveEvents.slice(0, 4).map((event) => (
                <p key={event.id}>
                  {event.source} · {event.description}
                </p>
              ))}
            </div>
          </div>
        )}

        {!isManualMode && !routesLoading && routesDataRef.current.features.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur">
            No route data found. Upload a batch or enter a manual route first.
          </div>
        )}

        {hasManualRoute && (
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 shadow-xl backdrop-blur">
            <p className="font-semibold text-white">Manual Route</p>
            <p className="mt-1">Origin: {originName ?? "Origin"}</p>
            <p>Destination: {destName ?? "Destination"}</p>
            <p className="mt-2 text-xs text-cyan-200">
              Green marker = origin, red marker = destination. The map is focused only on this route.
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
        focusedOption={focusedOption}
        detectedEvents={detectedEvents}
        bestOptionName={simulationResult?.best_option ?? null}
        approvedOptionName={approvedOptionName}
        selectedMode={selectedSimulationMode}
        onClose={handleClosePanel}
        onSimulate={() => void handleSimulateDisruption()}
        onSelectMode={handleSelectSimulationMode}
        onApprove={handleApproveDecision}
        onViewOption={handleViewOption}
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
