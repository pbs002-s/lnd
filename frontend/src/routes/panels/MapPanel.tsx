import { useMemo, useState } from 'react';
import {
  Layers,
  Copy,
  Check,
  Compass,
  Radio,
  MapPin,
  Grid,
  Ruler,
  AlertTriangle,
  Shield,
  Maximize2,
  Minimize2,
  Download,
  FileJson,
  Table2,
  Printer,
  ChevronDown,
  Plane,
} from 'lucide-react';
import type { Parcel } from '../../lib/types';
import ParcelPlate from '../../components/ParcelPlate';
import LeafletMap, { type MeasureResult } from '../../components/LeafletMap';
import { DataRow, Panel, StatusMark, Button } from '../../components/ui';
import { Reveal } from '../../components/motion';
import { decimals, katha, sqft, toBTM } from '../../lib/format';
import { printDocument } from '../../lib/print';
import OfflineSurveyModal from '../../components/OfflineSurveyModal';
import DroneCadastreModal from '../../components/DroneCadastreModal';

interface LayerOption {
  id: string;
  bn: string;
  en: string;
  meta: string;
  tone: 'state' | 'indigo' | 'amber';
  mark: string;
  description: string;
}

const LAYERS: LayerOption[] = [
  {
    id: 'bds',
    bn: 'বিডিএস ২০২৬ ড্রোন ভেক্টর',
    en: 'BDS 2026 Drone GIS Vector',
    meta: 'PostGIS · EPSG:4326',
    tone: 'indigo',
    mark: 'Active (সক্রিয়)',
    description: 'High-precision RTK GNSS drone cadastral vector layer with exact boundary vertex nodes.',
  },
  {
    id: 'sat',
    bn: 'স্যাটেলাইট অর্থোফটো বেসম্যাপ',
    en: 'Satellite Orthophoto',
    meta: 'High-res aerial raster',
    tone: 'amber',
    mark: 'Composite',
    description: 'Aerial satellite imagery overlay for ground physical feature comparison.',
  },
  {
    id: 'bs',
    bn: 'বিএস জরিপ (ডিজিটাইজড)',
    en: 'BS Survey Sheet (Vectorised)',
    meta: '2015 · sheet 04',
    tone: 'state',
    mark: 'Aligned',
    description: 'Digitized vector polygon from the authoritative BS 2015 cadastral field survey.',
  },
  {
    id: 'rs',
    bn: 'আরএস মৌজা নকশা',
    en: 'RS Mouza Cadastral Sheet',
    meta: '1988 · scanned archive',
    tone: 'state',
    mark: 'Archived',
    description: 'Georeferenced raster sheet from the 1988 Revisional Survey.',
  },
  {
    id: 'cs',
    bn: 'সিএস ঐতিহাসিক মৌজা নকশা',
    en: 'CS Historical Cadastre Sheet',
    meta: '1924 · Bengal survey archive',
    tone: 'amber',
    mark: 'Historical',
    description: 'Original British-era Bengal Cadastral Survey mouza plate reflecting earliest settlement.',
  },
];

interface StationNode {
  label: string;
  lat: string;
  lng: string;
  rawLat: number;
  rawLng: number;
  btm: string;
  easting: number;
  northing: number;
}

