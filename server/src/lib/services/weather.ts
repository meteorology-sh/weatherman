export interface CloudCoverPoint {
  lat: number;
  lon: number;
  cloudCover: number;
  time: string;
}

interface ForecastEntry {
  latitude: number;
  longitude: number;
  current?: { time: string; interval: number; cloud_cover: number };
}

// CONUS sample grid, 3° spacing (~180 points)
const GRID = { latMin: 25, latMax: 49, lonMin: -124, lonMax: -67, step: 3 };
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
// Open-Meteo current conditions update every 15 minutes
const CACHE_TTL_MS = 10 * 60 * 1000;

export class WeatherService {
  private readonly lats: number[] = [];
  private readonly lons: number[] = [];
  private cloudCache: {
    points: CloudCoverPoint[];
    fetchedAt: number;
  } | null = null;

  constructor() {
    for (let lat = GRID.latMin; lat <= GRID.latMax; lat += GRID.step) {
      for (let lon = GRID.lonMin; lon <= GRID.lonMax; lon += GRID.step) {
        this.lats.push(lat);
        this.lons.push(lon);
      }
    }
  }

  async cloudCover(): Promise<CloudCoverPoint[]> {
    if (
      this.cloudCache &&
      Date.now() - this.cloudCache.fetchedAt < CACHE_TTL_MS
    ) {
      return this.cloudCache.points;
    }

    const params = new URLSearchParams({
      latitude: this.lats.join(","),
      longitude: this.lons.join(","),
      current: "cloud_cover",
    });
    const res = await fetch(`${OPEN_METEO_URL}?${params}`);
    if (!res.ok) {
      throw new Error(`Open-Meteo request failed: ${res.status}`);
    }
    const entries: ForecastEntry[] = await res.json();

    const points: CloudCoverPoint[] = [];
    for (const entry of entries) {
      if (!entry.current) continue;
      points.push({
        lat: entry.latitude,
        lon: entry.longitude,
        cloudCover: entry.current.cloud_cover,
        time: entry.current.time,
      });
    }

    this.cloudCache = { points, fetchedAt: Date.now() };
    return points;
  }
}

export const Forecast = new WeatherService();
