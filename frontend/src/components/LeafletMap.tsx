import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { GeoJsonFeature } from '../lib/types';

interface Station {
  index: number;
  lat: number;
  lng: number;
  label: string;
  btm?: string;
}

export interface MeasureResult {
  pointsCount: number;
  totalMeters: number;
  totalFeet: number;
  totalGaj: number;
  totalLinks: number;
  areaSqFt?: number;
  areaDecimal?: number;
  areaKatha?: number;
}

interface LeafletMapProps {
  geojson?: GeoJsonFeature | any;
  mouza?: string;
  dagNo?: string;
  activeLayer?: string;
  areaDecimal?: number;
  landClass?: string;
  isMeasuring?: boolean;
  showBuffer?: boolean;
  /** 0 (fully transparent) to 1 (fully opaque). Only affects the cadastral overlay layer — the satellite base stays fixed underneath. */
  overlayOpacity?: number;
  adjacentParcels?: import('../lib/types').AdjacentParcel[];
  onStationSelect?: (st: Station) => void;
  onMeasureUpdate?: (res: MeasureResult | null) => void;
  className?: string;
}

const LAYER_TILES: Record<string, { url: string; attribution: string; maxZoom?: number }> = {
  bds: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap &middot; Bangladesh Digital Survey (BDS Cadastre 2026)',
    maxZoom: 19,
  },
  sat: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar &middot; High-Resolution Satellite Orthophoto',
    maxZoom: 19,
  },
  bs: {
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; Humanitarian OSM &middot; BS Survey Sheet (2015 Digitized)',
    maxZoom: 19,
  },
  rs: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap &middot; RS Revisional Survey Cadastral Sheet (1984)',
    maxZoom: 17,
  },
  cs: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; National Geographic / DLRS Historical Archive &middot; CS Cadastre (1924)',
    maxZoom: 16,
  },
};

// 1.5 ft legal setback tolerance line, in metres.
const BUFFER_METERS = 1.5 / 3.28084;

// ponytail: radial offset from the polygon centroid, not a true geometric
// Minkowski buffer — fine for the near-convex rectangular plots this app
// deals with; swap for turf.js buffer() if oddly-shaped/concave plots show up.
function bufferRingCoords(coords: number[][], distanceMeters: number): number[][] {
  const cLng = coords.reduce((a, c) => a + c[0], 0) / coords.length;
  const cLat = coords.reduce((a, c) => a + c[1], 0) / coords.length;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((cLat * Math.PI) / 180) || 1;
  return coords.map(([lng, lat]) => {
    const dx = (lng - cLng) * mPerDegLng;
    const dy = (lat - cLat) * mPerDegLat;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const scale = (len + distanceMeters) / len;
    return [cLng + (dx * scale) / mPerDegLng, cLat + (dy * scale) / mPerDegLat];
  });
}

import { toBTM, toLinks, toGaj, toFeet, azimuth, compassBearing } from '../lib/format';
import { gsap, prefersReducedMotion } from '../lib/gsap';

