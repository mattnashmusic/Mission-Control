"use client";

import { useMemo, useRef, useState } from "react";
import * as turf from "@turf/turf";
import Map, {
  Layer,
  Popup,
  Source,
  type MapMouseEvent,
  type MapTouchEvent,
} from "react-map-gl/mapbox";
import {
  clusterKey,
  type AudienceShape,
  type CityCluster,
  type ShapeMode,
} from "@/lib/email/audience";
import "mapbox-gl/dist/mapbox-gl.css";

type Props = {
  cityClusters: CityCluster[];
  center?: { lat: number; lng: number };
  radiusKm?: number;
  selectedKeys?: Set<string>;
  excludedKeys?: Set<string>;
  shapes?: AudienceShape[];
  /** When set, dragging on the map draws a lasso instead of panning. */
  drawMode?: ShapeMode | null;
  onShapeDrawn?: (coordinates: [number, number][]) => void;
  onToggleCluster?: (key: string, shouldBeIncluded: boolean) => void;
};

type SelectedCluster = {
  key: string;
  city: string;
  country: string;
  count: number;
  shareOfAudience: number;
  lat: number;
  lng: number;
};

type FeatureProperties = {
  key: string;
  city: string;
  country: string;
  count: number;
  shareOfAudience: number;
  lat: number;
  lng: number;
};

const RADIUS_FILL_LAYER_ID = "radius-fill";
const RADIUS_OUTLINE_LAYER_ID = "radius-outline";
const GLOW_LAYER_ID = "fan-glow";
const CORE_LAYER_ID = "fan-core";
const HIGHLIGHT_LAYER_ID = "fan-highlight";

const INCLUDE_COLOR = "#f0c94c";
const EXCLUDE_COLOR = "#ef4444";

// Minimum gap between recorded lasso points, in degrees. Keeps the shape
// light without visibly losing detail at tour-map zoom levels.
const MIN_POINT_GAP = 0.01;

