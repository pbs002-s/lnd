import React, { useState, useEffect } from 'react';
import {
  Compass,
  MapPin,
  Layers,
  Wifi,
  WifiOff,
  RefreshCw,
  Plus,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  Printer,
  Clock,
  UserCheck,
  Scale,
  FileText,
  Send,
  Navigation,
} from 'lucide-react';
import Modal from './Modal';
import { Button } from './ui';
import { useLanguage } from '../lib/language';
import {
  getSurveyRecords,
  createSurveyRecord,
  addStationPeg,
  addCoSharerStatement,
  submitSurveyReport,
  syncOfflineSurveys,
} from '../lib/api';
import type { SurveyRecord, BenchmarkPeg, CoSharerStatement } from '../lib/types';

interface OfflineSurveyModalProps {
  open: boolean;
  onClose: () => void;
  defaultParcelId?: string;
  defaultAreaDecimal?: number;
}

const LOCAL_STORAGE_OFFLINE_KEY = 'landupdate_offline_survey_queue_v1';

export default function OfflineSurveyModal({
  open,
  onClose,
  defaultParcelId = 'BD-DHK-SAV-000001',
  defaultAreaDecimal = 5.5,
}: OfflineSurveyModalProps) {
  const { lang } = useLanguage();
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [activeSurvey, setActiveSurvey] = useState<SurveyRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [offlineSimulated, setOfflineSimulated] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [showPrintView, setShowPrintView] = useState(false);

  // New Station Peg Form state
  const [showAddPeg, setShowAddPeg] = useState(false);
  const [pegNumber, setPegNumber] = useState('P-5 (মধ্যবর্তী সীমানা খাঁজ)');
  const [pegLat, setPegLat] = useState('23.8439');
  const [pegLng, setPegLng] = useState('90.2592');
  const [pegBtmE, setPegBtmE] = useState('526345.5');
  const [pegBtmN, setPegBtmN] = useState('2637380.0');
  const [pegElevation, setPegElevation] = useState('11.0');
  const [pegLinks, setPegLinks] = useState('60');
  const [pegMarkerType, setPegMarkerType] = useState<BenchmarkPeg['physicalMarkerType']>('CONCRETE_PILLAR');

  // New Statement Form state
  const [showAddStmt, setShowAddStmt] = useState(false);
  const [stmtName, setStmtName] = useState('Abdul Gafur');
  const [stmtNid, setStmtNid] = useState('19822692019900445');
  const [stmtRel, setStmtRel] = useState<CoSharerStatement['relationship']>('ADJACENT_OWNER');
  const [stmtDag, setStmtDag] = useState('দাগ নং ৪৮৪');
  const [stmtText, setStmtText] = useState('আমিন কর্তৃক সরেজমিন সীমানা নির্ধারণে কোনো প্রকার সীমানা বিরোধ পরিলক্ষিত হয়নি।');
  const [stmtHasObjection, setStmtHasObjection] = useState(false);

  const getStoredOfflineSurveys = (): SurveyRecord[] => {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_OFFLINE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  };

  const saveOfflineQueue = (list: SurveyRecord[]) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_OFFLINE_KEY, JSON.stringify(list));
      setOfflineQueueCount(list.length);
    } catch {
      // Storage error fallback
    }
  };

  const loadSurveys = async () => {
    setLoading(true);
    try {
      const offlineList = getStoredOfflineSurveys();
      setOfflineQueueCount(offlineList.length);

      const serverSurveys = await getSurveyRecords({ parcelId: defaultParcelId });
      const combined = [...offlineList, ...serverSurveys];
      setSurveys(combined);
      if (combined.length > 0) {
        setActiveSurvey(combined[0]);
      } else {
        // Auto create initial draft if none exists
        handleCreateNewSurvey();
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadSurveys();
    }
  }, [open, defaultParcelId]);

  const handleCreateNewSurvey = async () => {
    setActionLoading(true);
    try {
      const created = await createSurveyRecord({
        parcelId: defaultParcelId,
        mouza: 'Savar Mouza (সাভার মৌজা)',
        upazila: 'Savar',
        district: 'Dhaka',
        aminId: 'amin-004',
        aminName: 'Md. Abdur Rahim (Revenue Amin)',
        aminLicenseNo: 'AMIN-DHK-2018/88',
        khatianRecordedDecimal: defaultAreaDecimal,
        physicalLandUse: 'RESIDENTIAL_HOMESTEAD',
        isOffline: offlineSimulated,
      });

      if (offlineSimulated) {
        const queue = getStoredOfflineSurveys();
        queue.unshift(created);
        saveOfflineQueue(queue);
      }

      setSurveys((prev) => [created, ...prev]);
      setActiveSurvey(created);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddPeg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSurvey) return;
    setActionLoading(true);

    const linksVal = parseFloat(pegLinks) || 0;
    const feetVal = Number((linksVal * 0.66).toFixed(2));

    const pegData: Omit<BenchmarkPeg, 'id' | 'timestamp'> = {
      pegNumber,
      lat: parseFloat(pegLat) || 23.844,
      lng: parseFloat(pegLng) || 90.259,
      btmEasting: parseFloat(pegBtmE) || 526340,
      btmNorthing: parseFloat(pegBtmN) || 2637380,
      elevationMeters: parseFloat(pegElevation) || 11.0,
      chainageToNextLinks: linksVal,
      chainageToNextFeet: feetVal,
      physicalMarkerType: pegMarkerType,
    };

    try {
      if (offlineSimulated || activeSurvey.offlineCreated) {
        // Add to offline survey directly
        const updatedPegs: BenchmarkPeg[] = [
          ...activeSurvey.benchmarkPegs,
          {
            id: `peg-${Date.now()}`,
            ...pegData,
            timestamp: new Date().toISOString(),
          },
        ];
        const computedSqFt = updatedPegs.length * 5989.5;
        const computedDec = Number((computedSqFt / 435.6).toFixed(2));
        const updated: SurveyRecord = {
          ...activeSurvey,
          benchmarkPegs: updatedPegs,
          computedAreaSqFt: computedSqFt,
          computedAreaDecimal: computedDec,
          areaVarianceDecimal: Number((computedDec - activeSurvey.khatianRecordedDecimal).toFixed(2)),
          updatedAt: new Date().toISOString(),
        };

        const queue = getStoredOfflineSurveys().map((s) => (s.id === updated.id ? updated : s));
        saveOfflineQueue(queue);
        setActiveSurvey(updated);
        setSurveys((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const updated = await addStationPeg(activeSurvey.id, pegData);
        setActiveSurvey(updated);
        setSurveys((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      }
      setShowAddPeg(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSurvey) return;
    setActionLoading(true);

    const stmtData: Omit<CoSharerStatement, 'id' | 'timestamp'> = {
      personName: stmtName,
      nid: stmtNid,
      relationship: stmtRel,
      adjacentDagNo: stmtDag,
      statementText: stmtText,
      hasObjection: stmtHasObjection,
    };

    try {
      if (offlineSimulated || activeSurvey.offlineCreated) {
        const updatedStmts: CoSharerStatement[] = [
          ...activeSurvey.coSharerStatements,
          {
            id: `stmt-${Date.now()}`,
            ...stmtData,
            timestamp: new Date().toISOString(),
          },
        ];
        const updated: SurveyRecord = {
          ...activeSurvey,
          coSharerStatements: updatedStmts,
          boundaryDisputeFlag: updatedStmts.some((s) => s.hasObjection),
          updatedAt: new Date().toISOString(),
        };

        const queue = getStoredOfflineSurveys().map((s) => (s.id === updated.id ? updated : s));
        saveOfflineQueue(queue);
        setActiveSurvey(updated);
        setSurveys((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const updated = await addCoSharerStatement(activeSurvey.id, stmtData);
        setActiveSurvey(updated);
        setSurveys((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      }
      setShowAddStmt(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!activeSurvey) return;
    setActionLoading(true);
    try {
      const updated = await submitSurveyReport(activeSurvey.id);
      setActiveSurvey(updated);
      setSurveys((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncOffline = async () => {
    const queue = getStoredOfflineSurveys();
    if (queue.length === 0) return;
    setActionLoading(true);
    try {
      const res = await syncOfflineSurveys(queue);
      localStorage.removeItem(LOCAL_STORAGE_OFFLINE_KEY);
      setOfflineQueueCount(0);
      loadSurveys();
    } finally {
      setActionLoading(false);
    }
  };

  const varianceAbs = activeSurvey ? Math.abs(activeSurvey.areaVarianceDecimal) : 0;
  const hasVarianceAlert = varianceAbs > 0.1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="DLRS Field Survey & Offline Amin Sync"
      title="Amin Cadastral Survey & Offline Sync Module"
      bn="মাঠপর্যায়ে আমিন জরিপ, গান্টার চেইন ও অফলাইন ডেটা সিঙ্ক"
      maxWidth="5xl"
    >
      <div className="space-y-5 text-sm text-ink pb-4">
        {/* Offline Status & Network Bar */}
        <div className="p-3.5 bg-sheet border border-line rounded-lg flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-md flex items-center justify-center ${
                offlineSimulated
                  ? 'bg-amber/15 text-amber border border-amber/30'
                  : 'bg-state/15 text-state border border-state/30'
              }`}
            >
              {offlineSimulated ? (
                <WifiOff className="w-4 h-4" />
              ) : (
                <Wifi className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink">
                  {offlineSimulated
                    ? lang === 'bn'
                      ? 'অফলাইন চর/হাওর ফিল্ড মোড (নো ইন্টারনেট)'
                      : 'Offline Remote Field Mode (Zero Connectivity)'
                    : lang === 'bn'
                    ? 'অনলাইন সার্ভার কানেক্টেড'
                    : 'Online Server Connected'}
                </span>
                {offlineQueueCount > 0 && (
                  <span className="mono text-2xs px-2 py-0.5 rounded bg-amber/20 text-amber font-semibold border border-amber/40">
                    {offlineQueueCount} {lang === 'bn' ? 'অফলাইন রেকর্ড অপেক্ষমাণ' : 'Pending in Queue'}
                  </span>
                )}
              </div>
              <p className="text-2xs text-ink-3">
                {lang === 'bn'
                  ? 'লোকাল স্টোরেজে সংরক্ষিত ডেটা স্বয়ংক্রিয়ভাবে সিঙ্ক হবে নেটওয়ার্ক পুনঃসংযোগকালে।'
                  : 'Field records are locally cached via HTML5 IndexedStorage and two-way synced upon connection.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="quiet"
              size="sm"
              onClick={() => setOfflineSimulated(!offlineSimulated)}
              className="text-xs"
            >
              {offlineSimulated
                ? lang === 'bn'
                  ? 'অনলাইনে স্যুইচ করুন'
                  : 'Switch to Online'
                : lang === 'bn'
                ? 'অফলাইন ফিল্ড টেস্ট মোড'
                : 'Simulate Offline Char'}
            </Button>

            {offlineQueueCount > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSyncOffline}
                disabled={actionLoading || offlineSimulated}
                className="text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${actionLoading ? 'animate-spin' : ''}`} />
                {lang === 'bn' ? 'এখনই সিঙ্ক করুন' : 'Sync Offline Queue'}
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPrintView(!showPrintView)}
              className="text-xs"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              {showPrintView
                ? lang === 'bn'
                  ? 'তদন্ত প্যানেলে ফিরুন'
                  : 'Back to Editor'
                : lang === 'bn'
                ? 'তদন্ত প্রতিবেদন প্রিন্ট'
                : 'Print Report'}
            </Button>
          </div>
        </div>

        {showPrintView && activeSurvey ? (
          /* Printable Field Inspection Sheet */
          <div className="p-6 bg-sheet-raised border border-line rounded-lg space-y-6 print:border-none">
            <div className="text-center pb-4 border-b border-line space-y-1">
              <span className="mono text-xs uppercase tracking-widest text-ink-3">
                গণপ্রজাতন্ত্রী বাংলাদেশ সরকার — ভূমি মন্ত্রণালয়
              </span>
              <h2 className="text-lg font-bold text-ink">
                ভূমি রেকর্ড ও জরিপ অধিদপ্তর (DLRS) — সারজমিন তদন্ত প্রতিবেদন
              </h2>
              <p className="text-xs text-ink-2">
                মৌজা: {activeSurvey.mouza} | উপজেলা: {activeSurvey.upazila} | জেলা: {activeSurvey.district} | দাগ আইডি: {activeSurvey.parcelId}
              </p>
              <div className="mono text-2xs text-ink-3">
                প্রতিবেদন আইডি: {activeSurvey.id} | জরিপের তারিখ: {activeSurvey.surveyDate} | অবস্থা: {activeSurvey.status}
              </div>
            </div>

            {/* Officer & Land Information */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-2.5 bg-sheet rounded border border-line-hair">
                <span className="text-ink-3 block text-2xs">{lang === 'bn' ? 'দায়িত্বপ্রাপ্ত আমিন' : 'Revenue Amin'}</span>
                <span className="font-semibold text-ink">{activeSurvey.aminName}</span>
                <span className="block mono text-2xs text-ink-3">{activeSurvey.aminLicenseNo}</span>
              </div>
              <div className="p-2.5 bg-sheet rounded border border-line-hair">
                <span className="text-ink-3 block text-2xs">{lang === 'bn' ? 'জমির বাস্তব শ্রেণি' : 'Physical Land Use'}</span>
                <span className="font-semibold text-ink">{activeSurvey.physicalLandUseBn}</span>
              </div>
              <div className="p-2.5 bg-sheet rounded border border-line-hair">
                <span className="text-ink-3 block text-2xs">{lang === 'bn' ? 'খতিয়ানভুক্ত পরিমাণ' : 'Khatian Area'}</span>
                <span className="font-semibold text-ink">{activeSurvey.khatianRecordedDecimal} শতাংশ</span>
              </div>
              <div className="p-2.5 bg-sheet rounded border border-line-hair">
                <span className="text-ink-3 block text-2xs">{lang === 'bn' ? 'জমিনে পরিমাপকৃত পরিমাণ' : 'Computed Field Area'}</span>
                <span className="font-semibold text-state">{activeSurvey.computedAreaDecimal} শতাংশ</span>
                <span className="block text-2xs text-ink-3">({activeSurvey.computedAreaSqFt.toLocaleString()} বর্গফুট)</span>
              </div>
            </div>

            {/* Station Pegs Printout */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
                ১. স্টেশন খুঁটি ও গান্টার চেইন পরিমাপ তালিকা (Station Pegs & Chainage)
              </h3>
              <div className="overflow-x-auto border border-line rounded">
                <table className="w-full text-xs">
                  <thead className="bg-sheet border-b border-line text-ink-2">
                    <tr>
                      <th className="py-2 px-3 text-left">খুঁটি নম্বর</th>
                      <th className="py-2 px-3 text-left">চিহ্নিতকরণ ধরন</th>
                      <th className="py-2 px-3 text-left">GPS (অক্ষাংশ / দ্রাঘিমাংশ)</th>
                      <th className="py-2 px-3 text-left">BTM Easting / Northing</th>
                      <th className="py-2 px-3 text-right">পরবর্তী খুঁটির দূরত্ব (কড়ি / লিংক)</th>
                      <th className="py-2 px-3 text-right">দূরত্ব (ফুট)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-hair">
                    {activeSurvey.benchmarkPegs.map((peg) => (
                      <tr key={peg.id} className="hover:bg-sheet/50">
                        <td className="py-2 px-3 font-medium text-ink">{peg.pegNumber}</td>
                        <td className="py-2 px-3 text-ink-2">{peg.physicalMarkerType}</td>
                        <td className="py-2 px-3 mono text-2xs">{peg.lat.toFixed(4)}, {peg.lng.toFixed(4)}</td>
                        <td className="py-2 px-3 mono text-2xs">{peg.btmEasting}, {peg.btmNorthing}</td>
                        <td className="py-2 px-3 mono text-right text-indigo font-semibold">{peg.chainageToNextLinks} কড়ি</td>
                        <td className="py-2 px-3 mono text-right">{peg.chainageToNextFeet} ফুট</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Co-Sharer Statements Printout */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
                ২. অংশীদার ও প্রতিবেশীদের সারজমিন জবানবন্দি (Spot Statements)
              </h3>
              <div className="space-y-2">
                {activeSurvey.coSharerStatements.map((stmt) => (
                  <div key={stmt.id} className="p-3 bg-sheet rounded border border-line text-xs space-y-1">
                    <div className="flex justify-between font-semibold text-ink">
                      <span>{stmt.personName} (জাতীয় পরিচয়পত্র: {stmt.nid})</span>
                      <span className={stmt.hasObjection ? 'text-seal' : 'text-state'}>
                        {stmt.hasObjection ? 'আপত্তি আছে' : 'আপত্তি নেই / সম্মত'}
                      </span>
                    </div>
                    <div className="text-2xs text-ink-3">সম্পর্ক: {stmt.relationship} {stmt.adjacentDagNo && `| ${stmt.adjacentDagNo}`}</div>
                    <p className="text-ink-2 italic">"{stmt.statementText}"</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Official Certification and Signature Block */}
            <div className="pt-8 border-t border-line grid grid-cols-2 gap-8 text-center text-xs">
              <div className="space-y-8">
                <div className="text-ink-3">তদন্তকারী আমিনের স্বাক্ষর ও সিল</div>
                <div className="pt-4 border-t border-dashed border-line text-ink font-semibold">
                  {activeSurvey.aminName}
                  <span className="block text-2xs font-normal text-ink-3">{activeSurvey.aminLicenseNo}</span>
                </div>
              </div>
              <div className="space-y-8">
                <div className="text-ink-3">সার্কেল কানুনগো / সহকারী কমিশনার (ভূমি) এর প্রতিস্বাক্ষর</div>
                <div className="pt-4 border-t border-dashed border-line text-ink font-semibold">
                  {activeSurvey.kanungoReviewed ? 'অনুমোদিত ও স্বাক্ষরিত' : 'পর্যালোচনাধীন'}
                  <span className="block text-2xs font-normal text-ink-3">উপজেলা ভূমি অফিস, {activeSurvey.upazila}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Normal Interactive Survey Workspace */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left 2 Cols: Peg Logger & Chain Calculator */}
            <div className="lg:col-span-2 space-y-4">
              {/* Active Survey Header Card */}
              {activeSurvey && (
                <div className="p-4 bg-sheet border border-line rounded-lg space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-line-hair">
                    <div className="flex items-center gap-2">
                      <Compass className="w-5 h-5 text-indigo" />
                      <div>
                        <span className="font-semibold text-ink text-sm">
                          {activeSurvey.id}
                        </span>
                        <span className="mono text-2xs text-ink-3 ml-2">
                          {activeSurvey.mouza}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`mono text-2xs px-2.5 py-0.5 rounded font-semibold border ${
                        activeSurvey.status === 'SYNCED'
                          ? 'bg-state/15 text-state border-state/30'
                          : activeSurvey.status === 'OFFLINE_QUEUED'
                          ? 'bg-amber/15 text-amber border-amber/30'
                          : 'bg-indigo/15 text-indigo border-indigo/30'
                      }`}
                    >
                      {activeSurvey.status}
                    </span>
                  </div>

                  {/* Area Comparison Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-2.5 bg-sheet-raised rounded border border-line-hair">
                      <span className="text-2xs text-ink-3 block">{lang === 'bn' ? 'রেকর্ডকৃত এলাকা' : 'Recorded Area'}</span>
                      <span className="font-semibold text-ink">{activeSurvey.khatianRecordedDecimal} {lang === 'bn' ? 'শতক' : 'Dec'}</span>
                    </div>
                    <div className="p-2.5 bg-sheet-raised rounded border border-line-hair">
                      <span className="text-2xs text-ink-3 block">{lang === 'bn' ? 'আমিন পরিমাপকৃত' : 'Field Measured'}</span>
                      <span className="font-semibold text-state">{activeSurvey.computedAreaDecimal} {lang === 'bn' ? 'শতক' : 'Dec'}</span>
                      <span className="text-3xs text-ink-3 block">({activeSurvey.computedAreaSqFt.toLocaleString()} sqft)</span>
                    </div>
                    <div className="p-2.5 bg-sheet-raised rounded border border-line-hair">
                      <span className="text-2xs text-ink-3 block">{lang === 'bn' ? 'পরিমাপ পার্থক্য' : 'Area Variance'}</span>
                      <span className={`font-semibold ${hasVarianceAlert ? 'text-seal' : 'text-ink'}`}>
                        {activeSurvey.areaVarianceDecimal > 0 ? `+${activeSurvey.areaVarianceDecimal}` : activeSurvey.areaVarianceDecimal} {lang === 'bn' ? 'শতক' : 'Dec'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-sheet-raised rounded border border-line-hair">
                      <span className="text-2xs text-ink-3 block">{lang === 'bn' ? 'বাস্তব ব্যবহার' : 'Physical Land Use'}</span>
                      <span className="font-semibold text-ink truncate block">{activeSurvey.physicalLandUseBn}</span>
                    </div>
                  </div>

                  {/* Variance Alert Banner */}
                  {hasVarianceAlert && (
                    <div className="p-2.5 bg-seal-soft border border-seal/30 rounded flex items-center gap-2 text-seal text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        {lang === 'bn'
                          ? 'সতর্কতা: জমিনে পরিমাপকৃত পরিমাণ এবং খতিয়ানের রেকর্ডের মধ্যে ০.১০ শতাংশের বেশি তারতম্য বিদ্যমান।'
                          : 'DISCREPANCY ALERT: Field survey area deviates by more than 0.10 decimals from registered khatian.'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Benchmark Pegs / Milestones Section */}
              <div className="p-4 bg-sheet border border-line rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-indigo" />
                    <h3 className="font-semibold text-ink text-xs uppercase tracking-wider">
                      {lang === 'bn' ? 'স্টেশন খুঁটি ও গান্টার চেইন দূরত্ব' : 'Station Pegs & Gunter Chainage'}
                    </h3>
                    <span className="mono text-2xs text-ink-3">
                      ({activeSurvey?.benchmarkPegs.length || 0} {lang === 'bn' ? 'খুঁটি চিহ্নিত' : 'pegs'})
                    </span>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAddPeg(!showAddPeg)}
                    className="text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    {lang === 'bn' ? 'নতুন খুঁটি যোগ করুন' : 'Add Peg'}
                  </Button>
                </div>

                {/* Add Peg Inline Form */}
                {showAddPeg && (
                  <form onSubmit={handleAddPeg} className="p-3 bg-sheet-raised border border-line rounded-lg space-y-3">
                    <div className="text-xs font-semibold text-ink pb-1 border-b border-line-hair">
                      {lang === 'bn' ? 'নতুন স্টেশন খুঁটি ও গান্টার চেইন বিবরণ' : 'Record Station Peg Details'}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-2xs text-ink-3 block mb-0.5">{lang === 'bn' ? 'খুঁটি নম্বর / বিবরণ' : 'Peg Label'}</label>
                        <input
                          type="text"
                          value={pegNumber}
                          onChange={(e) => setPegNumber(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-sheet border border-line rounded text-xs text-ink"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-2xs text-ink-3 block mb-0.5">{lang === 'bn' ? 'চিহ্নিতকরণ ধরন' : 'Marker Type'}</label>
                        <select
                          value={pegMarkerType}
                          onChange={(e) => setPegMarkerType(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 bg-sheet border border-line rounded text-xs text-ink"
                        >
                          <option value="CONCRETE_PILLAR">কনক্রিট পিলার (Concrete Pillar)</option>
                          <option value="IRON_ROD">লোহার রড (Iron Rod)</option>
                          <option value="CANAL_BOUNDARY_MARK">নদী/খাল সীমানা পাথর (Canal Marker)</option>
                          <option value="WOODEN_PEG">কাঠের খুঁটি (Wooden Peg)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="text-2xs text-ink-3 block mb-0.5">Latitude (GPS)</label>
                        <input
                          type="text"
                          value={pegLat}
                          onChange={(e) => setPegLat(e.target.value)}
                          className="w-full px-2 py-1 bg-sheet border border-line rounded text-2xs mono"
                        />
                      </div>
                      <div>
                        <label className="text-2xs text-ink-3 block mb-0.5">Longitude (GPS)</label>
                        <input
                          type="text"
                          value={pegLng}
                          onChange={(e) => setPegLng(e.target.value)}
                          className="w-full px-2 py-1 bg-sheet border border-line rounded text-2xs mono"
                        />
                      </div>
                      <div>
                        <label className="text-2xs text-ink-3 block mb-0.5">BTM Easting (m)</label>
                        <input
                          type="text"
                          value={pegBtmE}
                          onChange={(e) => setPegBtmE(e.target.value)}
                          className="w-full px-2 py-1 bg-sheet border border-line rounded text-2xs mono"
                        />
                      </div>
                      <div>
                        <label className="text-2xs text-ink-3 block mb-0.5">BTM Northing (m)</label>
                        <input
                          type="text"
                          value={pegBtmN}
                          onChange={(e) => setPegBtmN(e.target.value)}
                          className="w-full px-2 py-1 bg-sheet border border-line rounded text-2xs mono"
                        />
                      </div>
                    </div>

                    {/* Cadastral Gunter Chain Converter Box */}
                    <div className="p-2.5 bg-sheet rounded border border-line-hair flex items-center justify-between gap-3 text-xs">
                      <div className="flex-1">
                        <label className="text-2xs text-ink-3 block mb-0.5">
                          {lang === 'bn' ? 'পরবর্তী খুঁটি পর্যন্ত গান্টার চেইন (কড়ি / Links)' : 'Distance to Next Peg (Links / কড়ি)'}
                        </label>
                        <input
                          type="number"
                          value={pegLinks}
                          onChange={(e) => setPegLinks(e.target.value)}
                          className="w-full px-2.5 py-1 bg-sheet border border-line rounded text-xs mono text-indigo font-bold"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="text-right">
                        <span className="text-2xs text-ink-3 block">{lang === 'bn' ? 'সমতুল্য ফুট' : 'Calculated Feet'}</span>
                        <span className="mono text-xs font-bold text-ink">
                          {((parseFloat(pegLinks) || 0) * 0.66).toFixed(2)} {lang === 'bn' ? 'ফুট' : 'ft'}
                        </span>
                        <span className="block text-3xs text-ink-3">১ কড়ি = ০.৬৬ ফুট</span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="quiet"
                        size="sm"
                        onClick={() => setShowAddPeg(false)}
                      >
                        {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={actionLoading}
                      >
                        {lang === 'bn' ? 'খুঁটি সংরক্ষণ করুন' : 'Save Peg'}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Pegs List */}
                <div className="divide-y divide-line-hair border border-line rounded overflow-hidden">
                  {activeSurvey?.benchmarkPegs.length === 0 ? (
                    <div className="p-4 text-center text-xs text-ink-3">
                      {lang === 'bn' ? 'কোনো স্টেশন খুঁটি এখনও নথিভুক্ত হয়নি।' : 'No station benchmark pegs recorded yet.'}
                    </div>
                  ) : (
                    activeSurvey?.benchmarkPegs.map((peg, idx) => (
                      <div key={peg.id} className="p-3 bg-sheet hover:bg-sheet-raised/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-indigo/15 text-indigo flex items-center justify-center font-bold text-3xs">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-semibold text-ink">{peg.pegNumber}</span>
                            <span className="block mono text-2xs text-ink-3">
                              GPS: {peg.lat.toFixed(4)}, {peg.lng.toFixed(4)} | BTM: {peg.btmEasting}, {peg.btmNorthing}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <span className="text-2xs text-ink-3 block">{peg.physicalMarkerType}</span>
                            <span className="mono text-2xs text-ink font-medium">
                              Elev: {peg.elevationMeters}m
                            </span>
                          </div>
                          <div className="pl-3 border-l border-line-hair">
                            <span className="mono text-xs font-bold text-indigo block">
                              {peg.chainageToNextLinks} {lang === 'bn' ? 'কড়ি' : 'links'}
                            </span>
                            <span className="mono text-2xs text-ink-3 block">
                              {peg.chainageToNextFeet} {lang === 'bn' ? 'ফুট' : 'ft'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Co-Sharer & Witness Statements */}
              <div className="p-4 bg-sheet border border-line rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-state" />
                    <h3 className="font-semibold text-ink text-xs uppercase tracking-wider">
                      {lang === 'bn' ? 'সারজমিন জবানবন্দি ও যৌথ সম্মতি' : 'Co-Sharer & Neighbor Spot Statements'}
                    </h3>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAddStmt(!showAddStmt)}
                    className="text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    {lang === 'bn' ? 'সাক্ষ্য যোগ করুন' : 'Add Statement'}
                  </Button>
                </div>

                {showAddStmt && (
                  <form onSubmit={handleAddStatement} className="p-3 bg-sheet-raised border border-line rounded-lg space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="text-2xs text-ink-3 block mb-0.5">{lang === 'bn' ? 'ব্যক্তির নাম' : 'Full Name'}</label>
                        <input
                          type="text"
                          value={stmtName}
                          onChange={(e) => setStmtName(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-sheet border border-line rounded text-xs text-ink"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-2xs text-ink-3 block mb-0.5">{lang === 'bn' ? 'জাতীয় পরিচয়পত্র (NID)' : 'National ID'}</label>
                        <input
                          type="text"
                          value={stmtNid}
                          onChange={(e) => setStmtNid(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-sheet border border-line rounded text-xs text-ink"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-2xs text-ink-3 block mb-0.5">{lang === 'bn' ? 'সম্পর্ক / ভূমিকা' : 'Role / Relationship'}</label>
                        <select
                          value={stmtRel}
                          onChange={(e) => setStmtRel(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 bg-sheet border border-line rounded text-xs text-ink"
                        >
                          <option value="CO_SHARER">সহ-শরিক (Co-Sharer)</option>
                          <option value="ADJACENT_OWNER">পার্শ্ববর্তী দাগের মালিক (Adjacent Owner)</option>
                          <option value="VILLAGE_PRADHAN">স্থানীয় প্রধান / গণ্যমান্য (Village Elder)</option>
                        </select>
                      </div>
                    </div>

                    <div className="text-xs">
                      <label className="text-2xs text-ink-3 block mb-0.5">{lang === 'bn' ? 'জবানবন্দি / সাক্ষ্য' : 'Statement Transcript'}</label>
                      <textarea
                        value={stmtText}
                        onChange={(e) => setStmtText(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-sheet border border-line rounded text-xs text-ink"
                        rows={2}
                        required
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="hasObjection"
                        checked={stmtHasObjection}
                        onChange={(e) => setStmtHasObjection(e.target.checked)}
                        className="rounded border-line text-seal focus:ring-seal"
                      />
                      <label htmlFor="hasObjection" className="text-xs text-ink">
                        {lang === 'bn' ? 'এই ব্যক্তির সীমানা সংক্রান্ত কোনো আপত্তি বা দাবি আছে' : 'Party has recorded an active objection/boundary dispute'}
                      </label>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="quiet"
                        size="sm"
                        onClick={() => setShowAddStmt(false)}
                      >
                        {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={actionLoading}
                      >
                        {lang === 'bn' ? 'জবানবন্দি সংরক্ষণ করুন' : 'Save Statement'}
                      </Button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  {activeSurvey?.coSharerStatements.map((stmt) => (
                    <div
                      key={stmt.id}
                      className={`p-3 rounded border text-xs space-y-1 ${
                        stmt.hasObjection
                          ? 'bg-seal-soft border-seal/40'
                          : 'bg-sheet border-line'
                      }`}
                    >
                      <div className="flex justify-between font-semibold">
                        <span className="text-ink">{stmt.personName}</span>
                        <span className={`text-2xs font-bold ${stmt.hasObjection ? 'text-seal' : 'text-state'}`}>
                          {stmt.hasObjection
                            ? lang === 'bn' ? 'আপত্তি উত্থাপিত' : 'Objection Raised'
                            : lang === 'bn' ? 'সম্মতি প্রদান' : 'Consented'}
                        </span>
                      </div>
                      <div className="text-2xs text-ink-3">
                        NID: {stmt.nid} | {stmt.relationship} {stmt.adjacentDagNo && `(${stmt.adjacentDagNo})`}
                      </div>
                      <p className="text-ink-2 italic">"{stmt.statementText}"</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Col: Amin Info & Official Actions */}
            <div className="space-y-4">
              {/* Amin Profile Card */}
              <div className="p-4 bg-sheet border border-line rounded-lg space-y-3">
                <span className="text-2xs uppercase tracking-wider text-ink-3 font-semibold block">
                  {lang === 'bn' ? 'সার্ভেয়ার পরিচয় ও লাইসেন্স' : 'Cadastral Amin Credentials'}
                </span>
                {activeSurvey && (
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-ink-3 block text-2xs">{lang === 'bn' ? 'আমিনের নাম' : 'Amin Name'}</span>
                      <span className="font-semibold text-ink">{activeSurvey.aminName}</span>
                    </div>
                    <div>
                      <span className="text-ink-3 block text-2xs">{lang === 'bn' ? 'লাইসেন্স / কোড নং' : 'License / Registration'}</span>
                      <span className="mono text-ink font-medium">{activeSurvey.aminLicenseNo}</span>
                    </div>
                    <div>
                      <span className="text-ink-3 block text-2xs">{lang === 'bn' ? 'কর্মক্ষেত্র' : 'Jurisdiction'}</span>
                      <span className="text-ink">{activeSurvey.upazila} Upazila, {activeSurvey.district}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-4 bg-sheet border border-line rounded-lg space-y-3">
                <span className="text-2xs uppercase tracking-wider text-ink-3 font-semibold block">
                  {lang === 'bn' ? 'সরকারি জমা ও কানুনগো যাচাই' : 'Official Submission & Sign-off'}
                </span>

                <div className="space-y-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full text-xs justify-center"
                    onClick={handleFinalSubmit}
                    disabled={actionLoading || activeSurvey?.status === 'SYNCED'}
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    {activeSurvey?.status === 'SYNCED'
                      ? lang === 'bn'
                        ? 'প্রতিবেদন কানুনগো অফিসে দাখিলকৃত'
                        : 'Report Submitted & Synced'
                      : lang === 'bn'
                      ? 'কানুনগো অফিসে চূড়ান্ত দাখিল'
                      : 'Submit to Kanungo Office'}
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full text-xs justify-center"
                    onClick={handleCreateNewSurvey}
                    disabled={actionLoading}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    {lang === 'bn' ? 'নতুন মাঠ জরিপ শুরু করুন' : 'Start New Field Survey'}
                  </Button>
                </div>

                {activeSurvey?.kanungoReviewed && (
                  <div className="p-3 bg-state/10 border border-state/30 rounded text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-state font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{lang === 'bn' ? 'কানুনগো পর্যালোচনা সম্পন্ন' : 'Kanungo Approved'}</span>
                    </div>
                    <p className="text-2xs text-ink-2">
                      {activeSurvey.kanungoComments}
                    </p>
                  </div>
                )}
              </div>

              {/* Cadastral Units Reference Box */}
              <div className="p-3.5 bg-sheet rounded-lg border border-line text-xs space-y-2">
                <span className="text-2xs uppercase tracking-wider font-semibold text-ink-3 block">
                  {lang === 'bn' ? 'প্রচলিত ভূমি জরিপ পরিমাপ একক' : 'Cadastral Conversion Standard'}
                </span>
                <div className="space-y-1 text-2xs text-ink-2 mono">
                  <div className="flex justify-between">
                    <span>১ গান্টার চেইন (Gunter Chain):</span>
                    <span className="font-semibold text-ink">১০০ কড়ি = ৬৬ ফুট</span>
                  </div>
                  <div className="flex justify-between">
                    <span>১ কড়ি (Link):</span>
                    <span className="font-semibold text-ink">০.৬৬ ফুট (৭.৯২ ইঞ্চি)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>১০০০ বর্গ কড়ি (Sq Links):</span>
                    <span className="font-semibold text-ink">১ শতক (Decimal)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>১ শতক (Decimal):</span>
                    <span className="font-semibold text-ink">৪৩৫.৬ বর্গফুট</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
