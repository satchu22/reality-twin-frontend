import { buildApiUrl } from "@/lib/api";

export type LiveEvent = {
  id: number;
  source: "weather" | "traffic" | "satellite" | "global_event";
  event_type: string;
  lat: number;
  lng: number;
  severity: "low" | "medium" | "high";
  radius_km: number;
  description: string;
  confidence: number;
};

export async function fetchEvents(): Promise<LiveEvent[]> {
  const response = await fetch(buildApiUrl("/events"));

  if (!response.ok) {
    if (response.status === 404) {
      console.warn("Live events endpoint not available at /events. Continuing without live events.");
      return [];
    }

    throw new Error(`Failed to load live events (${response.status})`);
  }

  return response.json();
}
