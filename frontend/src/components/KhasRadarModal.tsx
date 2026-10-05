import React, { useState, useEffect } from 'react';
import {
  Radar,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Building2,
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  MapPin,
  RefreshCw,
  FileWarning,
  ExternalLink,
  Waves,
} from 'lucide-react';
import Modal from './Modal';
import { Button } from './ui';
import { useLanguage } from '../lib/language';
import {
  getKhasRecords,
  checkKhasEncroachment,
  issueKhasEvictionNotice,
} from '../lib/api';
import type { KhasRecord, EncroachmentCheckResult } from '../lib/types';

interface KhasRadarModalProps {
  open: boolean;
  onClose: () => void;
  defaultParcelId?: string;
  defaultCoordinates?: [number, number];
}

export default function KhasRadarModal({
  open,
  onClose,
  defaultParcelId = 'BD-DHK-SAV-000001',
  defaultCoordinates = [90.258, 23.843],
}: KhasRadarModalProps) {
  const { lang, t } = useLanguage();
  const [encroachmentResult, setEncroachmentResult] = useState<EncroachmentCheckResult | null>(null);
  const [khasInventory, setKhasInventory] = useState<KhasRecord[]>([]);
  const [selectedUpazila, setSelectedUpazila] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Eviction form modal / inputs
  const [selectedKhasForEviction, setSelectedKhasForEviction] = useState<string | null>(null);
  const [evictionCaseNumber, setEvictionCaseNumber] = useState('EVICT-SAV-2026/09');
  const [encroacherName, setEncroacherName] = useState('Unauthorized Construction / Commercial Land Filler');

  const runRadarScan = async () => {
    setLoading(true);
    try {
      const [res, inventory] = await Promise.all([
        checkKhasEncroachment(defaultParcelId, defaultCoordinates),
        getKhasRecords(selectedUpazila === 'all' ? undefined : selectedUpazila),
      ]);
      setEncroachmentResult(res);
      setKhasInventory(inventory);
    } catch {
      // Handled via fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      runRadarScan();
    }
  }, [open, defaultParcelId, selectedUpazila]);

  const handleIssueEviction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKhasForEviction) return;
    setActionLoading(true);
    try {
      const updated = await issueKhasEvictionNotice(
        selectedKhasForEviction,
        evictionCaseNumber,
        encroacherName
      );
      setKhasInventory((prev) =>
        prev.map((k) => (k.id === updated.id ? updated : k))
      );
      setSelectedKhasForEviction(null);
    } finally {
      setActionLoading(false);
    }
  };

  const isCritical = encroachmentResult?.riskLevel === 'CRITICAL_ENCROACHMENT';
  const isBufferWarning = encroachmentResult?.riskLevel === 'BUFFER_WARNING';
  const isClean = encroachmentResult?.riskLevel === 'CLEAN';

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="State Property Integrity Radar"
      title="Khas & Vested Land Encroachment Radar"
      bn="১নং খাস খতিয়ান, নদী সিকস্তি ও অর্পিত সম্পত্তি দখল শনাক্তকরণ রাডার"
      maxWidth="5xl"
    >
      <div className="space-y-5 text-sm text-ink">
        {/* Radar Proximity Header Card */}
        <div className="p-4 bg-sheet border border-line rounded-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-line-hair">
            <div className="flex items-center gap-2">
              <Radar className="w-5 h-5 text-indigo animate-pulse" />
              <div>
                <span className="mono text-2xs font-semibold text-ink uppercase tracking-wider">
                  {lang === 'bn' ? '৫০-মিটার সংবিধিবদ্ধ বাফার জোন ও খাস স্ক্যানার' : '50-Meter Statutory Buffer & Khas Scanner'}
                </span>
                <span className="mono text-2xs text-ink-3 ml-2">
                  (Parcel: {defaultParcelId})
                </span>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={runRadarScan}
              className="text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              {lang === 'bn' ? 'পুনরায় স্ক্যান করুন' : 'Rescan Radar'}
            </Button>
          </div>

          {encroachmentResult ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Verdict Indicator */}
              <div
                className={`p-3.5 rounded-lg border flex flex-col justify-between ${
                  isCritical
                    ? 'bg-seal-soft border-seal/50 text-seal'
                    : isBufferWarning
                    ? 'bg-amber-soft border-amber/50 text-amber'
                    : 'bg-state-soft border-state/50 text-state'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2 mono text-2xs">
                    {isCritical ? (
                      <XCircle className="w-4 h-4 text-seal" />
                    ) : isBufferWarning ? (
                      <AlertTriangle className="w-4 h-4 text-amber" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-state" />
                    )}
                    <span className="font-semibold uppercase tracking-wider">
                      {encroachmentResult.riskLevel}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-ink leading-tight">
                    {lang === 'bn' ? encroachmentResult.riskLevelBn : encroachmentResult.riskLevel}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-line-hair mono text-[10px] text-ink-3">
                  {lang === 'bn' ? 'যাচাই সময়: ' : 'Verified at: '}
                  {new Date(encroachmentResult.checkedAt).toLocaleTimeString()}
                </div>
              </div>

              {/* Distance Meter Gauge */}
              <div className="p-3.5 bg-sheet-raised border border-line rounded-lg flex flex-col justify-between">
                <div>
                  <div className="mono text-2xs text-ink-3 mb-1">
                    {lang === 'bn' ? 'নিকটতম সরকারি খাস জমির দূরত্ব' : 'Closest Distance to Khas/Vested Boundary'}
                  </div>
                  <div className="mono text-2xl font-bold text-ink">
                    {encroachmentResult.closestDistanceMeters.toFixed(1)}{' '}
                    <span className="text-xs font-normal text-ink-3">meters</span>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="flex justify-between mono text-[10px] text-ink-3 mb-1">
                    <span className="text-seal font-semibold">0m (Encroached)</span>
                    <span className="text-amber font-semibold">50m Buffer</span>
                    <span className="text-state font-semibold">&gt; 100m Clean</span>
                  </div>
                  <div className="w-full bg-ground-sunk h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isCritical
                          ? 'bg-seal'
                          : isBufferWarning
                          ? 'bg-amber'
                          : 'bg-state'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(8, (encroachmentResult.closestDistanceMeters / 150) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Statutory Citation Card */}
              <div className="p-3.5 bg-sheet-raised border border-line rounded-lg flex flex-col justify-between">
                <div>
                  <div className="mono text-2xs text-ink-3 mb-1">
                    {lang === 'bn' ? 'আইনগত নির্দেশনা ও ধারা' : 'Statutory Reference'}
                  </div>
                  <div className="mono text-xs font-semibold text-ink leading-relaxed">
                    {encroachmentResult.statutoryCitation}
                  </div>
                </div>
                <div className="text-[11px] text-ink-2 leading-snug mt-2 pt-2 border-t border-line-hair">
                  {lang === 'bn'
                    ? encroachmentResult.statutoryNoticeBn
                    : encroachmentResult.statutoryNoticeEn}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center mono text-xs text-ink-3">
              Scanning parcel boundaries...
            </div>
          )}
        </div>

        {/* Inventory of Authoritative Government Khas & Vested Records */}
        <div className="p-4 bg-sheet border border-line rounded-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-line-hair">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo" />
              <span className="mono text-2xs font-semibold text-ink uppercase tracking-wider">
                {lang === 'bn' ? 'সরকারি খাস ও অর্পিত সম্পত্তি রেজিস্টার' : 'Authoritative Government Khas & Vested Land Inventory'}
              </span>
            </div>

            {/* Filter by Upazila */}
            <div className="flex items-center gap-2">
              <span className="mono text-2xs text-ink-3">
                {lang === 'bn' ? 'উপজেলা ফিল্টার:' : 'Filter Upazila:'}
              </span>
              <select
                aria-label="Filter Upazila"
                value={selectedUpazila}
                onChange={(e) => setSelectedUpazila(e.target.value)}
                className="bg-ground-sunk border border-line text-xs text-ink mono px-2 py-1 rounded focus:border-indigo focus:outline-none"
              >
                <option value="all">All Upazilas (সমগ্র)</option>
                <option value="Savar">Savar (সাভার)</option>
                <option value="Panchlaish">Panchlaish (পাঁচলাইশ)</option>
                <option value="Ishwardi">Ishwardi (ঈশ্বরদী)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-ground-sunk text-ink-3 mono uppercase tracking-wider text-[11px] border-b border-line">
                <tr>
                  <th className="py-2.5 px-3">Khas Khatian & Dag</th>
                  <th className="py-2.5 px-3">Location & Mouza</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Area</th>
                  <th className="py-2.5 px-3">Encroachment Status</th>
                  <th className="py-2.5 px-3 text-right">Administrative Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-hair mono">
                {khasInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-ground-sunk/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-ink">{item.khasKhatianNo}</div>
                      <div className="text-[11px] text-ink-3 mt-0.5">{item.dagNo}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-ink-2">{item.mouza}</div>
                      <div className="text-[11px] text-ink-3">
                        {item.upazila}, {item.district}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-soft text-indigo border border-indigo/30">
                        {item.category}
                      </span>
                      <div className="text-[10px] text-ink-3 mt-0.5 font-sans">{item.categoryBn}</div>
                    </td>
                    <td className="py-3 px-3 text-state font-bold">
                      {item.areaDecimal} dec
                    </td>
                    <td className="py-3 px-3">
                      {item.isEncroached ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-seal bg-seal-soft px-2 py-0.5 rounded border border-seal/30">
                            <FileWarning className="w-3 h-3" />
                            ENCROACHED
                          </span>
                          <div className="text-[10px] text-ink-3 font-sans line-clamp-1">
                            {item.encroacherName}
                          </div>
                          {item.evictionCaseNumber && (
                            <div className="text-[10px] text-amber font-semibold">
                              Notice: {item.evictionCaseNumber} ({item.evictionNoticeDate})
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-state bg-state-soft px-2 py-0.5 rounded border border-state/30">
                          <CheckCircle2 className="w-3 h-3" />
                          UNENCROACHED
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {item.isEncroached && !item.evictionCaseNumber ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedKhasForEviction(item.id)}
                          className="text-[11px] border-seal/40 text-seal hover:bg-seal-soft"
                        >
                          {lang === 'bn' ? 'উচ্ছেদ নোটিশ জারি' : 'Issue Eviction'}
                        </Button>
                      ) : item.evictionCaseNumber ? (
                        <span className="text-[11px] text-amber mono font-semibold">
                          Eviction Pending
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-3 mono">
                          Clean Record
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Administrative Eviction Notice Form */}
        {selectedKhasForEviction && (
          <form
            onSubmit={handleIssueEviction}
            className="p-4 bg-sheet border border-seal/40 rounded-lg space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-line-hair">
              <span className="mono text-2xs font-semibold text-seal uppercase tracking-wider">
                {lang === 'bn'
                  ? 'সরকারি ভূমি পুনরুদ্ধার অধ্যাদেশ ১৯৭০ এর অধীন উচ্ছেদ নোটিশ জারি'
                  : 'Issue Administrative Eviction Order (Public Lands Ordinance 1970)'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedKhasForEviction(null)}
                className="mono text-xs text-ink-3 hover:text-ink"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="mono text-[11px] text-ink-3 block mb-1">
                  {lang === 'bn' ? 'উচ্ছেদ মোকদ্দমা নম্বর:' : 'Eviction Case Reference:'}
                </label>
                <input
                  type="text"
                  value={evictionCaseNumber}
                  onChange={(e) => setEvictionCaseNumber(e.target.value)}
                  className="w-full bg-ground border border-line px-2.5 py-1.5 rounded text-xs text-ink mono focus:border-seal focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mono text-[11px] text-ink-3 block mb-1">
                  {lang === 'bn' ? 'দখলদার বা অবৈধ কাঠামোর বিবরণ:' : 'Encroacher Identity / Structure Description:'}
                </label>
                <input
                  type="text"
                  value={encroacherName}
                  onChange={(e) => setEncroacherName(e.target.value)}
                  className="w-full bg-ground border border-line px-2.5 py-1.5 rounded text-xs text-ink focus:border-seal focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSelectedKhasForEviction(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={actionLoading}
                className="bg-seal text-sheet-raised hover:opacity-90 font-bold text-xs"
              >
                {actionLoading ? 'Logging Notice...' : lang === 'bn' ? 'উচ্ছেদ নোটিশ অনুমোদন করুন' : 'Confirm Eviction Notice'}
              </Button>
            </div>
          </form>
        )}

        {/* Statutory Policy Footnote */}
        <div className="p-3 bg-ground-sunk border border-line-hair rounded-lg text-xs mono text-ink-3 space-y-1">
          <div className="text-ink font-semibold">
            {lang === 'bn' ? 'ভূমি আইনগত সতর্কতা ও নির্দেশিকা:' : 'Statutory Land Guidance Notes:'}
          </div>
          <div>
            1. Alluvial & Diluvial Lands (নদী সিকস্তি ও পয়স্তি): Governed under Section 86 of the State Acquisition and Tenancy Act 1950. All newly emerged chars and dried riverbeds automatically vest in the Government under 1 No. Khas Khatian.
          </div>
          <div>
            2. Vested Property (অর্পিত সম্পত্তি): Governed under Vested Property Return (Amendment) Act 2013 ("ক" তফসিল). Transactions on Vested Property are void ab initio.
          </div>
        </div>
      </div>
    </Modal>
  );
}
