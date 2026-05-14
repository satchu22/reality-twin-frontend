import { buildApiUrl } from "@/lib/api";

export type DisruptionType =
  | "port_closure"
  | "weather"
  | "congestion"
  | "breakdown";

export type SimulationRequest = {
  route_id?: number | string;
  distance_km?: number;
  disruption_type: DisruptionType;
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
  geometry: [number, number][];
};

export type SimulationOption = {
  name: string;
  label?: string;
  route_type: string;
  route: string;
  geometry?: [number, number][];
  handling_points?: [number, number][];
  steps: SimulationStep[];
  delay?: number;
  cost?: number;
  total_time: number;
  total_cost: number;
  total_time_hours: number;
  total_cost_usd: number;
  risk: "low" | "medium" | "high";
  risk_level: "low" | "medium" | "high";
  risk_score: number;
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
  route: string;
  route_id?: number | string;
  distance_km?: number;
  total_time_hours?: number;
  total_cost_usd?: number;
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
  const response = await fetch(buildApiUrl(`/simulate/${scenarioId}/approve`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      selected_option: selectedOption,
    }),
  });

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
