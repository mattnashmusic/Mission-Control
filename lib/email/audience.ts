import * as turf from "@turf/turf";

export type CityCluster = {
  city: string;
  country: string;
  lat: number;
  lng: number;
  count: number;
  shareOfAudience: number;
};

export function getAudienceInRadius(
  clusters: CityCluster[],
  centerLat: number,
  centerLng: number,
  radiusKm: number
) {
  const center = turf.point([centerLng, centerLat]);

  const within = clusters.filter((cluster) => {
    const point = turf.point([cluster.lng, cluster.lat]);
    const distance = turf.distance(center, point, { units: "kilometers" });
    return distance <= radiusKm;
  });

  const totalContacts = within.reduce((sum, cluster) => sum + cluster.count, 0);

  return {
    clusters: within.sort((a, b) => b.count - a.count),
    totalContacts,
  };
}

export function calculateClusterShares(
  clusters: Array<{
    city: string;
    country: string;
    lat: number;
    lng: number;
    count: number;
  }>
): CityCluster[] {
  const total = clusters.reduce((sum, cluster) => sum + cluster.count, 0) || 1;

  return clusters
    .map((cluster) => ({
      ...cluster,
      shareOfAudience: (cluster.count / total) * 100,
    }))
    .sort((a, b) => b.count - a.count);
}