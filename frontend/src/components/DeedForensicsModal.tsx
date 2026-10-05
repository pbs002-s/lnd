import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Gavel,
  Scale,
  FileText,
  Search,
  RotateCcw,
  Building2,
  UserCheck,
  AlertCircle,
  ExternalLink,
  Percent,
} from 'lucide-react';
import Modal from './Modal';
import { Button, StatusMark } from './ui';
import { useLanguage } from '../lib/language';
import {
  getDeedPresets,
  verifyDeed,
} from '../lib/api';
import type {
  DeedPreset,
  DeedVerificationParams,
  DeedVerificationResult,
  ForensicCheckItem,
} from '../lib/types';

interface DeedForensicsModalProps {
  open: boolean;
  onClose: () => void;
  defaultParcelId?: string;
  defaultAreaDecimal?: number;
  defaultOwnerName?: string;
  defaultOwnerNid?: string;
  onProceedToMutation?: () => void;
}

export default function DeedForensicsModal({
  open,
  onClose,
  defaultParcelId = 'BD-DHK-SAV-000001',
  defaultAreaDecimal = 5.5,
  defaultOwnerName = 'Kamal Hossain',
  defaultOwnerNid = '19852692011000123',
  onProceedToMutation,
}: DeedForensicsModalProps) {
  const { t } = useLanguage();

  const [presets, setPresets] = useState<DeedPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('preset-clean');
  const [loading, setLoading] = useState<boolean>(false);

  // Form Inputs
  const [formData, setFormData] = useState<DeedVerificationParams>({
    deedNumber: 'DALIL-2026-9042',
    parcelId: defaultParcelId,
    sellerNid: defaultOwnerNid,
    sellerName: defaultOwnerName,
    declaredAreaDecimal: defaultAreaDecimal,
    declaredPriceBdt: 4800000,
    parentDeedNumber: '1998-SAV-4521',
    subRegistryOffice: 'Savar Sub-Registry, Dhaka',
  });

  const [result, setResult] = useState<DeedVerificationResult | null>(null);

  // Load presets on mount
  useEffect(() => {
    let active = true;
    getDeedPresets()
      .then((data) => {
        if (active) {
          setPresets(data);
          if (data.length > 0 && data[0].params) {
            setFormData(data[0].params);
            runVerification(data[0].params);
          }
        }
      })
      .catch(() => {
        // Fallback handled by api.ts
      });
    return () => {
      active = false;
    };
  }, []);

  const runVerification = async (paramsToVerify?: DeedVerificationParams) => {
    setLoading(true);
    try {
      const res = await verifyDeed(paramsToVerify || formData);
      setResult(res);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (preset: DeedPreset) => {
    setSelectedPresetId(preset.id);
    setFormData(preset.params);
    runVerification(preset.params);
  };

  const handleInputChange = (field: keyof DeedVerificationParams, value: any) => {
    setFormData((prev: DeedVerificationParams) => ({
      ...prev,
      [field]: field === 'declaredAreaDecimal' || field === 'declaredPriceBdt' ? Number(value) || 0 : value,
    }));
  };

  const isVerified = result?.verdict === 'AUTHENTIC_VERIFIED';
  const isCaution = result?.verdict === 'REVIEW_RECOMMENDED';
  const isFraud = result?.verdict === 'SUSPECTED_FRAUD_LOCKED';

  return (
    <Modal
      open={open}
      onClose={onClose}
      label={t('Title Forensics Engine (দলিল যাচাই ও ফরেনসিক্স)', 'দলিল যাচাই ও ফরেনসিক্স')}
      title={t('Algorithmic Deed Forensics Scorer', 'অ্যালগরিদমিক দলিল সত্যতা ও জালিয়াতি নিরূপক')}
      bn="রেজিস্ট্রেশন আইন ১৯০৮ এর ধারা ৫২ক, খতিয়ান হিস্যা ও দেওয়ানি নিষেধাজ্ঞা যাচাই"
      wide
      maxWidth="5xl"
    >
      <div className="space-y-6">
        {/* Preset Scenarios Selector Strip */}
        <div className="border border-line bg-sheet-raised p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="mono text-2xs uppercase tracking-wider text-ink-3">
              {t('Interactive Test Scenarios (নমুনা পরীক্ষা পরিস্থিতি)', 'নমুনা পরীক্ষা পরিস্থিতি')}
            </span>
            <span className="text-2xs text-indigo font-medium">
              {t('6-Point Statutory Rules', '৬-দফা আইনি যাচাই বিধি')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {presets.map((preset) => {
              const active = selectedPresetId === preset.id;
              const isCleanScenario = preset.expectedVerdict === 'AUTHENTIC_VERIFIED';
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`text-left p-2.5 border transition-all ${
                    active
                      ? 'border-indigo bg-indigo/10 shadow-sm'
                      : 'border-line bg-sheet hover:border-ink-3 hover:bg-ground-sunk'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="mono text-[11px] font-bold text-ink truncate">
                      {preset.titleEn}
                    </span>
                    <span
                      className={`mono text-[9px] px-1 py-0.5 font-bold uppercase rounded ${
                        isCleanScenario
                          ? 'bg-state/20 text-state'
                          : 'bg-seal/20 text-seal'
                      }`}
                    >
                      {isCleanScenario ? 'Clean' : 'Defect'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-ink-2 line-clamp-2">
                    {preset.descriptionBn || preset.descriptionEn}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Inputs Grid */}
        <div className="border border-line bg-sheet p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="mono text-xs uppercase font-bold text-ink flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo" />
              {t('Conveyance Deed Parameters for Verification', 'যাচাইযোগ্য দলিলের তথ্য')}
            </h4>
            <span className="text-2xs text-ink-3 mono">
              {t('Ref: Registration Act 1908, Sec 52A', 'রেফারেন্স: রেজিস্ট্রেশন আইন ১৯০৮')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="mono text-[11px] text-ink-3 block mb-1">
                {t('Deed Number (দলিল নম্বর)', 'দলিল নম্বর')}
              </label>
              <input
                type="text"
                value={formData.deedNumber}
                onChange={(e) => handleInputChange('deedNumber', e.target.value)}
                className="w-full bg-ground border border-line px-2.5 py-1.5 mono text-ink text-xs focus:border-indigo focus:outline-none"
                placeholder="DALIL-2026-XXXX"
              />
            </div>

            <div>
              <label className="mono text-[11px] text-ink-3 block mb-1">
                {t('Parcel ID / Khatian (দাগ/খতিয়ান)', 'দাগ/খতিয়ান')}
              </label>
              <input
                type="text"
                value={formData.parcelId}
                onChange={(e) => handleInputChange('parcelId', e.target.value)}
                className="w-full bg-ground border border-line px-2.5 py-1.5 mono text-ink text-xs focus:border-indigo focus:outline-none"
                placeholder="BD-DHK-SAV-000001"
              />
            </div>

            <div>
              <label className="mono text-[11px] text-ink-3 block mb-1">
                {t('Vendor / Seller NID (বিক্রেতার এনআইডি)', 'বিক্রেতার এনআইডি')}
              </label>
              <input
                type="text"
                value={formData.sellerNid}
                onChange={(e) => handleInputChange('sellerNid', e.target.value)}
                className="w-full bg-ground border border-line px-2.5 py-1.5 mono text-ink text-xs focus:border-indigo focus:outline-none"
                placeholder="10 or 17 digit NID"
              />
            </div>

            <div>
              <label className="mono text-[11px] text-ink-3 block mb-1">
                {t('Vendor Name (বিক্রেতার নাম)', 'বিক্রেতার নাম')}
              </label>
              <input
                type="text"
                value={formData.sellerName}
                onChange={(e) => handleInputChange('sellerName', e.target.value)}
                className="w-full bg-ground border border-line px-2.5 py-1.5 text-ink text-xs focus:border-indigo focus:outline-none"
                placeholder="Full Name"
              />
            </div>

            <div>
              <label className="mono text-[11px] text-ink-3 block mb-1">
                {t('Declared Area in Decimal (দলিলে জমির পরিমাণ - শতাংশ)', 'দলিলে জমির পরিমাণ (শতাংশ)')}
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.declaredAreaDecimal}
                onChange={(e) => handleInputChange('declaredAreaDecimal', e.target.value)}
                className="w-full bg-ground border border-line px-2.5 py-1.5 mono text-ink text-xs focus:border-indigo focus:outline-none font-bold"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="mono text-[11px] text-ink-3 block mb-1">
                {t('Declared Consideration (দলিল মূল্য - টাকা)', 'দলিল মূল্য (টাকা)')}
              </label>
              <input
                type="number"
                value={formData.declaredPriceBdt}
                onChange={(e) => handleInputChange('declaredPriceBdt', e.target.value)}
                className="w-full bg-ground border border-line px-2.5 py-1.5 mono text-ink text-xs focus:border-indigo focus:outline-none"
                placeholder="BDT"
              />
            </div>

            <div>
              <label className="mono text-[11px] text-ink-3 block mb-1">
                {t('Parent Deed Lineage / বায়া দলিল নম্বর', 'বায়া দলিল নম্বর')}
              </label>
              <input
                type="text"
                value={formData.parentDeedNumber || ''}
                onChange={(e) => handleInputChange('parentDeedNumber', e.target.value)}
                className="w-full bg-ground border border-line px-2.5 py-1.5 mono text-ink text-xs focus:border-indigo focus:outline-none"
                placeholder="1998-SAV-4521"
              />
            </div>

            <div>
              <label className="mono text-[11px] text-ink-3 block mb-1">
                {t('Sub-Registry Office (সাব-রেজিস্ট্রি অফিস)', 'সাব-রেজিস্ট্রি অফিস')}
              </label>
              <input
                type="text"
                value={formData.subRegistryOffice || ''}
                onChange={(e) => handleInputChange('subRegistryOffice', e.target.value)}
                className="w-full bg-ground border border-line px-2.5 py-1.5 text-ink text-xs focus:border-indigo focus:outline-none"
                placeholder="Savar Sub-Registry, Dhaka"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="primary"
                onClick={() => runVerification()}
                disabled={loading}
                className="w-full justify-center h-[34px]"
              >
                <Search className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? t('Auditing...', 'যাচাই চলছে...') : t('Run Forensic Audit', 'ফরেনসিক অডিট চালান')}
              </Button>
            </div>
          </div>
        </div>

        {/* Verification Result Section */}
        {result && (
          <div className="space-y-4">
            {/* Verdict Header Banner */}
            <div
              className={`p-4 border ${
                isVerified
                  ? 'border-state bg-state/10 text-ink'
                  : isCaution
                  ? 'border-amber bg-amber/10 text-ink'
                  : 'border-seal bg-seal/10 text-ink'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {isVerified ? (
                      <CheckCircle2 className="h-6 w-6 text-state" />
                    ) : isCaution ? (
                      <AlertTriangle className="h-6 w-6 text-amber" />
                    ) : (
                      <XCircle className="h-6 w-6 text-seal" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="mono text-xs font-bold uppercase tracking-wider text-ink-3">
                        {t('Statutory Forensic Verdict', 'ফরেনসিক অডিট ফলাফল')}
                      </span>
                      <StatusMark tone={isVerified ? 'state' : isCaution ? 'amber' : 'seal'}>
                        {result.verdict}
                      </StatusMark>
                    </div>
                    <h3 className="text-base font-bold text-ink mt-0.5">
                      {result.verdictBn}
                    </h3>
                    <p className="text-xs text-ink-2 mt-1">
                      {result.statutorySummaryBn || result.statutorySummaryEn}
                    </p>
                  </div>
                </div>

                <div className="sm:text-right shrink-0 border-t sm:border-t-0 sm:border-l border-line pt-2 sm:pt-0 sm:pl-4">
                  <span className="mono text-[10px] text-ink-3 uppercase block">
                    {t('Forensic Risk Score', 'ঝুঁকি ইনডেক্স')}
                  </span>
                  <div className="flex items-baseline sm:justify-end gap-1 mt-0.5">
                    <span
                      className={`mono text-2xl font-bold ${
                        isVerified ? 'text-state' : isCaution ? 'text-amber' : 'text-seal'
                      }`}
                    >
                      {result.overallScore}
                    </span>
                    <span className="mono text-xs text-ink-3">/ 100</span>
                  </div>
                  <span className="mono text-[10px] text-ink-3 block">
                    {result.overallScore === 0
                      ? 'Clean Title'
                      : result.overallScore < 60
                      ? 'Moderate Risk'
                      : 'Critical Risk'}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-2 w-full bg-ground-sunk rounded-full overflow-hidden border border-line-hair">
                <div
                  className={`h-full transition-all duration-500 ${
                    result.overallScore < 20
                      ? 'bg-state'
                      : result.overallScore < 60
                      ? 'bg-amber'
                      : 'bg-seal'
                  }`}
                  style={{ width: `${Math.max(4, result.overallScore)}%` }}
                />
              </div>
            </div>

            {/* Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="border border-line bg-sheet-raised p-3">
                <span className="mono text-[10px] text-ink-3 uppercase block">
                  {t('Area Discrepancy', 'জমির পার্থক্য')}
                </span>
                <span
                  className={`mono text-base font-bold block mt-1 ${
                    result.areaInflationPercentage > 0 ? 'text-seal' : 'text-state'
                  }`}
                >
                  {result.areaInflationPercentage > 0
                    ? `+${result.areaInflationPercentage.toFixed(1)}%`
                    : '0.0% (Match)'}
                </span>
                <span className="text-[10px] text-ink-3 block mt-0.5">
                  {t('Versus Khatian Registered Extent', 'খতিয়ান হিস্যা সাপেক্ষে')}
                </span>
              </div>

              <div className="border border-line bg-sheet-raised p-3">
                <span className="mono text-[10px] text-ink-3 uppercase block">
                  {t('Valuation Disparity', 'মৌজা মূল্যের তারতম্য')}
                </span>
                <span
                  className={`mono text-base font-bold block mt-1 ${
                    result.valuationDisparityPercentage > 0 ? 'text-amber' : 'text-state'
                  }`}
                >
                  {result.valuationDisparityPercentage > 0
                    ? `-${result.valuationDisparityPercentage.toFixed(1)}%`
                    : 'Statutory Rate Met'}
                </span>
                <span className="text-[10px] text-ink-3 block mt-0.5">
                  {t('Sub-Registry Mouza Benchmark', 'সরকারি ন্যূনতম মৌজা রেট')}
                </span>
              </div>

              <div className="border border-line bg-sheet-raised p-3">
                <span className="mono text-[10px] text-ink-3 uppercase block">
                  {t('Audited Checks', 'আইনি অডিট দফা')}
                </span>
                <span className="mono text-base font-bold text-ink block mt-1">
                  {result.checks.filter((c: ForensicCheckItem) => c.status === 'PASS').length} / {result.checks.length}
                </span>
                <span className="text-[10px] text-ink-3 block mt-0.5">
                  {t('Statutory Passing Rate', 'সফলতার হার')}
                </span>
              </div>

              <div className="border border-line bg-sheet-raised p-3">
                <span className="mono text-[10px] text-ink-3 uppercase block">
                  {t('Timestamp', 'যাচাই সময়')}
                </span>
                <span className="mono text-xs font-semibold text-indigo block mt-1 truncate">
                  {new Date(result.verifiedAt).toLocaleTimeString()}
                </span>
                <span className="text-[10px] text-ink-3 block mt-0.5">
                  DLRS Forensic Node
                </span>
              </div>
            </div>

            {/* 6-Point Statutory Forensics Checklist */}
            <div className="border border-line bg-sheet">
              <div className="p-3 border-b border-line flex items-center justify-between bg-sheet-raised">
                <span className="mono text-xs font-bold uppercase text-ink flex items-center gap-2">
                  <Scale className="h-4 w-4 text-indigo" />
                  {t('6-Point Statutory Due Diligence Audit Findings', '৬-দফা আইনি যাচাই বিশ্লেষণ')}
                </span>
                <span className="mono text-[10px] text-ink-3">
                  Law of Transfer & Registration
                </span>
              </div>

              <div className="divide-y divide-line-hair">
                {result.checks.map((chk: ForensicCheckItem, index: number) => {
                  const isPass = chk.status === 'PASS';
                  const isCautionStatus = chk.status === 'CAUTION';
                  return (
                    <div
                      key={chk.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 hover:bg-ground-sunk transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {isPass ? (
                            <CheckCircle2 className="h-4 w-4 text-state" />
                          ) : isCautionStatus ? (
                            <AlertTriangle className="h-4 w-4 text-amber" />
                          ) : (
                            <XCircle className="h-4 w-4 text-seal" />
                          )}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-ink">
                              {index + 1}. {chk.titleBn || chk.titleEn}
                            </span>
                            <span className="mono text-[10px] bg-ground px-1.5 py-0.2 rounded text-ink-3 border border-line-hair">
                              {chk.category}
                            </span>
                            <span className="mono text-[10px] text-indigo bg-indigo/10 px-1.5 py-0.2 rounded">
                              {chk.statutoryRef}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-ink-2 leading-relaxed">
                            {chk.findingBn || chk.findingEn}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 self-end sm:self-center text-right">
                        <StatusMark tone={isPass ? 'state' : isCautionStatus ? 'amber' : 'seal'}>
                          {chk.status} {chk.penaltyScore > 0 ? `(+${chk.penaltyScore})` : ''}
                        </StatusMark>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button variant="quiet" size="sm" onClick={() => runVerification()}>
                <RotateCcw className="h-3.5 w-3.5" />
                {t('Re-Audit Deed', 'পুনরায় অডিট চালান')}
              </Button>

              <div className="flex items-center gap-2">
                <Button size="sm" onClick={onClose}>
                  {t('Close', 'বন্ধ করুন')}
                </Button>
                {isVerified && onProceedToMutation && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      onClose();
                      onProceedToMutation();
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t('Proceed to Mutation Filing', 'ই-নামজারি আবেদনে যান')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
