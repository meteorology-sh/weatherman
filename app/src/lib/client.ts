// Types
import type { CloudCoverPoint } from "@/lib/types";

export async function GetCloudCover(): Promise<CloudCoverPoint[]> {
  const res = await fetch("/weather/cloud-cover");
  if (!res.ok) {
    throw new Error(`Failed to fetch cloud cover: ${res.status}`);
  }
  const points: CloudCoverPoint[] = await res.json();
  return points;
}
