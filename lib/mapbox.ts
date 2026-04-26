const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export function getMapboxToken(): string | null {
  const token = mapboxToken?.trim();
  return token ? token : null;
}

export type GeocodedLocation = {
  name: string;
  latitude: number;
  longitude: number;
};

export async function geocodeLocationName(query: string): Promise<GeocodedLocation> {
  const token = getMapboxToken();

  if (!token) {
    throw new Error("Mapbox token missing. Please configure .env.local.");
  }

  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    throw new Error("Enter a location name.");
  }

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalizedQuery)}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to geocode location (${response.status})`);
  }

  const payload = (await response.json()) as {
    features?: Array<{
      place_name?: string;
      center?: [number, number];
    }>;
  };
  const feature = payload.features?.[0];

  if (!feature?.center) {
    throw new Error(`Invalid location: ${normalizedQuery}`);
  }

  return {
    name: feature.place_name ?? normalizedQuery,
    longitude: feature.center[0],
    latitude: feature.center[1],
  };
}
