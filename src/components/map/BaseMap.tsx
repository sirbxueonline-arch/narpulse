"use client";

import * as React from "react";
import maplibregl, { Map as MlMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { NARIMANOV_CENTER } from "@/lib/utils";
import { cn } from "@/lib/utils";

type MapMode = "streets" | "satellite";

const STREETS_BG = "#f4f1e9";
const SATELLITE_BG = "#0b1a2b";

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "carto-streets": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap, © CARTO",
      maxzoom: 19,
    },
    "esri-imagery": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles © Esri — Sources: Esri, Maxar, Earthstar Geographics",
      maxzoom: 19,
    },
    "carto-labels": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap, © CARTO",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "background-layer",
      type: "background",
      paint: { "background-color": STREETS_BG },
    },
    {
      id: "carto-streets-layer",
      type: "raster",
      source: "carto-streets",
      paint: { "raster-opacity": 1 },
    },
    {
      id: "esri-imagery-layer",
      type: "raster",
      source: "esri-imagery",
      paint: { "raster-opacity": 0 },
    },
    {
      id: "carto-labels-layer",
      type: "raster",
      source: "carto-labels",
      paint: { "raster-opacity": 0 },
    },
  ],
};

function applyMapMode(map: MlMap, mode: MapMode) {
  try {
    map.setPaintProperty(
      "carto-streets-layer",
      "raster-opacity",
      mode === "streets" ? 1 : 0
    );
    map.setPaintProperty(
      "esri-imagery-layer",
      "raster-opacity",
      mode === "satellite" ? 1 : 0
    );
    map.setPaintProperty(
      "carto-labels-layer",
      "raster-opacity",
      mode === "satellite" ? 0.95 : 0
    );
    map.setPaintProperty(
      "background-layer",
      "background-color",
      mode === "satellite" ? SATELLITE_BG : STREETS_BG
    );
  } catch {
    // Style may not be ready yet; the load handler will retry.
  }
}

class StyleToggleControl implements maplibregl.IControl {
  private container: HTMLDivElement | null = null;
  constructor(
    private getMode: () => MapMode,
    private setMode: (mode: MapMode) => void
  ) {}
  onAdd() {
    const wrap = document.createElement("div");
    wrap.className =
      "maplibregl-ctrl maplibregl-ctrl-group np-style-toggle";
    wrap.style.cssText =
      "display:flex;padding:3px;gap:2px;background:#ffffff;border:1px solid #e6e2d6;border-radius:10px;box-shadow:0 4px 12px rgba(28,24,16,0.10);";
    const make = (label: string, mode: MapMode) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.dataset.mode = mode;
      b.style.cssText =
        "border:0;background:transparent;color:#4a5266;font-weight:700;font-size:11px;letter-spacing:0.04em;text-transform:uppercase;padding:6px 10px;border-radius:7px;cursor:pointer;transition:background 0.15s ease, color 0.15s ease;";
      b.addEventListener("click", () => {
        this.setMode(mode);
        this.refresh();
      });
      return b;
    };
    const a = make("Küçə", "streets");
    const b = make("Peyk", "satellite");
    wrap.appendChild(a);
    wrap.appendChild(b);
    this.container = wrap;
    this.refresh();
    return wrap;
  }
  refresh() {
    if (!this.container) return;
    const mode = this.getMode();
    this.container.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      if (b.dataset.mode === mode) {
        b.style.background = "#1a1f2e";
        b.style.color = "#ffffff";
      } else {
        b.style.background = "transparent";
        b.style.color = "#4a5266";
      }
    });
  }
  onRemove() {
    this.container?.remove();
    this.container = null;
  }
}

const MODE_STORAGE_KEY = "narpulse:map-mode";

function readStoredMode(): MapMode {
  if (typeof window === "undefined") return "streets";
  try {
    const v = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (v === "satellite" || v === "streets") return v;
  } catch {}
  return "streets";
}

function storeMode(mode: MapMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {}
}

export type BaseMapProps = {
  className?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
  onReady?: (map: MlMap) => void;
  onMapClick?: (e: maplibregl.MapMouseEvent) => void;
  cursor?: string;
};

export default function BaseMap({
  className,
  initialCenter = NARIMANOV_CENTER,
  initialZoom = 13.4,
  onReady,
  onMapClick,
  cursor,
}: BaseMapProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MlMap | null>(null);
  const modeRef = React.useRef<MapMode>(readStoredMode());
  const onReadyRef = React.useRef(onReady);
  const onMapClickRef = React.useRef(onMapClick);

  React.useEffect(() => {
    onReadyRef.current = onReady;
    onMapClickRef.current = onMapClick;
  });

  React.useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE,
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 11,
      maxZoom: 18,
      attributionControl: { compact: true },
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );
    map.addControl(
      new StyleToggleControl(
        () => modeRef.current,
        (mode) => {
          modeRef.current = mode;
          storeMode(mode);
          applyMapMode(map, mode);
        }
      ),
      "top-right"
    );
    map.on("load", () => {
      applyMapMode(map, modeRef.current);
      onReadyRef.current?.(map);
    });
    map.on("error", (e) => {
      // eslint-disable-next-line no-console
      console.warn("[narpulse map]", e?.error?.message || e);
    });
    map.on("click", (e) => onMapClickRef.current?.(e));
    mapRef.current = map;
    if (typeof window !== "undefined") {
      (window as unknown as { __npMap?: MlMap }).__npMap = map;
    }
    requestAnimationFrame(() => map.resize());
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = cursor ?? "";
  }, [cursor]);

  return <div ref={ref} className={cn("h-full w-full", className)} />;
}