export default function LeafletMap({
  geojson,
  mouza = 'Tetuljhora',
  dagNo = '1204',
  activeLayer = 'bds',
  areaDecimal = 5.5,
  landClass = 'Homestead',
  isMeasuring = false,
  showBuffer = false,
  overlayOpacity = 1,
  adjacentParcels = [],
  onStationSelect,
  onMeasureUpdate,
  className = 'h-[440px] w-full',
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  // Satellite orthophoto stays mounted underneath permanently; the selected
  // cadastral epoch (bds/bs/rs/cs) is layered on top with adjustable opacity
  // so historical scanned sheets can be faded against the modern imagery.
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayerRef = useRef<L.TileLayer | null>(null);
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null);
  const bufferGroupRef = useRef<L.LayerGroup | null>(null);
  const adjacentGroupRef = useRef<L.LayerGroup | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const measureGroupRef = useRef<L.LayerGroup | null>(null);

  const measurePointsRef = useRef<L.LatLng[]>([]);
  const redrawMeasureRef = useRef<() => void>(() => {});

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenter: [number, number] = [23.843, 90.2585];
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 17,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    });

    const base = L.tileLayer(LAYER_TILES.sat.url, {
      attribution: LAYER_TILES.sat.attribution,
      maxZoom: LAYER_TILES.sat.maxZoom || 19,
    }).addTo(map);
    baseLayerRef.current = base;

    bufferGroupRef.current = L.layerGroup().addTo(map);
    adjacentGroupRef.current = L.layerGroup().addTo(map);
    markersGroupRef.current = L.layerGroup().addTo(map);
    measureGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Fix grey/blank tile bug caused by flex layouts, tabs, and GSAP entry animations
    const invalidate = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };
    const t1 = setTimeout(invalidate, 150);
    const t2 = setTimeout(invalidate, 600);

    const resizeObserver = new ResizeObserver(() => {
      invalidate();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Swap the cadastral overlay layer when the selected epoch changes. The
  // satellite base underneath is never touched here.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (overlayLayerRef.current) {
      map.removeLayer(overlayLayerRef.current);
      overlayLayerRef.current = null;
    }

    if (activeLayer !== 'sat') {
      const config = LAYER_TILES[activeLayer] || LAYER_TILES.bds;
      const overlay = L.tileLayer(config.url, {
        attribution: config.attribution,
        maxZoom: config.maxZoom || 19,
        opacity: overlayOpacity,
      }).addTo(map);
      overlayLayerRef.current = overlay;
    }
    map.invalidateSize();
    // overlayOpacity intentionally excluded — its own effect below updates
    // opacity in place so dragging the slider never re-fetches tiles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayer]);

  // Live opacity updates via setOpacity — no tile layer rebuild.
  useEffect(() => {
    overlayLayerRef.current?.setOpacity(overlayOpacity);
  }, [overlayOpacity]);

  // Update GeoJSON polygon, buffer ring, adjacent plots, and vertex station markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clean previous layers
    if (geojsonLayerRef.current) {
      map.removeLayer(geojsonLayerRef.current);
      geojsonLayerRef.current = null;
    }
    if (markersGroupRef.current) {
      markersGroupRef.current.clearLayers();
    }
    if (adjacentGroupRef.current) {
      adjacentGroupRef.current.clearLayers();
    }
    if (bufferGroupRef.current) {
      bufferGroupRef.current.clearLayers();
    }

    let coords: number[][] = [];
    if (geojson?.geometry?.coordinates?.[0]?.length >= 3) {
      coords = geojson.geometry.coordinates[0];
    } else {
      coords = [
        [90.2581, 23.8432],
        [90.2592, 23.8435],
        [90.2595, 23.8427],
        [90.2583, 23.8424],
        [90.2581, 23.8432],
      ];
    }

    // Legal setback buffer / tolerance line around the subject parcel
    if (showBuffer) {
      const bufferCoords = bufferRingCoords(coords, BUFFER_METERS);
      const bufferPoly = L.polygon(
        bufferCoords.map((pt) => [pt[1], pt[0]] as [number, number]),
        { color: '#c07a1f', weight: 1.5, dashArray: '3, 5', fill: false }
      );
      bufferPoly.bindTooltip(
        'সীমানা বাফার: ১.৫ ফুট আইনি সহনসীমা (Legal Setback Tolerance: 1.5 ft)',
        { sticky: true }
      );
      bufferGroupRef.current?.addLayer(bufferPoly);
    }

    // Render Adjacent Plots if provided
    if (adjacentParcels && adjacentParcels.length > 0) {
      // Offset coords slightly to create adjacent polygons
      const adj1Coords = [
        [coords[0][0] - 0.0011, coords[0][1] + 0.0007],
        [coords[1][0] - 0.0004, coords[1][1] + 0.0008],
        [coords[1][0], coords[1][1]],
        [coords[0][0], coords[0][1]],
        [coords[0][0] - 0.0011, coords[0][1] + 0.0007],
      ];

      const adj2Coords = [
        [coords[3][0], coords[3][1]],
        [coords[2][0], coords[2][1]],
        [coords[2][0] + 0.0005, coords[2][1] - 0.0008],
        [coords[3][0] - 0.0002, coords[3][1] - 0.0009],
        [coords[3][0], coords[3][1]],
      ];

      const adjLayers = [
        { coords: adj1Coords, meta: adjacentParcels[0] || { dagNo: '1203', encroachmentStatus: 'VARIANCE_FLAG', owner: 'Neighbor', overlapDiffSqFt: 0 } },
        { coords: adj2Coords, meta: adjacentParcels[1] || { dagNo: '1205', encroachmentStatus: 'CLEAR', owner: 'Adjacent Owner', overlapDiffSqFt: 0 } },
      ];

      adjLayers.forEach(({ coords: c, meta }) => {
        const flagged = meta.encroachmentStatus === 'VARIANCE_FLAG';
        const color = flagged ? '#a8322a' : '#4a7fb5';
        const poly = L.polygon(
          c.map((pt) => [pt[1], pt[0]] as [number, number]),
          {
            color,
            weight: flagged ? 2.5 : 1.5,
            dashArray: '4, 4',
            fillColor: color,
            fillOpacity: flagged ? 0.28 : 0.08,
          }
        );
        const overlapSqFt = meta.overlapDiffSqFt ?? 0;
        const overlapDecimal = overlapSqFt / 435.6;
        poly.bindTooltip(
          `<b>দাগ নং ${meta.dagNo} (পাশ্ববর্তী প্লট)</b><br/>মালিক: ${meta.owner}<br/>` +
            (flagged
              ? `<span style="color:#a8322a;font-weight:bold;">⚠️ সীমানা বিরোধ: ${overlapSqFt.toFixed(1)} বর্গফুট (${overlapDecimal.toFixed(3)} শতক) সম্ভাব্য ওভারল্যাপ</span>`
              : '<span style="color:#116149;">✓ সীমানা সুনির্দিষ্ট</span>')
        );
        adjacentGroupRef.current?.addLayer(poly);
      });
    }

    // Leaflet Main Polygon GeoJSON
    const polygonFeature: GeoJSON.Feature = {
      type: 'Feature',
      properties: {
        mouza,
        dagNo,
        areaDecimal,
        landClass,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [coords],
      },
    };

    const isSatellite = activeLayer === 'sat';
    const geoLayer = L.geoJSON(polygonFeature, {
      style: {
        color: isSatellite ? '#00f0ff' : '#22456e',
        weight: 3,
        opacity: 0.95,
        fillColor: isSatellite ? '#00f0ff' : '#22456e',
        fillOpacity: isSatellite ? 0.22 : 0.16,
        dashArray: '5, 5',
      },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`
          <div style="font-family: sans-serif; font-size: 13px; line-height: 1.4; color: #14181a;">
            <strong style="font-size: 14px; color: #22456e;">দাগ নং ${dagNo} (নির্বাচিত প্লট)</strong><br/>
            <span>মৌজা: ${mouza}</span><br/>
            <span>রেকর্ডকৃত জমি: <b>${areaDecimal} শতক</b> (${landClass})</span><br/>
            <span style="font-size: 11px; color: #666;">BDS 2026 Drone RTK GNSS Cadastral Vector</span>
          </div>
        `);
      },
    }).addTo(map);

    geojsonLayerRef.current = geoLayer;

    // Fit map bounds to the parcel polygon with smooth animation
    const bounds = geoLayer.getBounds();
    if (bounds.isValid()) {
      map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 18, duration: 0.6 });
    }

    // Add survey station benchmark node markers at each polygon vertex
    const uniqueCoords = coords.slice(
      0,
      coords.length > 3 && coords[0][0] === coords[coords.length - 1][0] ? -1 : undefined
    );

    const stationLabels = ['NW Station', 'NE Station', 'SE Station', 'SW Station', 'ST-5', 'ST-6'];

    uniqueCoords.forEach(([lng, lat], idx) => {
      const label = stationLabels[idx] || `ST-${idx + 1}`;
      const btm = toBTM(lat, lng);

      const iconHtml = `
        <div style="
          width: 22px;
          height: 22px;
          background: ${isSatellite ? '#00f0ff' : '#22456e'};
          color: ${isSatellite ? '#000' : '#fff'};
          border: 2px solid #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: monospace;
          font-size: 10px;
          font-weight: bold;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          cursor: pointer;
        ">
          ${idx + 1}
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'cadastral-station-icon',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });
      marker.bindTooltip(
        `<b>${label} (জরিপ স্তম্ভ #${idx + 1})</b><br/>` +
          `WGS84: ${lat.toFixed(5)}°, ${lng.toFixed(5)}°<br/>` +
          `<span style="color:#22456e;font-weight:bold;">BTM: ${btm.formatted}</span>`,
        {
          direction: 'top',
          offset: [0, -10],
        }
      );

      marker.on('click', () => {
        if (onStationSelect) {
          onStationSelect({ index: idx, lat, lng, label, btm: btm.formatted });
        }
      });

      if (!prefersReducedMotion()) {
        marker.on('add', () => {
          const pin = marker.getElement()?.firstElementChild;
          if (!pin) return;
          gsap.fromTo(
            pin,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2.5)', delay: idx * 0.06 }
          );
        });
      }

      if (markersGroupRef.current) {
        markersGroupRef.current.addLayer(marker);
      }
    });
  }, [geojson, mouza, dagNo, activeLayer, areaDecimal, landClass, adjacentParcels, showBuffer, onStationSelect]);

  // Handle Measurement Interaction — click to add points, with magnetic
  // snapping onto existing survey station pillars within 15px, and a
  // per-segment distance + compass bearing readout.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!isMeasuring) {
      measureGroupRef.current?.clearLayers();
      measurePointsRef.current = [];
      if (onMeasureUpdate) onMeasureUpdate(null);
      return;
    }

    const redraw = () => {
      const pts = measurePointsRef.current;
      measureGroupRef.current?.clearLayers();

      if (pts.length === 0) {
        if (onMeasureUpdate) onMeasureUpdate(null);
        return;
      }

      // Vertex pins
      pts.forEach((p) => {
        const pin = L.circleMarker(p, {
          radius: 5,
          color: '#a8322a',
          fillColor: '#ffffff',
          fillOpacity: 1,
          weight: 2,
        });
        measureGroupRef.current?.addLayer(pin);
      });

      // Per-segment distance + bearing
      let totalMeters = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const segMeters = a.distanceTo(b);
        totalMeters += segMeters;

        const seg = L.polyline([a, b], { color: '#a8322a', weight: 2.5, dashArray: '4, 4' });
        const brg = compassBearing(azimuth(a.lat, a.lng, b.lat, b.lng));
        seg.bindTooltip(`${toFeet(segMeters)} ft &middot; ${brg}`, {
          permanent: true,
          direction: 'center',
          className: 'mono',
        });
        measureGroupRef.current?.addLayer(seg);
      }

      // Enclosed area if 3+ points
      let areaSqFt: number | undefined;
      let areaDecimalVal: number | undefined;
      let areaKathaVal: number | undefined;

      if (pts.length >= 3) {
        // Approximate planar area in meters
        let a = 0;
        const n = pts.length;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const p1 = map.latLngToLayerPoint(pts[i]);
          const p2 = map.latLngToLayerPoint(pts[j]);
          a += p1.x * p2.y - p2.x * p1.y;
        }
        // Conversion factor based on current scale
        const p0 = map.latLngToLayerPoint(pts[0]);
        const pEast = map.layerPointToLatLng(L.point(p0.x + 100, p0.y));
        const pNorth = map.layerPointToLatLng(L.point(p0.x, p0.y - 100));
        const mEast = pts[0].distanceTo(pEast) / 100;
        const mNorth = pts[0].distanceTo(pNorth) / 100;
        const areaSqM = (Math.abs(a) / 2) * mEast * mNorth;

        areaSqFt = areaSqM * 10.7639;
        areaDecimalVal = areaSqFt / 435.6;
        areaKathaVal = areaDecimalVal / 1.65;

        const closedPoly = L.polygon(pts, {
          color: '#a8322a',
          fillColor: '#a8322a',
          fillOpacity: 0.15,
          weight: 1,
        });
        measureGroupRef.current?.addLayer(closedPoly);
      }

      if (onMeasureUpdate) {
        onMeasureUpdate({
          pointsCount: pts.length,
          totalMeters: Math.round(totalMeters * 10) / 10,
          totalFeet: toFeet(totalMeters),
          totalGaj: toGaj(totalMeters),
          totalLinks: toLinks(totalMeters),
          areaSqFt: areaSqFt ? Math.round(areaSqFt) : undefined,
          areaDecimal: areaDecimalVal ? Number(areaDecimalVal.toFixed(2)) : undefined,
          areaKatha: areaKathaVal ? Number(areaKathaVal.toFixed(2)) : undefined,
        });
      }
    };

    redrawMeasureRef.current = redraw;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      let pt = e.latlng;

      // Magnetic snap: if the click lands within 15px of an existing survey
      // station pillar, use that pillar's exact coordinate instead.
      const clickPx = map.latLngToContainerPoint(pt);
      const stationMarkers = (markersGroupRef.current?.getLayers() ?? []) as L.Marker[];
      for (const marker of stationMarkers) {
        const markerPx = map.latLngToContainerPoint(marker.getLatLng());
        if (clickPx.distanceTo(markerPx) <= 15) {
          pt = marker.getLatLng();
          break;
        }
      }

      measurePointsRef.current.push(pt);
      redraw();
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isMeasuring, onMeasureUpdate]);

  return (
    <div className={`relative overflow-hidden border border-line ${className}`}>
      <div
        ref={mapContainerRef}
        className={`h-full w-full bg-ground-sunk ${isMeasuring ? 'cursor-crosshair' : ''}`}
      />
      <div className="absolute bottom-2 left-2 z-[400] flex items-center gap-2">
        <div className="rounded border border-line bg-sheet/90 px-2 py-1 text-2xs text-ink shadow-sm backdrop-blur-sm">
          <span className="font-semibold text-indigo">EPSG:4326 / BTM</span> &middot; Mouza {mouza} &middot; Plot {dagNo}
        </div>
        <button
          type="button"
          onClick={() => {
            if (mapRef.current && geojsonLayerRef.current) {
              const bounds = geojsonLayerRef.current.getBounds();
              if (bounds.isValid()) {
                mapRef.current.flyToBounds(bounds, { padding: [50, 50], maxZoom: 18, duration: 0.5 });
              }
            }
          }}
          className="rounded border border-line bg-sheet/95 px-2 py-1 text-2xs font-medium text-ink shadow-sm hover:bg-ground-sunk active:scale-95 transition"
          title="Fit plot to viewport"
        >
          🎯 Fit Plot (প্লট কেন্দ্র)
        </button>
      </div>
      {isMeasuring && (
        <div className="absolute right-2 top-2 z-[400] flex items-center gap-2 rounded border border-line bg-sheet/95 px-3 py-1.5 shadow-md">
          <span className="h-2 w-2 animate-ping rounded-full bg-seal" />
          <span className="text-2xs font-semibold text-seal">মাপজোখ মোড সক্রিয় — ম্যাপে ক্লিক করুন</span>
          <button
            type="button"
            onClick={() => {
              measurePointsRef.current.pop();
              redrawMeasureRef.current();
            }}
            className="rounded border border-line bg-ground px-1.5 py-0.5 text-2xs font-medium text-ink hover:bg-ground-sunk"
          >
            পূর্বের বিন্দু (Undo Point)
          </button>
          <button
            type="button"
            onClick={() => {
              measureGroupRef.current?.clearLayers();
              measurePointsRef.current = [];
              if (onMeasureUpdate) onMeasureUpdate(null);
            }}
            className="rounded border border-line bg-ground px-1.5 py-0.5 text-2xs font-medium text-ink hover:bg-ground-sunk"
          >
            মুছুন
          </button>
        </div>
      )}
    </div>
  );
}
