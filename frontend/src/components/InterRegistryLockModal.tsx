import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  AlertTriangle,
  Building,
  Landmark,
  Scale,
  FileText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Zap,
  Info,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  KeyRound,
} from 'lucide-react';
import Modal from './Modal';
import { Button } from './ui';
import { useLanguage } from '../lib/language';
import {
  getInterAgencyDashboard,
  simulateCrossAgencyEvent,
  issueBankNoc,
} from '../lib/api';
import type { InterAgencyDashboardState, RegistryLockRecord } from '../lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  parcelId: string;
  onRefreshParent?: () => void;
  onOpenNecCert?: () => void;
}

export default function InterRegistryLockModal({
  open,
  onClose,
  parcelId,
  onRefreshParent,
  onOpenNecCert,
}: Props) {
  const { lang, t } = useLanguage();
  const [data, setData] = useState<InterAgencyDashboardState | null>(null);
  const [loading, setLoading] = useState(false);
  const [simBusy, setSimBusy] = useState(false);
  const [alertBanner, setAlertBanner] = useState<{
    type: 'success' | 'danger' | 'info';
    title: string;
    messageEn: string;
    messageBn: string;
    statute?: string;
  } | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await getInterAgencyDashboard(parcelId);
      setData(res);
    } catch {
      // Handled via fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setAlertBanner(null);
      fetchDashboard();
    }
  }, [open, parcelId]);

  const handleSimulate = async (scenario: string, extraParams?: any) => {
    setSimBusy(true);
    try {
      const sim = await simulateCrossAgencyEvent(parcelId, scenario, extraParams);
      if (sim.event === 'DOUBLE_SALE_INTERCEPTED') {
        setAlertBanner({
          type: 'danger',
          title: t('Double Sale Attempt Intercepted!', 'দ্বৈত বিক্রয় জালিয়াতি প্রতিহত!'),
          messageEn: sim.messageEn,
          messageBn: sim.messageBn,
          statute: 'Registration Act 1908 Section 52A & Penal Code Section 420',
        });
      } else if (sim.event === 'DOUBLE_MORTGAGE_BLOCKED') {
        setAlertBanner({
          type: 'danger',
          title: t('Double Mortgage Collision Blocked!', 'দ্বৈত বন্ধক সংঘর্ষ প্রতিহত!'),
          messageEn: sim.messageEn,
          messageBn: sim.messageBn,
          statute: 'Transfer of Property Act 1882 Section 58 & Bangladesh Bank CIB II Regulations',
        });
      } else if (sim.event === 'JUDICIAL_STAY_APPLIED') {
        setAlertBanner({
          type: 'danger',
          title: t('Civil Court Stay Order Active!', 'আদালতের স্থগিতাদেশ কার্যকর!'),
          messageEn: sim.messageEn,
          messageBn: sim.messageBn,
          statute: 'Code of Civil Procedure 1908 (Order 39 Rules 1-2)',
        });
      } else if (sim.event === 'JUDICIAL_STAY_VACATED') {
        setAlertBanner({
          type: 'success',
          title: t('Stay Order Vacated by Court', 'আদালতের স্থগিতাদেশ প্রত্যাহার সম্পন্ন'),
          messageEn: sim.messageEn,
          messageBn: sim.messageBn,
        });
      } else if (sim.event === 'BANK_NOC_ISSUED') {
        setAlertBanner({
          type: 'success',
          title: t('Bank NOC Issued', 'ব্যাংকের অনাপত্তিপত্র নিবন্ধিত'),
          messageEn: sim.messageEn,
          messageBn: sim.messageBn,
        });
      } else {
        setAlertBanner({
          type: 'info',
          title: t('Event Processed', 'ইভেন্ট প্রক্রিয়াজাত'),
          messageEn: sim.messageEn,
          messageBn: sim.messageBn,
        });
      }

      await fetchDashboard();
      if (onRefreshParent) onRefreshParent();
    } finally {
      setSimBusy(false);
    }
  };

  const isClean = data?.isFullyClear;
  const hasStay = data?.agencyStatuses.judiciary.hasInjunction;
  const hasMortgage = data?.agencyStatuses.centralBankCib.hasActiveMortgage;

  return (
    <Modal
      open={open}
      onClose={onClose}
      label={t('Sovereign Inter-Registry Lock Engine', 'আন্তঃ-রেজিস্ট্রি লক ও স্বত্ব ইঞ্জিন')}
      title={t('4-Agency Title Encumbrance Command Center', '৪-সংস্থা সমন্বিত স্বত্ব ও দায়মুক্তি কনসোল')}
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {/* Top Header Card */}
        <div
          className={`border p-4 transition-colors ${
            hasStay
              ? 'border-red-500/30 bg-red-950/20'
              : hasMortgage
              ? 'border-amber/30 bg-amber-soft'
              : isClean
              ? 'border-state/30 bg-state-soft'
              : 'border-indigo/30 bg-indigo-soft'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  hasStay
                    ? 'bg-red-600 text-white'
                    : hasMortgage
                    ? 'bg-amber text-white'
                    : isClean
                    ? 'bg-state text-white'
                    : 'bg-indigo text-white'
                }`}
              >
                {hasStay ? (
                  <ShieldAlert className="h-5 w-5" />
                ) : hasMortgage ? (
                  <Lock className="h-5 w-5" />
                ) : isClean ? (
                  <ShieldCheck className="h-5 w-5" />
                ) : (
                  <Clock className="h-5 w-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-ink">
                    {lang === 'bn' ? data?.overallStatusBn : data?.overallStatusEn?.replace(/_/g, ' ')}
                  </h3>
                  <span className="mono text-2xs uppercase px-1.5 py-0.5 rounded bg-sheet-raised text-ink-2 border border-line">
                    UPID: {parcelId}
                  </span>
                </div>
                <p className="text-xs text-ink-2 mt-0.5">
                  {t(
                    'Real-time synchronization active across Ministry of Land, Ministry of Law, Civil Courts & Bangladesh Bank CIB.',
                    'ভূমি মন্ত্রণালয়, আইন মন্ত্রণালয় (সাব-রেজিস্ট্রি), দেওয়ানি আদালত ও বাংলাদেশ ব্যাংক সিআইবি ডাটাবেজ সমন্বয় সক্রিয়।'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={fetchDashboard} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                {t('Sync Registries', 'পুনরায় সমন্বয়')}
              </Button>
              {onOpenNecCert && (
                <Button size="sm" variant="primary" onClick={onOpenNecCert}>
                  <FileText className="h-3.5 w-3.5" />
                  {t('View NEC Certificate', 'দায়মুক্তি সনদপত্র')}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Simulation Interception Alert Banner */}
        {alertBanner && (
          <div
            className={`border p-4 rounded text-xs flex items-start gap-3 transition-all ${
              alertBanner.type === 'danger'
                ? 'border-red-500/40 bg-red-950/30 text-red-200'
                : alertBanner.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                : 'border-indigo-500/40 bg-indigo-950/30 text-indigo-200'
            }`}
          >
            {alertBanner.type === 'danger' ? (
              <XCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
            ) : alertBanner.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <Info className="h-5 w-5 shrink-0 text-indigo-400 mt-0.5" />
            )}
            <div className="space-y-1 flex-1">
              <p className="font-bold text-sm tracking-wide">{alertBanner.title}</p>
              <p className="leading-relaxed">
                {lang === 'bn' ? alertBanner.messageBn : alertBanner.messageEn}
              </p>
              {alertBanner.statute && (
                <p className="mono text-2xs opacity-80 pt-1">
                  ⚖️ Statutory Basis: {alertBanner.statute}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 4-Sovereign Agency Grid */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-3 mb-3">
            {t('Cross-Ministerial 4-Registry Live Radar', '৪-সংস্থা সমন্বিত লাইভ যাচাইকরণ রাডার')}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
            {/* 1. Land Ministry */}
            {(() => {
              const isOk = data?.agencyStatuses.landMinistry.canMutate;
              const badgeLabel = isOk ? t('ELIGIBLE', 'অনুমোদিত') : t('FROZEN', 'স্থগিত');
              const badgeStyle = isOk
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30';
              const dotStyle = isOk ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50' : 'bg-red-500 shadow-xs shadow-red-500/50';

              return (
                <div className="flex flex-col justify-between h-full rounded border border-line bg-sheet-raised p-3.5 transition-all hover:border-line-strong hover:shadow-xs">
                  <div>
                    <div className="flex items-center justify-between gap-1.5 pb-2.5 border-b border-line-hair">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <Building className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-ink leading-tight block truncate">
                            {t('Land Ministry', 'ভূমি মন্ত্রণালয়')}
                          </span>
                          <span className="text-3xs text-ink-3 uppercase tracking-wider block">e-Mutation</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-3xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeStyle}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${dotStyle}`} />
                        <span>{badgeLabel}</span>
                      </span>
                    </div>

                    <p className="text-2xs text-ink-2 leading-relaxed pt-2.5">
                      {lang === 'bn'
                        ? data?.agencyStatuses.landMinistry.summaryBn
                        : data?.agencyStatuses.landMinistry.summaryEn}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-line-hair flex items-center justify-between text-3xs text-ink-3">
                    <span>AC Land</span>
                    <span className="mono font-semibold text-ink">{data?.agencyStatuses.landMinistry.activeKhatian || '—'}</span>
                  </div>
                </div>
              );
            })()}

            {/* 2. Law Ministry Sub-Registry */}
            {(() => {
              const canConvey = data?.agencyStatuses.lawMinistry.canConvey;
              const isCond = data?.agencyStatuses.lawMinistry.status === 'CONDITIONAL_NOC';
              const badgeLabel = canConvey
                ? t('CLEAR', 'অনুমোদিত')
                : isCond
                ? t('NOC REQ.', 'এনওসি আবশ্যক')
                : t('BARRED', 'নিষিদ্ধ');
              const badgeStyle = canConvey
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : isCond
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30';
              const dotStyle = canConvey
                ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                : isCond
                ? 'bg-amber-500 shadow-xs shadow-amber-500/50'
                : 'bg-red-500 shadow-xs shadow-red-500/50';

              return (
                <div className="flex flex-col justify-between h-full rounded border border-line bg-sheet-raised p-3.5 transition-all hover:border-line-strong hover:shadow-xs">
                  <div>
                    <div className="flex items-center justify-between gap-1.5 pb-2.5 border-b border-line-hair">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-indigo-500/10 text-indigo">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-ink leading-tight block truncate">
                            {t('Sub-Registry', 'সাব-রেজিস্ট্রি')}
                          </span>
                          <span className="text-3xs text-ink-3 uppercase tracking-wider block">Deed Archives</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-3xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeStyle}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${dotStyle}`} />
                        <span>{badgeLabel}</span>
                      </span>
                    </div>

                    <p className="text-2xs text-ink-2 leading-relaxed pt-2.5">
                      {lang === 'bn'
                        ? data?.agencyStatuses.lawMinistry.summaryBn
                        : data?.agencyStatuses.lawMinistry.summaryEn}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-line-hair flex items-center justify-between text-3xs text-ink-3">
                    <span>Archives</span>
                    <span className="mono font-semibold text-ink truncate max-w-[130px]" title={data?.agencyStatuses.lawMinistry.subRegistryOffice}>
                      {data?.agencyStatuses.lawMinistry.subRegistryOffice?.replace('Sub-Registry Office', '').trim() || 'Book 1'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* 3. Judiciary Civil Courts */}
            {(() => {
              const hasStay = data?.agencyStatuses.judiciary.hasInjunction;
              const badgeLabel = hasStay ? t('STAY ACTIVE', 'স্থগিতাদেশ') : t('NO SUITS', 'মামলামুক্ত');
              const badgeStyle = hasStay
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
              const dotStyle = hasStay ? 'bg-red-500 shadow-xs shadow-red-500/50' : 'bg-emerald-500 shadow-xs shadow-emerald-500/50';

              return (
                <div className="flex flex-col justify-between h-full rounded border border-line bg-sheet-raised p-3.5 transition-all hover:border-line-strong hover:shadow-xs">
                  <div>
                    <div className="flex items-center justify-between gap-1.5 pb-2.5 border-b border-line-hair">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-amber-500/10 text-amber">
                          <Scale className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-ink leading-tight block truncate">
                            {t('Civil Judiciary', 'দেওয়ানি আদালত')}
                          </span>
                          <span className="text-3xs text-ink-3 uppercase tracking-wider block">Civil Court JCIS</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-3xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeStyle}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${dotStyle}`} />
                        <span>{badgeLabel}</span>
                      </span>
                    </div>

                    <p className="text-2xs text-ink-2 leading-relaxed pt-2.5">
                      {lang === 'bn'
                        ? data?.agencyStatuses.judiciary.summaryBn
                        : data?.agencyStatuses.judiciary.summaryEn}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-line-hair flex items-center justify-between text-3xs text-ink-3">
                    <span>Jurisdiction</span>
                    <span className="mono font-semibold text-ink truncate max-w-[130px]" title={data?.agencyStatuses.judiciary.caseNumber || 'Order 39 CPC'}>
                      {data?.agencyStatuses.judiciary.caseNumber || 'Order 39 CPC'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* 4. Central Bank CIB II */}
            {(() => {
              const hasMortgage = data?.agencyStatuses.centralBankCib.hasActiveMortgage;
              const badgeLabel = hasMortgage ? t('MORTGAGED', 'বন্ধকযুক্ত') : t('NO LIEN', 'দায়মুক্ত');
              const badgeStyle = hasMortgage
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
              const dotStyle = hasMortgage ? 'bg-amber-500 shadow-xs shadow-amber-500/50' : 'bg-emerald-500 shadow-xs shadow-emerald-500/50';

              return (
                <div className="flex flex-col justify-between h-full rounded border border-line bg-sheet-raised p-3.5 transition-all hover:border-line-strong hover:shadow-xs">
                  <div>
                    <div className="flex items-center justify-between gap-1.5 pb-2.5 border-b border-line-hair">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                          <Landmark className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-ink leading-tight block truncate">
                            {t('Central Bank CIB', 'বাংলাদেশ ব্যাংক')}
                          </span>
                          <span className="text-3xs text-ink-3 uppercase tracking-wider block">Collateral II</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-3xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeStyle}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${dotStyle}`} />
                        <span>{badgeLabel}</span>
                      </span>
                    </div>

                    <p className="text-2xs text-ink-2 leading-relaxed pt-2.5">
                      {lang === 'bn'
                        ? data?.agencyStatuses.centralBankCib.summaryBn
                        : data?.agencyStatuses.centralBankCib.summaryEn}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-line-hair flex items-center justify-between text-3xs text-ink-3">
                    <span>Lien Rank</span>
                    <span className="mono font-semibold text-ink">
                      {data?.agencyStatuses.centralBankCib.hasActiveMortgage
                        ? `৳${((data.agencyStatuses.centralBankCib.sanctionedBdt || 0) / 100000).toFixed(1)}L · 1st Chg`
                        : 'Unencumbered'}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Active Sovereign Locks Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-3">
              {t('Active Sovereign Locks & Caveats', 'সক্রিয় সরকারি লক ও আইনি নিষেধাজ্ঞা')} (
              {data?.locks.length || 0})
            </h4>
            <span className="text-2xs text-ink-3">
              {t('Strict Lock Precedence Enforced', 'অগ্রাধিকার নীতিমালার ভিত্তিতে কার্যকর')}
            </span>
          </div>

          {data?.locks && data.locks.length > 0 ? (
            <div className="divide-y divide-line border border-line bg-sheet-raised rounded overflow-hidden">
              {data.locks.map((lock) => (
                <div key={lock.id} className="p-3.5 text-xs space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="mono text-2xs px-2 py-0.5 rounded font-bold bg-ground-sunk text-indigo border border-line">
                        Priority #{lock.priority} &middot; {lock.lockType}
                      </span>
                      <strong className="text-ink">{lock.lockingAuthority}</strong>
                    </div>
                    <span className="mono text-2xs text-ink-3">{lock.lockToken}</span>
                  </div>
                  <p className="text-ink-2 text-2xs">
                    {lang === 'bn' ? lock.orderSummaryBn : lock.orderSummaryEn}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-3xs text-ink-3 pt-1 border-t border-line-hair mono">
                    <span>Statutory Ref: {lock.statutoryBasis}</span>
                    <span>Audit Hash: {lock.auditHash}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-line bg-sheet-raised p-6 text-center text-xs text-ink-3 rounded">
              <CheckCircle2 className="h-6 w-6 text-state mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-ink">
                {t('Zero Active Locks or Caveats', 'কোনো সক্রিয় লক বা নিষেধাজ্ঞা নেই')}
              </p>
              <p className="text-2xs mt-1">
                {t(
                  'The parcel is clean and fully authorized for deed registration and e-Mutation.',
                  'জমিটি সম্পূর্ণ পরিষ্কার এবং রেজিস্ট্রি ও নামজারির জন্য অনুমোদিত।'
                )}
              </p>
            </div>
          )}
        </div>

        {/* ⚡ Interactive Cross-Agency Fraud Interception Sandbox */}
        <div className="border border-indigo/30 bg-ground-sunk p-4 rounded space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-ink">
              <Zap className="h-4 w-4 text-amber" />
              <span>{t('Interactive Cross-Agency Fraud Simulation Sandbox', 'আন্তঃ-সংস্থা জালিয়াতি প্রতিরোধ সিমুলেশন স্যান্ডবক্স')}</span>
            </div>
            <span className="mono text-3xs uppercase px-2 py-0.5 rounded bg-indigo/20 text-indigo font-bold">
              Live Interception Testing
            </span>
          </div>

          <p className="text-2xs text-ink-2 leading-relaxed">
            {t(
              'Test the lock engine in real-time. Trigger simulated fraudulent double sales, double mortgages, or civil court stay orders to observe how the 4 registries intercept attacks:',
              'বাস্তব সময়ে লক ইঞ্জিন পরীক্ষা করুন। দ্বৈত বিক্রয়, একাধিক ব্যাংকে ভুয়া বন্ধক বা আদালতের স্থগিতাদেশ সিমুলেট করে দেখুন কীভাবে সিস্টেম জালিয়াতি আটকে দেয়:'
            )}
          </p>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 pt-1">
            <button
              onClick={() => handleSimulate('DOUBLE_SALE_ATTEMPT')}
              disabled={simBusy}
              className="text-left p-2.5 rounded border border-line bg-sheet-raised hover:bg-line-hair text-xs transition-colors space-y-1"
            >
              <div className="font-semibold text-red-400 flex items-center justify-between">
                <span>1. {t('Attempt Double Sale', 'দ্বৈত বিক্রয় চেষ্টা')}</span>
                <ChevronRight className="h-3 w-3" />
              </div>
              <p className="text-3xs text-ink-3">
                {t('Attempts sale deed while escrow active. Sub-Registry blocks.', 'এসক্রো চুক্তিধীন জমি অন্য ক্রেতার নিকট রেজিস্ট্রি চেষ্টা।')}
              </p>
            </button>

            <button
              onClick={() => handleSimulate('DOUBLE_MORTGAGE_ATTEMPT')}
              disabled={simBusy}
              className="text-left p-2.5 rounded border border-line bg-sheet-raised hover:bg-line-hair text-xs transition-colors space-y-1"
            >
              <div className="font-semibold text-amber flex items-center justify-between">
                <span>2. {t('Attempt Double Mortgage', 'দ্বৈত বন্ধক চেষ্টা')}</span>
                <ChevronRight className="h-3 w-3" />
              </div>
              <p className="text-3xs text-ink-3">
                {t('Bank 2 attempts 1st charge over existing lien. CIB II halts.', '১ম চার্জ বন্ধকযুক্ত জমিতে দ্বিতীয় ব্যাংকের বন্ধক চেষ্টা।')}
              </p>
            </button>

            <button
              onClick={() =>
                handleSimulate(hasStay ? 'COURT_INJUNCTION_VACATED' : 'COURT_INJUNCTION_ISSUED')
              }
              disabled={simBusy}
              className="text-left p-2.5 rounded border border-line bg-sheet-raised hover:bg-line-hair text-xs transition-colors space-y-1"
            >
              <div className="font-semibold text-indigo flex items-center justify-between">
                <span>
                  3. {hasStay ? t('Vacate Court Stay Order', 'স্থগিতাদেশ প্রত্যাহার') : t('Issue Court Stay Order', 'আদালতের নিষেধাজ্ঞা জারি')}
                </span>
                <ChevronRight className="h-3 w-3" />
              </div>
              <p className="text-3xs text-ink-3">
                {hasStay
                  ? t('Simulate final judicial decree vacating stay.', 'মামলার রায়ে নিষেধাজ্ঞা প্রত্যাহার।')
                  : t('Senior Assistant Judge Court stays transfer under Order 39.', 'দেওয়ানি আদালতের স্থগিতাদেশ জারি।')}
              </p>
            </button>

            <button
              onClick={() => handleSimulate('BANK_NOC_ISSUED')}
              disabled={simBusy}
              className="text-left p-2.5 rounded border border-line bg-sheet-raised hover:bg-line-hair text-xs transition-colors space-y-1"
            >
              <div className="font-semibold text-emerald-400 flex items-center justify-between">
                <span>4. {t('Issue Bank NOC', 'ব্যাংকের অনাপত্তিপত্র')}</span>
                <ChevronRight className="h-3 w-3" />
              </div>
              <p className="text-3xs text-ink-3">
                {t('Simulate Sonali Bank issuing digital NOC for title transfer.', 'দায় থাকা সত্ত্বেও ব্যাংকের অনাপত্তিপত্র নিবন্ধন।')}
              </p>
            </button>

            <button
              onClick={() => handleSimulate('OWNER_LOCK_TOGGLED')}
              disabled={simBusy}
              className="text-left p-2.5 rounded border border-line bg-sheet-raised hover:bg-line-hair text-xs transition-colors space-y-1"
            >
              <div className="font-semibold text-cyan-400 flex items-center justify-between">
                <span>5. {t('Toggle Owner Lock', 'মালিকানা বায়োমেট্রিক লক')}</span>
                <ChevronRight className="h-3 w-3" />
              </div>
              <p className="text-3xs text-ink-3">
                {t('Simulate citizen 2FA OTP property freeze/unfreeze.', 'প্রকৃত মালিক কর্তৃক জমি সাময়িক লক বা আনলক।')}
              </p>
            </button>
          </div>
        </div>

        {/* Footer info & close */}
        <div className="flex items-center justify-between pt-2 border-t border-line text-2xs text-ink-3">
          <span>
            {t('Engine Version: iLMIS 4-Agency Bus v3.2', 'ইঞ্জিন সংস্করণ: আই-এলএমআইএস ৪-সংস্থা বাস ৩.২')}
          </span>
          <Button size="sm" onClick={onClose}>
            {t('Close Console', 'বন্ধ করুন')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
