import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  FileCheck,
  RefreshCw,
  Printer,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Scale,
  Gavel,
  Landmark,
  Radar,
  Lock,
  Unlock,
  Banknote,
} from 'lucide-react';
import type {
  Parcel,
  DueDiligenceReport,
  LitigationCase,
  EscrowContract,
  EncroachmentCheckResult,
} from '../../lib/types';
import {
  getDueDiligence,
  getParcelLitigation,
  checkKhasEncroachment,
  getEscrowContracts,
} from '../../lib/api';
import { Button, Panel, StatusMark, DataRow } from '../../components/ui';
import { Reveal } from '../../components/motion';
import { useLanguage } from '../../lib/language';
import { shortDate, decimals, katha, sqft } from '../../lib/format';
import ClearanceCertificateModal from '../../components/ClearanceCertificateModal';
import DeedForensicsModal from '../../components/DeedForensicsModal';
import EscrowPipelineModal from '../../components/EscrowPipelineModal';
import KhasRadarModal from '../../components/KhasRadarModal';

export default function DueDiligencePanel({ parcel }: { parcel: Parcel }) {
  const { pickLang, t } = useLanguage();
  const [report, setReport] = useState<DueDiligenceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [deedModalOpen, setDeedModalOpen] = useState(false);
  const [escrowModalOpen, setEscrowModalOpen] = useState(false);
  const [khasRadarOpen, setKhasRadarOpen] = useState(false);
  const [litigationCases, setLitigationCases] = useState<LitigationCase[]>([]);
  const [khasResult, setKhasResult] = useState<EncroachmentCheckResult | null>(null);
  const [escrowContracts, setEscrowContracts] = useState<EscrowContract[]>([]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const [reportData, litData, khasData, escrowData] = await Promise.all([
        getDueDiligence(parcel.id),
        getParcelLitigation(parcel.id),
        checkKhasEncroachment(parcel.id),
        getEscrowContracts({ parcelId: parcel.id }),
      ]);
      setReport(reportData);
      const safeCases = Array.isArray(litData) ? litData : (litData as any)?.cases || [];
      setLitigationCases(safeCases);
      setKhasResult(khasData);
      setEscrowContracts(escrowData);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [parcel.id]);

  const isApproved = report?.overallVerdict === 'APPROVED_FOR_TRANSACTION';
  const isCaution = report?.overallVerdict === 'CAUTION_REQUIRED';

  return (
    <div className="space-y-6">
      {/* Top Banner / Verdict Header */}
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo" />
              <h2 className="sheet-title text-xl font-semibold text-ink">
                {t('Pre-Purchase Due Diligence & Title Clearance', 'জমি ক্রয়-বিক্রয় অনাপত্তি ও যাচাইকরণ')}
              </h2>
            </div>
            <p className="mt-1 max-w-measure text-sm text-ink-2">
              {t(
                'Comprehensive 7-point automated audit verifying ownership lineage, PostGIS boundary match, tax clearance, mortgage encumbrance, and litigation caveats.',
                'দলিল রেজিস্ট্রি ও নামজারির পূর্বে জাতীয় ডাটাবেজ, খতিয়ান চেইন, ড্রোন নকশা ও রাজস্ব আদালতের স্বয়ংক্রিয় ৭-দফা যাচাই।'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEscrowModalOpen(true)}>
              <Landmark className="h-3.5 w-3.5 text-state" />
              {t('Escrow Pipeline', 'এস্ক্রো পাইপলাইন')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setKhasRadarOpen(true)}>
              <Radar className="h-3.5 w-3.5 text-indigo" />
              {t('Khas Radar', 'খাস জমি রাডার')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDeedModalOpen(true)}>
              <Scale className="h-3.5 w-3.5 text-indigo" />
              {t('Deed Forensics Scorer', 'দলিল ফরেনসিক্স যাচাই')}
            </Button>
            <Button size="sm" onClick={loadReport} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? t('Auditing...', 'যাচাই চলছে...') : t('Re-Audit', 'পুনরায় যাচাই')}
            </Button>
            {report && (
              <Button size="sm" variant="primary" onClick={() => setCertModalOpen(true)}>
                <Printer className="h-3.5 w-3.5" />
                {t('Issue Clearance Certificate', 'অনাপত্তি সনদপত্র দেখুন')}
              </Button>
            )}
          </div>
        </div>
      </Reveal>

      {/* Main Scorecard and Summary Strip */}
      {report && (
        <Reveal delay={40}>
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="border border-line bg-sheet-raised p-4">
              <span className="mono block text-2xs uppercase text-ink-3">
                {t('Title Health Score', 'স্বত্ব ও রেকর্ড স্কোর')}
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="mono text-3xl font-bold text-ink">{report.score}</span>
                <span className="mono text-sm text-ink-3">/ 100</span>
              </div>
              <div className="mt-3 h-1.5 w-full bg-ground-sunk rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${report.score >= 80 ? 'bg-state' : report.score >= 60 ? 'bg-amber' : 'bg-seal'
                    }`}
                  style={{ width: `${report.score}%` }}
                />
              </div>
            </div>

            <div className="border border-line bg-sheet-raised p-4">
              <span className="mono block text-2xs uppercase text-ink-3">
                {t('Transaction Eligibility', 'লেনদেন ও ক্রয় যোগ্যতা')}
              </span>
              <div className="mt-2">
                <StatusMark tone={isApproved ? 'state' : isCaution ? 'amber' : 'seal'}>
                  {isApproved
                    ? t('Approved for Transaction', 'ক্রয়-বিক্রয় নিরাপদ ও অনুমোদিত')
                    : isCaution
                      ? t('Caution Required', 'শর্তসাপেক্ষ নিষ্পত্তি প্রয়োজন')
                      : t('Disputed / Restricted', 'স্থগিত বা বিতর্কিত রেকর্ড')}
                </StatusMark>
              </div>
              <p className="mt-2 text-xs text-ink-2">
                {isApproved
                  ? t('No civil stay orders, mortgage charges, or unrectified boundary disputes.', 'কোনো দেওয়ানী স্থগিতাদেশ, ব্যাংক দায় বা অপরিশোধিত কর নেই।')
                  : t('Review flagged warning items prior to token deed earnest payment.', 'বায়না বা রেজিস্ট্রি সম্পাদনের পূর্বে অমিল শর্তসমূহ সংশোধন করুন।')}
              </p>
            </div>

            <div className="border border-line bg-sheet-raised p-4">
              <span className="mono block text-2xs uppercase text-ink-3">
                {t('Cryptographic Verification', 'ডিজিটাল সত্যায়ন ট্র্যাকার')}
              </span>
              <p className="mono mt-2 text-xs font-semibold text-indigo truncate" title={report.verificationHash}>
                {report.verificationHash}
              </p>
              <p className="mt-2 text-2xs text-ink-3">
                {t('Verified on', 'যাচাইয়ের সময়')}: {shortDate(report.generatedAt)} &middot; DLRS Cloud Node
              </p>
            </div>
          </div>
        </Reveal>
      )}

      {/* 7-Point Audit Checklist Grid */}
      {report && (
        <Reveal delay={80}>
          <Panel
            label={t('7-Point Automated Pre-Purchase Checklist', '৭-দফা প্রি-পারচেজ ডিউ ডিলিজেন্স চেকলিস্ট')}
            meta={`${report.items.filter((i) => i.status === 'PASS').length} / ${report.items.length} ${t('Passed', 'উত্তীর্ণ')}`}
            bodyClassName="px-0 py-0"
          >
            <div className="divide-y divide-line-hair">
              {report.items.map((it, idx) => {
                const pass = it.status === 'PASS';
                return (
                  <div
                    key={it.id}
                    className="flex flex-col gap-2 p-4 transition-colors hover:bg-ground-sunk sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {pass ? (
                          <CheckCircle2 className="h-5 w-5 text-state" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-amber" />
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-ink">
                            {idx + 1}. {pickLang(it.nameBn)} ({it.name})
                          </span>
                          <span className="mono rounded bg-ground px-1.5 py-0.5 text-[10px] text-ink-3">
                            {it.statuteRef}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-ink-2">{it.finding}</p>
                        <p className="mt-0.5 text-2xs text-ink-3">{it.detail}</p>
                      </div>
                    </div>

                    <div className="self-end sm:self-center shrink-0">
                      <StatusMark tone={pass ? 'state' : 'amber'}>
                        {pass ? t('Pass (উত্তীর্ণ)', 'উত্তীর্ণ') : t('Caution (সতর্কতা)', 'সতর্কতা')}
                      </StatusMark>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </Reveal>
      )}

      {/* Civil Court Injunction & Litigation Radar */}
      <Reveal delay={100}>
        <Panel
          label={t(
            'Civil Court Injunction & Litigation Radar (দেওয়ানি আদালত লিস পেনডেন্স রাডার)',
            'দেওয়ানি আদালত লিস পেনডেন্স রাডার'
          )}
          meta={
            Array.isArray(litigationCases) && litigationCases.some((c) => c.stayOrderActive)
              ? t('STAY ORDER ACTIVE (স্থগিতাদেশ বলবৎ)', 'স্থগিতাদেশ বলবৎ')
              : Array.isArray(litigationCases) && litigationCases.length > 0
              ? t('Pending Suit (মোকদ্দমা চলমান)', 'মোকদ্দমা চলমান')
              : t('No Injunctions (নিষ্কণ্টক)', 'নিষ্কণ্টক')
          }
          bodyClassName="p-4"
        >
          {!Array.isArray(litigationCases) || litigationCases.length === 0 ? (
            <div className="flex items-center gap-3 p-3 bg-state/10 border border-state text-ink">
              <CheckCircle2 className="h-5 w-5 text-state shrink-0" />
              <div>
                <p className="text-xs font-bold text-ink">
                  {t(
                    'No Active Civil Injunctions or Stay Orders Found',
                    'কোনো সক্রিয় দেওয়ানি আদালতের স্থগিতাদেশ বা স্বত্ব মোকদ্দমা পাওয়া যায়নি'
                  )}
                </p>
                <p className="text-[11px] text-ink-2 mt-0.5">
                  {t(
                    `Senior Assistant Judge Court, Joint District Judge Court, and DLRS Registry confirm zero lis pendens under CPC Order 39 or Sec 52 Transfer of Property Act for Parcel ${parcel.id}.`,
                    `এই দাগের (খতিয়ান নং ${parcel.khatianNo}, দাগ নং ${parcel.dagNo}) ওপর কোনো দেওয়ানি আদালতের অস্থায়ী নিষেধাজ্ঞা বা বিক্রয় স্থগিতাদেশ নেই। স্বত্ব হস্তান্তর আইনত বৈধ।`
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {litigationCases.map((litCase) => {
                const isStay = litCase.stayOrderActive;
                return (
                  <div
                    key={litCase.id}
                    className={`p-4 border ${
                      isStay
                        ? 'border-seal bg-seal/10 text-ink'
                        : 'border-amber bg-amber/10 text-ink'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Gavel className={`h-5 w-5 ${isStay ? 'text-seal' : 'text-amber'}`} />
                        <div>
                          <span className="mono text-xs font-bold uppercase text-ink">
                            {litCase.caseNumber} &middot; {litCase.suitTypeBn || litCase.suitType}
                          </span>
                          <p className="text-[11px] text-ink-3">
                            {litCase.courtName}
                          </p>
                        </div>
                      </div>

                      <StatusMark tone={isStay ? 'seal' : 'amber'}>
                        {isStay
                          ? t('ACTIVE STAY ORDER (স্থগিতাদেশ বলবৎ)', 'স্থগিতাদেশ বলবৎ')
                          : t('LIS PENDENS PENDING (মোকদ্দমা বিচারাধীন)', 'মোকদ্দমা বিচারাধীন')}
                      </StatusMark>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs mb-3">
                      <div>
                        <span className="mono text-[10px] text-ink-3 block">
                          {t('Claimant (বাদী)', 'বাদী')}
                        </span>
                        <span className="font-semibold text-ink">{litCase.claimant}</span>
                      </div>
                      <div>
                        <span className="mono text-[10px] text-ink-3 block">
                          {t('Defendant (বিবাদী)', 'বিবাদী')}
                        </span>
                        <span className="font-semibold text-ink">{litCase.defendant}</span>
                      </div>
                      <div>
                        <span className="mono text-[10px] text-ink-3 block">
                          {t('Filing Date', 'মামলা দায়ের')}
                        </span>
                        <span className="mono text-ink">{litCase.filedDate}</span>
                      </div>
                      <div>
                        <span className="mono text-[10px] text-ink-3 block">
                          {t('Next Hearing Date', 'পরবর্তী শুনানি')}
                        </span>
                        <span className="mono font-semibold text-indigo">{litCase.nextHearingDate}</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-ground border border-line-hair text-xs">
                      <p className="font-medium text-ink">
                        {litCase.orderSummaryBn || litCase.orderSummary}
                      </p>
                      <p className="mono text-[10px] text-ink-3 mt-1">
                        {t('Statutory Ground: ', 'আইনি ভিত্তি: ')}{litCase.statutorySection}
                      </p>
                    </div>

                    {isStay && (
                      <div className="mt-2 text-xs font-bold text-seal flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>
                          {t(
                            'JUDICIAL CAVEAT: Alienation, conveyance deed registration, and mutation on this parcel are legally barred.',
                            'আদালতের আদেশ: এই দাগের জমি বিক্রয়, হস্তান্তরমূলক দলিল সম্পাদন এবং নামজারি কার্যক্রম সম্পূর্ণ নিষিদ্ধ।'
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </Reveal>

      {/* Phase 3: Transaction Escrow & Khas Encroachment Radar Grid */}
      <Reveal delay={100}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Zero-Trust Escrow Pipeline Card */}
          <Panel
            label={t('Zero-Trust Land Buy/Sell Escrow', 'জিরো-ট্রাস্ট ভূমি ক্রয়-বিক্রয় এস্ক্রো')}
            meta={
              escrowContracts.length > 0 ? (
                <StatusMark tone={escrowContracts[0].isLocked ? 'amber' : 'state'}>
                  {escrowContracts[0].isLocked
                    ? t('LAND LOCKED & PROTECTED', 'জমি লক কার্যকর')
                    : t('ESCROW ACTIVE', 'এস্ক্রো সক্রিয়')}
                </StatusMark>
              ) : (
                <StatusMark tone="neutral">{t('READY TO INITIALIZE', 'প্রস্তাব প্রস্তুত')}</StatusMark>
              )
            }
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="mono text-ink-3">{t('Contract Settlement State', 'নিষ্পত্তি ধাপ')}</span>
                <span className="mono font-semibold text-ink">
                  {escrowContracts.length > 0 ? escrowContracts[0].stage : t('No Active Deal', 'কোনো চুক্তি নেই')}
                </span>
              </div>

              {escrowContracts.length > 0 ? (
                <>
                  <div className="p-3 bg-ground-sunk border border-line-hair text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-ink-3">{t('Total Consideration', 'মোট বিক্রয়মূল্য')}:</span>
                      <span className="mono font-bold text-ink">
                        BDT {escrowContracts[0].totalConsiderationBdt.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-3">{t('Treasury Vault Balance', 'ট্রেজারি ভল্ট স্থিতি')}:</span>
                      <span className="mono font-bold text-state">
                        BDT {escrowContracts[0].depositedAmountBdt.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-3">{t('Govt Statutory Taxes (10%)', 'সরকারি রাজস্ব (১০%)')}:</span>
                      <span className="mono text-amber">
                        BDT {escrowContracts[0].totalStatutoryFeesBdt.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-2xs mono text-ink-3">
                    <span>A/C: {escrowContracts[0].escrowVaultAccount}</span>
                    <span>{escrowContracts[0].escrowBankName}</span>
                  </div>
                </>
              ) : (
                <div className="p-3 bg-ground-sunk border border-line-hair text-xs text-ink-2">
                  {t(
                    'Multi-stage zero-trust escrow locks the land on digital registers, secures funds in Sonali Bank Treasury Vault, and automates 10% statutory tax deductions.',
                    'বহুধাপবিশিষ্ট এস্ক্রো ডিজিটাল খতিয়ানে জমি লক করে, সোনালী ব্যাংক ট্রেজারি ভল্টে জামানত সংরক্ষণ করে এবং ১০% রাজস্ব কর্তন নিশ্চিত করে।'
                  )}
                </div>
              )}

              <Button
                size="sm"
                variant="primary"
                onClick={() => setEscrowModalOpen(true)}
                className="w-full mt-2"
              >
                <Landmark className="h-3.5 w-3.5 mr-1.5" />
                {t('Open Escrow Pipeline Stepper', 'এস্ক্রো নিষ্পত্তির বিস্তারিত ধাপ দেখুন')}
              </Button>
            </div>
          </Panel>

          {/* Khas & Vested Land Radar Card */}
          <Panel
            label={t('Government Khas & Vested Land Radar', '১নং খাস খতিয়ান ও অর্পিত সম্পত্তি সততা')}
            meta={
              khasResult ? (
                <StatusMark
                  tone={
                    khasResult.riskLevel === 'CRITICAL_ENCROACHMENT'
                      ? 'seal'
                      : khasResult.riskLevel === 'BUFFER_WARNING'
                      ? 'amber'
                      : 'state'
                  }
                >
                  {khasResult.riskLevel}
                </StatusMark>
              ) : (
                <StatusMark tone="neutral">SCANNING</StatusMark>
              )
            }
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="mono text-ink-3">{t('Proximity to Government Land', 'নিকটবর্তী খাস দূরত্ব')}</span>
                <span className="mono font-bold text-ink">
                  {khasResult ? `${khasResult.closestDistanceMeters.toFixed(1)} meters` : 'Scanning...'}
                </span>
              </div>

              <div className="p-3 bg-ground-sunk border border-line-hair text-xs space-y-1.5">
                <div className="text-ink font-semibold">
                  {khasResult?.riskLevelBn || t('Safe Clearance', 'খাস জমি মুক্ত')}
                </div>
                <p className="text-2xs text-ink-3 font-mono leading-relaxed">
                  {khasResult?.statutoryCitation || 'State Acquisition and Tenancy Act 1950 (Section 86)'}
                </p>
                <div className="w-full bg-ground h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full ${
                      khasResult?.riskLevel === 'CRITICAL_ENCROACHMENT'
                        ? 'bg-seal'
                        : khasResult?.riskLevel === 'BUFFER_WARNING'
                        ? 'bg-amber'
                        : 'bg-state'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(10, ((khasResult?.closestDistanceMeters || 100) / 120) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => setKhasRadarOpen(true)}
                className="w-full mt-2"
              >
                <Radar className="h-3.5 w-3.5 mr-1.5 text-indigo" />
                {t('Launch Proximity Radar & Inventory', 'খাস জমি রাডার ও উচ্ছেদ ট্র্যাকার খুলুন')}
              </Button>
            </div>
          </Panel>
        </div>
      </Reveal>

      {/* Buyer Guidance Notes */}
      <Reveal delay={120}>
        <div className="border border-line bg-sheet p-5">
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-indigo" />
            {t('Buyer Guidance & Legal Safeguards (ক্রেতার করণীয় সতর্কতা)', 'ক্রেতার করণীয় ও আইনি সতর্কতা')}
          </h3>
          <ul className="mt-3 space-y-2 text-xs text-ink-2">
            <li className="flex items-start gap-2">
              <span className="text-indigo font-bold">১.</span>
              <span>
                <strong>বায়া দলিলের ধারাবাহিকতা যাচাই:</strong> সিএস হতে বর্তমান বিএস/বিডিএস পর্যন্ত ন্যূনতম ২৫ বছরের স্বত্ব ও মালিকানার ধারাবাহিকতা মিল নিশ্চিত করুন।
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo font-bold">২.</span>
              <span>
                <strong>সরেজমিনে সীমানা ও দখল:</strong> নকশায় উল্লিখিত উত্তর-দক্ষিণ-পূর্ব-পশ্চিমের সীমানা খুঁটি এবং পাশ্ববর্তী দাগের সাথে বাস্তব দখল মিলিয়ে নিন।
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo font-bold">৩.</span>
              <span>
                <strong>সাব-রেজিস্ট্রি অফিসে তল্লাশি:</strong> দলিল সম্পাদনের অব্যবহিত পূর্বে সংশ্লিষ্ট সাব-রেজিস্ট্রি অফিসে কোনো অগ্রিম বায়না বা গোপন দানপত্র রেজিস্ট্রি রয়েছে কিনা তল্লাশি দিন।
              </span>
            </li>
          </ul>
        </div>
      </Reveal>

      {/* Clearance Certificate Modal */}
      {report && (
        <ClearanceCertificateModal
          open={certModalOpen}
          onClose={() => setCertModalOpen(false)}
          parcel={parcel}
          report={report}
        />
      )}

      {/* Deed Forensics Modal */}
      <DeedForensicsModal
        open={deedModalOpen}
        onClose={() => setDeedModalOpen(false)}
        defaultParcelId={parcel.id}
        defaultAreaDecimal={parcel.areaDecimal}
        defaultOwnerName={parcel.currentOwner}
        defaultOwnerNid={parcel.nidNumber}
      />

      {/* Escrow Pipeline Modal */}
      <EscrowPipelineModal
        open={escrowModalOpen}
        onClose={() => {
          setEscrowModalOpen(false);
          loadReport();
        }}
        defaultParcelId={parcel.id}
        defaultAreaDecimal={parcel.areaDecimal}
        defaultOwnerName={parcel.currentOwner}
        defaultOwnerNid={parcel.nidNumber}
      />

      {/* Khas & Vested Land Radar Modal */}
      <KhasRadarModal
        open={khasRadarOpen}
        onClose={() => {
          setKhasRadarOpen(false);
          loadReport();
        }}
        defaultParcelId={parcel.id}
      />
    </div>
  );
}
