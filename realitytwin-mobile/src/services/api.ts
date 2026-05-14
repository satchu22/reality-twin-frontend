import axios from "axios";

export const API_BASE_URL = "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export type RouteItem = {
  routeId: string;
  name: string;
  source: [number, number];
  dest: [number, number];
  distanceKm: number | null;
  status: "best" | "high risk" | "medium risk" | "normal";
};

export type SimulationRequest = {
  route_id: string | number;
  distance_km: number;
  disruption_type: "weather" | "port_closure" | "congestion" | "breakdown";
};

export type DecisionOption = {
  name: string;
  delay?: number;
  cost?: number;
  route_type?: string;
  total_time_hours?: number;
  total_cost_usd?: number;
  risk: "low" | "medium" | "high";
  score: number;
  steps?: Array<{
    mode: "road" | "air" | "sea" | "handling";
    from: string;
    to: string;
    purpose: string;
    distance_km: number;
    time_hours: number;
    cost_usd: number;
  }>;
};

export type SimulationResponse = {
  options: DecisionOption[];
  best_option: string;
};

export type NotificationItem = {
  id: number;
  user_id: number;
  message: string;
  type: "info" | "warning" | "critical";
  is_read: boolean;
  created_at: string;
};

export type OverviewResponse = {
  active_routes: number;
  risk_alerts: number;
  cost_exposure: number;
  best_action: string;
};

function parseRouteDistance(route: {
  distance?: number;
  distance_km?: number;
}): number | null {
  const value = route.distance ?? route.distance_km;
  return typeof value === "number" ? value : null;
}

function normalizeRoute(route: {
  route?: string;
  route_name?: string;
  source: number[];
  dest: number[];
  distance?: number;
  distance_km?: number;
}): RouteItem {
  const name = route.route_name || route.route || "Unknown route";
  return {
    routeId: name,
    name,
    source: [route.source[1], route.source[0]],
    dest: [route.dest[1], route.dest[0]],
    distanceKm: parseRouteDistance(route),
    status: "normal",
  };
}

export async function getRoutes(): Promise<RouteItem[]> {
  try {
    const response = await api.get<
      Array<{
        route?: string;
        route_name?: string;
        source: number[];
        dest: number[];
        distance?: number;
        distance_km?: number;
      }>
    >("/routes");
    return response.data.map(normalizeRoute);
  } catch (error) {
    console.error("getRoutes failed", error);
    throw new Error("Failed to load routes");
  }
}

export async function simulateRoute(
  payload: SimulationRequest,
): Promise<SimulationResponse> {
  try {
    const response = await api.post<SimulationResponse>("/simulate", payload);
    return response.data;
  } catch (error) {
    console.error("simulateRoute failed", error);
    throw new Error("Simulation failed. Please try again.");
  }
}

export async function getNotifications(
  userId = 1,
): Promise<NotificationItem[]> {
  try {
    const response = await api.get<NotificationItem[]>(
      `/notifications?user_id=${userId}`,
    );
    return response.data;
  } catch (error) {
    console.error("getNotifications failed", error);
    throw new Error("Failed to load notifications");
  }
}

export async function approveDecision(
  scenarioId: string | number,
  selectedOption: string,
): Promise<{ message: string }> {
  try {
    const response = await api.post<{ message: string }>(
      `/simulate/${scenarioId}/approve`,
      {
        selected_option: selectedOption,
      },
    );
    return response.data;
  } catch (error) {
    console.error("approveDecision failed", error);
    throw new Error("Failed to approve decision");
  }
}

export async function getOverview(): Promise<OverviewResponse> {
  try {
    const response = await api.get<OverviewResponse>("/overview");
    return response.data;
  } catch (error) {
    console.error("getOverview failed", error);
    throw new Error("Failed to load dashboard overview");
  }
}
