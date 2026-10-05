import { useEffect, useMemo, useState } from 'react';
import {
  ShieldAlert,
  Globe,
  Building2,
  Users,
  TrendingUp,
  FileSpreadsheet,
  Sliders,
  Lock,
  Unlock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Satellite,
  History,
  UserCog,
  FolderOpen,
} from 'lucide-react';
import type { Parcel, AdminMetrics, AdminOfficer, AuditTrailEntry, TaxSlabPolicy } from '../../lib/types';
import { Panel, Button, StatusMark, DataRow, inputClass } from '../../components/ui';
import { Reveal } from '../../components/motion';
import { useLanguage } from '../../lib/language';
import { taka, decimals, shortDate, cx } from '../../lib/format';
import {
  getAdminMetrics,
  getAdminOfficers,
  reassignOfficer,
  setOfficerStatus,
  getAdminAuditTrail,
  getTaxPolicy,
  updateTaxPolicy,
} from '../../lib/api';

interface Props {
  parcels: Parcel[];
  onSelectParcel: (parcelId: string) => void;
}

type SubTab = 'overview' | 'officers' | 'reconciliation' | 'audit' | 'policy';

const DIVISIONS = ['Dhaka', 'Chattogram', 'Rajshahi', 'Khulna', 'Barishal', 'Sylhet', 'Rangpur', 'Mymensingh'];

