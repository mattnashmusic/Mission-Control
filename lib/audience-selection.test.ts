import { test } from "node:test";
import assert from "node:assert/strict";
import { getAudienceSelection, type CityCluster } from "./email/audience";

// Nijmegen centre, with one city inside 50 km and two outside it.
const NIJMEGEN = { lat: 51.8126, lng: 5.8372 };

function city(name: string, lat: number, lng: number, count: number): CityCluster {
  return { city: name, country: "NL", lat, lng, count, shareOfAudience: 0 };
}

const clusters = [
  city("Arnhem", 51.9851, 5.8987, 40), // ~20 km, in radius
  city("Venlo", 51.3704, 6.1724, 15), // ~55 km, outside radius
  city("Utrecht", 52.0907, 5.1214, 60), // ~58 km, outside radius
];

// A box around Venlo only.
const venloBox: [number, number][] = [
  [6.0, 51.3],
  [6.3, 51.3],
  [6.3, 51.45],
  [6.0, 51.45],
];

test("radius only matches the old behaviour", () => {
  const result = getAudienceSelection(clusters, NIJMEGEN.lat, NIJMEGEN.lng, 50);
  assert.equal(result.totalContacts, 40);
  assert.deepEqual([...result.selectedKeys], ["Arnhem-NL"]);
});

test("include shape adds cities outside the radius", () => {
  const result = getAudienceSelection(clusters, NIJMEGEN.lat, NIJMEGEN.lng, 50, {
    shapes: [{ id: "a", mode: "include", coordinates: venloBox }],
    includeKeys: [],
    excludeKeys: [],
  });
  assert.equal(result.totalContacts, 55);
  assert.equal(result.radiusContacts, 40);
  assert.equal(result.addedContacts, 15);
  assert.ok(!result.selectedKeys.has("Utrecht-NL"));
});

test("exclude shape and manual toggles", () => {
  const arnhemBox: [number, number][] = [
    [5.8, 51.9],
    [6.0, 51.9],
    [6.0, 52.05],
    [5.8, 52.05],
  ];
  const result = getAudienceSelection(clusters, NIJMEGEN.lat, NIJMEGEN.lng, 50, {
    shapes: [{ id: "x", mode: "exclude", coordinates: arnhemBox }],
    includeKeys: ["Utrecht-NL"],
    excludeKeys: [],
  });
  assert.ok(!result.selectedKeys.has("Arnhem-NL"));
  assert.ok(result.excludedKeys.has("Arnhem-NL"));
  assert.equal(result.excludedContacts, 40);
  assert.ok(result.selectedKeys.has("Utrecht-NL"));
  assert.equal(result.totalContacts, 60);
});

test("manual include beats an exclude shape", () => {
  const result = getAudienceSelection(clusters, NIJMEGEN.lat, NIJMEGEN.lng, 50, {
    shapes: [{ id: "x", mode: "exclude", coordinates: venloBox }],
    includeKeys: ["Venlo-NL"],
    excludeKeys: [],
  });
  assert.ok(result.selectedKeys.has("Venlo-NL"));
});