export default function FanMap({
  cityClusters,
  center,
  radiusKm,
  selectedKeys,
  excludedKeys,
  shapes = [],
  drawMode = null,
  onShapeDrawn,
  onToggleCluster,
}: Props) {
  const [selectedCluster, setSelectedCluster] = useState<SelectedCluster | null>(null);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const isDrawing = useRef(false);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: cityClusters.map((cluster) => {
        const key = clusterKey(cluster);
        return {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [cluster.lng, cluster.lat],
          },
          properties: {
            key,
            city: cluster.city,
            country: cluster.country,
            count: cluster.count,
            shareOfAudience: cluster.shareOfAudience,
            lat: cluster.lat,
            lng: cluster.lng,
            isHighlighted: selectedKeys?.has(key) ? 1 : 0,
            isExcluded: excludedKeys?.has(key) ? 1 : 0,
          },
        };
      }),
    };
  }, [cityClusters, selectedKeys, excludedKeys]);

  const radiusGeoJson = useMemo(() => {
    if (!center || !radiusKm) return null;

    return turf.circle([center.lng, center.lat], radiusKm, {
      steps: 128,
      units: "kilometers",
    });
  }, [center, radiusKm]);

  const shapesGeoJson = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: shapes
        .filter((shape) => shape.coordinates.length >= 3)
        .map((shape) => ({
          type: "Feature" as const,
          geometry: {
            type: "Polygon" as const,
            coordinates: [[...shape.coordinates, shape.coordinates[0]]],
          },
          properties: { id: shape.id, mode: shape.mode },
        })),
    };
  }, [shapes]);

  const draftGeoJson = useMemo(() => {
    if (draft.length < 2) return null;
    return {
      type: "Feature" as const,
      geometry: { type: "LineString" as const, coordinates: draft },
      properties: {},
    };
  }, [draft]);

  if (!token) {
    return (
      <div className="flex h-[680px] items-center justify-center rounded-2xl border border-[#2c2c2c] bg-[#0f0f0f] p-6 text-center text-sm text-gray-400">
        Missing NEXT_PUBLIC_MAPBOX_TOKEN in your .env.local file.
      </div>
    );
  }

  const startDraw = (lng: number, lat: number) => {
    if (!drawMode) return;
    isDrawing.current = true;
    setSelectedCluster(null);
    setDraft([[lng, lat]]);
  };

  const extendDraw = (lng: number, lat: number) => {
    if (!isDrawing.current) return;
    setDraft((prev) => {
      const last = prev[prev.length - 1];
      if (last && Math.hypot(last[0] - lng, last[1] - lat) < MIN_POINT_GAP) return prev;
      return [...prev, [lng, lat]];
    });
  };

  const finishDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const points = draft;
    setDraft([]);
    if (points.length < 3) return;

    // Smooth out hand jitter before saving the shape.
    let ring = points;
    try {
      const simplified = turf.simplify(turf.lineString(points), {
        tolerance: 0.005,
        highQuality: true,
      });
      const coords = simplified.geometry.coordinates as [number, number][];
      if (coords.length >= 3) ring = coords;
    } catch {
      // Fall back to the raw points.
    }

    onShapeDrawn?.(ring);
  };

  const handleClick = (event: MapMouseEvent) => {
    if (drawMode) return;

    const feature = (event.features?.[0] ?? null) as
      | {
          geometry?: { type?: string };
          properties?: FeatureProperties;
        }
      | null;

    if (!feature || feature.geometry?.type !== "Point" || !feature.properties) return;

    const props = feature.properties;

    setSelectedCluster({
      key: props.key,
      city: props.city,
      country: props.country,
      count: Number(props.count),
      shareOfAudience: Number(props.shareOfAudience),
      lat: Number(props.lat),
      lng: Number(props.lng),
    });
  };

  const popupIsSelected = selectedCluster ? selectedKeys?.has(selectedCluster.key) ?? false : false;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#1f1f1f]">
      <Map
        initialViewState={{
          longitude: 7.5,
          latitude: 51.5,
          zoom: 4.2,
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={token}
        style={{ width: "100%", height: 680 }}
        interactiveLayerIds={[GLOW_LAYER_ID, CORE_LAYER_ID, HIGHLIGHT_LAYER_ID]}
        onClick={handleClick}
        dragPan={!drawMode}
        cursor={drawMode ? "crosshair" : undefined}
        onMouseDown={(e: MapMouseEvent) => startDraw(e.lngLat.lng, e.lngLat.lat)}
        onMouseMove={(e: MapMouseEvent) => extendDraw(e.lngLat.lng, e.lngLat.lat)}
        onMouseUp={finishDraw}
        onTouchStart={(e: MapTouchEvent) => startDraw(e.lngLat.lng, e.lngLat.lat)}
        onTouchMove={(e: MapTouchEvent) => extendDraw(e.lngLat.lng, e.lngLat.lat)}
        onTouchEnd={finishDraw}
      >
        {radiusGeoJson && (
          <Source id="radius-source" type="geojson" data={radiusGeoJson}>
            <Layer
              id={RADIUS_FILL_LAYER_ID}
              type="fill"
              paint={{
                "fill-color": "#f0c94c",
                "fill-opacity": 0.08,
              }}
            />
            <Layer
              id={RADIUS_OUTLINE_LAYER_ID}
              type="line"
              paint={{
                "line-color": "#f0c94c",
                "line-opacity": 0.5,
                "line-width": 2,
              }}
            />
          </Source>
        )}

        <Source id="audience-shapes" type="geojson" data={shapesGeoJson}>
          <Layer
            id="audience-shapes-fill"
            type="fill"
            paint={{
              "fill-color": ["case", ["==", ["get", "mode"], "exclude"], EXCLUDE_COLOR, INCLUDE_COLOR],
              "fill-opacity": 0.1,
            }}
          />
          <Layer
            id="audience-shapes-outline"
            type="line"
            paint={{
              "line-color": ["case", ["==", ["get", "mode"], "exclude"], EXCLUDE_COLOR, INCLUDE_COLOR],
              "line-opacity": 0.8,
              "line-width": 2,
              "line-dasharray": [2, 1.5],
            }}
          />
        </Source>

        {draftGeoJson && (
          <Source id="audience-draft" type="geojson" data={draftGeoJson}>
            <Layer
              id="audience-draft-line"
              type="line"
              paint={{
                "line-color": drawMode === "exclude" ? EXCLUDE_COLOR : INCLUDE_COLOR,
                "line-width": 3,
              }}
            />
          </Source>
        )}

        <Source id="fans" type="geojson" data={geojson}>
          <Layer
            id={GLOW_LAYER_ID}
            type="circle"
            paint={{
              "circle-color": ["case", ["==", ["get", "isExcluded"], 1], "#6b7280", "#f0c94c"],
              "circle-opacity": ["case", ["==", ["get", "isExcluded"], 1], 0.08, 0.18],
              "circle-blur": 0.6,
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["get", "count"],
                1, 14,
                5, 20,
                10, 26,
                25, 34,
                50, 42,
                100, 54,
              ],
              "circle-stroke-width": 0,
            }}
          />

          <Layer
            id={HIGHLIGHT_LAYER_ID}
            type="circle"
            filter={["==", ["get", "isHighlighted"], 1]}
            paint={{
              "circle-color": "#ffe07a",
              "circle-opacity": 0.18,
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["get", "count"],
                1, 18,
                5, 24,
                10, 30,
                25, 38,
                50, 46,
                100, 58,
              ],
              "circle-stroke-color": "#ffe07a",
              "circle-stroke-opacity": 0.9,
              "circle-stroke-width": 2,
            }}
          />

          <Layer
            id={CORE_LAYER_ID}
            type="circle"
            paint={{
              "circle-color": [
                "case",
                ["==", ["get", "isExcluded"], 1],
                "#6b7280",
                ["==", ["get", "isHighlighted"], 1],
                "#ffe07a",
                "#f0c94c",
              ],
              "circle-opacity": ["case", ["==", ["get", "isExcluded"], 1], 0.6, 0.9],
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["get", "count"],
                1, 5,
                5, 7,
                10, 9,
                25, 12,
                50, 15,
                100, 18,
              ],
              "circle-stroke-color": [
                "case",
                ["==", ["get", "isExcluded"], 1],
                "#9ca3af",
                ["==", ["get", "isHighlighted"], 1],
                "#fff2b0",
                "#ffe07a",
              ],
              "circle-stroke-width": 2,
            }}
          />
        </Source>

        {selectedCluster && (
          <Popup
            longitude={selectedCluster.lng}
            latitude={selectedCluster.lat}
            closeButton
            closeOnClick={false}
            onClose={() => setSelectedCluster(null)}
            offset={18}
            className="fan-popup"
          >
            <div className="min-w-[180px]">
              <p className="text-base font-semibold text-[#111]">
                {selectedCluster.city}
              </p>
              <p className="text-sm text-[#444]">{selectedCluster.country}</p>
              <div className="mt-3 text-sm font-medium text-[#111]">
                {selectedCluster.count} contact{selectedCluster.count === 1 ? "" : "s"}
              </div>
              <div className="mt-1 text-xs text-[#666]">
                {selectedCluster.shareOfAudience.toFixed(1)}% of total audience
              </div>
              {onToggleCluster && (
                <button
                  onClick={() => onToggleCluster(selectedCluster.key, !popupIsSelected)}
                  className={`mt-3 w-full rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    popupIsSelected
                      ? "border border-[#d1d5db] text-[#b91c1c]"
                      : "bg-[#111] text-[#f0c94c]"
                  }`}
                >
                  {popupIsSelected ? "Remove from audience" : "Add to audience"}
                </button>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
