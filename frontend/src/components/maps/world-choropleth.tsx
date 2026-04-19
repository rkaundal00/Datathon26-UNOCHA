"use client";

import "leaflet/dist/leaflet.css";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { MapMetric } from "@/lib/url-state";
import { colorForRow, PALETTE } from "./color-scales";
import type { MapRow } from "./map-data";
import { numericToIso3 } from "@/lib/iso-map";
import { MapTooltip, type TooltipState } from "./map-tooltip";
import { ZoomControls } from "./zoom-controls";

const DEFAULT_CENTER: L.LatLngExpression = [20, 0];
const DEFAULT_ZOOM = 2;
const MIN_ZOOM = 2;
const MAX_ZOOM = 8;
const FOCUS_MAX_ZOOM = 5;

const CARTO_BASE_URL =
  "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://carto.com/attributions">CARTO</a>';

const CONTINENTS: { name: string; latlng: [number, number] }[] = [
  { name: "North America", latlng: [45, -100] },
  { name: "South America", latlng: [-15, -60] },
  { name: "Europe", latlng: [52, 15] },
  { name: "Africa", latlng: [2, 20] },
  { name: "Asia", latlng: [45, 95] },
  { name: "Oceania", latlng: [-25, 135] },
];

const COUNTRY_LABEL_MIN_ZOOM = 4;

