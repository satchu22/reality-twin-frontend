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

export type SimulationOption = {
  name: string;
  route_type: string;
  route: string;
  geometry?: [number, number][];
  delay: number;
  cost: number;
  total_time: number;
  total_cost: number;
  risk: "low" | "medium" | "high";
  score: number;
  explanation: string[];
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
  total_time: number;
  total_cost: number;
  risk: "low" | "medium" | "high";
  explanation: string[];
  options: SimulationOption[];
  best_option: string;
};

export type SimulationApprovalResponse = {
  message: string;
};

export async function simulateRoute(
  payload: SimulationRequest,
): Promise<SimulationResponse> {
  let response: Response;

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
    throw new Error("Simulation failed. Please try again.");
  }

  if (!response.ok) {
    try {
      const errorPayload = (await response.json()) as {
        detail?: string | { msg?: string };
      };
      console.error("simulateRoute returned error", {
        status: response.status,
        payload,
        detail: errorPayload.detail,
      });
    } catch (error) {
      console.error("simulateRoute returned non-JSON error", {
        status: response.status,
        payload,
        error,
      });
    }

    throw new Error("Simulation failed. Please try again.");
  }

  return response.json();
}

export async function approveSimulationDecision(
  scenarioId: number | string,
  selectedOption: string,
): Promise<SimulationApprovalResponse> {
  const response = await fetch(
    buildApiUrl(`/simulate/${scenarioId}/approve`),
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
