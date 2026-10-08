import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  FileCheck,
  Plane,
  Waves,
  Link as LinkIcon,
  Lock,
  Unlock,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  ExternalLink,
  Printer,
  QrCode,
  Sparkles,
  RefreshCw,
  FileText,
  BadgeAlert,
  ArrowRight,
  Info,
  Scale,
  Check,
  Copy,
} from 'lucide-react';
import Modal from './Modal';
import { Button, StatusMark } from './ui';
import { useLanguage } from '../lib/language';
import {
  getLandGuardAudit,
  toggleLandGuardLock,
  exportLandGuardDossier,
} from '../lib/api';
import type {
  LandGuardAuditResult,
  LandGuardPillarEvaluation,
  LandGuardDossier,
} from '../lib/types';

interface AILandGuardModalProps {
  open: boolean;
  onClose: () => void;
  parcelId: string;
  khatianNo?: string;
  onOpenDeedForensics?: () => void;
  onOpenDroneCadastre?: () => void;
  onOpenKhasRadar?: () => void;
  onOpenDigitalEvidence?: () => void;
  onOpenLandLock?: () => void;
  onStatusChanged?: () => void;
}

export default function AILandGuardModal({
  open,
  onClose,
  parcelId,
  khatianNo = 'RS-4412',
  onOpenDeedForensics,
  onOpenDroneCadastre,
  onOpenKhasRadar,
  onOpenDigitalEvidence,
  onOpenLandLock,
  onStatusChanged,
}: AILandGuardModalProps) {
  const { lang, t } = useLanguage();
  const [audit, setAudit] = useState<LandGuardAuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);
  const [showDossier, setShowDossier] = useState(false);
  const [dossier, setDossier] = useState<LandGuardDossier | null>(null);
  const [copiedQr, setCopiedQr] = useState(false);
  const [filterPillar, setFilterPillar] = useState<'ALL' | 'ISSUES' | 'PASS'>('ALL');

  const loadAudit = async (targetId: string) => {
    setLoading(true);
    try {
      const res = await getLandGuardAudit(targetId);
      setAudit(res);
    } catch (err) {
      console.error('Failed to load LandGuard audit:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && parcelId) {
      loadAudit(parcelId);
      setShowDossier(false);
    }
  }, [open, parcelId]);

  const handleToggleLock = async () => {
    if (!audit) return;
    setTogglingLock(true);
    try {
      const res = await toggleLandGuardLock(audit.parcelId);
      // Reload audit to reflect updated trust score and lock status
      await loadAudit(audit.parcelId);
      onStatusChanged?.();
    } catch (err) {
      console.error('Failed to toggle land lock:', err);
    } finally {
      setTogglingLock(false);
    }
  };

  const handleOpenDossier = async () => {
    if (!audit) return;
    try {
      const res = await exportLandGuardDossier(audit.parcelId);
      setDossier(res);
      setShowDossier(true);
    } catch (err) {
      console.error('Failed to generate dossier:', err);
    }
  };

  const handleCopyQr = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQr(true);
    setTimeout(() => setCopiedQr(false), 2000);
  };

  if (!open) return null;

  const score = audit ? audit.trustScore : 0;
  const isEncroachedOrLitigated = audit?.verdict === 'CRITICAL_FRAUD_FLAGGED';
  const isAdvisory = audit?.verdict === 'CAUTION_ADVISORY';
  const isProtected = audit?.verdict === 'CLEARED_PROTECTED';

  // SVG Gauge Calculations
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getPillarIcon = (pillarId: string) => {
    switch (pillarId) {
      case 'DEED_FORENSICS':
        return <FileCheck className="h-4 w-4" />;
      case 'DRONE_CADASTRE':
        return <Plane className="h-4 w-4" />;
      case 'KHAS_PROXIMITY':
        return <Waves className="h-4 w-4" />;
      case 'EVIDENCE_CHAIN':
        return <LinkIcon className="h-4 w-4" />;
      case 'LAND_LOCK':
        return <Lock className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const handleDrillDown = (target: string) => {
    onClose();
    switch (target) {
      case 'deed':
        onOpenDeedForensics?.();
        break;
      case 'drone':
        onOpenDroneCadastre?.();
        break;
      case 'khas':
        onOpenKhasRadar?.();
        break;
      case 'evidence':
        onOpenDigitalEvidence?.();
        break;
      case 'lock':
        onOpenLandLock?.();
        break;
    }
  };

  const filteredPillars = audit?.pillars.filter((p) => {
    if (filterPillar === 'ISSUES') return p.status !== 'PASS';
    if (filterPillar === 'PASS') return p.status === 'PASS';
    return true;
  }) || [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(
        'AI LandGuard — Smart Land Ownership Verification & Fraud Detection',
        'এআই ল্যান্ডগার্ড — কৃত্রিম বুদ্ধিমত্তা চালিত জমি স্বত্ব ও প্রতারণা সনাক্তকরণ'
      )}
      label={t('National Land Security Hub', 'জাতীয় ভূমি নিরাপত্তা হাব')}
      maxWidth="5xl"
    >
      <div className="space-y-6">
        {/* Top Header Card: Trust Meter & Core Verdict */}
        <div className="border border-line bg-sheet p-5 shadow-sm">
          {loading && !audit ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-ink-3" />
              <p className="mono mt-3 text-xs text-ink-2">
                {t(
                  'Synthesizing Deed Forensics, Drone Cadastre, Khas Radar, Evidence Ledger...',
                  'দলিল বিশ্লেষণ, ড্রোন ক্যাডাস্ট্রে, খাস রাডার এবং সাক্ষ্য লেজার সমন্বয় করা হচ্ছে...'
                )}
              </p>
            </div>
          ) : audit ? (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              {/* Trust Meter Gauge */}
              <div className="flex items-center gap-5">
                <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
                  <svg className="h-28 w-28 -rotate-90 transform" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      className="stroke-line"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      className={
                        isProtected
                          ? 'stroke-state transition-all duration-1000'
                          : isAdvisory
                          ? 'stroke-amber transition-all duration-1000'
                          : 'stroke-seal transition-all duration-1000'
                      }
                      strokeWidth="8"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="mono text-2xl font-bold tracking-tight text-ink">
                      {audit.trustScore}
                    </span>
                    <span className="mono text-[10px] uppercase text-ink-3">
                      / 100
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                        isProtected
                          ? 'bg-state-soft text-state border border-state/30'
                          : isAdvisory
                          ? 'bg-amber-soft text-amber border border-amber/30'
                          : 'bg-seal-soft text-seal border border-seal/30'
                      }`}
                    >
                      {isProtected ? (
                        <ShieldCheck className="h-4 w-4" />
                      ) : isAdvisory ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <AlertOctagon className="h-4 w-4" />
                      )}
                      {lang === 'bn' ? audit.verdictTitleBn : audit.verdictTitleEn}
                    </span>

                    <span className="mono text-2xs rounded border border-line bg-ground-sunk px-2 py-0.5 text-ink-2">
                      {audit.parcelId}
                    </span>
                  </div>

                  <h3 className="sheet-title text-lg font-semibold text-ink">
                    {audit.mouza} &middot; {t('Dag No', 'দাগ নং')} {audit.dagNo} &middot; {audit.areaDecimal} {t('Decimals', 'শতাংশ')}
                  </h3>

                  <p className="text-xs text-ink-2">
                    <span className="font-semibold text-ink">{audit.ownerName}</span> &middot; {audit.upazila}, {audit.district}
                  </p>
                </div>
              </div>

              {/* Action Buttons & Biometric Lock Control */}
              <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-4 lg:border-t-0 lg:pt-0">
                <Button
                  size="sm"
                  variant={audit.isLocked ? 'primary' : 'secondary'}
                  onClick={handleToggleLock}
                  disabled={togglingLock}
                  className="flex items-center gap-1.5"
                  title={t('Toggle Real-Time Property Freeze', 'বায়োমেট্রিক জমি সুরক্ষা লক পরিবর্তন')}
                >
                  {togglingLock ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : audit.isLocked ? (
                    <Lock className="h-3.5 w-3.5 text-state" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5 text-amber" />
                  )}
                  <span>
                    {audit.isLocked
                      ? t('Biometric Lock: ACTIVE', 'বায়োমেট্রিক লক: সক্রিয়')
                      : t('Lock Property Now', 'জমি লক করুন')}
                  </span>
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleOpenDossier}
                  className="flex items-center gap-1.5"
                  title={t('Export Court & Bank Dossier', 'আদালত ও ব্যাংক ভেরিফিকেশন ডসিয়ার')}
                >
                  <FileText className="h-3.5 w-3.5 text-ink-2" />
                  <span>{t('Court Dossier', 'আইনি ডসিয়ার')}</span>
                </Button>

                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() => loadAudit(audit.parcelId)}
                  disabled={loading}
                  title={t('Re-run All Verification Engines', 'পুনরায় যাচাই করুন')}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {/* AI Forensic Diagnostic Narrative */}
        {audit && (
          <div
            className={`border p-4.5 transition-colors ${
              isProtected
                ? 'border-state/30 bg-state-soft/50'
                : isAdvisory
                ? 'border-amber/30 bg-amber-soft/50'
                : 'border-seal/30 bg-seal-soft/50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`rounded-full p-1.5 shrink-0 ${
                  isProtected
                    ? 'bg-state text-white'
                    : isAdvisory
                    ? 'bg-amber text-white'
                    : 'bg-seal text-white'
                }`}
              >
                <Sparkles className="h-4 w-4" />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="sheet-title text-sm font-semibold text-ink">
                    {t(
                      'AI LandGuard Synthesized Intelligence Briefing',
                      'এআই ল্যান্ডগার্ড সমন্বিত গোয়েন্দা বিশ্লেষণ ও মতামত'
                    )}
                  </h4>
                  <span className="mono text-[10px] rounded bg-sheet px-1.5 py-0.5 font-bold uppercase text-ink-2 border border-line">
                    Engine v3.1
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-ink">
                  {lang === 'bn' ? audit.aiExplanationBn : audit.aiExplanationEn}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-ink-2">
                  <span className="inline-flex items-center gap-1">
                    <Scale className="h-3.5 w-3.5 text-ink-3" />
                    <strong>{t('Statutory Benchmark:', 'আইনি মানদণ্ড:')}</strong>{' '}
                    {isProtected
                      ? t('Cleared under Registration Act Sec 52A', 'রেজিস্ট্রেশন আইন ধারা ৫২এ অনুযায়ী উত্তীর্ণ')
                      : isEncroachedOrLitigated
                      ? t('Conveyance barred: SAT Act Sec 86 & CPC Order 39', 'হস্তান্তর নিষিদ্ধ: এসএটি আইন ধারা ৮৬ ও দেওয়ানি কার্যবিধি আদেশ ৩৯')
                      : t('Survey verification recommended', 'সরেজমিন সার্ভেয়ার যাচাইকরণ সুপারিশকৃত')}
                  </span>

                  <span className="mono text-[10px] text-ink-3">
                    {t('Audited at:', 'যাচাইকাল:')} {new Date(audit.auditedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5 Anti-Fraud Verification Pillars Grid */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="sheet-title text-sm font-semibold uppercase tracking-wider text-ink-2">
              {t(
                '5-Pillar Fraud Defense Evaluation',
                '৫-স্তর বিশিষ্ট জালিয়াতি প্রতিরোধ মূল্যায়ন'
              )}
            </h4>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 rounded border border-line bg-sheet p-0.5 text-2xs">
              <button
                type="button"
                onClick={() => setFilterPillar('ALL')}
                className={`rounded px-2 py-1 font-medium transition-colors ${
                  filterPillar === 'ALL'
                    ? 'bg-ground-sunk text-ink font-semibold'
                    : 'text-ink-3 hover:text-ink'
                }`}
              >
                {t('All (5)', 'সবগুলো (৫)')}
              </button>
              <button
                type="button"
                onClick={() => setFilterPillar('ISSUES')}
                className={`rounded px-2 py-1 font-medium transition-colors ${
                  filterPillar === 'ISSUES'
                    ? 'bg-seal-soft text-seal font-semibold'
                    : 'text-ink-3 hover:text-ink'
                }`}
              >
                {t('Risks / Flags', 'ঝুঁকি / ত্রুটি')}
              </button>
              <button
                type="button"
                onClick={() => setFilterPillar('PASS')}
                className={`rounded px-2 py-1 font-medium transition-colors ${
                  filterPillar === 'PASS'
                    ? 'bg-state-soft text-state font-semibold'
                    : 'text-ink-3 hover:text-ink'
                }`}
              >
                {t('Passed (Clean)', 'উত্তীর্ণ (বিশুদ্ধ)')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPillars.map((pillar) => {
              const isPass = pillar.status === 'PASS';
              const isWarn = pillar.status === 'WARNING';
              const isFail = pillar.status === 'FAIL';

              return (
                <div
                  key={pillar.pillarId}
                  className={`flex flex-col justify-between border bg-sheet p-4 transition-all hover:shadow-sm ${
                    isFail
                      ? 'border-seal/40 bg-seal-soft/20'
                      : isWarn
                      ? 'border-amber/40 bg-amber-soft/20'
                      : 'border-line'
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* Pillar Card Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`rounded p-1.5 ${
                            isPass
                              ? 'bg-state-soft text-state'
                              : isWarn
                              ? 'bg-amber-soft text-amber'
                              : 'bg-seal-soft text-seal'
                          }`}
                        >
                          {getPillarIcon(pillar.pillarId)}
                        </div>
                        <div>
                          <h5 className="sheet-title text-xs font-semibold text-ink">
                            {lang === 'bn' ? pillar.titleBn : pillar.titleEn}
                          </h5>
                          <span className="mono text-[10px] text-ink-3">
                            {pillar.weightPercent}% {t('Weight', 'ওজন')}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`mono text-[10px] font-bold rounded px-1.5 py-0.5 uppercase ${
                          isPass
                            ? 'bg-state-soft text-state border border-state/20'
                            : isWarn
                            ? 'bg-amber-soft text-amber border border-amber/20'
                            : 'bg-seal-soft text-seal border border-seal/20'
                        }`}
                      >
                        {pillar.status}
                      </span>
                    </div>

                    {/* Metric Highlight */}
                    <div className="flex items-baseline justify-between border-y border-line/60 py-2">
                      <span className="mono text-2xs uppercase text-ink-3">
                        {t('Observed Metric', 'পর্যবেক্ষিত মান')}
                      </span>
                      <span
                        className={`mono text-xs font-semibold ${
                          isPass
                            ? 'text-state'
                            : isWarn
                            ? 'text-amber'
                            : 'text-seal font-bold'
                        }`}
                      >
                        {pillar.highlightMetric}
                      </span>
                    </div>

                    {/* Pillar Narrative */}
                    <p className="text-2xs leading-relaxed text-ink-2">
                      {lang === 'bn' ? pillar.summaryBn : pillar.summaryEn}
                    </p>
                  </div>

                  {/* Drill-down action link */}
                  <div className="mt-4 pt-3 border-t border-line/40 flex items-center justify-between">
                    <span className="mono text-[11px] font-semibold text-ink-3">
                      {pillar.score}/100 ({pillar.weightedScore} pts)
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDrillDown(pillar.drillDownTarget)}
                      className="group inline-flex items-center gap-1 text-xs font-semibold text-indigo hover:text-indigo-dark transition-colors"
                    >
                      <span>{t('Deep Inspect', 'বিস্তারিত দেখুন')}</span>
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Demo Toggle Quick Switch Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border border-line bg-sheet-raised px-4 py-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-ink-3 shrink-0" />
            <span className="text-xs text-ink-2">
              {t(
                'Explore fraud defense capabilities across different parcel risk profiles:',
                'বিভিন্ন ঝুঁকির পার্সেল প্রোফাইলে প্রতারণা প্রতিরোধ পরীক্ষা করুন:'
              )}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => loadAudit('BD-DHK-SAV-000001')}
              className={`mono rounded border px-2.5 py-1 text-2xs transition-colors ${
                audit?.parcelId === 'BD-DHK-SAV-000001'
                  ? 'border-state bg-state-soft text-state font-bold'
                  : 'border-line bg-sheet text-ink-2 hover:bg-ground-sunk'
              }`}
            >
              BD-DHK-SAV-000001 ({t('Clean Savar', 'বিশুদ্ধ সাভার')})
            </button>
            <button
              type="button"
              onClick={() => loadAudit('BD-DHK-SAV-000003')}
              className={`mono rounded border px-2.5 py-1 text-2xs transition-colors ${
                audit?.parcelId === 'BD-DHK-SAV-000003'
                  ? 'border-seal bg-seal-soft text-seal font-bold'
                  : 'border-line bg-sheet text-ink-2 hover:bg-ground-sunk'
              }`}
            >
              BD-DHK-SAV-000003 ({t('High Risk Encroached', 'ঝুঁকিপূর্ণ দখলকৃত')})
            </button>
            <button
              type="button"
              onClick={() => loadAudit('BD-SYL-SRM-000108')}
              className={`mono rounded border px-2.5 py-1 text-2xs transition-colors ${
                audit?.parcelId === 'BD-SYL-SRM-000108'
                  ? 'border-state bg-state-soft text-state font-bold'
                  : 'border-line bg-sheet text-ink-2 hover:bg-ground-sunk'
              }`}
            >
              BD-SYL-SRM-000108 ({t('Sylhet Tea Estate', 'শ্রীমঙ্গল চা বাগান')})
            </button>
          </div>
        </div>

        {/* Official Court & Bank Dossier Modal / View */}
        {showDossier && dossier && (
          <div className="mt-6 border-2 border-line bg-sheet p-6 shadow-md print:m-0 print:border-none print:p-0">
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-state text-white">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="sheet-title text-base font-bold uppercase tracking-wider text-ink">
                      {t(
                        'People\'s Republic of Bangladesh — Ministry of Land',
                        'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার — ভূমি মন্ত্রণালয়'
                      )}
                    </h3>
                    <p className="mono text-[10px] text-ink-3">
                      {dossier.issuerAuthority}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 print:hidden">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>{t('Print / Save PDF', 'প্রিন্ট / পিডিএফ')}</span>
                </Button>
                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() => setShowDossier(false)}
                >
                  {t('Close Dossier', 'বন্ধ করুন')}
                </Button>
              </div>
            </div>

            <div className="my-5 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="space-y-3 md:col-span-2">
                <div className="rounded border border-line bg-ground-sunk p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="mono text-2xs uppercase text-ink-3">
                      {t('Dossier Certificate ID', 'ডসিয়ার সনদ নম্বর')}
                    </span>
                    <span className="mono text-xs font-bold text-ink">
                      {dossier.dossierId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="mono text-2xs uppercase text-ink-3">
                      {t('Parcel Identifier', 'পার্সেল নম্বর')}
                    </span>
                    <span className="mono text-xs font-semibold text-indigo">
                      {dossier.parcelId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="mono text-2xs uppercase text-ink-3">
                      {t('Statutory Verdict', 'আইনি রায়')}
                    </span>
                    <span className={`mono text-xs font-bold ${isProtected ? 'text-state' : isAdvisory ? 'text-amber' : 'text-seal'}`}>
                      {dossier.audit.verdict} ({dossier.audit.trustScore}/100)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="mono text-2xs uppercase text-ink-3">
                      {t('Certified Timestamp', 'সত্যায়ন সময়')}
                    </span>
                    <span className="mono text-xs text-ink-2">
                      {new Date(dossier.exportedAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="rounded border border-line bg-sheet p-3.5 text-xs text-ink-2 space-y-1.5 leading-relaxed">
                  <p className="font-semibold text-ink">
                    {lang === 'bn' ? dossier.legalDisclaimerBn : dossier.legalDisclaimerEn}
                  </p>
                  <p className="text-2xs text-ink-3">
                    {t(
                      'This document serves as primary proof of clean title and boundary sanctity for Scheduled Commercial Banks, Sub-Registry offices, and civil courts.',
                      'এই নথিটি তফসিলি ব্যাংক, সাব-রেজিস্ট্রি অফিস এবং দেওয়ানি আদালতে জমি স্বত্বের অবিসংবাদিত প্রমাণ হিসেবে গণ্য হবে।'
                    )}
                  </p>
                </div>
              </div>

              {/* QR Code and Cryptographic Seal */}
              <div className="flex flex-col items-center justify-center rounded border border-line bg-sheet p-4 text-center">
                <div className="relative flex h-32 w-32 items-center justify-center rounded border-2 border-line bg-ground-sunk p-2 shadow-inner">
                  <QrCode className="h-28 w-28 text-ink" />
                </div>

                <div className="mt-3 flex items-center gap-1.5">
                  <span className="mono truncate text-[9px] text-ink-3 max-w-[180px]">
                    {dossier.qrPayload}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyQr(dossier.qrPayload)}
                    className="text-ink-3 hover:text-ink"
                    title={t('Copy QR payload', 'কিউআর কোড কপি করুন')}
                  >
                    {copiedQr ? <Check className="h-3 w-3 text-state" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>

                <span className="mono mt-2 rounded bg-state-soft px-2 py-0.5 text-[10px] font-bold text-state">
                  SHA-256 SEALED
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
