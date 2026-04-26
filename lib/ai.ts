import { buildApiUrl } from "@/lib/api";

export type AIInsightEvent = {
  id?: number;
  source: "weather" | "traffic" | "satellite" | "global_event";
  event_type?: string;
  severity: "low" | "medium" | "high" | string;
  description: string;
};

export type AIExplainableRouteOption = {
  name: string;
  route_type: string;
  total_time: number;
  total_cost: number;
  risk: string;
  score?: number;
  explanation: string[];
};

export async function fetchAIExplanation(
  routeOptions: AIExplainableRouteOption[],
  events: AIInsightEvent[],
): Promise<string> {
  const response = await fetch(buildApiUrl("/ai/explain"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route_options: routeOptions,
      events,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI explain failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { explanation?: string };
  return payload.explanation ?? "";
}
