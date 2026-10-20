import * as turf from "@turf/turf";

export type CityCluster = {
  city: string;
  country: string;
  lat: number;
  lng: number;
  count: number;
  shareOfAudience: number;
  emails?: string[];
  mailerLiteEmails?: string[];
  shopifyOnlyEmails?: string[];
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

// ---------------------------------------------------------------------------
// Refinements: hand-drawn areas and per-city toggles layered on top of the
// radius, so an audience can follow real geography instead of a perfect circle.
// ---------------------------------------------------------------------------

export type ShapeMode = "include" | "exclude";

export type AudienceShape = {
  id: string;
  mode: ShapeMode;
  label?: string;
  // Closed ring of [lng, lat] pairs. The first point need not repeat at the end.
  coordinates: [number, number][];
};

export type AudienceRefinements = {
  shapes: AudienceShape[];
  includeKeys: string[];
  excludeKeys: string[];
};

export const EMPTY_REFINEMENTS: AudienceRefinements = {
  shapes: [],
  includeKeys: [],
  excludeKeys: [],
};

export type SelectionSource = "radius" | "shape" | "manual";

export type AudienceSelection = {
  clusters: (CityCluster & { source: SelectionSource })[];
  totalContacts: number;
  radiusContacts: number;
  addedContacts: number;
  excludedContacts: number;
  selectedKeys: Set<string>;
  excludedKeys: Set<string>;
};

export function clusterKey(cluster: { city: string; country: string }) {
  return `${cluster.city}-${cluster.country}`;
}

function toPolygon(shape: AudienceShape) {
  const ring = [...shape.coordinates];
  if (ring.length < 3) return null;
  const [firstLng, firstLat] = ring[0];
  const [lastLng, lastLat] = ring[ring.length - 1];
  if (firstLng !== lastLng || firstLat !== lastLat) ring.push(ring[0]);
  try {
    return turf.polygon([ring]);
  } catch {
    return null;
  }
}

/**
 * A city is in the audience when it is inside the radius, inside an
 * include shape, or manually added — and not inside an exclude shape or
 * manually removed. Manual toggles win over shapes, so a single city can
 * always be pulled back in or out regardless of what was drawn.
 */
export function getAudienceSelection(
  clusters: CityCluster[],
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  refinements: AudienceRefinements = EMPTY_REFINEMENTS
): AudienceSelection {
  const center = turf.point([centerLng, centerLat]);
  const includePolys = refinements.shapes
    .filter((shape) => shape.mode === "include")
    .map(toPolygon)
    .filter((poly): poly is NonNullable<typeof poly> => poly !== null);
  const excludePolys = refinements.shapes
    .filter((shape) => shape.mode === "exclude")
    .map(toPolygon)
    .filter((poly): poly is NonNullable<typeof poly> => poly !== null);
  const manualIn = new Set(refinements.includeKeys);
  const manualOut = new Set(refinements.excludeKeys);

  const selected: (CityCluster & { source: SelectionSource })[] = [];
  const selectedKeys = new Set<string>();
  const excludedKeys = new Set<string>();
  let radiusContacts = 0;
  let addedContacts = 0;
  let excludedContacts = 0;

  for (const cluster of clusters) {
    const key = clusterKey(cluster);
    const point = turf.point([cluster.lng, cluster.lat]);
    const inRadius = turf.distance(center, point, { units: "kilometers" }) <= radiusKm;
    const inIncludeShape = includePolys.some((poly) => turf.booleanPointInPolygon(point, poly));
    const inExcludeShape = excludePolys.some((poly) => turf.booleanPointInPolygon(point, poly));

    let included: boolean;
    let source: SelectionSource;

    if (manualIn.has(key)) {
      included = true;
      source = inRadius ? "radius" : "manual";
    } else if (manualOut.has(key)) {
      included = false;
      source = "manual";
    } else {
      included = (inRadius || inIncludeShape) && !inExcludeShape;
      source = inRadius ? "radius" : "shape";
    }

    if (included) {
      selected.push({ ...cluster, source });
      selectedKeys.add(key);
      if (source === "radius") radiusContacts += cluster.count;
      else addedContacts += cluster.count;
    } else if (inRadius || inIncludeShape || manualOut.has(key)) {
      // Would have been in the audience without an exclusion.
      excludedKeys.add(key);
      excludedContacts += cluster.count;
    }
  }

  return {
    clusters: selected.sort((a, b) => b.count - a.count),
    totalContacts: radiusContacts + addedContacts,
    radiusContacts,
    addedContacts,
    excludedContacts,
    selectedKeys,
    excludedKeys,
  };
}

export function hasRefinements(refinements: AudienceRefinements) {
  return (
    refinements.shapes.length > 0 ||
    refinements.includeKeys.length > 0 ||
    refinements.excludeKeys.length > 0
  );
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