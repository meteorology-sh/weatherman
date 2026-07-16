export interface CloudCoverPoint {
  lat: number;
  lon: number;
  cloudCover: number;
  time: string;
}

export interface CloudPointI {
  type: "Feature";
  properties: {
    cloudCover: number;
    lat: number;
    lon: number;
    time: string;
  };
  geometry: {
    coordinates: [number, number];
    type: "Point";
  };
  id: number;
}

export interface GeoJSON<T = CloudPointI> {
  type: "FeatureCollection";
  features: Array<T>;
}