export default function SuperAdminDashboardPanel({ parcels, onSelectParcel }: Props) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<SubTab>('overview');
  const [division, setDivision] = useState<string>('ALL');

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [officers, setOfficers] = useState<AdminOfficer[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditTrailEntry[]>([]);
  const [taxPolicy, setTaxPolicy] = useState<TaxSlabPolicy | null>(null);
  const [loading, setLoading] = useState(true);

  const [reassignTarget, setReassignTarget] = useState<AdminOfficer | null>(null);
  const [reassignUpazila, setReassignUpazila] = useState('');
  const [reassignDistrict, setReassignDistrict] = useState('');
  const [auditActorFilter, setAuditActorFilter] = useState<string | null>(null);
  const [frozenParcels, setFrozenParcels] = useState<Set<string>>(new Set());
  const [resurveyOrders, setResurveyOrders] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const [m, o, a, p] = await Promise.all([getAdminMetrics(), getAdminOfficers(), getAdminAuditTrail(), getTaxPolicy()]);
    setMetrics(m);
    setOfficers(o);
    setAuditTrail(a);
    setTaxPolicy(p);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredOfficers = useMemo(
    () => (division === 'ALL' ? officers : officers.filter((o) => o.division === division)),
    [officers, division]
  );

  const filteredDivisions = useMemo(
    () => (metrics ? (division === 'ALL' ? metrics.divisions : metrics.divisions.filter((d) => d.division === division)) : []),
    [metrics, division]
  );

  const reconciliationRows = useMemo(
    () =>
      parcels
        .filter((p) => p.mappedAreaDecimal != null)
        .map((p) => {
          const diffPct = Math.abs((p.mappedAreaDecimal as number) - p.areaDecimal) / (p.areaDecimal || 1) * 100;
          return { parcel: p, diffPct, anomaly: diffPct > 5 };
        }),
    [parcels]
  );

  const filteredAudit = useMemo(
    () => (auditActorFilter ? auditTrail.filter((e) => e.actor === auditActorFilter) : auditTrail),
    [auditTrail, auditActorFilter]
  );

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignTarget || !reassignUpazila.trim()) return;
    const { officer } = await reassignOfficer(reassignTarget.id, reassignDistrict.trim(), reassignUpazila.trim());
    if (officer) setOfficers((prev) => prev.map((o) => (o.id === officer.id ? officer : o)));
    setReassignTarget(null);
  };

  const handleToggleStatus = async (officer: AdminOfficer, status: AdminOfficer['status']) => {
    const { officer: updated } = await setOfficerStatus(officer.id, status);
    if (updated) setOfficers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const toggleFreeze = (parcelId: string) => {
    setFrozenParcels((prev) => {
      const next = new Set(prev);
      if (next.has(parcelId)) next.delete(parcelId);
      else next.add(parcelId);
      return next;
    });
  };

  const toggleResurvey = (parcelId: string) => {
    setResurveyOrders((prev) => {
      const next = new Set(prev);
      if (next.has(parcelId)) next.delete(parcelId);
      else next.add(parcelId);
      return next;
    });
  };

  if (loading || !metrics || !taxPolicy) {
    return (
      <div className="border border-line bg-sheet px-5 py-16 text-center">
        <p className="mono text-2xs uppercase text-ink-3">{t('Loading national command center...', 'জাতীয় কেন্দ্র লোড হচ্ছে...')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Masthead */}
      <Reveal>
        <div className="border border-indigo/30 bg-indigo-soft p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-indigo/40 bg-sheet text-indigo shadow-sm">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono rounded bg-indigo px-2 py-0.5 text-2xs font-bold uppercase tracking-wider text-white">
                    {t('National Oversight Active', 'জাতীয় তত্ত্বাবধান সক্রিয়')}
                  </span>
                  <span className="mono text-2xs font-semibold text-ink-3">Ministry of Land, Dhaka</span>
                </div>
                <h1 className="sheet-title text-xl font-bold text-ink sm:text-2xl mt-1">
                  {t('National Land Registry Command Center', 'জাতীয় ভূমি ব্যবস্থাপনা ও তত্ত্বাবধান কেন্দ্র')}
                </h1>
                <p className="mt-0.5 text-xs text-ink-2">{t('8 divisions', '৮টি বিভাগ')} &middot; {t('64 districts', '৬৪টি জেলা')} &middot; {t('Land Reform Board oversight', 'ভূমি সংস্কার বোর্ড তত্ত্বাবধান')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select value={division} onChange={(e) => setDivision(e.target.value)} className={cx(inputClass, 'h-9 w-auto py-0 text-xs')}>
                <option value="ALL">{t('All Divisions', 'সকল বিভাগ')}</option>
                {DIVISIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <Button size="sm" onClick={load}>
                <RefreshCw className="h-3.5 w-3.5" /> {t('Refresh', 'রিফ্রেশ')}
              </Button>
            </div>
          </div>

          {/* KPI strip */}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-indigo/20 pt-4 sm:grid-cols-4">
            <div className="rounded border border-line bg-sheet p-3">
              <span className="mono block text-[10px] uppercase text-ink-3">{t('Registered Parcels', 'নিবন্ধিত খতিয়ান')}</span>
              <span className="mono text-2xl font-bold text-ink">{metrics.totalParcels.toLocaleString('en-BD')}</span>
              <span className="block text-[11px] text-ink-3">{decimals(metrics.totalAreaDecimal)} {t('decimal total', 'শতক মোট')}</span>
            </div>
            <div className="rounded border border-line bg-sheet p-3">
              <span className="mono block text-[10px] uppercase text-ink-3">{t('Mutation Velocity', 'নামজারি গতি')}</span>
              <span className="mono text-2xl font-bold text-indigo">{metrics.mutations.avgTurnaroundDays} {t('days', 'দিন')}</span>
              <span className="block text-[11px] text-indigo font-medium">
                {t('SLA target', 'লক্ষ্যমাত্রা')} {metrics.mutations.slaTargetDays} {t('days', 'দিন')}
              </span>
            </div>
            <div className="rounded border border-line bg-sheet p-3">
              <span className="mono block text-[10px] uppercase text-ink-3">{t('Treasury Collected', 'রাজস্ব আদায়')}</span>
              <span className="mono text-2xl font-bold text-state">{taka(metrics.treasury.collectedBDT)}</span>
              <span className="block text-[11px] text-state font-medium">
                {t('vs', 'বনাম')} {taka(metrics.treasury.outstandingBDT)} {t('outstanding', 'বকেয়া')}
              </span>
            </div>
            <div className="rounded border border-line bg-sheet p-3">
              <span className="mono block text-[10px] uppercase text-ink-3">{t('Systemic Discrepancies', 'গরমিল চিহ্নিত')}</span>
              <span className="mono text-2xl font-bold text-seal">{metrics.discrepancies.unresolved.toLocaleString('en-BD')}</span>
              <span className="block text-[11px] text-seal font-medium">{t('PostGIS overlap & lineage flags', 'সীমানা ও ধারাবাহিকতা গরমিল')}</span>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Sub-navigation */}
      <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-5">
        {[
          { id: 'overview' as const, label: t('Executive Summary', 'নির্বাহী সারসংক্ষেপ'), icon: TrendingUp },
          { id: 'officers' as const, label: t('Officer Governance', 'কর্মকর্তা ও এখতিয়ার'), icon: Users, badge: officers.length },
          { id: 'reconciliation' as const, label: t('Cadastral Reconciliation', 'জরিপ সমন্বয়'), icon: MapPin, badge: reconciliationRows.filter((r) => r.anomaly).length },
          { id: 'audit' as const, label: t('Judicial Audit Trail', 'বিচারিক অডিট লগ'), icon: History, badge: filteredAudit.length },
          { id: 'policy' as const, label: t('LD Tax Policy', 'ভূমি কর নীতি'), icon: Sliders },
        ].map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cx(
                'flex items-center justify-between p-3.5 text-left transition-colors duration-1',
                active ? 'bg-indigo-soft text-indigo font-semibold' : 'bg-sheet text-ink-2 hover:bg-ground-sunk'
              )}
            >
              <div className="flex items-center gap-2">
                <item.icon className={cx('h-4 w-4', active ? 'text-indigo' : 'text-ink-3')} />
                <span className="text-xs">{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={cx('mono rounded px-1.5 py-0.5 text-2xs font-bold', active ? 'bg-indigo text-white' : 'bg-ground-sunk text-ink-2')}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab: Executive Summary */}
      {tab === 'overview' && (
        <Reveal delay={40}>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel label={t('Mutation Case Velocity', 'নামজারি মামলার অগ্রগতি')} bodyClassName="px-0 py-0">
              <div className="divide-y divide-line-hair">
                <DataRow label={t('Filed', 'দায়েরকৃত')} value={metrics.mutations.filed.toLocaleString('en-BD')} mono />
                <DataRow label={t('Approved', 'মঞ্জুরকৃত')} value={metrics.mutations.approved.toLocaleString('en-BD')} mono />
                <DataRow label={t('Rejected', 'খারিজকৃত')} value={metrics.mutations.rejected.toLocaleString('en-BD')} mono />
                <DataRow label={t('Pending', 'অমীমাংসিত')} value={metrics.mutations.pending.toLocaleString('en-BD')} mono />
              </div>
            </Panel>

            <Panel label={t('Treasury Revenue by Division', 'বিভাগভিত্তিক রাজস্ব')} meta={t('LD Tax collected', 'ভূমি উন্নয়ন কর')} bodyClassName="px-0 py-0">
              <div className="divide-y divide-line-hair">
                {filteredDivisions.map((d) => (
                  <div key={d.division} className="flex items-center justify-between px-4 py-2.5 sm:px-5">
                    <span className="flex items-center gap-2 text-sm text-ink">
                      <Building2 className="h-3.5 w-3.5 text-ink-3" /> {d.division}
                    </span>
                    <span className="mono text-xs text-ink-2">
                      {d.parcels.toLocaleString('en-BD')} {t('parcels', 'খতিয়ান')} &middot; {decimals(d.areaDecimal)} {t('dec', 'শতক')}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </Reveal>
      )}

      {/* Tab: Officer Governance */}
      {tab === 'officers' && (
        <Reveal delay={40}>
          <Panel label={t('AC (Land) & Kanungo Jurisdiction Roster', 'সহকারী কমিশনার (ভূমি) ও কানুনগো এখতিয়ার তালিকা')} meta={`${filteredOfficers.length} ${t('officers', 'জন কর্মকর্তা')}`} bodyClassName="px-0 py-0">
            <div className="divide-y divide-line-hair">
              {filteredOfficers.map((o) => (
                <div key={o.id} className="flex flex-col gap-3 p-5 transition-colors hover:bg-ground-sunk lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{o.name}</span>
                      <span className="mono rounded bg-ground px-1.5 py-0.5 text-2xs text-ink-3">{o.designation.replace('_', ' ')}</span>
                      <StatusMark tone={o.status === 'ACTIVE' ? 'state' : o.status === 'ON_LEAVE' ? 'amber' : 'seal'}>{o.status.replace('_', ' ')}</StatusMark>
                    </div>
                    <p className="mono text-2xs text-ink-3">
                      NID {o.nid} &middot; {o.mobile} &middot; {o.upazila}, {o.district} ({o.division})
                    </p>
                    <p className="text-xs text-ink-2">
                      {t('Pending queue', 'অপেক্ষমাণ কেস')}: <strong>{o.pendingQueue}</strong>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-start lg:self-center shrink-0">
                    <Button
                      size="sm"
                      onClick={() => {
                        setReassignTarget(o);
                        setReassignUpazila(o.upazila);
                        setReassignDistrict(o.district);
                      }}
                    >
                      <UserCog className="h-3.5 w-3.5" /> {t('Reassign Upazila', 'বদলি')}
                    </Button>
                    <Button
                      size="sm"
                      variant={o.status === 'SUSPENDED' ? 'primary' : 'secondary'}
                      onClick={() => handleToggleStatus(o, o.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED')}
                    >
                      <ShieldAlert className="h-3.5 w-3.5" /> {o.status === 'SUSPENDED' ? t('Restore Key', 'পুনর্বহাল') : t('Revoke Signing Key', 'সাইনিং কী বাতিল')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setAuditActorFilter(o.name);
                        setTab('audit');
                      }}
                    >
                      <History className="h-3.5 w-3.5" /> {t('View Audit Logs', 'অডিট লগ')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>
      )}

      {/* Tab: Cadastral Reconciliation */}
      {tab === 'reconciliation' && (
        <Reveal delay={40}>
          <Panel
            label={t('CS / RS / BS / BDS Cross-Survey Reconciliation', 'সিএস, আরএস, বিএস ও বিডিএস জরিপ সমন্বয়')}
            meta={`${reconciliationRows.filter((r) => r.anomaly).length} ${t('anomalies flagged', 'গরমিল চিহ্নিত')}`}
            bodyClassName="px-0 py-0"
          >
            {reconciliationRows.length === 0 ? (
              <p className="p-6 text-center text-xs text-ink-3">{t('No digitized BDS vector data loaded for comparison yet.', 'তুলনার জন্য কোনো বিডিএস ভেক্টর ডেটা লোড হয়নি।')}</p>
            ) : (
              <div className="divide-y divide-line-hair">
                {reconciliationRows.map(({ parcel: p, diffPct, anomaly }) => (
                  <div key={p.id} className="flex flex-col gap-3 p-5 transition-colors hover:bg-ground-sunk lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="mono text-xs font-bold text-indigo">{p.id}</span>
                        <span className="mono rounded bg-ground px-1.5 py-0.5 text-2xs text-ink-3">{p.upazila}, {p.district}</span>
                        <StatusMark tone={anomaly ? 'seal' : 'state'}>
                          {anomaly ? t('VARIANCE > 5%', 'গরমিল > ৫%') : t('WITHIN TOLERANCE', 'সহনসীমার মধ্যে')}
                        </StatusMark>
                        {resurveyOrders.has(p.id) && <StatusMark tone="amber">{t('Drone resurvey ordered', 'ড্রোন পুনঃজরিপ আদেশ')}</StatusMark>}
                      </div>
                      <p className="text-xs text-ink-2">
                        {t('Recorded (deed) area', 'দলিলীয় পরিমাণ')}: <strong>{decimals(p.areaDecimal)}</strong> &middot;{' '}
                        {t('Digitized BDS area', 'ডিজিটাইজড বিডিএস পরিমাণ')}: <strong>{decimals(p.mappedAreaDecimal ?? 0)}</strong> &middot;{' '}
                        {t('Variance', 'পার্থক্য')}: <strong className={anomaly ? 'text-seal' : 'text-state'}>{diffPct.toFixed(2)}%</strong>
                      </p>
                      <p className="mono text-2xs text-ink-3">
                        {t('Survey epochs on file', 'নথিভুক্ত জরিপ যুগ')}: {(p.titleChain ?? []).map((n) => n.epoch).join(' → ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 self-start lg:self-center shrink-0">
                      <Button size="sm" onClick={() => onSelectParcel(p.id)}>
                        <FolderOpen className="h-3.5 w-3.5" /> {t('Inspect Plot', 'জমি পরিদর্শন')}
                      </Button>
                      {anomaly && (
                        <Button size="sm" variant="primary" onClick={() => toggleResurvey(p.id)}>
                          <Satellite className="h-3.5 w-3.5" />
                          {resurveyOrders.has(p.id) ? t('Resurvey Ordered', 'আদেশকৃত') : t('Order Drone Resurvey', 'ড্রোন পুনঃজরিপ আদেশ')}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </Reveal>
      )}

      {/* Tab: Judicial Audit Trail */}
      {tab === 'audit' && (
        <Reveal delay={40}>
          <Panel
            label={t('Immutable Judicial & Administrative Audit Log', 'অপরিবর্তনযোগ্য বিচারিক ও প্রশাসনিক অডিট লগ')}
            meta={auditActorFilter ? `${t('Filtered', 'ফিল্টারকৃত')}: ${auditActorFilter}` : `${filteredAudit.length} ${t('entries', 'এন্ট্রি')}`}
            action={
              auditActorFilter ? (
                <button onClick={() => setAuditActorFilter(null)} className="mono text-2xs text-indigo underline">
                  {t('Clear filter', 'ফিল্টার মুছুন')}
                </button>
              ) : undefined
            }
            bodyClassName="px-0 py-0"
          >
            {filteredAudit.length === 0 ? (
              <p className="p-6 text-center text-xs text-ink-3">{t('No audit entries recorded yet.', 'কোনো অডিট এন্ট্রি নেই।')}</p>
            ) : (
              <div className="divide-y divide-line-hair">
                {filteredAudit.map((e) => {
                  const frozen = frozenParcels.has(e.parcelId);
                  const isVested = /khas|vested|সরকারি|অর্পিত/i.test(`${e.title} ${e.description}`);
                  return (
                    <div key={e.id} className="flex flex-col gap-2 p-5 transition-colors hover:bg-ground-sunk lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="mono text-2xs text-ink-3">{shortDate(e.eventDate)}</span>
                          <span className="mono text-xs font-bold text-indigo">{e.referenceDoc || e.parcelId}</span>
                          <span className="mono rounded bg-ground px-1.5 py-0.5 text-2xs text-ink-3">{e.eventType.replace(/_/g, ' ')}</span>
                          {frozen && <StatusMark tone="seal"><Lock className="h-3 w-3" /> {t('Transfer Frozen', 'হস্তান্তর স্থগিত')}</StatusMark>}
                        </div>
                        <p className="text-sm text-ink">{e.title}</p>
                        <p className="text-xs text-ink-2">{e.description}</p>
                        <p className="mono text-2xs text-ink-3">{t('Actor', 'কর্মকর্তা')}: {e.actor}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 self-start lg:self-center shrink-0">
                        <Button size="sm" onClick={() => onSelectParcel(e.parcelId)}>
                          <FolderOpen className="h-3.5 w-3.5" /> {t('Open Parcel', 'নথি দেখুন')}
                        </Button>
                        <Button size="sm" variant={frozen ? 'secondary' : 'seal'} onClick={() => toggleFreeze(e.parcelId)}>
                          {frozen ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                          {frozen ? t('Unfreeze', 'পুনরায় সচল') : t('Freeze Parcel Transfer', 'হস্তান্তর জরুরি স্থগিত')}
                        </Button>
                        {isVested && <StatusMark tone="amber"><AlertTriangle className="h-3 w-3" /> {t('Khas/Vested flag', 'খাস/অর্পিত সতর্কতা')}</StatusMark>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </Reveal>
      )}

      {/* Tab: LD Tax Policy */}
      {tab === 'policy' && (
        <Reveal delay={40}>
          <TaxPolicyForm policy={taxPolicy} onSaved={setTaxPolicy} />
        </Reveal>
      )}

      {/* Reassign modal */}
      {reassignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md border border-line bg-sheet p-6 shadow-xl animate-sheet-in">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 text-indigo">
                <UserCog className="h-5 w-5" />
                <h3 className="sheet-title text-base font-semibold text-ink">{t('Reassign Jurisdiction', 'এখতিয়ার বদলি')}</h3>
              </div>
              <button onClick={() => setReassignTarget(null)} className="text-ink-3 hover:text-ink">✕</button>
            </div>
            <form onSubmit={handleReassign} className="mt-4 space-y-4 text-xs">
              <div className="bg-indigo-soft p-3 rounded border border-indigo/20">
                <p className="font-semibold text-indigo">{reassignTarget.name}</p>
                <p className="text-2xs text-ink-2 mt-0.5">{t('Currently', 'বর্তমানে')}: {reassignTarget.upazila}, {reassignTarget.district}</p>
              </div>
              <div>
                <label className="block font-semibold text-ink mb-1">{t('New District', 'নতুন জেলা')}</label>
                <input value={reassignDistrict} onChange={(e) => setReassignDistrict(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label className="block font-semibold text-ink mb-1">{t('New Upazila', 'নতুন উপজেলা')}</label>
                <input value={reassignUpazila} onChange={(e) => setReassignUpazila(e.target.value)} className={inputClass} required />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <Button size="sm" type="button" onClick={() => setReassignTarget(null)}>{t('Cancel', 'বাতিল')}</Button>
                <Button size="sm" variant="primary" type="submit">{t('Confirm Reassignment', 'নিশ্চিত করুন')}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TaxPolicyForm({ policy, onSaved }: { policy: TaxSlabPolicy; onSaved: (p: TaxSlabPolicy) => void }) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(policy);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateTaxPolicy(draft);
      onSaved(updated);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel label={t('National LD Tax Slab Configuration', 'জাতীয় ভূমি উন্নয়ন কর নির্ধারণ')} meta={t('Rate per decimal per year (BDT)', 'বার্ষিক শতক প্রতি হার (টাকা)')}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('Residential', 'আবাসিক')} value={draft.ratePerDecimal.residential} onChange={(v) => setDraft((d) => ({ ...d, ratePerDecimal: { ...d.ratePerDecimal, residential: v } }))} />
          <Field label={t('Commercial', 'বাণিজ্যিক')} value={draft.ratePerDecimal.commercial} onChange={(v) => setDraft((d) => ({ ...d, ratePerDecimal: { ...d.ratePerDecimal, commercial: v } }))} />
          <Field label={t('Agricultural', 'কৃষি')} value={draft.ratePerDecimal.agricultural} onChange={(v) => setDraft((d) => ({ ...d, ratePerDecimal: { ...d.ratePerDecimal, agricultural: v } }))} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Late Payment Surcharge Multiplier', 'বিলম্ব জরিমানা গুণক')} step="0.01" value={draft.lateSurchargeMultiplier} onChange={(v) => setDraft((d) => ({ ...d, lateSurchargeMultiplier: v }))} />
          <Field label={t('Agricultural Waiver Threshold (Bigha)', 'কৃষি মওকুফ সীমা (বিঘা)')} value={draft.agriculturalWaiverUnderBigha} onChange={(v) => setDraft((d) => ({ ...d, agriculturalWaiverUnderBigha: v }))} />
        </div>
        <p className="text-xs text-ink-2 border-l-2 border-indigo pl-3">
          {t(
            'Agricultural holdings under the threshold above are exempt from LD Tax under the Land Development Tax Ordinance 1976.',
            'উপরোক্ত সীমার নিচে কৃষি জোতের ক্ষেত্রে ভূমি উন্নয়ন কর অধ্যাদেশ ১৯৭৬ অনুযায়ী কর মওকুফযোগ্য।'
          )}
        </p>
        <div className="flex items-center gap-3 border-t border-line pt-4">
          <Button variant="primary" onClick={save} disabled={saving}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> {saving ? t('Saving...', 'সংরক্ষণ হচ্ছে...') : t('Save Policy', 'নীতি সংরক্ষণ করুন')}
          </Button>
          {saved && <StatusMark tone="state"><CheckCircle2 className="h-3 w-3" /> {t('Policy updated', 'নীতি হালনাগাদ হয়েছে')}</StatusMark>}
        </div>
      </div>
    </Panel>
  );
}

function Field({ label, value, onChange, step = '0.1' }: { label: string; value: number; onChange: (v: number) => void; step?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs text-ink-2">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputClass}
      />
    </label>
  );
}
