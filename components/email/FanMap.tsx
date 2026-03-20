"use client";

import { useMemo, useState } from "react";
import * as turf from "@turf/turf";
import Map, { Layer, Popup, Source, type MapLayerMouseEvent } from "react-map-gl/mapbox";
import type { CityCluster } from "@/lib/email/audience";
import "mapbox-gl/dist/mapbox-gl.css";

type Props = {
  cityClusters: CityCluster[];
  center?: { lat: number; lng: number };
  radiusKm?: number;
  highlightedKeys?: string[];
};

type SelectedCluster = {
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

export default function FanMap({
  cityClusters,
  center,
  radiusKm,
  highlightedKeys = [],
}: Props) {
  const [selectedCluster, setSelectedCluster] = useState<SelectedCluster | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: cityClusters.map((cluster) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [cluster.lng, cluster.lat],
        },
        properties: {
          key: `${cluster.city}-${cluster.country}`,
          city: cluster.city,
          country: cluster.country,
          count: cluster.count,
          shareOfAudience: cluster.shareOfAudience,
          lat: cluster.lat,
          lng: cluster.lng,
          isHighlighted: highlightedKeys.includes(`${cluster.city}-${cluster.country}`) ? 1 : 0,
        },
      })),
    };
  }, [cityClusters, highlightedKeys]);

  const radiusGeoJson = useMemo(() => {
    if (!center || !radiusKm) return null;

    return turf.circle([center.lng, center.lat], radiusKm, {
      steps: 128,
      units: "kilometers",
    });
  }, [center, radiusKm]);

  if (!token) {
    return (
      <div className="flex h-[680px] items-center justify-center rounded-2xl border border-[#2c2c2c] bg-[#0f0f0f] p-6 text-center text-sm text-gray-400">
        Missing NEXT_PUBLIC_MAPBOX_TOKEN in your .env.local file.
      </div>
    );
  }

  const handleClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature || feature.geometry.type !== "Point") return;

    const props = feature.properties as {
      city: string;
      country: string;
      count: number;
      shareOfAudience: number;
      lat: number;
      lng: number;
    };

    setSelectedCluster({
      city: props.city,
      country: props.country,
      count: Number(props.count),
      shareOfAudience: Number(props.shareOfAudience),
      lat: Number(props.lat),
      lng: Number(props.lng),
    });
  };

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

        <Source id="fans" type="geojson" data={geojson}>
          <Layer
            id={GLOW_LAYER_ID}
            type="circle"
            paint={{
              "circle-color": "#f0c94c",
              "circle-opacity": 0.18,
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
                ["==", ["get", "isHighlighted"], 1],
                "#ffe07a",
                "#f0c94c",
              ],
              "circle-opacity": 0.9,
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
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}