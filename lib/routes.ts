import { buildApiUrl } from "@/lib/api";

export type RouteRecord = {
  route_id: number;
  route?: string;
  route_name?: string;
  distance?: number;
  source: [number, number];
  dest: [number, number];
};

export async function fetchRoutes(batchId?: number | null): Promise<RouteRecord[]> {
  const path = batchId
    ? `/batch-data?batch_id=${batchId}`
    : "/routes";

  const response = await fetch(buildApiUrl(path));

  if (!response.ok) {
    throw new Error(`Failed to load routes (${response.status})`);
  }

  return response.json();
}