function continentIcon(name: string): L.DivIcon {
  return L.divIcon({
    className: "continent-label",
    html: `<span>${name}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function countryIcon(name: string): L.DivIcon {
  return L.divIcon({
    className: "country-label-marker",
    html: `<span>${name}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

interface CountryLabel { key: string; name: string; latlng: [number, number] }

function bboxCenter(ring: number[][]): { center: [number, number]; area: number } {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const pt of ring) {
    const lng = pt[0], lat = pt[1];
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return {
    center: [(minLat + maxLat) / 2, (minLng + maxLng) / 2],
    area: (maxLng - minLng) * (maxLat - minLat),
  };
}

function featureLabelPosition(feature: Feature<Geometry>): [number, number] | null {
  const g = feature.geometry;
  if (!g) return null;
  if (g.type === "Polygon") {
    return bboxCenter(g.coordinates[0] as number[][]).center;
  }
  if (g.type === "MultiPolygon") {
    let best: { center: [number, number]; area: number } | null = null;
    for (const poly of g.coordinates as number[][][][]) {
      const c = bboxCenter(poly[0] as number[][]);
      if (!best || c.area > best.area) best = c;
    }
    return best?.center ?? null;
  }
  return null;
}

export interface MapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  panToIso3: (iso3: string) => void;
}

interface Props {
  features: FeatureCollection;
  rows: Map<string, MapRow>;
  metric: MapMetric;
  focusIso: string | null;
  onSelect: (iso3: string | null) => void;
}

function styleFor(
  feature: Feature | undefined,
  rows: Map<string, MapRow>,
  metric: MapMetric,
  focusIso: string | null,
): L.PathOptions {
  if (!feature) return {};
  const iso3 = numericToIso3(feature.id as string | number);
  const row = iso3 ? rows.get(iso3) : undefined;
  const fill = row ? colorForRow(metric, row) : PALETTE.excluded;
  const isFocus = Boolean(iso3 && focusIso === iso3);
  const hairline = row?.inCohort
    ? "rgba(255,255,255,0.85)"
    : "rgba(100,100,100,0.25)";
  return {
    fillColor: fill,
    fillOpacity: row ? 0.86 : 0.55,
    weight: isFocus ? 1.9 : row?.inCohort ? 0.6 : 0.4,
    color: isFocus ? "#3c6b64" : hairline,
    opacity: 1,
    lineCap: "round",
    lineJoin: "round",
  };
}

export const WorldChoropleth = forwardRef<MapHandle, Props>(function WorldChoropleth(
  { features, rows, metric, focusIso, onSelect },
  handleRef,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoJsonRef = useRef<L.GeoJSON | null>(null);
  const isoToLayer = useRef<Map<string, L.Polygon>>(new Map());
  const layerToIso = useRef<WeakMap<L.Layer, string>>(new WeakMap());
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);

  const countryLabels = useMemo<CountryLabel[]>(() => {
    const out: CountryLabel[] = [];
    features.features.forEach((f, idx) => {
      if (String(f.id) === "10") return; // skip Antarctica
      const name = ((f.properties ?? {}) as { name?: string }).name;
      if (!name) return;
      const pos = featureLabelPosition(f as Feature<Geometry>);
      if (!pos) return;
      const key = f.id != null ? `${String(f.id)}-${name}` : `idx-${idx}-${name}`;
      out.push({ key, name, latlng: pos });
    });
    return out;
  }, [features]);

  // Mirror latest values into refs so event callbacks (bound once per layer) read fresh values.
  const rowsRef = useRef(rows);
  const metricRef = useRef(metric);
  const focusRef = useRef(focusIso);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    rowsRef.current = rows;
    metricRef.current = metric;
    focusRef.current = focusIso;
    onSelectRef.current = onSelect;
  }, [rows, metric, focusIso, onSelect]);

  // Re-style all layers when metric, focus, or rows change.
  useEffect(() => {
    const gj = geoJsonRef.current;
    if (!gj) return;
    gj.eachLayer((layer) => {
      const f = (layer as unknown as { feature?: Feature }).feature;
      (layer as L.Path).setStyle(styleFor(f, rows, metric, focusIso));
    });
  }, [rows, metric, focusIso]);

  const relativeXY = useCallback((ev: MouseEvent | L.LeafletMouseEvent): { x: number; y: number } => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const src = "originalEvent" in ev ? (ev.originalEvent as unknown as globalThis.MouseEvent) : (ev as unknown as globalThis.MouseEvent);
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }, []);

  const onEachFeature = useCallback((feature: Feature<Geometry>, layer: L.Layer) => {
    const iso3 = numericToIso3(feature.id as string | number);
    if (iso3) {
      isoToLayer.current.set(iso3, layer as L.Polygon);
      layerToIso.current.set(layer, iso3);
    }
    const path = layer as L.Path;

    layer.on({
      mouseover: (e: L.LeafletMouseEvent) => {
        const currentIso = layerToIso.current.get(layer) ?? null;
        const row = currentIso ? rowsRef.current.get(currentIso) ?? null : null;
        const props = (feature.properties ?? {}) as { name?: string };
        const { x, y } = relativeXY(e);
        setTooltip({ row, unknownIso: currentIso ?? undefined, unknownName: props.name, x, y });

        // Subtle hover outline bump without re-styling everything.
        if (!(currentIso && focusRef.current === currentIso)) {
          path.setStyle({
            weight: row?.inCohort ? 1.1 : 0.6,
            color: "rgba(60,107,100,0.8)",
          });
          path.bringToFront();
        }
      },
      mousemove: (e: L.LeafletMouseEvent) => {
        const { x, y } = relativeXY(e);
        setTooltip((t) => (t ? { ...t, x, y } : t));
      },
      mouseout: () => {
        setTooltip(null);
        const f = (layer as unknown as { feature?: Feature }).feature;
        path.setStyle(styleFor(f, rowsRef.current, metricRef.current, focusRef.current));
      },
      click: (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        const currentIso = layerToIso.current.get(layer) ?? null;
        if (currentIso) onSelectRef.current(currentIso);
      },
    });
  }, [relativeXY]);

  const api: MapHandle = useMemo(
    () => ({
      zoomIn() {
        mapRef.current?.zoomIn();
      },
      zoomOut() {
        mapRef.current?.zoomOut();
      },
      reset() {
        mapRef.current?.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 0.6 });
      },
      panToIso3(iso3: string) {
        const layer = isoToLayer.current.get(iso3);
        const m = mapRef.current;
        if (!layer || !m) return;
        const bounds = layer.getBounds();
        m.flyToBounds(bounds, { maxZoom: FOCUS_MAX_ZOOM, padding: [40, 40], duration: 0.6 });
      },
    }),
    [],
  );

  useImperativeHandle(handleRef, () => api, [api]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-xl border border-border bg-surface"
    >
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        worldCopyJump
        zoomControl={false}
        attributionControl
        preferCanvas={false}
        style={{ height: "100%", width: "100%", background: "var(--surface-2)" }}
        ref={(instance) => {
          mapRef.current = instance;
        }}
      >
        <TileLayer
          url={CARTO_BASE_URL}
          attribution={CARTO_ATTRIBUTION}
          subdomains="abcd"
          crossOrigin
        />
        <GeoJSON
          data={features}
          style={(f) => styleFor(f, rowsRef.current, metricRef.current, focusRef.current)}
          onEachFeature={onEachFeature}
          ref={(instance) => {
            geoJsonRef.current = instance;
          }}
        />
        {zoomLevel < COUNTRY_LABEL_MIN_ZOOM &&
          CONTINENTS.map((c) => (
            <Marker
              key={c.name}
              position={c.latlng}
              icon={continentIcon(c.name)}
              interactive={false}
              keyboard={false}
            />
          ))}
        {zoomLevel >= COUNTRY_LABEL_MIN_ZOOM &&
          countryLabels.map((l) => (
            <Marker
              key={l.key}
              position={l.latlng}
              icon={countryIcon(l.name)}
              interactive={false}
              keyboard={false}
            />
          ))}
        <ZoomWatcher onZoom={setZoomLevel} />
        <BackgroundClick onClear={() => onSelect(null)} />
      </MapContainer>

      <MapTooltip state={tooltip} metric={metric} />
      <ZoomControls onZoomIn={api.zoomIn} onZoomOut={api.zoomOut} onReset={api.reset} />
    </div>
  );
});

function BackgroundClick({ onClear }: { onClear: () => void }) {
  useMapEvents({
    click: () => {
      onClear();
    },
  });
  return null;
}

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  });
  return null;
}
