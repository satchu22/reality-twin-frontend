import { buildApiUrl } from "@/lib/api";

export type DisruptionType =
  | "port_closure"
  | "weather"
  | "congestion"
  | "breakdown";

export type SimulationMode = "road" | "air" | "sea" | "hybrid";

export type SimulationRequest = {
  route_id?: number | string;
  distance_km?: number;
  disruption_type: DisruptionType;
  selected_mode?: SimulationMode;
  origin_name?: string;
  origin_lat?: number;
  origin_lng?: number;
  origin_latitude?: number;
  origin_longitude?: number;
  destination_name?: string;
  destination_lat?: number;
  destination_lng?: number;
  destination_latitude?: number;
  destination_longitude?: number;
  cargo_type?: string;
  goods_description?: string;
  shipment_weight_kg?: number;
  shipment_volume_cbm?: number;
  shipment_units?: number;
  pallet_count?: number;
  hazardous_material?: boolean;
  cold_chain_required?: boolean;
  priority?: "low" | "standard" | "high" | "critical";
};

export type SimulationStep = {
  mode: "road" | "air" | "sea" | "handling";
  from: string;
  to: string;
  purpose: string;
  distance_km: number;
  time_hours: number;
  cost_usd: number;
  risk_score?: number;
  geometry: [number, number][];
};

export type WeatherRisk = {
  source: "open_meteo" | "noaa_nws" | "combined";
  risk_level: "low" | "medium" | "high" | "unknown";
  risk_score: number;
  delay_hours: number;
  summary: string;
  alerts: Array<{
    id?: string | null;
    event_id?: string | null;
    url?: string | null;
    source?: string;
    event?: string;
    severity?: string;
    certainty?: string;
    urgency?: string;
    headline?: string;
    description?: string;
    instruction?: string;
    area_desc?: string;
  }>;
  affected_modes: string[];
  lat: number;
  lng: number;
  sampled_locations: Array<{
    lat: number;
    lng: number;
    summary: string;
    risk_score: number;
    source: string;
  }>;
  risk_explanation: string[];
};

export type SimulationOption = {
  id?: string;
  name: string;
  label?: string;
  mode: SimulationMode;
  mode_sequence: SimulationMode[] | Array<"road" | "air" | "sea">;
  route_type: string;
  route: string;
  origin?: string;
  destination?: string;
  geometry?: [number, number][];
  handling_points?: [number, number][];
  legs: SimulationStep[];
  steps: SimulationStep[];
  delay?: number;
  cost?: number;
  total_time: number;
  total_cost: number;
  total_distance_km?: number;
  total_time_hours: number;
  total_cost_usd: number;
  estimated_time_hours?: number;
  estimated_cost_usd?: number;
  selected_origin_airport?: string;
  selected_origin_airport_name?: string;
  selected_destination_airport?: string;
  selected_destination_airport_name?: string;
  carrier?: string;
  carrier_codes?: string[];
  route_possibility?: string;
  air_route_validation?: string;
  airport_handling_cost?: number;
  stops?: number | null;
  shipment_assumptions?: {
    cargo_type: string;
    goods_description: string;
    priority: string;
    shipment_weight_kg: number;
    shipment_volume_cbm: number;
    shipment_units: number;
    pallet_count: number;
    hazardous_material: boolean;
    cold_chain_required: boolean;
    chargeable_weight_kg: number;
    capacity_utilization_estimate: number;
  };
  recommendation_reason: string;
  weather_risk?: WeatherRisk;
  risk: "low" | "medium" | "high";
  risk_level: "low" | "medium" | "high";
  risk_score: number;
  overall_risk_score?: number;
  score: number;
  best?: boolean;
  explanation: string[];
  explanations: string[];
  analysis?: Record<string, number | boolean | null>;
  event_types: Array<"weather" | "traffic" | "satellite" | "global_event">;
  live_events_used: Array<{
    id: number;
    source: "weather" | "traffic" | "satellite" | "global_event";
    event_type: string;
    severity: "low" | "medium" | "high";
    lat: number;
    lng: number;
    radius_km: number;
    description: string;
    confidence: number;
  }>;
};

export type SimulationResponse = {
  origin?: string;
  destination?: string;
  selected_mode?: SimulationMode;
  route: string;
  route_id?: number | string;
  distance_km?: number;
  total_time_hours?: number;
  total_cost_usd?: number;
  risk_score?: number;
  total_time: number;
  total_cost: number;
  risk: "low" | "medium" | "high";
  risk_level?: "low" | "medium" | "high";
  explanation: string[];
  options: SimulationOption[];
  best_option: string;
};

export type SimulationApprovalResponse = {
  message: string;
};

function normalizeSimulationError(input: unknown): string {
  if (typeof input === "string" && input.trim()) {
    return input;
  }

  if (Array.isArray(input)) {
    const parts = input
      .map((item) => normalizeSimulationError(item))
      .filter(Boolean);
    return parts.join("; ");
  }

  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    if (typeof record.msg === "string" && record.msg.trim()) {
      return record.msg;
    }
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
    if ("detail" in record) {
      return normalizeSimulationError(record.detail);
    }
    if ("error" in record) {
      return normalizeSimulationError(record.error);
    }
  }

  return "";
}

export async function simulateRoute(
  payload: SimulationRequest,
): Promise<SimulationResponse> {
  let response: Response;

  console.log("Sending simulate payload:", payload);

  try {
    response = await fetch(buildApiUrl("/simulate"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("simulateRoute request failed", error);
    throw new Error("Backend not reachable. Make sure server is running.");
  }

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = "Simulation failed";

    try {
      const parsed = JSON.parse(text) as { detail?: unknown; error?: unknown };
      errorMessage =
        normalizeSimulationError(parsed.error) ||
        normalizeSimulationError(parsed.detail) ||
        errorMessage;
    } catch {
      if (text.trim()) {
        errorMessage = text.trim();
      }
    }

    console.error("SIMULATION ERROR:", {
      status: response.status,
      raw: text,
    });

    throw new Error(errorMessage);
  }

  const data = (await response.json()) as SimulationResponse;

  console.log("Simulate response:", data);

  if (!data || !Array.isArray(data.options)) {
    console.error("SIMULATION ERROR:", {
      status: response.status,
      raw: data,
    });
    throw new Error("Simulation failed");
  }

  return data;
}

export async function approveSimulationDecision(
  scenarioId: number | string,
  selectedOption: string,
): Promise<SimulationApprovalResponse> {
  const response = await fetch(
    buildApiUrl(`/simulate/${encodeURIComponent(String(scenarioId))}/approve`),
    {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      selected_option: selectedOption,
    }),
    },
  );

  if (!response.ok) {
    let errorMessage = "Decision approval failed";

    try {
      const errorPayload = (await response.json()) as {
        detail?: string | { msg?: string };
      };

      if (typeof errorPayload.detail === "string") {
        errorMessage = errorPayload.detail;
      } else if (
        errorPayload.detail &&
        typeof errorPayload.detail === "object" &&
        typeof errorPayload.detail.msg === "string"
      ) {
        errorMessage = errorPayload.detail.msg;
      }
    } catch {
      errorMessage = `Decision approval failed with status ${response.status}`;
    }

    throw new Error(errorMessage);
  }

  return response.json();
}