/** Triggers a browser download of in-memory text content — GeoJSON/CSV export, no server round-trip. */
function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function MapPanel({ parcel }: { parcel: Parcel }) {
  const [activeLayer, setActiveLayer] = useState<string>('bds');
  const [viewMode, setViewMode] = useState<'leaflet' | 'plate'>('leaflet');
  const [selectedStationInfo, setSelectedStationInfo] = useState<{ label: string; lat: number; lng: number; btm?: string } | null>(null);
  const [copiedStation, setCopiedStation] = useState<string | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measureResult, setMeasureResult] = useState<MeasureResult | null>(null);
  const [showBuffer, setShowBuffer] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [droneModalOpen, setDroneModalOpen] = useState(false);
  const printAreaId = 'printable-cadastral-map';

  // Extract true vertex coordinates from GeoJSON with BTM
  const stations: StationNode[] = useMemo(() => {
    const coords = parcel.geojsonBoundary?.geometry?.coordinates?.[0] as number[][] | undefined;
    if (coords && coords.length >= 3) {
      const unique = coords.slice(0, coords.length > 3 && coords[0][0] === coords[coords.length - 1][0] ? -1 : undefined);
      const labels = ['NW Station', 'NE Station', 'SE Station', 'SW Station', 'Station 5', 'Station 6'];
      return unique.map((pt: number[], i: number) => {
        const lat = pt[1];
        const lng = pt[0];
        const btm = toBTM(lat, lng);
        return {
          label: labels[i] || `ST-${i + 1}`,
          lat: Number(lat).toFixed(5),
          lng: Number(lng).toFixed(5),
          rawLat: lat,
          rawLng: lng,
          btm: btm.formatted,
          easting: btm.easting,
          northing: btm.northing,
        };
      });
    }
    const fallback: [string, number, number][] = [
      ['NW Station', 23.8432, 90.2581],
      ['NE Station', 23.8435, 90.2592],
      ['SE Station', 23.8427, 90.2595],
      ['SW Station', 23.8424, 90.2583],
    ];
    return fallback.map(([label, lat, lng]) => {
      const btm = toBTM(lat, lng);
      return { label, lat: lat.toFixed(4), lng: lng.toFixed(4), rawLat: lat, rawLng: lng, btm: btm.formatted, easting: btm.easting, northing: btm.northing };
    });
  }, [parcel]);

  const handleExportGeoJson = () => {
    const feature = parcel.geojsonBoundary ?? {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[90.2581, 23.8432], [90.2592, 23.8435], [90.2595, 23.8427], [90.2583, 23.8424], [90.2581, 23.8432]]],
      },
    };
    const featureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          ...feature,
          properties: {
            parcelId: parcel.id,
            dagNo: parcel.dagNo,
            khatianNo: parcel.khatianNo,
            mouza: parcel.mouza,
            district: parcel.district,
            areaDecimal: parcel.areaDecimal,
          },
        },
      ],
    };
    downloadBlob(`${parcel.id}-cadastre.geojson`, JSON.stringify(featureCollection, null, 2), 'application/geo+json');
    setExportMenuOpen(false);
  };

  const handleExportCsv = () => {
    const header = 'Index,Station Label,WGS84 Lat,WGS84 Lng,BTM Easting (m),BTM Northing (m)';
    const rows = stations.map((s, i) => `${i + 1},${s.label},${s.rawLat},${s.rawLng},${s.easting},${s.northing}`);
    downloadBlob(`${parcel.id}-station-benchmarks.csv`, [header, ...rows].join('\n'), 'text/csv');
    setExportMenuOpen(false);
  };

  const handlePrintSnapshot = () => {
    printDocument(printAreaId, `Cadastral-Map-${parcel.id}`);
    setExportMenuOpen(false);
  };

  const gap =
    parcel.mappedAreaDecimal !== undefined
      ? Math.abs(parcel.mappedAreaDecimal - parcel.areaDecimal)
      : 0;

  const handleCopyCoord = (st: (typeof stations)[0]) => {
    navigator.clipboard.writeText(`${st.lat}, ${st.lng} (${st.btm})`);
    setCopiedStation(st.label);
    setTimeout(() => setCopiedStation(null), 2000);
  };

  const adjacent = parcel.adjacentParcels || [
    {
      dagNo: '1203',
      mouza: parcel.mouza,
      owner: 'মোঃ আব্দুল করিম (Abdul Karim)',
      areaDecimal: 6.2,
      landClass: 'বাস্তুভিটা',
      encroachmentStatus: 'VARIANCE_FLAG' as const,
      overlapDiffSqFt: 87.12,
    },
    {
      dagNo: '1205',
      mouza: parcel.mouza,
      owner: 'বেগম রওশন আরা (Rowshan Ara)',
      areaDecimal: 11.4,
      landClass: 'নাল জমি',
      encroachmentStatus: 'CLEAR' as const,
      overlapDiffSqFt: 0,
    },
  ];

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-[999] overflow-y-auto bg-ground p-3 sm:p-4' : 'grid gap-5 xl:grid-cols-[1.4fr_1fr]'}>
      <Reveal>
        <Panel
          label="Cadastral Vector Map & Survey GIS"
          meta={`মৌজা ${parcel.mouza} · দাগ ${parcel.dagNo}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={isMeasuring ? 'primary' : 'secondary'}
                onClick={() => setIsMeasuring(!isMeasuring)}
              >
                <Ruler className="h-3.5 w-3.5" />
                {isMeasuring ? 'Exit Measuring (পরিমাপ সমাপ্ত)' : 'Measure Plot (জমি মাপুন)'}
              </Button>
              <Button
                size="sm"
                variant={showBuffer ? 'primary' : 'secondary'}
                onClick={() => setShowBuffer((v) => !v)}
                title="Show Buffer & Encroachment Zone (সীমানা বাফার ও বিরোধ অঞ্চল)"
              >
                <Shield className="h-3.5 w-3.5" /> Buffer Zone (বাফার)
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setSurveyModalOpen(true)}
                title="Amin Field Survey & Offline Sync (মাঠপর্যায়ে আমিন জরিপ ও অফলাইন সিঙ্ক)"
              >
                <Compass className="h-3.5 w-3.5 text-indigo" />
                Amin Survey (আমিন জরিপ)
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setDroneModalOpen(true)}
                title="Drone Cadastre Multi-Epoch Comparison (ঐতিহাসিক নকশা ও ড্রোন ক্যাডাস্ট্রে বহু-স্তরীয় তুলনা)"
              >
                <Plane className="h-3.5 w-3.5 text-indigo" />
                Drone Cadastre (ড্রোন ক্যাডাস্ট্রে)
              </Button>
              <div className="relative">
                <Button size="sm" onClick={() => setExportMenuOpen((v) => !v)}>
                  <Download className="h-3.5 w-3.5" /> Export Cadastre (নকশা ডাউনলোড) <ChevronDown className="h-3 w-3" />
                </Button>
                {exportMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
                    <div className="absolute right-0 top-full z-50 mt-1 w-64 border border-line bg-sheet shadow-lg">
                      <button
                        type="button"
                        onClick={handleExportGeoJson}
                        className="flex w-full items-center gap-2 border-b border-line-hair px-3.5 py-2.5 text-left text-xs text-ink hover:bg-ground-sunk"
                      >
                        <FileJson className="h-3.5 w-3.5 text-indigo" />
                        <span>
                          <span className="block font-medium">Export GeoJSON</span>
                          <span className="block text-2xs text-ink-3">Authoritative parcel polygon (.geojson)</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportCsv}
                        className="flex w-full items-center gap-2 border-b border-line-hair px-3.5 py-2.5 text-left text-xs text-ink hover:bg-ground-sunk"
                      >
                        <Table2 className="h-3.5 w-3.5 text-indigo" />
                        <span>
                          <span className="block font-medium">Export CSV (Station Coordinates)</span>
                          <span className="block text-2xs text-ink-3">Index, WGS84 lat/lng, BTM easting/northing</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={handlePrintSnapshot}
                        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs text-ink hover:bg-ground-sunk"
                      >
                        <Printer className="h-3.5 w-3.5 text-indigo" />
                        <span>
                          <span className="block font-medium">High-Res Map Snapshot</span>
                          <span className="block text-2xs text-ink-3">Print-ready cadastral layout (PDF)</span>
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="flex rounded border border-line bg-sheet p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('leaflet')}
                  className={`flex items-center gap-1 px-2 py-1 text-2xs font-semibold rounded ${viewMode === 'leaflet' ? 'bg-indigo text-white' : 'text-ink-2 hover:text-ink'
                    }`}
                >
                  <MapPin className="h-3 w-3" /> Leaflet GIS
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('plate')}
                  className={`flex items-center gap-1 px-2 py-1 text-2xs font-semibold rounded ${viewMode === 'plate' ? 'bg-indigo text-white' : 'text-ink-2 hover:text-ink'
                    }`}
                >
                  <Grid className="h-3 w-3" /> Drafting Sheet
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsFullscreen((v) => !v)}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen GIS Mode (in-field tablet view)'}
                className="rounded border border-line bg-sheet p-1.5 text-ink-2 transition-colors hover:bg-ground-sunk hover:text-ink"
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          }
        >
          {/* Active Layer Header Bar */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo" />
              <span className="mono text-2xs font-semibold uppercase text-ink-2">
                Active Epoch: {LAYERS.find((l) => l.id === activeLayer)?.en}
              </span>
            </div>
            {viewMode === 'leaflet' && activeLayer !== 'sat' && (
              <div className="flex items-center gap-2">
                <span className="mono text-2xs uppercase text-ink-3">Sheet Opacity (স্বচ্ছতা)</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                  className="h-1.5 w-28 accent-indigo"
                />
                <span className="mono w-9 text-2xs tnum text-ink-2">{overlayOpacity}%</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-ink-3">
              <Compass className="h-3.5 w-3.5 text-indigo" />
              <span>BTM / WGS84 EPSG:4326</span>
            </div>
          </div>

          <div id={printAreaId} className="overflow-hidden border border-line bg-sheet-raised">
            {viewMode === 'leaflet' ? (
              <LeafletMap
                geojson={parcel.geojsonBoundary}
                mouza={parcel.mouza}
                dagNo={parcel.dagNo.split(/[\/ ]/)[0]}
                activeLayer={activeLayer}
                areaDecimal={parcel.areaDecimal}
                landClass={parcel.landClass}
                isMeasuring={isMeasuring}
                showBuffer={showBuffer}
                overlayOpacity={overlayOpacity / 100}
                adjacentParcels={adjacent}
                onMeasureUpdate={setMeasureResult}
                className={isFullscreen ? 'h-[70vh] w-full' : 'h-[460px] w-full'}
                onStationSelect={(st) =>
                  setSelectedStationInfo({ label: st.label, lat: st.lat, lng: st.lng, btm: st.btm })
                }
              />
            ) : (
              <div className="graticule px-2 py-2">
                <ParcelPlate
                  dagNo={parcel.dagNo.split(/[\/ ]/)[0]}
                  areaDecimal={parcel.areaDecimal}
                  landClass={parcel.landClass}
                  mouza={parcel.mouza}
                  geojson={parcel.geojsonBoundary}
                  onStationSelect={(st: { label: string; lat: number; lng: number }) =>
                    setSelectedStationInfo({ label: st.label, lat: st.lat, lng: st.lng })
                  }
                />
              </div>
            )}
          </div>

          {/* Live Cadastral Measurement Metrics Box */}
          {isMeasuring && (
            <div className="mt-4 border border-seal/30 bg-seal-soft p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-seal">
                  ডিজিটাল আমিন জরিপ ফিতা (Surveyor Field Measurement)
                </span>
                <span className="mono text-2xs text-ink-3">
                  {measureResult?.pointsCount ? `${measureResult.pointsCount} পয়েন্ট চিহ্নিত` : 'ম্যাপে ক্লিক করে বিন্দু যোগ করুন'}
                </span>
              </div>
              {measureResult ? (
                <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div className="rounded border border-line bg-sheet p-2">
                    <span className="mono block text-2xs uppercase text-ink-3">Length (ফুট ও লিঙ্ক)</span>
                    <span className="mono font-semibold text-ink">
                      {measureResult.totalFeet} ft · {measureResult.totalLinks} links (কড়ি)
                    </span>
                  </div>
                  <div className="rounded border border-line bg-sheet p-2">
                    <span className="mono block text-2xs uppercase text-ink-3">Length (গজ ও মিটার)</span>
                    <span className="mono font-semibold text-ink">
                      {measureResult.totalGaj} গজ · {measureResult.totalMeters} m
                    </span>
                  </div>
                  <div className="rounded border border-line bg-sheet p-2">
                    <span className="mono block text-2xs uppercase text-ink-3">Enclosed Area (শতক)</span>
                    <span className="mono font-semibold text-indigo">
                      {measureResult.areaDecimal ? `${measureResult.areaDecimal} শতক` : '—'}
                    </span>
                  </div>
                  <div className="rounded border border-line bg-sheet p-2">
                    <span className="mono block text-2xs uppercase text-ink-3">Area (কাঠা ও বর্গফুট)</span>
                    <span className="mono font-semibold text-indigo">
                      {measureResult.areaKatha ? `${measureResult.areaKatha} কাঠা` : '—'} ({measureResult.areaSqFt?.toLocaleString()} sqft)
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-xs text-ink-2">
                  ম্যাপে ক্লিক করে যেকোনো দুটি বিন্দুর মধ্যবর্তী দূরত্ব (কড়ি/লিঙ্ক, গজ, ফুট) অথবা ৩ বা ততোধিক বিন্দু দিয়ে ক্ষেত্রফল নির্ণয় করুন।
                </p>
              )}
            </div>
          )}

          {/* Dynamic GPS & BTM Survey Stations Table */}
          <div className="mt-4">
            <p className="mono mb-2 text-2xs uppercase text-ink-3">
              Survey Station Benchmark Nodes & BTM Coordinates (জরিপ স্তম্ভ ও প্রক্ষেপণ স্থানাঙ্ক)
            </p>
            <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
              {stations.map((st) => (
                <div
                  key={st.label}
                  className="group relative bg-sheet px-3 py-2.5 transition-colors hover:bg-ground-sunk"
                >
                  <div className="flex items-center justify-between">
                    <span className="mono block text-2xs uppercase text-ink-3">{st.label}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyCoord(st)}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      title="Copy coordinates"
                    >
                      {copiedStation === st.label ? (
                        <Check className="h-3 w-3 text-state" />
                      ) : (
                        <Copy className="h-3 w-3 text-ink-3 hover:text-indigo" />
                      )}
                    </button>
                  </div>
                  <span className="mono tnum mt-1 block text-xs font-medium text-ink">
                    {st.lat}°, {st.lng}°
                  </span>
                  <span className="mono block text-[10px] text-ink-3 truncate" title={st.btm}>
                    {st.btm}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {selectedStationInfo && (
            <div className="mt-3 border-l-2 border-indigo bg-indigo-soft px-3.5 py-2 text-xs text-indigo">
              <span className="font-semibold">{selectedStationInfo.label} নির্বাচিত: </span>
              Latitude {selectedStationInfo.lat.toFixed(6)}°N, Longitude {selectedStationInfo.lng.toFixed(6)}°E
              {selectedStationInfo.btm && ` · BTM: ${selectedStationInfo.btm}`}
            </div>
          )}
        </Panel>
      </Reveal>

      <div className="space-y-5">
        {/* Layer Selector */}
        <Reveal delay={80}>
          <Panel label="Historical Survey & GIS Epochs (জরিপ স্তর)" bodyClassName="px-0 py-0">
            <ul>
              {LAYERS.map((l) => (
                <li
                  key={l.id}
                  onClick={() => setActiveLayer(l.id)}
                  className={`cursor-pointer border-b border-line-hair px-5 py-3.5 transition-colors last:border-0 hover:bg-ground-sunk ${activeLayer === l.id ? 'bg-indigo-soft' : ''
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <Radio
                        className={`mt-0.5 h-4 w-4 shrink-0 ${activeLayer === l.id ? 'text-indigo' : 'text-ink-3'
                          }`}
                      />
                      <div>
                        <span className="bn block text-sm font-semibold text-ink">{l.bn}</span>
                        <span className="block text-xs text-ink-3">
                          {l.en} · <span className="mono">{l.meta}</span>
                        </span>
                        <p className="mt-1 text-2xs text-ink-2">{l.description}</p>
                      </div>
                    </div>
                    <StatusMark tone={l.tone}>{l.mark}</StatusMark>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>

        {/* Phase 4: Field Survey & Drone Cadastre Quick Launch Card */}
        <Reveal delay={90}>
          <Panel label="Field Cadastre & Offline Sync (মাঠ জরিপ ও ড্রোন ক্যাডাস্ট্রে)">
            <p className="text-xs text-ink-2 mb-3">
              Direct integration with DLRS field survey teams, RTK GNSS benchmark pegs, Gunter chain conversions, and multi-epoch drone vector comparison (CS 1924, RS 1988, BS 2015, BDS 2026).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="justify-start text-xs"
                onClick={() => setSurveyModalOpen(true)}
              >
                <Compass className="h-3.5 w-3.5 mr-1.5 text-indigo" />
                <div className="text-left">
                  <span className="block font-medium">Amin Field Survey</span>
                  <span className="block text-2xs text-ink-3">Offline logger & pegs</span>
                </div>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="justify-start text-xs"
                onClick={() => setDroneModalOpen(true)}
              >
                <Plane className="h-3.5 w-3.5 mr-1.5 text-indigo" />
                <div className="text-left">
                  <span className="block font-medium">Drone Epoch Analysis</span>
                  <span className="block text-2xs text-ink-3">CS/RS/BS comparison</span>
                </div>
              </Button>
            </div>
          </Panel>
        </Reveal>

        {/* Adjacent Plot Boundary Inspector */}
        <Reveal delay={100}>
          <Panel label="Adjacent Plot Boundary Inspector (পাশ্ববর্তী দাগ ও সীমানা)" bodyClassName="px-0 py-0">
            <ul>
              {adjacent.map((adj) => (
                <li key={adj.dagNo} className="border-b border-line-hair px-5 py-3 last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="mono text-xs font-semibold text-ink">দাগ নং {adj.dagNo}</span>
                        <span className="text-2xs text-ink-3">({adj.landClass})</span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-2">{adj.owner}</p>
                      <p className="mono text-2xs text-ink-3">পরিমাপ: {adj.areaDecimal} শতক</p>
                    </div>
                    <StatusMark tone={adj.encroachmentStatus === 'VARIANCE_FLAG' ? 'seal' : 'state'}>
                      {adj.encroachmentStatus === 'VARIANCE_FLAG' ? 'Overlapping Variance' : 'Boundary Clear'}
                    </StatusMark>
                  </div>
                  {adj.encroachmentStatus === 'VARIANCE_FLAG' && (
                    <div className="mt-2 flex items-center gap-1.5 rounded border border-seal/30 bg-seal-soft px-2 py-1 text-2xs text-seal">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>উত্তর-পশ্চিম সীমানায় ৮৭.১২ বর্গফুট (০.০২ শতক) সম্ভাব্য অমিল চিহ্নিত।</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>

        {/* Multi-Unit Area & Reconciliation Check */}
        <Reveal delay={120}>
          <Panel label="Cadastral Area Verification">
            <DataRow label="Recorded in খতিয়ান" value={decimals(parcel.areaDecimal)} mono />
            <DataRow label="Standard Katha (কাঠা)" value={katha(parcel.areaDecimal)} mono />
            <DataRow label="Square Feet (বর্গফুট)" value={sqft(parcel.areaDecimal)} mono />
            <DataRow label="Digitized Polygon Area" value={decimals(parcel.mappedAreaDecimal)} mono />
            <DataRow
              label="Spatial Variance (পার্থক্য)"
              value={
                <span className={gap > 0.05 ? 'font-semibold text-amber' : 'text-state'}>
                  {gap === 0 ? 'Exact Match (0.00)' : `${gap.toFixed(2)} decimal variance`}
                </span>
              }
              mono
            />
            <p className="mt-3 text-xs text-ink-3">
              Any variance between deed area and high-resolution drone cadastre under 0.05 decimals is treated as
              acceptable mathematical variance under Survey Act provisions.
            </p>
          </Panel>
        </Reveal>
      </div>

      {/* Phase 4: Field Survey & Drone Cadastre Modals */}
      <OfflineSurveyModal
        open={surveyModalOpen}
        onClose={() => setSurveyModalOpen(false)}
        defaultParcelId={parcel.id}
        defaultAreaDecimal={parcel.areaDecimal}
      />
      <DroneCadastreModal
        open={droneModalOpen}
        onClose={() => setDroneModalOpen(false)}
        defaultParcelId={parcel.id}
      />
    </div>
  );
}

