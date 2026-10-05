import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plane,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Maximize2,
  FileText,
  RefreshCw,
  Compass,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Waves,
  MapPin,
} from 'lucide-react';
import Modal from './Modal';
import { Button } from './ui';
import { useLanguage } from '../lib/language';
import { getDroneEpochs, compareDroneEpochs } from '../lib/api';
import type { CadastralEpoch, EpochComparisonResult } from '../lib/types';

interface DroneCadastreModalProps {
  open: boolean;
  onClose: () => void;
  defaultParcelId?: string;
}

export default function DroneCadastreModal({
  open,
  onClose,
  defaultParcelId = 'BD-DHK-SAV-000001',
}: DroneCadastreModalProps) {
  const { lang } = useLanguage();
  const [epochs, setEpochs] = useState<CadastralEpoch[]>([]);
  const [comparison, setComparison] = useState<EpochComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeLayers, setActiveLayers] = useState<{ [key: string]: boolean }>({
    CS_1924: true,
    RS_1988: true,
    BS_2015: true,
    BDS_2026: true,
  });
  const [selectedEpoch, setSelectedEpoch] = useState<CadastralEpoch | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [epochList, compRes] = await Promise.all([
        getDroneEpochs(defaultParcelId),
        compareDroneEpochs(defaultParcelId),
      ]);
      setEpochs(epochList);
      setComparison(compRes);
      if (epochList.length > 0) {
        setSelectedEpoch(epochList[epochList.length - 1]);
      }
    } catch {
      // Fallback handled via api.ts
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, defaultParcelId]);

  const toggleLayer = (epochId: string) => {
    setActiveLayers((prev) => ({
      ...prev,
      [epochId]: !prev[epochId],
    }));
  };

  const isEncroached = comparison?.canalEncroachmentFlag ?? false;
  const isCongruent = comparison?.verdict === 'CONGRUENT_MATCH';

  const getEpochStrokeColor = (epochId: string) => {
    switch (epochId) {
      case 'CS_1924':
        return '#f59e0b'; // Amber
      case 'RS_1988':
        return '#3b82f6'; // Blue
      case 'BS_2015':
        return '#10b981'; // Emerald
      case 'BDS_2026':
        return isEncroached ? '#ef4444' : '#6366f1'; // Indigo or Red if encroached
      default:
        return '#94a3b8';
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Geodetic Multi-Epoch Cadastre"
      title="Drone Cadastre & Multi-Epoch Survey Comparison"
      bn="ঐতিহাসিক নকশা ও ড্রোন ক্যাডাস্ট্রে বহু-স্তরীয় তুলনা"
      maxWidth="5xl"
    >
      <div className="space-y-5 text-sm text-ink pb-4">
        {/* Header Bar with Parcel Info and Rescan */}
        <div className="p-3.5 bg-sheet border border-line rounded-lg flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-md ${
                isEncroached
                  ? 'bg-seal-soft text-seal border border-seal/40'
                  : 'bg-indigo/15 text-indigo border border-indigo/30'
              }`}
            >
              <Plane className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">
                  {lang === 'bn' ? 'ড্রোন অর্থোমোসাইক বনাম ঐতিহাসিক নকশা বিশ্লেষণ' : 'Drone RTK Orthomosaic vs Historical Cadastre'}
                </span>
                <span className="mono text-2xs px-2 py-0.5 rounded bg-sheet-raised border border-line text-ink-3">
                  Parcel: {defaultParcelId}
                </span>
              </div>
              <p className="text-2xs text-ink-3">
                {lang === 'bn'
                  ? 'সিএস ১৯২৪, আরএস ১৯৮৮, বিএস ২০১৫ এবং বিডিএস ২০২৬ ড্রোন ভেক্টর রূপান্তর ও সীমানা বিচ্যুতি মূল্যায়ন।'
                  : 'Comparative vector overlay across 4 major cadastral epochs under The Survey Act 1875.'}
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            {lang === 'bn' ? 'পুনরায় বিশ্লেষণ' : 'Recompute Epochs'}
          </Button>
        </div>

        {/* Comparison Verdict Summary Cards */}
        {comparison && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Status Card */}
            <div
              className={`p-3.5 rounded-lg border flex flex-col justify-between ${
                isEncroached
                  ? 'bg-seal-soft border-seal/50 text-seal'
                  : 'bg-state/10 border-state/30 text-state'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-2xs uppercase tracking-wider font-semibold">
                  {lang === 'bn' ? 'ক্যাডাস্ট্রাল রায়' : 'Cadastral Verdict'}
                </span>
                {isEncroached ? (
                  <ShieldAlert className="w-4 h-4" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
              </div>
              <div className="font-bold text-xs leading-tight">
                {lang === 'bn' ? comparison.verdictBn : comparison.verdict}
              </div>
            </div>

            {/* Area Drift */}
            <div className="p-3.5 bg-sheet border border-line rounded-lg flex flex-col justify-between">
              <span className="text-2xs uppercase tracking-wider font-semibold text-ink-3">
                {lang === 'bn' ? 'শতকরা ক্ষেত্রফল বিচ্যুতি' : 'Area Drift Rate'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-xl font-bold mono ${comparison.areaDriftPercentage > 5 ? 'text-seal' : 'text-ink'}`}>
                  {comparison.areaDriftPercentage}%
                </span>
                <span className="text-2xs text-ink-3">
                  {comparison.areaDriftPercentage > 5 ? 'অতিরিক্ত সম্প্রসারণ' : 'সহনশীলতার মধ্যে'}
                </span>
              </div>
            </div>

            {/* Max Vertex Shift */}
            <div className="p-3.5 bg-sheet border border-line rounded-lg flex flex-col justify-between">
              <span className="text-2xs uppercase tracking-wider font-semibold text-ink-3">
                {lang === 'bn' ? 'সর্বোচ্চ সীমানা স্থানচ্যুতি' : 'Max Vertex Shift'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-xl font-bold mono ${comparison.maxVertexShiftMeters > 1.0 ? 'text-seal' : 'text-state'}`}>
                  {comparison.maxVertexShiftMeters} m
                </span>
                <span className="text-2xs text-ink-3">
                  (BTM Geodetic Grid)
                </span>
              </div>
            </div>

            {/* Canal Encroachment Metric */}
            <div
              className={`p-3.5 rounded-lg border flex flex-col justify-between ${
                isEncroached
                  ? 'bg-seal-soft border-seal/50 text-seal'
                  : 'bg-sheet border-line text-ink'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-2xs uppercase tracking-wider font-semibold">
                  {lang === 'bn' ? 'সরকারি খাল দখল' : 'Canal Encroachment'}
                </span>
                <Waves className="w-4 h-4 opacity-75" />
              </div>
              <div className="font-bold text-xs">
                {isEncroached
                  ? `${comparison.canalEncroachmentAreaSqFt || 544.5} sqft দখলকৃত`
                  : lang === 'bn' ? 'কোনো খাল বা জলাশয় দখল নেই' : 'Zero Canal Buffer Violation'}
              </div>
            </div>
          </div>
        )}

        {/* Vector Canvas & Interactive Epoch Layer Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Visual SVG Map Canvas (2 Cols) */}
          <div className="lg:col-span-2 p-4 bg-sheet border border-line rounded-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-line-hair">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo" />
                <span className="text-xs font-semibold uppercase tracking-wider text-ink">
                  {lang === 'bn' ? 'ভেক্টর সীমানা ওভারলে (BTM Georeferenced Projection)' : 'BTM Georeferenced Vector Overlay'}
                </span>
              </div>

              {/* Layer Toggles */}
              <div className="flex flex-wrap items-center gap-2">
                {epochs.map((ep) => (
                  <button
                    key={ep.epochId}
                    type="button"
                    onClick={() => toggleLayer(ep.epochId)}
                    className={`px-2 py-0.5 rounded text-2xs mono font-semibold border flex items-center gap-1.5 transition-colors ${
                      activeLayers[ep.epochId]
                        ? 'bg-sheet-raised border-line text-ink'
                        : 'opacity-40 line-through bg-sheet border-line text-ink-3'
                    }`}
                    style={{
                      borderLeftColor: getEpochStrokeColor(ep.epochId),
                      borderLeftWidth: '3px',
                    }}
                  >
                    <span>{ep.epochId.replace('_', ' ')}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Visualizer */}
            <div className="relative w-full h-60 sm:h-68 bg-ground-sunk rounded border border-line flex items-center justify-center overflow-hidden">
              {/* Grid Background Pattern */}
              <svg className="absolute inset-0 w-full h-full opacity-15 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="cadastre-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#cadastre-grid)" />
              </svg>

              {/* Cadastral Polygon Simulation */}
              <svg viewBox="0 0 500 300" className="w-full h-full z-10 p-4 pointer-events-none">
                {/* Adjacent Canal / Waterbody Polygon */}
                <path
                  d="M 20 20 L 480 30 L 460 75 L 40 65 Z"
                  fill="rgba(6, 182, 212, 0.15)"
                  stroke="#0891b2"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
                <text x="200" y="50" fill="#0891b2" fontSize="10" className="mono" fontWeight="bold">
                  {lang === 'bn' ? 'সংলগ্ন সরকারি নালা / খাল (দাগ নং ৫৯২)' : 'Adjacent Public Canal Reserve (Dag #592)'}
                </text>

                {/* CS 1924 Polygon */}
                {activeLayers['CS_1924'] && (
                  <g>
                    <polygon
                      points="120,85 380,95 365,240 105,230"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeDasharray="6 3"
                    />
                    <text x="125" y="105" fill="#f59e0b" fontSize="9" className="mono font-bold">
                      CS 1924
                    </text>
                  </g>
                )}

                {/* RS 1988 Polygon */}
                {activeLayers['RS_1988'] && (
                  <g>
                    <polygon
                      points="122,83 382,93 367,238 107,228"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="1.8"
                      strokeDasharray="4 2"
                    />
                    <text x="330" y="110" fill="#3b82f6" fontSize="9" className="mono font-bold">
                      RS 1988
                    </text>
                  </g>
                )}

                {/* BS 2015 Polygon */}
                {activeLayers['BS_2015'] && (
                  <g>
                    <polygon
                      points="123,82 383,92 368,237 108,227"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="1.5"
                    />
                    <text x="330" y="225" fill="#10b981" fontSize="9" className="mono font-bold">
                      BS 2015
                    </text>
                  </g>
                )}

                {/* BDS 2026 Drone RTK Polygon */}
                {activeLayers['BDS_2026'] && (
                  <g>
                    {/* If encroached, top boundary stretches into canal */}
                    <polygon
                      points={
                        isEncroached
                          ? '115,55 388,60 368,237 108,227'
                          : '124,81 384,91 369,236 109,226'
                      }
                      fill={isEncroached ? 'rgba(239, 68, 68, 0.12)' : 'rgba(99, 102, 241, 0.1)'}
                      stroke={isEncroached ? '#ef4444' : '#6366f1'}
                      strokeWidth="2.5"
                    />

                    {/* Vertices */}
                    <circle cx={isEncroached ? 115 : 124} cy={isEncroached ? 55 : 81} r="4" fill={isEncroached ? '#ef4444' : '#6366f1'} />
                    <circle cx={isEncroached ? 388 : 384} cy={isEncroached ? 60 : 91} r="4" fill={isEncroached ? '#ef4444' : '#6366f1'} />
                    <circle cx={isEncroached ? 368 : 369} cy={isEncroached ? 237 : 236} r="4" fill={isEncroached ? '#ef4444' : '#6366f1'} />
                    <circle cx={isEncroached ? 108 : 109} cy={isEncroached ? 227 : 226} r="4" fill={isEncroached ? '#ef4444' : '#6366f1'} />

                    {isEncroached && (
                      <g>
                        <line x1="120" y1="85" x2="115" y2="55" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2 2" />
                        <text x="140" y="70" fill="#ef4444" fontSize="9" className="mono font-bold">
                          8.6m Shift into Canal
                        </text>
                      </g>
                    )}

                    <text
                      x="210"
                      y="160"
                      fill={isEncroached ? '#ef4444' : '#6366f1'}
                      fontSize="10"
                      className="mono font-bold"
                    >
                      BDS 2026 RTK DRONE
                    </text>
                  </g>
                )}
              </svg>

              {/* Floating Legend */}
              <div className="absolute bottom-2 left-2 p-2 bg-sheet/90 backdrop-blur border border-line rounded text-3xs mono space-y-1">
                <div className="flex items-center gap-1.5 text-amber">
                  <span className="w-3 h-0.5 bg-amber inline-block"></span>
                  <span>CS 1924 (Gunter Chain)</span>
                </div>
                <div className="flex items-center gap-1.5 text-blue-500">
                  <span className="w-3 h-0.5 bg-blue-500 inline-block"></span>
                  <span>RS 1988 (Theodolite)</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-500">
                  <span className="w-3 h-0.5 bg-emerald-500 inline-block"></span>
                  <span>BS 2015 (Total Station)</span>
                </div>
                <div className="flex items-center gap-1.5 text-indigo">
                  <span className="w-3 h-0.5 bg-indigo inline-block"></span>
                  <span>BDS 2026 (RTK Drone)</span>
                </div>
              </div>
            </div>

            {/* Technical Summary Banner */}
            {comparison && (
              <div
                className={`p-3 rounded border text-xs leading-relaxed ${
                  isEncroached
                    ? 'bg-seal-soft border-seal/30 text-seal'
                    : 'bg-sheet border-line text-ink-2'
                }`}
              >
                <div className="font-semibold text-ink mb-0.5">
                  {lang === 'bn' ? 'কারিগরি ভৌগোলিক বিশ্লেষণ প্রতিবেদন:' : 'Technical Geodetic Analysis:'}
                </div>
                <p>{lang === 'bn' ? comparison.technicalSummaryBn : comparison.technicalSummaryEn}</p>
                <div className="mono text-2xs text-ink-3 mt-1.5">
                  {lang === 'bn' ? 'সংবিধিবদ্ধ আইনানুগ বিধি:' : 'Statutory Reference:'} {comparison.statutoryReference}
                </div>
              </div>
            )}
          </div>

          {/* Right Col: Epoch Comparative Table & Specifications */}
          <div className="space-y-4">
            <div className="p-4 bg-sheet border border-line rounded-lg space-y-3">
              <span className="text-2xs uppercase tracking-wider font-semibold text-ink-3 block">
                {lang === 'bn' ? '৪টি জরিপের প্রযুক্তিগত তুলনা' : 'Epoch Specifications Matrix'}
              </span>

              <div className="space-y-2">
                {epochs.map((ep) => (
                  <div
                    key={ep.epochId}
                    onClick={() => setSelectedEpoch(ep)}
                    className={`p-2.5 rounded border text-xs cursor-pointer transition-all ${
                      selectedEpoch?.epochId === ep.epochId
                        ? 'bg-sheet-raised border-indigo/40 ring-1 ring-indigo/30'
                        : 'bg-sheet border-line-hair hover:bg-sheet-raised/50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-ink">{lang === 'bn' ? ep.epochNameBn : ep.epochNameEn}</span>
                      <span className="mono text-2xs text-indigo font-bold">{ep.measuredAreaDecimal} {lang === 'bn' ? 'শতক' : 'Dec'}</span>
                    </div>

                    <div className="text-2xs text-ink-3 mt-1 space-y-0.5">
                      <div className="flex justify-between">
                        <span>{lang === 'bn' ? 'প্রযুক্তি:' : 'Tech:'}</span>
                        <span className="text-ink font-medium truncate max-w-[150px]">{ep.surveyTechnology}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{lang === 'bn' ? 'পরিমাপ নির্ভুলতা:' : 'Precision:'}</span>
                        <span className="mono text-ink">±{ep.precisionMeters} m</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{lang === 'bn' ? 'নকশার স্কেল:' : 'Scale:'}</span>
                        <span className="mono text-ink">{ep.nominalScale}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Epoch Deep Dive */}
            {selectedEpoch && (
              <div className="p-3.5 bg-sheet rounded-lg border border-line text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-indigo" />
                  <span className="font-semibold text-ink text-xs">
                    {selectedEpoch.epochNameEn}
                  </span>
                </div>
                <div className="space-y-1.5 text-2xs text-ink-2">
                  <div className="flex justify-between border-b border-line-hair pb-1">
                    <span className="text-ink-3">{lang === 'bn' ? 'জরিপকারী সংস্থা' : 'Agency'}:</span>
                    <span className="text-ink font-medium text-right">{selectedEpoch.surveyAgency}</span>
                  </div>
                  <div className="flex justify-between border-b border-line-hair pb-1">
                    <span className="text-ink-3">{lang === 'bn' ? 'শীর্ষবিন্দু সংখ্যা' : 'Vertices'}:</span>
                    <span className="mono text-ink font-medium">{selectedEpoch.vertexCount} geodetic points</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-3">{lang === 'bn' ? 'জলাশয় বাফার ওভারল্যাপ' : 'Canal Overlap'}:</span>
                    <span className={`font-semibold ${selectedEpoch.canalBufferOverlap ? 'text-seal' : 'text-state'}`}>
                      {selectedEpoch.canalBufferOverlap
                        ? lang === 'bn' ? 'হ্যাঁ (দখলকৃত)' : 'Yes (Encroached)'
                        : lang === 'bn' ? 'না (নিরাপদ)' : 'None (Compliant)'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
