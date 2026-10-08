import {
  demoParcels,
  findDemoParcel,
  getDemoDueDiligenceReport,
  toggleDemoParcelLock,
  demoSmsAlerts,
  demoOfficers,
  demoTaxPolicy,
  updateDemoTaxPolicy,
  computeDemoAdminMetrics,
  computeDemoAuditTrail,
} from './demoData';
import type {
  AdminMetrics,
  AdminOfficer,
  AuditTrailEntry,
  Complaint,
  Discrepancy,
  DueDiligenceReport,
  FaraezInput,
  FaraezShare,
  LandUnits,
  Mutation,
  MutationStatus,
  Parcel,
  Session,
  SmsAlert,
  TaxRecord,
  TaxSlabPolicy,
  DeedVerificationParams,
  DeedVerificationResult,
  DeedPreset,
  LitigationCase,
  ParcelValuation,
  EscrowContract,
  EscrowStage,
  EscrowTimelineEvent,
  KhasRecord,
  EncroachmentCheckResult,
  BenchmarkPeg,
  CoSharerStatement,
  SurveyStatus,
  SurveyRecord,
  CadastralEpoch,
  EpochComparisonResult,
  EvidenceModality,
  EvidenceActor,
  EvidencePayload,
  EvidenceBlock,
  BlockValidationResult,
  ChainVerificationReport,
  CourtDossier,
  LandGuardVerdict,
  LandGuardPillarEvaluation,
  LandGuardAuditResult,
  LandGuardDossier,
  InterAgencyDashboardState,
  RegistryLockRecord,
  CibInquiryResult,
  CibLienRecord,
  NonEncumbranceCertificate,
} from './types';

export type DataSource = 'live' | 'demo';

let source: DataSource = 'demo';
export const getSource = () => source;

const listeners = new Set<(s: DataSource) => void>();
export function onSourceChange(fn: (s: DataSource) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setSource(next: DataSource) {
  if (next === source) return;
  source = next;
  listeners.forEach((fn) => fn(next));
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);
  try {
    const res = await fetch(path, {
      ...init,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) throw new Error(body?.error || `${res.status}`);
    setSource('live');
    return body.data as T;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------------- parcels */

export async function listParcels(query?: string): Promise<Parcel[]> {
  try {
    const url = query ? `/api/parcels?q=${encodeURIComponent(query)}` : '/api/parcels';
    return await req<Parcel[]>(url);
  } catch {
    setSource('demo');
    if (!query) return demoParcels;
    const q = query.toLowerCase().trim();
    return demoParcels.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.khatianNo.toLowerCase().includes(q) ||
        p.dagNo.toLowerCase().includes(q) ||
        p.holdingNo.toLowerCase().includes(q) ||
        p.currentOwner.toLowerCase().includes(q) ||
        p.mouza.toLowerCase().includes(q)
    );
  }
}

export async function getParcel(id: string): Promise<Parcel | null> {
  try {
    return await req<Parcel>(`/api/parcels/${encodeURIComponent(id)}`);
  } catch {
    setSource('demo');
    return findDemoParcel(id) ?? null;
  }
}

/* ------------------------------------------------------------------- tax */

export async function payTax(input: {
  parcelId: string;
  fiscalYear: string;
  amount: number;
  paymentMethod: string;
}): Promise<{ taxRecord: TaxRecord }> {
  const trxId = `${input.paymentMethod.toUpperCase().replace(/\s+/g, '')}_${Math.floor(
    10_000_000 + Math.random() * 90_000_000
  )}`;
  try {
    return await req<{ taxRecord: TaxRecord }>('/api/payments/pay-tax', {
      method: 'POST',
      body: JSON.stringify({ ...input, trxId }),
    });
  } catch {
    setSource('demo');
    const parcel = findDemoParcel(input.parcelId);
    const record = parcel?.taxRecords?.find((t) => t.fiscalYear === input.fiscalYear);
    const dakhilaNumber = `DAK-${new Date().getFullYear()}-${Math.floor(100_000 + Math.random() * 900_000)}`;
    const taxRecord: TaxRecord = {
      ...(record ?? {
        id: 'demo',
        fiscalYear: input.fiscalYear,
        annualDemandBDT: input.amount,
        arrearAmountBDT: 0,
        totalDueBDT: input.amount,
      }),
      paidAmountBDT: input.amount,
      status: 'VERIFIED',
      trxId,
      paymentMethod: input.paymentMethod,
      dakhilaNumber,
      qrCodeUrl: `https://land.gov.bd/verify/dakhila/${dakhilaNumber}`,
      paymentDate: new Date().toISOString(),
    } as TaxRecord;
    if (record) Object.assign(record, taxRecord);
    return { taxRecord };
  }
}

/* -------------------------------------------------------------- mutation */

export async function fileMutation(input: {
  parcelId: string;
  applicantName: string;
  applicantNid: string;
  applicantPhone: string;
  proposedOwner: string;
}): Promise<{ mutation: Mutation }> {
  try {
    return await req<{ mutation: Mutation }>('/api/mutations', {
      method: 'POST',
      body: JSON.stringify({ ...input, dcrAmount: 1150 }),
    });
  } catch {
    setSource('demo');
    const mutation: Mutation = {
      id: `demo-${Date.now()}`,
      caseNumber: `MUT-${new Date().getFullYear()}-DH-${Math.floor(1000 + Math.random() * 9000)}`,
      applicantName: input.applicantName,
      applicantNid: input.applicantNid,
      applicantPhone: input.applicantPhone,
      proposedOwner: input.proposedOwner,
      status: 'SUBMITTED',
      currentStage: 'Stage 1: Application Received & Assigned to ULAO',
      hearingDate: null,
      dcrAmount: 1150,
      remarks: 'Filed online.',
      createdAt: new Date().toISOString(),
    };
    const parcel = findDemoParcel(input.parcelId);
    parcel?.mutations?.unshift(mutation);
    return { mutation };
  }
}

/** Officer action: advance mutation stage or approve */
export async function advanceMutation(
  mutationId: string,
  parcelId: string,
  data?: { action?: 'REJECT'; officerNote?: string; customStatus?: MutationStatus }
): Promise<{ mutation: Mutation }> {
  try {
    return await req<{ mutation: Mutation }>(`/api/mutations/${mutationId}/advance`, {
      method: 'PATCH',
      body: JSON.stringify(data ?? {}),
    });
  } catch {
    setSource('demo');
    const parcel = findDemoParcel(parcelId);
    const m = parcel?.mutations?.find((item) => item.id === mutationId);
    if (m) {
      if (data?.action === 'REJECT') {
        m.status = 'REJECTED';
        m.currentStage = 'Rejected by AC (Land) following judicial review.';
      } else if (m.status === 'SUBMITTED') {
        m.status = 'KANUNGO_VERIFICATION';
        m.currentStage = 'Stage 2: Kanungo Field Survey in Progress';
      } else if (m.status === 'KANUNGO_VERIFICATION') {
        m.status = 'AC_LAND_HEARING';
        m.currentStage = 'Stage 3: Spot Survey Verified. AC Land Hearing Scheduled';
        m.hearingDate = new Date(Date.now() + 7 * 86_400_000).toISOString();
      } else if (m.status === 'AC_LAND_HEARING') {
        m.status = 'DCR_PAYMENT_PENDING';
        m.currentStage = 'Stage 4: Hearing Completed. DCR Fee Due';
      } else if (m.status === 'DCR_PAYMENT_PENDING') {
        m.status = 'APPROVED';
        m.currentStage = 'Completed — new খতিয়ান issued';
        parcel!.currentOwner = m.proposedOwner;
      }
      if (data?.officerNote) {
        m.remarks = `${m.remarks || ''} [Officer: ${data.officerNote}]`.trim();
      }
    }
    return { mutation: m! };
  }
}

/* ---------------------------------------------------------- reconciliation */

export interface AuditCheck {
  name: string;
  status: 'PASS' | 'FLAGGED';
  detail: string;
}

export async function runReconciliation(parcelId: string): Promise<{ checks: AuditCheck[] }> {
  try {
    return await req<{ checks: AuditCheck[] }>('/api/reconciliation/run', {
      method: 'POST',
      body: JSON.stringify({ parcelId }),
    });
  } catch {
    setSource('demo');
    await new Promise((r) => setTimeout(r, 600));
    const parcel = findDemoParcel(parcelId);
    const flagged = (parcel?.discrepancies?.filter((d) => !d.isResolved) ?? []).length > 0;
    return {
      checks: [
        { name: 'Khatian Title Chain', status: 'PASS', detail: 'RS to BS records agree. Title chain intact.' },
        { name: 'Dag & Holding Alignment', status: 'PASS', detail: `Plot Dag matches the upazila holding register.` },
        {
          name: 'Boundary Spatial Envelope',
          status: flagged ? 'FLAGGED' : 'PASS',
          detail: flagged
            ? 'Difference between recorded and mapped area flagged for reconciliation.'
            : 'Vector boundary matches the digitised BDS survey sheet.',
        },
        { name: 'Payment & Arrears Balance', status: 'PASS', detail: 'No unexplained arrears across fiscal years.' },
      ],
    };
  }
}

/** Officer action: resolve discrepancy flag */
export async function resolveFlag(
  flagId: string,
  parcelId: string,
  note?: string
): Promise<{ discrepancy: Discrepancy }> {
  try {
    return await req<{ discrepancy: Discrepancy }>(`/api/reconciliation/flags/${flagId}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ resolutionNote: note }),
    });
  } catch {
    setSource('demo');
    const parcel = findDemoParcel(parcelId);
    const d = parcel?.discrepancies?.find((item) => item.id === flagId);
    if (d) {
      d.isResolved = true;
      d.flaggedBy = `Resolved by AC (Land)`;
    }
    return { discrepancy: d! };
  }
}

/* ------------------------------------------------------------- complaints */

export async function submitComplaint(input: {
  parcelId: string;
  complainant: string;
  phone: string;
  category: string;
  description: string;
  assignedOffice?: string;
}): Promise<{ complaint: Complaint }> {
  try {
    return await req<{ complaint: Complaint }>('/api/complaints', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch {
    setSource('demo');
    const trackingNo = `CMP-SAV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const complaint: Complaint = {
      id: `cmp-${Date.now()}`,
      trackingNo,
      parcelId: input.parcelId,
      complainant: input.complainant,
      phone: input.phone,
      category: input.category,
      description: input.description,
      assignedOffice: input.assignedOffice || 'Upazila Land Office, Savar',
      status: 'ROUTED',
      createdAt: new Date().toISOString(),
    };
    const parcel = findDemoParcel(input.parcelId);
    if (!parcel?.complaints) parcel!.complaints = [];
    parcel!.complaints.unshift(complaint);
    return { complaint };
  }
}

/* ------------------------------------------------------------- land tools */

export async function convertLandUnits(
  value: number,
  fromUnit: 'decimal' | 'katha' | 'bigha' | 'acre' | 'sqft' | 'sqm'
): Promise<LandUnits> {
  try {
    const res = await req<{ result: LandUnits }>('/api/tools/convert-units', {
      method: 'POST',
      body: JSON.stringify({ value, fromUnit }),
    });
    return res.result;
  } catch {
    setSource('demo');
    let dec = 0;
    switch (fromUnit) {
      case 'decimal':
        dec = value;
        break;
      case 'katha':
        dec = value * 1.65;
        break;
      case 'bigha':
        dec = value * 33.0;
        break;
      case 'acre':
        dec = value * 100.0;
        break;
      case 'sqft':
        dec = value / 435.6;
        break;
      case 'sqm':
        dec = value / 40.4686;
        break;
    }
    return {
      decimal: Number(dec.toFixed(4)),
      katha: Number((dec / 1.65).toFixed(4)),
      bigha: Number((dec / 33.0).toFixed(4)),
      acre: Number((dec / 100.0).toFixed(4)),
      squareFeet: Number((dec * 435.6).toFixed(2)),
      squareMetres: Number((dec * 40.4686).toFixed(2)),
    };
  }
}

export async function calculateFaraez(input: FaraezInput): Promise<{ shares: FaraezShare[]; totalDistributed: number }> {
  try {
    return await req<{ shares: FaraezShare[]; totalDistributed: number }>('/api/tools/faraez', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch {
    setSource('demo');
    const { totalDecimal, sons, daughters, wife, husband, father, mother } = input;
    const hasChildren = sons > 0 || daughters > 0;
    const shares: FaraezShare[] = [];
    let remaining = totalDecimal;

    if (wife > 0 && husband === 0) {
      const shareVal = hasChildren ? totalDecimal * (1 / 8) : totalDecimal * (1 / 4);
      shares.push({
        relation: 'Wife',
        relationBn: 'স্ত্রী',
        count: wife,
        fraction: hasChildren ? '1/8' : '1/4',
        totalDecimal: Number(shareVal.toFixed(4)),
        perPersonDecimal: Number((shareVal / wife).toFixed(4)),
        percentage: Number(((shareVal / totalDecimal) * 100).toFixed(2)),
      });
      remaining -= shareVal;
    } else if (husband > 0 && wife === 0) {
      const shareVal = hasChildren ? totalDecimal * (1 / 4) : totalDecimal * (1 / 2);
      shares.push({
        relation: 'Husband',
        relationBn: 'স্বামী',
        count: 1,
        fraction: hasChildren ? '1/4' : '1/2',
        totalDecimal: Number(shareVal.toFixed(4)),
        perPersonDecimal: Number(shareVal.toFixed(4)),
        percentage: Number(((shareVal / totalDecimal) * 100).toFixed(2)),
      });
      remaining -= shareVal;
    }

    if (father > 0 && hasChildren) {
      const shareVal = totalDecimal * (1 / 6);
      shares.push({
        relation: 'Father',
        relationBn: 'পিতা',
        count: 1,
        fraction: '1/6',
        totalDecimal: Number(shareVal.toFixed(4)),
        perPersonDecimal: Number(shareVal.toFixed(4)),
        percentage: Number(((shareVal / totalDecimal) * 100).toFixed(2)),
      });
      remaining -= shareVal;
    }

    if (mother > 0) {
      const shareVal = hasChildren ? totalDecimal * (1 / 6) : totalDecimal * (1 / 3);
      shares.push({
        relation: 'Mother',
        relationBn: 'মাতা',
        count: 1,
        fraction: hasChildren ? '1/6' : '1/3',
        totalDecimal: Number(shareVal.toFixed(4)),
        perPersonDecimal: Number(shareVal.toFixed(4)),
        percentage: Number(((shareVal / totalDecimal) * 100).toFixed(2)),
      });
      remaining -= shareVal;
    }

    if (hasChildren && remaining > 0) {
      const totalUnits = sons * 2 + daughters * 1;
      const unitValue = remaining / totalUnits;
      if (sons > 0) {
        shares.push({
          relation: 'Sons',
          relationBn: 'পুত্র',
          count: sons,
          fraction: `${sons * 2}/${totalUnits} of residue`,
          totalDecimal: Number((unitValue * 2 * sons).toFixed(4)),
          perPersonDecimal: Number((unitValue * 2).toFixed(4)),
          percentage: Number((((unitValue * 2 * sons) / totalDecimal) * 100).toFixed(2)),
        });
      }
      if (daughters > 0) {
        shares.push({
          relation: 'Daughters',
          relationBn: 'কন্যা',
          count: daughters,
          fraction: `${daughters}/${totalUnits} of residue`,
          totalDecimal: Number((unitValue * daughters).toFixed(4)),
          perPersonDecimal: Number(unitValue.toFixed(4)),
          percentage: Number((((unitValue * daughters) / totalDecimal) * 100).toFixed(2)),
        });
      }
    }

    const totalDistributed = shares.reduce((acc, s) => acc + s.totalDecimal, 0);
    return { shares, totalDistributed: Number(totalDistributed.toFixed(4)) };
  }
}

/* ---------------------------------------------------------------- session */

const SESSION_KEY = 'bhumi.session';

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function writeSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked */
  }
}

/* ---------------------------------------------------------------- due diligence & title */

export async function getDueDiligence(parcelId: string): Promise<DueDiligenceReport> {
  try {
    return await req<DueDiligenceReport>(`/api/parcels/${encodeURIComponent(parcelId)}/due-diligence`);
  } catch {
    setSource('demo');
    const p = findDemoParcel(parcelId) ?? demoParcels[0];
    return getDemoDueDiligenceReport(p);
  }
}

/* ---------------------------------------------------------------- land lock & fraud radar */

export async function toggleParcelLock(parcelId: string, otp: string): Promise<{ success: boolean; isLocked: boolean }> {
  try {
    return await req<{ success: boolean; isLocked: boolean }>(`/api/parcels/${encodeURIComponent(parcelId)}/lock`, {
      method: 'POST',
      body: JSON.stringify({ otp }),
    });
  } catch {
    setSource('demo');
    toggleDemoParcelLock(parcelId, otp);
    const p = findDemoParcel(parcelId);
    return { success: true, isLocked: !!p?.isLocked };
  }
}

export async function listSmsAlerts(): Promise<SmsAlert[]> {
  try {
    return await req<SmsAlert[]>('/api/alerts/sms');
  } catch {
    return [...demoSmsAlerts];
  }
}

export async function sendSimulatedSms(alert: Partial<SmsAlert>): Promise<SmsAlert> {
  const newAlert: SmsAlert = {
    id: `sms-${Date.now()}`,
    recipientPhone: alert.recipientPhone || '+880 1711-223344',
    senderId: 'BHUMISHEBA',
    messageText: alert.messageText || 'ভূমি সেবা নোটিফিকেশন',
    timestamp: new Date().toISOString(),
    status: 'DELIVERED',
    type: alert.type || 'MUTATION_ACTIVITY',
  };
  demoSmsAlerts.unshift(newAlert);
  return newAlert;
}

/* ----------------------------------------------------- super admin / national */

export async function getAdminMetrics(): Promise<AdminMetrics> {
  try {
    return await req<AdminMetrics>('/api/admin/metrics');
  } catch {
    setSource('demo');
    return computeDemoAdminMetrics(demoParcels);
  }
}

export async function getAdminOfficers(): Promise<AdminOfficer[]> {
  try {
    return await req<AdminOfficer[]>('/api/admin/officers');
  } catch {
    setSource('demo');
    return demoOfficers;
  }
}

export async function reassignOfficer(officerId: string, district: string, upazila: string): Promise<{ officer: AdminOfficer }> {
  try {
    return await req<{ officer: AdminOfficer }>('/api/admin/reassign-officer', {
      method: 'POST',
      body: JSON.stringify({ officerId, district, upazila }),
    });
  } catch {
    setSource('demo');
    const officer = demoOfficers.find((o) => o.id === officerId);
    if (officer) {
      officer.upazila = upazila;
      if (district) officer.district = district;
    }
    return { officer: officer! };
  }
}

export async function setOfficerStatus(officerId: string, status: AdminOfficer['status']): Promise<{ officer: AdminOfficer }> {
  try {
    return await req<{ officer: AdminOfficer }>(`/api/admin/officers/${officerId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  } catch {
    setSource('demo');
    const officer = demoOfficers.find((o) => o.id === officerId);
    if (officer) officer.status = status;
    return { officer: officer! };
  }
}

export async function getAdminAuditTrail(): Promise<AuditTrailEntry[]> {
  try {
    return await req<AuditTrailEntry[]>('/api/admin/audit-trail');
  } catch {
    setSource('demo');
    return computeDemoAuditTrail(demoParcels);
  }
}

export async function getTaxPolicy(): Promise<TaxSlabPolicy> {
  try {
    return await req<TaxSlabPolicy>('/api/admin/tax-policy');
  } catch {
    setSource('demo');
    return demoTaxPolicy;
  }
}

export async function updateTaxPolicy(patch: Partial<TaxSlabPolicy>): Promise<TaxSlabPolicy> {
  try {
    return await req<TaxSlabPolicy>('/api/admin/tax-policy', { method: 'PUT', body: JSON.stringify(patch) });
  } catch {
    setSource('demo');
    return updateDemoTaxPolicy(patch);
  }
}

// --- Phase 2: Deed Forensics & Valuation Endpoints ---

export async function getDeedPresets(): Promise<DeedPreset[]> {
  try {
    return await req<DeedPreset[]>('/api/deed-verifier/presets');
  } catch {
    setSource('demo');
    return [
      {
        id: 'preset-clean',
        titleEn: 'Authentic Conveyance Deed',
        titleBn: 'সম্পূর্ণ বৈধ ও ত্রুটিমুক্ত সাফ-কবলা হস্তান্তর',
        descriptionEn: 'Area matches Khatian, living vendor verified, unbroken parent deed lineage, fair price.',
        descriptionBn: 'জমির পরিমাণ খতিয়ানের সাথে সম্পূর্ণ মিল, বিক্রেতা জীবিত, বায়া দলিল যাচাইকৃত এবং সরকারি রেট সম্বলিত।',
        expectedVerdict: 'AUTHENTIC_VERIFIED',
        params: {
          deedNumber: 'DALIL-2026-9042',
          parcelId: 'BD-DHK-SAV-000001',
          sellerNid: '19852692011000123',
          sellerName: 'Kamal Hossain',
          declaredAreaDecimal: 5.5,
          declaredPriceBdt: 4800000,
          parentDeedNumber: '1998-SAV-4521',
          subRegistryOffice: 'Savar Sub-Registry, Dhaka',
        },
      },
      {
        id: 'preset-inflation',
        titleEn: 'Area Inflation Forgery',
        titleBn: 'অতিরিক্ত জমি দাবি জালিয়াতি',
        descriptionEn: 'Deed declares 12.0 decimals, but registered Khatian only contains 5.5 decimals (118% inflation).',
        descriptionBn: 'খতিয়ানে জমি ৫.৫ শতাংশ হলেও দলিলে ১২.০ শতাংশ হস্তান্তর দাবি করা হয়েছে।',
        expectedVerdict: 'SUSPECTED_FRAUD_LOCKED',
        params: {
          deedNumber: 'DALIL-2026-8812',
          parcelId: 'BD-DHK-SAV-000001',
          sellerNid: '19852692011000123',
          sellerName: 'Kamal Hossain',
          declaredAreaDecimal: 12.0,
          declaredPriceBdt: 9600000,
          parentDeedNumber: '1998-SAV-4521',
          subRegistryOffice: 'Savar Sub-Registry, Dhaka',
        },
      },
      {
        id: 'preset-deceased',
        titleEn: 'Deceased Seller Impersonation',
        titleBn: 'মৃত ব্যক্তির ভুয়া পরিচয়ে দলিল তৈরি',
        descriptionEn: 'Vendor NID flagged in national vital records as deceased. Mortis causa forgery attempt.',
        descriptionBn: 'বিক্রেতার এনআইডি জাতীয় মৃত্যু সনদের সাথে মিলে গেছে। জালিয়াতিপূর্বক নামজারি অপচেষ্টা।',
        expectedVerdict: 'SUSPECTED_FRAUD_LOCKED',
        params: {
          deedNumber: 'DALIL-2026-0041',
          parcelId: 'BD-DHK-SAV-000002',
          sellerNid: '19502692011000999',
          sellerName: 'Late Mofizur Rahman',
          declaredAreaDecimal: 4.0,
          declaredPriceBdt: 3200000,
          parentDeedNumber: '1975-SAV-1002',
          subRegistryOffice: 'Savar Sub-Registry, Dhaka',
        },
      },
      {
        id: 'preset-injunction',
        titleEn: 'Civil Court Stay Order Violation',
        titleBn: 'আদালতের নিষেধাজ্ঞা অমান্য করে বিক্রির চেষ্টা',
        descriptionEn: 'Parcel subject to temporary injunction under CPC Order 39 Rules 1-2. Transfer prohibited.',
        descriptionBn: 'আদালতের নিষেধাজ্ঞা বলবৎ থাকা সত্ত্বেও দলিল রেজিস্ট্রি ও হস্তান্তরের অপচেষ্টা।',
        expectedVerdict: 'SUSPECTED_FRAUD_LOCKED',
        params: {
          deedNumber: 'DALIL-2026-6631',
          parcelId: 'BD-DHK-SAV-000003',
          sellerNid: '19852692011000123',
          sellerName: 'Kamal Hossain',
          declaredAreaDecimal: 8.0,
          declaredPriceBdt: 7000000,
          parentDeedNumber: '2001-SAV-8891',
          subRegistryOffice: 'Savar Sub-Registry, Dhaka',
        },
      },
    ];
  }
}

export async function verifyDeed(params: DeedVerificationParams): Promise<DeedVerificationResult> {
  try {
    return await req<DeedVerificationResult>('/api/deed-verifier/verify', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  } catch {
    setSource('demo');
    const isClean = params.declaredAreaDecimal <= 5.5 && params.sellerNid !== '19502692011000999';
    return {
      deedNumber: params.deedNumber || 'DALIL-2026-DEMO',
      parcelId: params.parcelId,
      overallScore: isClean ? 0 : 75,
      verdict: isClean ? 'AUTHENTIC_VERIFIED' : 'SUSPECTED_FRAUD_LOCKED',
      verdictBn: isClean
        ? 'স্বত্ব যাচাইকৃত ও লেনদেন নিরাপদ (Authentic Verified)'
        : 'জালিয়াতির প্রবল আশঙ্কা / স্বত্ব স্থগিত (Suspected Fraud Locked)',
      checks: [
        {
          id: 'chk-area-integrity',
          category: 'AREA_INTEGRITY',
          titleEn: 'Cadastral Area Congruence',
          titleBn: 'খতিয়ানের সাথে জমির পরিমাণের সামঞ্জস্যতা',
          status: isClean ? 'PASS' : 'FAIL',
          penaltyScore: isClean ? 0 : 45,
          findingEn: isClean ? 'Declared area strictly aligns with registered Khatian extent.' : 'Declared area exceeds registered Khatian extent.',
          findingBn: isClean ? 'ঘোষিত জমির পরিমাণ খতিয়ানের মোট পরিমাণের সাথে সামঞ্জস্যপূর্ণ।' : 'দলিলে ঘোষিত জমির পরিমাণ খতিয়ানের হিস্যা অতিক্রম করেছে।',
          statutoryRef: 'State Acquisition and Tenancy Act 1950, Section 89',
        },
      ],
      areaInflationPercentage: isClean ? 0 : 118,
      valuationDisparityPercentage: 0,
      verifiedAt: new Date().toISOString(),
      statutorySummaryEn: isClean
        ? 'PRIMA FACIE CLEAN TITLE: Deed parameters satisfy the 6-point statutory due diligence criteria.'
        : 'CRITICAL DEFECTS DETECTED: This deed conveyance violates Section 52A of the Registration Act 1908.',
      statutorySummaryBn: isClean
        ? 'নিরাপদ স্বত্ব: দলিলটির যাবতীয় তথ্য জাতীয় ভূমি রেকর্ড ও রেজিস্ট্রেশন আইনানুযায়ী সম্পূর্ণ নির্ভুল ও নির্ভরযোগ্য।'
        : 'মারাত্মক ত্রুটি শনাক্ত: প্রস্তাবিত হস্তান্তরটি রেজিস্ট্রেশন আইন ১৯০৮ এর ৫২ক ধারা লঙ্ঘন করে।',
    };
  }
}

// --- Phase 2: Civil Court Litigation Endpoints ---

export async function getParcelLitigation(parcelId: string): Promise<LitigationCase[]> {
  try {
    const res = await req<any>(`/api/parcels/${encodeURIComponent(parcelId)}/litigation`);
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.cases)) return res.cases;
    return [];
  } catch {
    setSource('demo');
    if (parcelId.toLowerCase() === 'bd-dhk-sav-000003'.toLowerCase()) {
      return [
        {
          id: 'lit-001',
          parcelId: 'BD-DHK-SAV-000003',
          caseNumber: 'TS-142/2025',
          courtName: 'Senior Assistant Judge Court, Savar, Dhaka',
          suitType: 'TEMPORARY_INJUNCTION',
          suitTypeBn: 'অস্থায়ী নিষেধাজ্ঞা ও স্বত্ব মোকদ্দমা',
          claimant: 'Alhaj Mokhlesur Rahman',
          defendant: 'Rafiqul Islam & Others',
          filedDate: '2025-01-14',
          stayOrderActive: true,
          stayOrderDate: '2025-02-01',
          nextHearingDate: '2026-10-15',
          status: 'ACTIVE_STAY',
          orderSummary: 'Temporary injunction issued under Order 39 Rules 1-2 of CPC restraining defendant from alienating or transferring Dag #482.',
          orderSummaryBn: 'দেওয়ানি কার্যবিধির ৩৯ আদেশের ১-২ নিয়মমতে বিবাদীদের বিরুদ্ধে উক্ত দাগের জমি বিক্রয় বা হস্তান্তরে নিষেধাজ্ঞা বলবৎ।',
          statutorySection: 'Code of Civil Procedure 1908 (Order 39 Rules 1-2) & Section 52 Transfer of Property Act 1882',
        },
      ];
    }
    if (parcelId.toLowerCase() === 'bd-dhk-sav-000007'.toLowerCase()) {
      return [
        {
          id: 'lit-002',
          parcelId: 'BD-DHK-SAV-000007',
          caseNumber: 'PS-89/2024',
          courtName: 'Joint District Judge 2nd Court, Dhaka',
          suitType: 'PARTITION_SUIT',
          suitTypeBn: 'বাটোয়ারা / বণ্টন মোকদ্দমা',
          claimant: 'Shahana Begum',
          defendant: 'Kamal Hossain',
          filedDate: '2024-08-20',
          stayOrderActive: false,
          nextHearingDate: '2026-11-05',
          status: 'PENDING_HEARING',
          orderSummary: 'Partition suit pending preliminary decree for 2.25 decimal co-sharer allotment.',
          orderSummaryBn: 'উত্তরাধিকারীদের মধ্যে হিস্যা নির্ধারণকল্পে বাটোয়ারা মোকদ্দমা চলমান।',
          statutorySection: 'Partition Act 1893, Section 4',
        },
      ];
    }
    return [];
  }
}

export async function addParcelLitigation(entry: Omit<LitigationCase, 'id'>): Promise<LitigationCase> {
  try {
    return await req<LitigationCase>(`/api/parcels/${encodeURIComponent(entry.parcelId)}/litigation`, {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  } catch {
    setSource('demo');
    return {
      id: `lit-${Date.now()}`,
      ...entry,
    };
  }
}

export async function getParcelValuation(parcelId: string): Promise<ParcelValuation> {
  try {
    return await req<ParcelValuation>(`/api/parcels/${encodeURIComponent(parcelId)}/valuation`);
  } catch {
    setSource('demo');
    return {
      parcelId,
      mouza: 'Savar Mouza (মৌজা: সাভার)',
      areaDecimal: 5.5,
      statutoryBenchmarkPerDecimal: 450000,
      statutoryMinimumTotalBdt: 2475000,
      fairMarketPerDecimal: 850000,
      fairMarketTotalBdt: 4675000,
      stampDutyRatePercent: 8.5,
      estimatedRegistrationCostBdt: 210375,
      gazetteRef: 'Gazette S.R.O. No. 284-Ain/2012 / Savar Sub-Registry Valuation Schedule',
    };
  }
}

// --- Phase 3: Zero-Trust Escrow Pipeline Endpoints ---

const demoEscrowContracts: EscrowContract[] = [
  {
    id: 'ESCROW-2026-0081',
    parcelId: 'BD-DHK-SAV-000001',
    mouza: 'Savar Mouza (সাভার মৌজা)',
    areaDecimal: 5.5,
    buyerNid: '19922692019900011',
    buyerName: 'Tanvir Ahmed',
    buyerPhone: '01819-876543',
    sellerNid: '19852692011000123',
    sellerName: 'Kamal Hossain',
    sellerPhone: '01711-223344',
    sellerBankAccount: '1082001928371',
    sellerBankRouting: '090271829',
    totalConsiderationBdt: 4800000,
    earnestDepositBdt: 960000,
    balanceBdt: 3840000,
    depositedAmountBdt: 4800000,
    escrowBankName: 'Sonali Bank PLC (Savar Treasury Branch)',
    escrowVaultAccount: 'SBL-TREASURY-VAULT-2026-778',
    stage: 'ESCROW_DEPOSITED',
    isLocked: true,
    lockTimestamp: '2026-03-01T10:00:00Z',
    stampDutyBdt: 144000,
    localGovTaxBdt: 96000,
    registrationFeeBdt: 48000,
    aitSourceTaxBdt: 192000,
    totalStatutoryFeesBdt: 480000,
    netPayableToSellerBdt: 4320000,
    createdAt: '2026-03-01T09:30:00Z',
    updatedAt: '2026-03-02T14:15:00Z',
    timeline: [
      {
        stage: 'OFFER_PENDING',
        timestamp: '2026-03-01T09:30:00Z',
        descriptionEn: 'Purchase offer initialized for 5.5 decimals at BDT 4,800,000.',
        descriptionBn: '৫.৫ শতাংশ জমির জন্য ৪৮,০০,০০০ টাকায় প্রাথমিক ক্রয় প্রস্তাব দেওয়া হয়েছে।',
        actor: 'Tanvir Ahmed (Buyer)',
      },
      {
        stage: 'LAND_LOCKED',
        timestamp: '2026-03-01T10:00:00Z',
        descriptionEn: 'Automated Land-Lock activated. Secondary transfers frozen.',
        descriptionBn: 'স্বয়ংক্রিয় জমি লক কার্যকর। দ্বিতীয় কোনো হস্তান্তর বা রেজিস্ট্রি বন্ধ।',
        actor: 'Smart Contract Engine',
        referenceNumber: 'LOCK-SAV-2026-904',
      },
      {
        stage: 'ESCROW_DEPOSITED',
        timestamp: '2026-03-02T14:15:00Z',
        descriptionEn: 'Full consideration BDT 4,800,000 deposited in Sonali Bank Treasury Vault.',
        descriptionBn: 'সম্পূর্ণ বিক্রয়মূল্য ৪৮,০০,০০০ টাকা সোনালী ব্যাংক ট্রেজারি ভল্টে জমা হয়েছে।',
        actor: 'Sonali Bank Clearing API',
        referenceNumber: 'TRX-SBL-88291039',
      },
    ],
  },
];

export async function getEscrowContracts(filter?: { parcelId?: string; nid?: string }): Promise<EscrowContract[]> {
  try {
    const params = new URLSearchParams();
    if (filter?.parcelId) params.append('parcelId', filter.parcelId);
    if (filter?.nid) params.append('nid', filter.nid);
    const query = params.toString() ? `?${params.toString()}` : '';
    return await req<EscrowContract[]>(`/api/escrow/contracts${query}`);
  } catch {
    setSource('demo');
    if (!filter) return demoEscrowContracts;
    return demoEscrowContracts.filter((c) => {
      if (filter.parcelId && c.parcelId.toLowerCase() !== filter.parcelId.toLowerCase()) return false;
      if (filter.nid && c.buyerNid !== filter.nid && c.sellerNid !== filter.nid) return false;
      return true;
    });
  }
}

export async function getEscrowContract(id: string): Promise<EscrowContract> {
  try {
    return await req<EscrowContract>(`/api/escrow/contracts/${encodeURIComponent(id)}`);
  } catch {
    setSource('demo');
    const found = demoEscrowContracts.find((c) => c.id === id);
    if (!found) throw new Error(`Escrow contract ${id} not found.`);
    return found;
  }
}

export async function createEscrowContract(input: {
  parcelId: string;
  mouza?: string;
  areaDecimal?: number;
  buyerNid: string;
  buyerName: string;
  buyerPhone?: string;
  sellerNid: string;
  sellerName: string;
  sellerPhone?: string;
  sellerBankAccount?: string;
  sellerBankRouting?: string;
  totalConsiderationBdt: number;
  earnestDepositBdt?: number;
  escrowBankName?: string;
}): Promise<EscrowContract> {
  try {
    return await req<EscrowContract>('/api/escrow/contracts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch {
    setSource('demo');
    const total = Number(input.totalConsiderationBdt);
    const earnest = input.earnestDepositBdt ? Number(input.earnestDepositBdt) : Math.round(total * 0.2);
    const stamp = Math.round(total * 0.03);
    const local = Math.round(total * 0.02);
    const reg = Math.round(total * 0.01);
    const ait = Math.round(total * 0.04);
    const totalTax = stamp + local + reg + ait;

    const contract: EscrowContract = {
      id: `ESCROW-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      parcelId: input.parcelId,
      mouza: input.mouza || 'Savar Mouza',
      areaDecimal: input.areaDecimal || 5.5,
      buyerNid: input.buyerNid,
      buyerName: input.buyerName,
      buyerPhone: input.buyerPhone || '01819-000000',
      sellerNid: input.sellerNid,
      sellerName: input.sellerName,
      sellerPhone: input.sellerPhone || '01711-000000',
      sellerBankAccount: input.sellerBankAccount || '1082001928371',
      sellerBankRouting: input.sellerBankRouting || '090271829',
      totalConsiderationBdt: total,
      earnestDepositBdt: earnest,
      balanceBdt: total - earnest,
      depositedAmountBdt: 0,
      escrowBankName: input.escrowBankName || 'Sonali Bank PLC (Treasury Settlement Vault)',
      escrowVaultAccount: `SBL-VAULT-2026-${Math.floor(100 + Math.random() * 900)}`,
      stage: 'LAND_LOCKED',
      isLocked: true,
      lockTimestamp: new Date().toISOString(),
      stampDutyBdt: stamp,
      localGovTaxBdt: local,
      registrationFeeBdt: reg,
      aitSourceTaxBdt: ait,
      totalStatutoryFeesBdt: totalTax,
      netPayableToSellerBdt: total - totalTax,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [
        {
          stage: 'OFFER_PENDING',
          timestamp: new Date().toISOString(),
          descriptionEn: `Purchase offer initialized for BDT ${total.toLocaleString('en-IN')}.`,
          descriptionBn: `মোট ${total.toLocaleString('bn-BD')} টাকার ক্রয় প্রস্তাব নথিভুক্ত।`,
          actor: `${input.buyerName} (Buyer)`,
        },
        {
          stage: 'LAND_LOCKED',
          timestamp: new Date().toISOString(),
          descriptionEn: 'Automated Land-Lock activated on digital land register.',
          descriptionBn: 'ডিজিটাল খতিয়ান রেজিস্ট্রারে জমি লক কার্যকর হয়েছে।',
          actor: 'Smart Contract Engine',
        },
      ],
    };
    demoEscrowContracts.unshift(contract);
    return contract;
  }
}

export async function depositEscrowFunds(id: string, amountBdt: number, trxId?: string): Promise<EscrowContract> {
  try {
    return await req<EscrowContract>(`/api/escrow/contracts/${encodeURIComponent(id)}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amountBdt, trxId }),
    });
  } catch {
    setSource('demo');
    const c = demoEscrowContracts.find((item) => item.id === id);
    if (!c) throw new Error('Contract not found');
    c.depositedAmountBdt += amountBdt;
    if (c.depositedAmountBdt >= c.totalConsiderationBdt) {
      c.stage = 'ESCROW_DEPOSITED';
    }
    c.updatedAt = new Date().toISOString();
    c.timeline.push({
      stage: c.stage,
      timestamp: new Date().toISOString(),
      descriptionEn: `Deposit of BDT ${amountBdt.toLocaleString('en-IN')} received in Treasury Vault.`,
      descriptionBn: `ট্রেজারি ভল্টে ${amountBdt.toLocaleString('bn-BD')} টাকা জমা নিশ্চিত হয়েছে।`,
      actor: 'Sonali Bank Clearing API',
      referenceNumber: trxId || `TRX-${Date.now()}`,
    });
    return c;
  }
}

export async function certifyEscrowTitle(id: string, verdict: string = 'AUTHENTIC_VERIFIED', score: number = 0): Promise<EscrowContract> {
  try {
    return await req<EscrowContract>(`/api/escrow/contracts/${encodeURIComponent(id)}/certify-title`, {
      method: 'POST',
      body: JSON.stringify({ verdict, forensicScore: score }),
    });
  } catch {
    setSource('demo');
    const c = demoEscrowContracts.find((item) => item.id === id);
    if (!c) throw new Error('Contract not found');
    c.stage = 'TITLE_AUDITED';
    c.forensicsVerdict = verdict;
    c.updatedAt = new Date().toISOString();
    c.timeline.push({
      stage: 'TITLE_AUDITED',
      timestamp: new Date().toISOString(),
      descriptionEn: `Title forensics certified: ${verdict}. Risk score: ${score}/100.`,
      descriptionBn: `দলিল ও স্বত্ব ফরেনসিক যাচাই সম্পন্ন: ${verdict}।`,
      actor: 'Automated Deed & Title Engine',
    });
    return c;
  }
}

export async function executeEscrowDeed(id: string, deedNumber: string, volumeNumber?: string): Promise<EscrowContract> {
  try {
    return await req<EscrowContract>(`/api/escrow/contracts/${encodeURIComponent(id)}/execute-deed`, {
      method: 'POST',
      body: JSON.stringify({ deedNumber, volumeNumber }),
    });
  } catch {
    setSource('demo');
    const c = demoEscrowContracts.find((item) => item.id === id);
    if (!c) throw new Error('Contract not found');
    c.stage = 'DEED_EXECUTED';
    c.deedNumber = deedNumber;
    c.deedVolumeNumber = volumeNumber || 'VOL-2026-88';
    c.updatedAt = new Date().toISOString();
    c.timeline.push({
      stage: 'DEED_EXECUTED',
      timestamp: new Date().toISOString(),
      descriptionEn: `Conveyance deed executed at Sub-Registry Office. Deed #${deedNumber}.`,
      descriptionBn: `সাব-রেজিস্ট্রি অফিসে সাফ-কবলা দলিল সম্পাদিত হয়েছে। দলিল নং ${deedNumber}।`,
      actor: 'Sub-Registrar, Savar',
      referenceNumber: deedNumber,
    });
    return c;
  }
}

export async function recordEscrowMutation(id: string, mutationCaseNumber: string, newKhatianNo: string): Promise<EscrowContract> {
  try {
    return await req<EscrowContract>(`/api/escrow/contracts/${encodeURIComponent(id)}/record-mutation`, {
      method: 'POST',
      body: JSON.stringify({ mutationCaseNumber, newKhatianNo }),
    });
  } catch {
    setSource('demo');
    const c = demoEscrowContracts.find((item) => item.id === id);
    if (!c) throw new Error('Contract not found');
    c.stage = 'MUTATION_RECORDED';
    c.mutationCaseNumber = mutationCaseNumber;
    c.newKhatianNo = newKhatianNo;
    c.updatedAt = new Date().toISOString();
    c.timeline.push({
      stage: 'MUTATION_RECORDED',
      timestamp: new Date().toISOString(),
      descriptionEn: `e-Mutation completed by AC (Land). New Khatian #${newKhatianNo} recorded.`,
      descriptionBn: `সহকারী কমিশনার (ভূমি) কর্তৃক নামজারি অনুমোদন সম্পন্ন। নতুন খতিয়ান নং ${newKhatianNo}।`,
      actor: 'AC (Land), Savar Upazila',
      referenceNumber: mutationCaseNumber,
    });
    return c;
  }
}

export async function releaseEscrowFunds(id: string): Promise<EscrowContract> {
  try {
    return await req<EscrowContract>(`/api/escrow/contracts/${encodeURIComponent(id)}/release`, {
      method: 'POST',
    });
  } catch {
    setSource('demo');
    const c = demoEscrowContracts.find((item) => item.id === id);
    if (!c) throw new Error('Contract not found');
    c.stage = 'FUNDS_RELEASED';
    c.isLocked = false;
    c.updatedAt = new Date().toISOString();
    c.timeline.push({
      stage: 'FUNDS_RELEASED',
      timestamp: new Date().toISOString(),
      descriptionEn: `Funds disbursed. Statutory taxes (BDT ${c.totalStatutoryFeesBdt.toLocaleString('en-IN')}) credited to NBR Treasury. Net BDT ${c.netPayableToSellerBdt.toLocaleString('en-IN')} disbursed to seller.`,
      descriptionBn: `অর্থ হস্তান্তর সম্পন্ন। সরকারি রাজস্ব সরকারি কোষাগারে এবং নিট টাকা বিক্রেতার অ্যাকাউন্টে স্থানান্তরিত।`,
      actor: 'Escrow Settlement Smart Gateway',
      referenceNumber: `DISBURSE-${Date.now()}`,
    });
    return c;
  }
}

// --- Phase 3: Government Khas & Vested Land Radar Endpoints ---

const demoKhasRecords: KhasRecord[] = [
  {
    id: 'khas-001',
    mouza: 'Savar Mouza (সাভার মৌজা)',
    upazila: 'Savar',
    district: 'Dhaka',
    khasKhatianNo: '১নং খাস খতিয়ান (Khas Khatian #1)',
    dagNo: 'দাগ নং ৫৯২ (Dag #592 - Bangshi Riverbed Foreshore)',
    category: 'RIVERBED_FORESHORE',
    categoryBn: 'নদী সিকস্তি ও সরকারি পয়স্তি জলাশয়',
    areaDecimal: 45.0,
    controllingAuthority: 'Ministry of Land / Deputy Commissioner Dhaka',
    coordinates: [90.2582, 23.8436],
    isEncroached: true,
    encroacherName: 'Commercial Encroachment / Unregistered Sand Lifting',
    evictionCaseNumber: 'EVICT-SAV-2025/12',
    evictionNoticeDate: '2025-11-20',
    statutoryAct: 'State Acquisition and Tenancy Act 1950, Section 86 (Alluvial and Diluvial Land Rules)',
  },
  {
    id: 'khas-002',
    mouza: 'Panchlaish Mouza (পাঁচলাইশ মৌজা)',
    upazila: 'Panchlaish',
    district: 'Chattogram',
    khasKhatianNo: '১নং খাস খতিয়ান (Khas Khatian #1)',
    dagNo: 'দাগ নং ১১৪ (Dag #114)',
    category: 'VESTED_PROPERTY',
    categoryBn: 'অর্পিত সম্পত্তি ("ক" তফসিল)',
    areaDecimal: 18.25,
    controllingAuthority: 'Additional Deputy Commissioner (Revenue), Chattogram',
    coordinates: [91.8322, 22.3619],
    isEncroached: false,
    statutoryAct: 'Vested Property Return (Amendment) Act 2013',
  },
  {
    id: 'khas-003',
    mouza: 'Ishwardi Mouza (ঈশ্বরদী মৌজা)',
    upazila: 'Ishwardi',
    district: 'Pabna',
    khasKhatianNo: '১নং খাস খতিয়ান (Khas Khatian #1)',
    dagNo: 'দাগ নং ৮৮ (Railway Buffer & Canal Reserve)',
    category: '1_NO_KHAS',
    categoryBn: 'রেলওয়ে অধিগ্রহণ ও সরকারি খাস নালা',
    areaDecimal: 12.8,
    controllingAuthority: 'Bangladesh Railway / Assistant Commissioner (Land) Ishwardi',
    coordinates: [89.0682, 24.1539],
    isEncroached: true,
    encroacherName: 'Unauthorized Permanent Brick Construction',
    evictionCaseNumber: 'EVICT-ISW-2026/04',
    evictionNoticeDate: '2026-02-10',
    statutoryAct: 'The Public Lands and Buildings (Recovery of Possession) Ordinance 1970',
  },
];

export async function getKhasRecords(upazila?: string): Promise<KhasRecord[]> {
  try {
    const url = upazila ? `/api/khas/records?upazila=${encodeURIComponent(upazila)}` : '/api/khas/records';
    return await req<KhasRecord[]>(url);
  } catch {
    setSource('demo');
    if (!upazila) return demoKhasRecords;
    return demoKhasRecords.filter((k) => k.upazila.toLowerCase() === upazila.toLowerCase());
  }
}

export async function checkKhasEncroachment(parcelId: string, coordinates?: [number, number]): Promise<EncroachmentCheckResult> {
  try {
    return await req<EncroachmentCheckResult>('/api/khas/check-encroachment', {
      method: 'POST',
      body: JSON.stringify({ parcelId, coordinates }),
    });
  } catch {
    setSource('demo');
    // If parcel is parcel-003 or parcel-006, simulate buffer proximity or encroachment
    if (parcelId.toLowerCase().includes('000003')) {
      const matched = demoKhasRecords[0];
      return {
        parcelId,
        isEncroaching: false,
        inBufferZone: true,
        closestDistanceMeters: 38.5,
        riskLevel: 'BUFFER_WARNING',
        riskLevelBn: 'সতর্কীকরণ: সরকারি খাস সীমানার সংলগ্ন (বাফার জোন)',
        matchedKhasRecord: matched,
        statutoryCitation: 'State Acquisition and Tenancy Act 1950, Section 86 & River Protection Act 2013',
        statutoryNoticeEn: 'CAUTION: Parcel boundary is located within 38.5 meters of Bangshi Riverbed Foreshore (Khas Khatian #1, Dag #592). Mandatory joint field survey with Upazila Revenue Amin required.',
        statutoryNoticeBn: 'সতর্কতা: দাগের সীমানা বংশী নদীর পয়স্তি খাস খতিয়ান হতে ৩৮.৫ মিটার দূরত্বে অবস্থিত। রেজিস্ট্রির পূর্বে কানুনগো যৌথ সীমানা নির্ধারণ আবশ্যক।',
        checkedAt: new Date().toISOString(),
      };
    }
    return {
      parcelId,
      isEncroaching: false,
      inBufferZone: false,
      closestDistanceMeters: 840.0,
      riskLevel: 'CLEAN',
      riskLevelBn: 'খাস বা অর্পিত সম্পত্তি মুক্ত (সম্পূর্ণ নিরাপদ)',
      matchedKhasRecord: null,
      statutoryCitation: 'State Acquisition and Tenancy Act 1950 (Section 86, 92)',
      statutoryNoticeEn: 'CLEAN: Parcel boundary maintains a buffer clearance exceeding 800 meters from registered 1 No. Khas or Vested Properties.',
      statutoryNoticeBn: 'নিরাপদ: দাগের সীমানা ১নং খাস খতিয়ান ও অর্পিত সম্পত্তির সংরক্ষিত বাফার জোন হতে নিরাপদ দূরত্বে অবস্থিত।',
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function issueKhasEvictionNotice(khasId: string, caseNumber: string, encroacherName: string): Promise<KhasRecord> {
  try {
    return await req<KhasRecord>('/api/khas/eviction-notice', {
      method: 'POST',
      body: JSON.stringify({ khasId, caseNumber, encroacherName }),
    });
  } catch {
    setSource('demo');
    const record = demoKhasRecords.find((r) => r.id === khasId);
    if (!record) throw new Error('Khas record not found');
    record.isEncroached = true;
    record.evictionCaseNumber = caseNumber;
    record.encroacherName = encroacherName;
    record.evictionNoticeDate = new Date().toISOString().slice(0, 10);
    return record;
  }
}

// --- Phase 4: Field Survey & Offline Amin Sync Endpoints ---

const demoSurveyRecords: SurveyRecord[] = [
  {
    id: 'SURV-2026-SAV-0192',
    parcelId: 'BD-DHK-SAV-000001',
    mouza: 'Savar Mouza (সাভার মৌজা)',
    upazila: 'Savar',
    district: 'Dhaka',
    aminId: 'amin-004',
    aminName: 'Md. Abdur Rahim (Revenue Amin)',
    aminLicenseNo: 'AMIN-DHK-2018/88',
    surveyDate: '2026-03-02',
    status: 'SYNCED',
    physicalLandUse: 'RESIDENTIAL_HOMESTEAD',
    physicalLandUseBn: 'বাস্তু / আবাসিক বসতভিটা ও সীমানা প্রাচীর',
    benchmarkPegs: [
      {
        id: 'peg-1',
        pegNumber: 'P-1 (উত্তর-পশ্চিম সীমানা)',
        lat: 23.8441,
        lng: 90.2589,
        btmEasting: 526312.4,
        btmNorthing: 2637410.2,
        elevationMeters: 11.4,
        chainageToNextLinks: 120,
        chainageToNextFeet: 79.2,
        physicalMarkerType: 'CONCRETE_PILLAR',
        timestamp: '2026-03-02T10:15:00Z',
      },
      {
        id: 'peg-2',
        pegNumber: 'P-2 (উত্তর-পূর্ব সীমানা)',
        lat: 23.8442,
        lng: 90.2596,
        btmEasting: 526383.6,
        btmNorthing: 2637421.1,
        elevationMeters: 11.2,
        chainageToNextLinks: 75,
        chainageToNextFeet: 49.5,
        physicalMarkerType: 'CONCRETE_PILLAR',
        timestamp: '2026-03-02T10:45:00Z',
      },
      {
        id: 'peg-3',
        pegNumber: 'P-3 (দক্ষিণ-পূর্ব সীমানা)',
        lat: 23.8437,
        lng: 90.2595,
        btmEasting: 526373.1,
        btmNorthing: 2637365.8,
        elevationMeters: 10.9,
        chainageToNextLinks: 120,
        chainageToNextFeet: 79.2,
        physicalMarkerType: 'IRON_ROD',
        timestamp: '2026-03-02T11:15:00Z',
      },
      {
        id: 'peg-4',
        pegNumber: 'P-4 (দক্ষিণ-পশ্চিম সীমানা)',
        lat: 23.8436,
        lng: 90.2588,
        btmEasting: 526302.2,
        btmNorthing: 2637354.9,
        elevationMeters: 11.1,
        chainageToNextLinks: 75,
        chainageToNextFeet: 49.5,
        physicalMarkerType: 'CONCRETE_PILLAR',
        timestamp: '2026-03-02T11:45:00Z',
      },
    ],
    computedAreaSqFt: 23958.0,
    computedAreaDecimal: 5.5,
    khatianRecordedDecimal: 5.5,
    areaVarianceDecimal: 0.0,
    boundaryDisputeFlag: false,
    coSharerStatements: [
      {
        id: 'stmt-1',
        personName: 'Shamsul Alam',
        nid: '19782692011000888',
        relationship: 'ADJACENT_OWNER',
        adjacentDagNo: 'দাগ নং ৪৮৩',
        statementText: 'উভয় পক্ষের উপস্থিতিতে সীমানা নির্ধারণ সম্পন্ন হয়েছে। কোনো দাবি বা আপত্তি নেই।',
        hasObjection: false,
        timestamp: '2026-03-02T12:00:00Z',
      },
    ],
    kanungoReviewed: true,
    kanungoComments: 'Physical boundary matches digitized BDS GIS cadastral sheet. Certified for transaction.',
    syncedAt: '2026-03-02T14:30:00Z',
    offlineCreated: false,
    createdAt: '2026-03-02T10:00:00Z',
    updatedAt: '2026-03-02T14:30:00Z',
  },
];

export async function getSurveyRecords(filter?: { parcelId?: string; aminId?: string }): Promise<SurveyRecord[]> {
  try {
    const params = new URLSearchParams();
    if (filter?.parcelId) params.append('parcelId', filter.parcelId);
    if (filter?.aminId) params.append('aminId', filter.aminId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return await req<SurveyRecord[]>(`/api/survey/records${query}`);
  } catch {
    setSource('demo');
    if (!filter) return demoSurveyRecords;
    return demoSurveyRecords.filter((s) => {
      if (filter.parcelId && s.parcelId.toLowerCase() !== filter.parcelId.toLowerCase()) return false;
      if (filter.aminId && s.aminId.toLowerCase() !== filter.aminId.toLowerCase()) return false;
      return true;
    });
  }
}

export async function getSurveyRecord(id: string): Promise<SurveyRecord> {
  try {
    return await req<SurveyRecord>(`/api/survey/records/${encodeURIComponent(id)}`);
  } catch {
    setSource('demo');
    const found = demoSurveyRecords.find((s) => s.id === id);
    if (!found) throw new Error('Survey record not found');
    return found;
  }
}

export async function createSurveyRecord(input: {
  parcelId: string;
  mouza?: string;
  upazila?: string;
  district?: string;
  aminId?: string;
  aminName?: string;
  aminLicenseNo?: string;
  physicalLandUse?: SurveyRecord['physicalLandUse'];
  khatianRecordedDecimal: number;
  isOffline?: boolean;
}): Promise<SurveyRecord> {
  try {
    return await req<SurveyRecord>('/api/survey/records', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch {
    setSource('demo');
    const survey: SurveyRecord = {
      id: `SURV-2026-DEMO-${Math.floor(100 + Math.random() * 900)}`,
      parcelId: input.parcelId,
      mouza: input.mouza || 'Savar Mouza',
      upazila: input.upazila || 'Savar',
      district: input.district || 'Dhaka',
      aminId: input.aminId || 'amin-004',
      aminName: input.aminName || 'Md. Abdur Rahim (Revenue Amin)',
      aminLicenseNo: input.aminLicenseNo || 'AMIN-DHK-2018/88',
      surveyDate: new Date().toISOString().slice(0, 10),
      status: input.isOffline ? 'OFFLINE_QUEUED' : 'DRAFT_IN_FIELD',
      physicalLandUse: input.physicalLandUse || 'AGRICULTURAL_PADDY',
      physicalLandUseBn: 'কৃষি ফসলি জমি',
      benchmarkPegs: [],
      computedAreaSqFt: 0,
      computedAreaDecimal: 0,
      khatianRecordedDecimal: input.khatianRecordedDecimal,
      areaVarianceDecimal: 0,
      boundaryDisputeFlag: false,
      coSharerStatements: [],
      kanungoReviewed: false,
      offlineCreated: !!input.isOffline,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    demoSurveyRecords.unshift(survey);
    return survey;
  }
}

export async function addStationPeg(
  surveyId: string,
  peg: Omit<BenchmarkPeg, 'id' | 'timestamp'>
): Promise<SurveyRecord> {
  try {
    return await req<SurveyRecord>(`/api/survey/records/${encodeURIComponent(surveyId)}/pegs`, {
      method: 'POST',
      body: JSON.stringify(peg),
    });
  } catch {
    setSource('demo');
    const s = demoSurveyRecords.find((item) => item.id === surveyId);
    if (!s) throw new Error('Survey not found');
    const newPeg: BenchmarkPeg = {
      id: `peg-${Date.now()}`,
      ...peg,
      timestamp: new Date().toISOString(),
    };
    s.benchmarkPegs.push(newPeg);
    s.computedAreaSqFt = s.benchmarkPegs.length * 5989.5;
    s.computedAreaDecimal = Number((s.computedAreaSqFt / 435.6).toFixed(2));
    s.areaVarianceDecimal = Number((s.computedAreaDecimal - s.khatianRecordedDecimal).toFixed(2));
    s.updatedAt = new Date().toISOString();
    return s;
  }
}

export async function addCoSharerStatement(
  surveyId: string,
  statement: Omit<CoSharerStatement, 'id' | 'timestamp'>
): Promise<SurveyRecord> {
  try {
    return await req<SurveyRecord>(`/api/survey/records/${encodeURIComponent(surveyId)}/statements`, {
      method: 'POST',
      body: JSON.stringify(statement),
    });
  } catch {
    setSource('demo');
    const s = demoSurveyRecords.find((item) => item.id === surveyId);
    if (!s) throw new Error('Survey not found');
    s.coSharerStatements.push({
      id: `stmt-${Date.now()}`,
      ...statement,
      timestamp: new Date().toISOString(),
    });
    s.updatedAt = new Date().toISOString();
    return s;
  }
}

export async function submitSurveyReport(surveyId: string): Promise<SurveyRecord> {
  try {
    return await req<SurveyRecord>(`/api/survey/records/${encodeURIComponent(surveyId)}/submit`, {
      method: 'POST',
    });
  } catch {
    setSource('demo');
    const s = demoSurveyRecords.find((item) => item.id === surveyId);
    if (!s) throw new Error('Survey not found');
    s.status = 'SYNCED';
    s.kanungoReviewed = true;
    s.kanungoComments = 'Field verification confirmed by Kanungo. Survey sheet ready for formal khatian record.';
    s.updatedAt = new Date().toISOString();
    return s;
  }
}

export async function syncOfflineSurveys(records: SurveyRecord[]): Promise<{
  syncedCount: number;
  updatedSurveys: SurveyRecord[];
}> {
  try {
    return await req<{ syncedCount: number; updatedSurveys: SurveyRecord[] }>('/api/survey/sync', {
      method: 'POST',
      body: JSON.stringify({ records }),
    });
  } catch {
    setSource('demo');
    records.forEach((r) => {
      const idx = demoSurveyRecords.findIndex((item) => item.id === r.id);
      if (idx >= 0) {
        demoSurveyRecords[idx] = { ...r, status: 'SYNCED', syncedAt: new Date().toISOString() };
      } else {
        demoSurveyRecords.unshift({ ...r, status: 'SYNCED', syncedAt: new Date().toISOString() });
      }
    });
    return {
      syncedCount: records.length,
      updatedSurveys: records,
    };
  }
}

// --- Phase 4: Drone Cadastre Multi-Epoch Comparison Endpoints ---

export async function getDroneEpochs(parcelId: string): Promise<CadastralEpoch[]> {
  try {
    return await req<CadastralEpoch[]>(`/api/drone/epochs/${encodeURIComponent(parcelId)}`);
  } catch {
    setSource('demo');
    return [
      {
        epochId: 'CS_1924',
        epochNameEn: 'CS 1924 (Cadastral Survey)',
        epochNameBn: 'সিএস ১৯২৪ (ক্যাডাস্ট্রাল সার্ভে)',
        surveyYear: 1924,
        surveyTechnology: 'Gunter Chain & Optical Plane Table',
        surveyAgency: 'Directorate of Land Records & Surveys (Bengal)',
        nominalScale: '16 inches = 1 mile (1:3,960)',
        precisionMeters: 1.5,
        measuredAreaDecimal: 5.48,
        vertexCount: 4,
        coordinates: [
          [90.2588, 23.8440],
          [90.2595, 23.8441],
          [90.2594, 23.8436],
          [90.2587, 23.8435],
        ],
        canalBufferOverlap: false,
      },
      {
        epochId: 'RS_1988',
        epochNameEn: 'RS 1988 (Revisional Survey)',
        epochNameBn: 'আরএস ১৯৮৮ (রিভিশনাল সার্ভে)',
        surveyYear: 1988,
        surveyTechnology: 'Theodolite & Traverse Cadastre',
        surveyAgency: 'Department of Land Records and Surveys (DLRS)',
        nominalScale: '16 inches = 1 mile (1:3,960)',
        precisionMeters: 0.8,
        measuredAreaDecimal: 5.50,
        vertexCount: 4,
        coordinates: [
          [90.25885, 23.84405],
          [90.25955, 23.84415],
          [90.25945, 23.84365],
          [90.25875, 23.84355],
        ],
        canalBufferOverlap: false,
      },
      {
        epochId: 'BS_2015',
        epochNameEn: 'BS 2015 (Bangladesh Survey)',
        epochNameBn: 'বিএস ২০১৫ (বাংলাদেশ সার্ভে)',
        surveyYear: 2015,
        surveyTechnology: 'Electronic Total Station (ETS)',
        surveyAgency: 'DLRS & Survey of Bangladesh',
        nominalScale: '1:1,000 High Precision',
        precisionMeters: 0.15,
        measuredAreaDecimal: 5.50,
        vertexCount: 4,
        coordinates: [
          [90.25888, 23.84408],
          [90.25958, 23.84418],
          [90.25948, 23.84368],
          [90.25878, 23.84358],
        ],
        canalBufferOverlap: false,
      },
      {
        epochId: 'BDS_2026',
        epochNameEn: 'BDS 2026 (Digital Drone GIS)',
        epochNameBn: 'বিডিএস ২০২৬ (ড্রোন জিআইএস ক্যাডাস্ট্রে)',
        surveyYear: 2026,
        surveyTechnology: 'RTK GNSS + 2cm GSD Drone Orthomosaic',
        surveyAgency: 'Ministry of Land Digital Cadastre Cell',
        nominalScale: '1:500 Geodetic PostGIS',
        precisionMeters: 0.02,
        measuredAreaDecimal: 5.502,
        vertexCount: 4,
        coordinates: [
          [90.2589, 23.8441],
          [90.2596, 23.8442],
          [90.2595, 23.8437],
          [90.2588, 23.8436],
        ],
        canalBufferOverlap: false,
      },
    ];
  }
}

export async function compareDroneEpochs(parcelId: string): Promise<EpochComparisonResult> {
  try {
    return await req<EpochComparisonResult>('/api/drone/compare-epochs', {
      method: 'POST',
      body: JSON.stringify({ parcelId }),
    });
  } catch {
    setSource('demo');
    const epochs = await getDroneEpochs(parcelId);
    const isEncroached = parcelId.toLowerCase().includes('000003');
    return {
      parcelId,
      mouza: 'Savar Mouza (সাভার মৌজা)',
      epochs,
      areaDriftPercentage: isEncroached ? 15.6 : 0.04,
      maxVertexShiftMeters: isEncroached ? 8.6 : 0.45,
      canalEncroachmentFlag: isEncroached,
      canalEncroachmentAreaSqFt: isEncroached ? 544.5 : undefined,
      verdict: isEncroached ? 'SUSPECTED_CANAL_ENCROACHMENT' : 'CONGRUENT_MATCH',
      verdictBn: isEncroached
        ? 'সরকারি খাল বা জলাশয় ভরাট ও দখল শনাক্ত (Canal Encroachment)'
        : 'সকল জরিপে সীমানা সামঞ্জস্যপূর্ণ (Congruent Match)',
      technicalSummaryEn: isEncroached
        ? 'CRITICAL DEVIATION: Modern boundary extends 8.6 meters beyond historical CS/RS line, encroaching approx. 544.5 sq ft into the adjacent public canal.'
        : 'Drone orthophoto boundary precisely overlays RS 1988 and BS 2015 vectors within 0.45m geodetic tolerance.',
      technicalSummaryBn: isEncroached
        ? 'মারাত্মক অমিল: আধুনিক ড্রোন নকশায় সীমানা ঐতিহাসিক সিএস নকশার তুলনায় ৮.৬ মিটার প্রসারিত হয়ে সংলগ্ন সরকারি খালে প্রবেশ করেছে।'
        : 'ড্রোন নকশার সীমানা পূর্ববর্তী আরএস ও বিএস নকশার সাথে নিখুঁতভাবে মিলে গেছে। কোনো স্থানচ্যুতি বা দখল নেই।',
      statutoryReference: 'The Survey Act 1875 (Section 22) & Bangladesh Digital Survey (BDS) Standard Operating Procedure',
      generatedAt: new Date().toISOString(),
    };
  }
}

// --- Phase 5: Digital Evidence & Tamper-Evident Ledger Endpoints ---

const fallbackEvidenceBlocks: EvidenceBlock[] = [
  {
    blockIndex: 0,
    blockId: 'ev-seed-0',
    parcelId: 'BD-DHK-SAV-000001',
    timestamp: '2026-02-01T08:30:00.000Z',
    modality: 'DEVICE_EVENT',
    title: 'Genesis Anchor: Savar Circle Jurisdictional Root',
    summaryBn: 'ডিজিটাল এভিডেন্স লেজার সূচনা: সহকারী কমিশনার (ভূমি) সাভার রাজস্ব সার্কেল',
    payload: {
      modality: 'DEVICE_EVENT',
      actor: {
        name: 'Savar Upazila Land Office Node',
        role: 'AC_LAND',
        nidOrBadge: 'AC-SAVAR-ADM-01',
        ipAddress: '10.24.112.5',
      },
      capturedAt: '2026-02-01T08:30:00.000Z',
      metadata: {
        deviceEventType: 'SECURE_BOOT',
        jurisdiction: 'Dhaka Division, Savar Upazila, Savar Mouza (JL-42)',
        appVersion: 'DEMS-GovBD v3.4.1',
      },
    },
    payloadHash: '4a5e2f9d8a1c3b5e7f9a2c4e6d8b0a1c3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b',
    previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
    currentHash: '383c9da1169c29420e1b75b7842ab122cd01d57b1363f4f1047a42bd26d1c8d6',
    signature: 'MEUCIQDh2...ed25519-root-sig-gov-bd...',
    publicKey: 'MCowBQYDK2VwAyEA9f518a2...spki-pubkey...',
  },
  {
    blockIndex: 1,
    blockId: 'ev-seed-1',
    parcelId: 'BD-DHK-SAV-000001',
    timestamp: '2026-02-05T09:15:00.000Z',
    modality: 'MESSAGE',
    title: 'AC Land Hearing Summons Dispatched via SMS Gateway',
    summaryBn: 'সহকারী কমিশনার (ভূমি) শুনানির নোটিশ: আবেদনকারীকে দলিল ও পর্চাসহ হাজির হওয়ার তলব',
    payload: {
      modality: 'MESSAGE',
      actor: {
        name: 'Khandakar Mizanur Rahman, BCS (Admin)',
        role: 'AC_LAND',
        nidOrBadge: 'BCS-36-88912',
        phone: '+8801711223344',
      },
      capturedAt: '2026-02-05T09:15:00.000Z',
      metadata: {
        channel: 'SMS_GATEWAY',
        sender: 'BD-GOVT-LAND',
        recipient: '+8801712000000',
        messageBody: 'Notification: Mutation Case 2026/MUT-SAV-0042 hearing scheduled on 18 Feb 2026 at 11:00 AM at Savar Upazila Land Office. Bring original Dalil #4821.',
        messageBodyBn: 'বিজ্ঞপ্তি: খারিজ মোকদ্দমা ২০২৬/MUT-SAV-০০৪২ এর শুনানি ১৮ ফেব্রুয়ারি ২০২৬ সকাল ১১:০০ টায় ধার্য করা হয়েছে। মূল দলিল নং ৪৮২১ সঙ্গে আনুন।',
        deliveryStatus: 'DELIVERED',
        telecomGatewayId: 'BTCL-GOV-SMS-884129',
      },
    },
    payloadHash: 'b1c3d5e7f9a1b3c5d7e9f1a3b4a5e2f9d8a1c3b5e7f9a2c4e6d8b0a1c3e5f7a9',
    previousHash: '383c9da1169c29420e1b75b7842ab122cd01d57b1363f4f1047a42bd26d1c8d6',
    currentHash: 'a9b1c3d5e7f9a1b3c5d7e9f1a3b4a5e2f9d8a1c3b5e7f9a2c4e6d8b0a1c3e5f7',
    signature: 'RUIwQQId...sms-gateway-attested-sig...',
    publicKey: 'MCowBQYDK2VwAyEA9f518a2...spki-pubkey...',
  },
  {
    blockIndex: 2,
    blockId: 'ev-seed-2',
    parcelId: 'BD-DHK-SAV-000001',
    timestamp: '2026-02-12T10:45:22.000Z',
    modality: 'LOCATION',
    title: 'Field Surveyor On-Site GPS Fix at Northern Mouza Benchmark',
    summaryBn: 'আমিন সরজমিন সীমানা জিপিএস ফিক্স: উত্তর সীমানা সীমানা খুঁটি (Peg P-01)',
    payload: {
      modality: 'LOCATION',
      actor: {
        name: 'Md. Abdur Rahim (Revenue Amin)',
        role: 'SURVEYOR_AMIN',
        nidOrBadge: 'AMIN-DHK-2018/88',
        phone: '+8801819345678',
      },
      capturedAt: '2026-02-12T10:45:22.000Z',
      metadata: {
        latitude: 23.85124,
        longitude: 90.26145,
        altitudeMeters: 14.8,
        accuracyRadiusMeters: 1.2,
        speedKmh: 0.4,
        headingDegrees: 18.5,
        isMockGpsDetected: false,
        mouzaPegRef: 'P-01 (উত্তর-পূর্ব কর্নার সীমানা পিলার)',
        deviceSatelliteCount: 16,
      },
    },
    payloadHash: 'f7a9b1c3d5e7f9a1b3c5d7e9f1a3b4a5e2f9d8a1c3b5e7f9a2c4e6d8b0a1c3e5',
    previousHash: 'a9b1c3d5e7f9a1b3c5d7e9f1a3b4a5e2f9d8a1c3b5e7f9a2c4e6d8b0a1c3e5f7',
    currentHash: 'c4e6d8b0a1c3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b4a5e2f9d8a1c3b5e7f9a2',
    signature: 'PUIwEAIe...rtk-gnss-carrier-phase-sig...',
    publicKey: 'MCowBQYDK2VwAyEA9f518a2...spki-pubkey...',
  },
  {
    blockIndex: 3,
    blockId: 'ev-seed-3',
    parcelId: 'BD-DHK-SAV-000001',
    timestamp: '2026-02-12T10:48:10.000Z',
    modality: 'FILE',
    title: 'Geotagged Boundary Peg Inspection Photo Uploaded',
    summaryBn: 'সরজমিন তদন্ত আলোকচিত্র: আরএস দাগ নং ১১২ সীমানা পিলারের উচ্চ-রেজোলিউশন ছবি',
    payload: {
      modality: 'FILE',
      actor: {
        name: 'Md. Abdur Rahim (Revenue Amin)',
        role: 'SURVEYOR_AMIN',
        nidOrBadge: 'AMIN-DHK-2018/88',
      },
      capturedAt: '2026-02-12T10:48:10.000Z',
      metadata: {
        fileName: 'SURVEY_SAVAR_DAG112_PEG1_GEO.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 4289104,
        fileSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        exifGps: { lat: 23.851238, lng: 90.261448, altitudeMeters: 14.7 },
        fileDescription: 'Northern boundary concrete pillar marked with yellow paint, adjacent to canal embankment.',
      },
    },
    payloadHash: '2c4e6d8b0a1c3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b4a5e2f9d8a1c3b5e7f9a',
    previousHash: 'c4e6d8b0a1c3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b4a5e2f9d8a1c3b5e7f9a2',
    currentHash: 'b5e7f9a2c4e6d8b0a1c3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b4a5e2f9d8a1c3',
    signature: 'VEUCIQDf...sha256-exif-sealed-sig...',
    publicKey: 'MCowBQYDK2VwAyEA9f518a2...spki-pubkey...',
  },
  {
    blockIndex: 4,
    blockId: 'ev-seed-4',
    parcelId: 'BD-DHK-SAV-000001',
    timestamp: '2026-02-12T10:50:00.000Z',
    modality: 'DEVICE_EVENT',
    title: 'Survey Handset Hardware Telemetry & Non-Root Attestation',
    summaryBn: 'মাঠপর্যায়ের মোবাইল ডিভাইসের সিকিউরিটি লগ: মক জিপিএস নিষ্ক্রিয় ও নকশ হার্ডওয়্যার সত্যায়ন',
    payload: {
      modality: 'DEVICE_EVENT',
      actor: {
        name: 'Md. Abdur Rahim (Revenue Amin)',
        role: 'SURVEYOR_AMIN',
        nidOrBadge: 'AMIN-DHK-2018/88',
      },
      capturedAt: '2026-02-12T10:50:00.000Z',
      metadata: {
        deviceModel: 'Samsung Galaxy XCover 6 Pro (Govt Issued Rugged)',
        deviceIdHash: '8a3b59dfc12e8471b6910a30b42fce1286940a1b8972',
        osVersion: 'Android 14 (Security Patch Feb 2026)',
        appVersion: 'BhumiFieldSurvey-Mobile v2.9.0',
        batteryLevelPercent: 86,
        networkType: '4G_LTE',
        isRootedOrJailbroken: false,
        deviceEventType: 'MOCK_GPS_PROBE',
        hardwareSecurityTier: 'HARDWARE_BACKED_TEE',
      },
    },
    payloadHash: 'd8b0a1c3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b4a5e2f9d8a1c3b5e7f9a2c4e6',
    previousHash: 'b5e7f9a2c4e6d8b0a1c3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b4a5e2f9d8a1c3',
    currentHash: 'e7f9a2c4e6d8b0a1c3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b4a5e2f9d8a1c3b5',
    signature: 'TEUCIQCf...tee-hardware-attestation-sig...',
    publicKey: 'MCowBQYDK2VwAyEA9f518a2...spki-pubkey...',
  },
  {
    blockIndex: 5,
    blockId: 'ev-seed-5',
    parcelId: 'BD-DHK-SAV-000001',
    timestamp: '2026-02-18T11:20:00.000Z',
    modality: 'FILE',
    title: 'Sub-Registry Authenticated Registered Sale Deed (Dalil #4821)',
    summaryBn: 'সাব-রেজিস্ট্রি প্রত্যয়িত সাফ-কবলা দলিল স্ক্যান (দলিল নং ৪৮২১/২০১২)',
    payload: {
      modality: 'FILE',
      actor: {
        name: 'Sub-Registrar Savar Office Vault',
        role: 'SUB_REGISTRAR',
        nidOrBadge: 'SUBREG-SAVAR-VAULT-04',
      },
      capturedAt: '2026-02-18T11:20:00.000Z',
      metadata: {
        fileName: 'DEED_4821_SAVAR_OFFICIAL_ARCHIVE.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 8940212,
        fileSha256: 'bc94a974b7c6c4f03c054ee42045e763b6528751475510427954e3cb41ee3bc0',
        bayaVolumeNo: 'Book-1, Volume 44, Pages 89-98',
        subRegistryOffice: 'Savar Sadar Sub-Registry Office',
      },
    },
    payloadHash: 'a1b3c5d7e9f1a3b4a5e2f9d8a1c3b5e7f9a2c4e6d8b0a1c3e5f7a9b1c3d5e7f9',
    previousHash: 'e7f9a2c4e6d8b0a1c3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b4a5e2f9d8a1c3b5',
    currentHash: '781b359f1a3b4a5e2f9d8a1c3b5e7f9a2c4e6d8b0a1c3e5f7a9b1c3d5e7f9a1b',
    signature: 'DEUCIQD2...subregistry-official-seal-sig...',
    publicKey: 'MCowBQYDK2VwAyEA9f518a2...spki-pubkey...',
  },
];

let localEvidenceBlocks = [...fallbackEvidenceBlocks];

export async function getEvidenceTimeline(parcelId: string): Promise<{
  parcelId: string;
  totalBlocks: number;
  verification: ChainVerificationReport;
  blocks: EvidenceBlock[];
}> {
  try {
    return await req<{
      parcelId: string;
      totalBlocks: number;
      verification: ChainVerificationReport;
      blocks: EvidenceBlock[];
    }>(`/api/evidence/timeline/${encodeURIComponent(parcelId)}`);
  } catch {
    setSource('demo');
    const mappedBlocks = localEvidenceBlocks.map((b) => ({
      ...b,
      parcelId,
    }));
    const valid = !mappedBlocks.some((b) => b.isTampered);
    const tamperedIdx = mappedBlocks.findIndex((b) => b.isTampered);
    return {
      parcelId,
      totalBlocks: mappedBlocks.length,
      verification: {
        isValid: valid,
        parcelId,
        totalBlocks: mappedBlocks.length,
        genesisHash: mappedBlocks[0]?.currentHash || '',
        latestHash: mappedBlocks[mappedBlocks.length - 1]?.currentHash || '',
        tamperedBlockIndex: tamperedIdx !== -1 ? tamperedIdx : undefined,
        errorReason: tamperedIdx !== -1 ? mappedBlocks[tamperedIdx].tamperDetails : undefined,
        verifiedAt: new Date().toISOString(),
        blockValidations: mappedBlocks.map((b) => ({
          blockIndex: b.blockIndex,
          hashValid: !b.isTampered,
          prevHashValid: !b.isTampered,
          signatureValid: !b.isTampered,
          tamperedReason: b.tamperDetails,
        })),
      },
      blocks: mappedBlocks,
    };
  }
}

export async function verifyEvidenceChain(parcelId: string): Promise<ChainVerificationReport> {
  try {
    return await req<ChainVerificationReport>(`/api/evidence/verify/${encodeURIComponent(parcelId)}`, {
      method: 'POST',
    });
  } catch {
    setSource('demo');
    const timeline = await getEvidenceTimeline(parcelId);
    return timeline.verification;
  }
}

export async function ingestEvidence(payload: {
  parcelId: string;
  modality: EvidenceModality;
  title: string;
  summaryBn?: string;
  actor: EvidenceActor;
  capturedAt?: string;
  metadata: Record<string, any>;
}): Promise<{
  message: string;
  block: EvidenceBlock;
  verification: ChainVerificationReport;
}> {
  try {
    return await req<{
      message: string;
      block: EvidenceBlock;
      verification: ChainVerificationReport;
    }>('/api/evidence/ingest', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    setSource('demo');
    const blockIndex = localEvidenceBlocks.length;
    const prev = localEvidenceBlocks[blockIndex - 1];
    const dummyHash = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    const newBlock: EvidenceBlock = {
      blockIndex,
      blockId: `ev-local-${Date.now()}`,
      parcelId: payload.parcelId,
      timestamp: payload.capturedAt || new Date().toISOString(),
      modality: payload.modality,
      title: payload.title,
      summaryBn: payload.summaryBn || payload.title,
      payload: {
        modality: payload.modality,
        actor: payload.actor,
        capturedAt: payload.capturedAt || new Date().toISOString(),
        metadata: payload.metadata || {},
      },
      payloadHash: `sha256-payload-${dummyHash}`,
      previousHash: prev ? prev.currentHash : '0000000000000000000000000000000000000000000000000000000000000000',
      currentHash: `sha256-block-${dummyHash}`,
      signature: `ed25519-sig-${dummyHash}`,
      publicKey: 'MCowBQYDK2VwAyEA9f518a2...spki-pubkey...',
    };
    localEvidenceBlocks.push(newBlock);
    const verification: ChainVerificationReport = {
      isValid: true,
      parcelId: payload.parcelId,
      totalBlocks: localEvidenceBlocks.length,
      genesisHash: localEvidenceBlocks[0].currentHash,
      latestHash: newBlock.currentHash,
      verifiedAt: new Date().toISOString(),
      blockValidations: localEvidenceBlocks.map((b) => ({
        blockIndex: b.blockIndex,
        hashValid: true,
        prevHashValid: true,
        signatureValid: true,
      })),
    };
    return {
      message: 'Evidence successfully ingested and sealed into timeline.',
      block: newBlock,
      verification,
    };
  }
}

export async function simulateEvidenceTamper(
  parcelId: string,
  targetBlockIndex: number,
  field: string,
  maliciousValue: any,
  reasonBn?: string
): Promise<{
  success: boolean;
  message: string;
  tamperedBlock: EvidenceBlock;
  verification: ChainVerificationReport;
}> {
  try {
    return await req<{
      success: boolean;
      message: string;
      tamperedBlock: EvidenceBlock;
      verification: ChainVerificationReport;
    }>('/api/evidence/simulate-tamper', {
      method: 'POST',
      body: JSON.stringify({ parcelId, targetBlockIndex, field, maliciousValue, reasonBn }),
    });
  } catch {
    setSource('demo');
    const blk = localEvidenceBlocks[targetBlockIndex];
    if (blk) {
      (blk.payload.metadata as any)[field] = maliciousValue;
      blk.isTampered = true;
      blk.tamperDetails = `Tampered: ${reasonBn || 'Malicious alteration injected'}`;
    }
    const report: ChainVerificationReport = {
      isValid: false,
      parcelId,
      totalBlocks: localEvidenceBlocks.length,
      genesisHash: localEvidenceBlocks[0].currentHash,
      latestHash: localEvidenceBlocks[localEvidenceBlocks.length - 1].currentHash,
      tamperedBlockIndex: targetBlockIndex,
      errorReason: blk?.tamperDetails || 'Hash chain integrity broken',
      tamperDetails: blk?.tamperDetails,
      verifiedAt: new Date().toISOString(),
      blockValidations: localEvidenceBlocks.map((b, idx) => ({
        blockIndex: b.blockIndex,
        hashValid: idx !== targetBlockIndex,
        prevHashValid: idx < targetBlockIndex,
        signatureValid: idx !== targetBlockIndex,
        tamperedReason: b.tamperDetails,
      })),
    };
    return {
      success: true,
      message: `Injected tampering into Block #${targetBlockIndex}.`,
      tamperedBlock: blk,
      verification: report,
    };
  }
}

export async function resetEvidenceChain(parcelId: string): Promise<{
  message: string;
  result: any;
  verification: ChainVerificationReport;
}> {
  try {
    return await req<{
      message: string;
      result: any;
      verification: ChainVerificationReport;
    }>('/api/evidence/reset-chain', {
      method: 'POST',
      body: JSON.stringify({ parcelId }),
    });
  } catch {
    setSource('demo');
    localEvidenceBlocks = fallbackEvidenceBlocks.map((b) => ({ ...b, isTampered: false, tamperDetails: undefined }));
    const verification: ChainVerificationReport = {
      isValid: true,
      parcelId,
      totalBlocks: localEvidenceBlocks.length,
      genesisHash: localEvidenceBlocks[0].currentHash,
      latestHash: localEvidenceBlocks[localEvidenceBlocks.length - 1].currentHash,
      verifiedAt: new Date().toISOString(),
      blockValidations: localEvidenceBlocks.map((b) => ({
        blockIndex: b.blockIndex,
        hashValid: true,
        prevHashValid: true,
        signatureValid: true,
      })),
    };
    return {
      message: 'Evidence chain restored to pristine authentic state.',
      result: { success: true },
      verification,
    };
  }
}

export async function exportEvidenceDossier(parcelId: string): Promise<CourtDossier> {
  try {
    return await req<CourtDossier>(`/api/evidence/export-dossier/${encodeURIComponent(parcelId)}`);
  } catch {
    setSource('demo');
    const timeline = await getEvidenceTimeline(parcelId);
    return {
      dossierId: `DOSSIER-${parcelId}-${Date.now().toString(36).toUpperCase()}`,
      parcelId,
      exportedAt: new Date().toISOString(),
      qrPayload: `BDEVD:v2:${parcelId}:${timeline.totalBlocks}:${timeline.verification.latestHash.substring(0, 16)}:${timeline.verification.isValid ? 'VALID' : 'TAMPERED'}`,
      verification: timeline.verification,
      chainLength: timeline.totalBlocks,
      blocks: timeline.blocks,
      legalDisclaimerBn: 'ডিজিটাল নিরাপত্তা ও সাক্ষ্য আইন অনুযায়ী এই টাইমলাইন ক্রিপ্টোগ্রাফিক হ্যাশ চেইনে সংরক্ষিত এবং অপরিবর্তনীয়। যেকোনো পরিবর্তন স্বয়ংক্রিয়ভাবে ধরা পড়ে।',
      legalDisclaimerEn: 'Per the Bangladesh Evidence Act & Digital Security framework, this forensic timeline is anchored on an append-only SHA-256 cryptographic chain with Ed25519 digital signatures. Any record alteration renders the chain invalid.',
    };
  }
}

// ============================================================================
// AI LANDGUARD MULTI-ENGINE FRAUD VERIFICATION API
// ============================================================================

export async function getLandGuardAudit(parcelId: string): Promise<LandGuardAuditResult> {
  try {
    return await req<LandGuardAuditResult>(`/api/landguard/audit/${encodeURIComponent(parcelId)}`);
  } catch {
    setSource('demo');
    const isEncroached = parcelId === 'BD-DHK-SAV-000003';
    const isSylhet = parcelId.includes('SYL') || parcelId === 'BD-SYL-SRM-000108';

    const mouza = isSylhet ? 'Sreemangal Mouza' : 'Savar Mouza';
    const upazila = isSylhet ? 'Sreemangal' : 'Savar';
    const district = isSylhet ? 'Moulvibazar' : 'Dhaka';
    const ownerName = isSylhet ? 'Tanvir Ahmed' : 'Mohammad Rafiqul Islam';
    const khatianNo = isSylhet ? 'BS-5510' : 'RS-4412';
    const dagNo = isSylhet ? '2041' : '112';
    const areaDecimal = isSylhet ? 45.0 : 5.5;

    const trustScore = isEncroached ? 33 : (isSylhet ? 96 : 93);
    const verdict: LandGuardVerdict = isEncroached ? 'CRITICAL_FRAUD_FLAGGED' : 'CLEARED_PROTECTED';

    const pillars: LandGuardPillarEvaluation[] = [
      {
        pillarId: 'DEED_FORENSICS',
        titleEn: 'Dalil Deed & Title Forgery Scan',
        titleBn: 'দলিল জালিয়াতি ও স্বত্ব বিশ্লেষণ',
        status: isEncroached ? 'FAIL' : 'PASS',
        score: isEncroached ? 10 : 95,
        weightPercent: 30,
        weightedScore: isEncroached ? 3 : 28,
        highlightMetric: isEncroached ? 'Deceased Seller NID' : '100% Authentic',
        summaryEn: isEncroached
          ? 'High risk: Seller NID flagged as deceased. Civil court injunction active.'
          : 'Dalil chain unbroken. No area inflation or statutory valuation disparity.',
        summaryBn: isEncroached
          ? 'উচ্চ ঝুঁকি: বিক্রেতার এনআইডি মৃত চিহ্নিত। দেওয়ানি আদালতের নিষেধাজ্ঞা বিদ্যমান।'
          : 'দলিলের ধারাবাহিকতা অটুট। অতিরিক্ত জমির দাবি বা বাজারমূল্য ফাঁকি নেই।',
        drillDownTarget: 'deed',
      },
      {
        pillarId: 'DRONE_CADASTRE',
        titleEn: 'Drone Cadastre & Boundary Drift',
        titleBn: 'ড্রোন ক্যাডাস্ট্রে ও সীমানা পরিবর্তন',
        status: isEncroached ? 'FAIL' : 'PASS',
        score: isEncroached ? 20 : 100,
        weightPercent: 20,
        weightedScore: isEncroached ? 4 : 20,
        highlightMetric: isEncroached ? 'Canal Drift 8.6m' : '±0.45m Congruent',
        summaryEn: isEncroached
          ? 'Drone survey reveals northern vertex extends 8.6m into government canal.'
          : 'BDS 2026 drone vector congruent with historic RS 1988 cadastral boundaries.',
        summaryBn: isEncroached
          ? 'ড্রোন জরিপে দেখা যায় উত্তর সীমানা সরকারি খালে ৮.৬ মিটার প্রসারিত।'
          : 'ঐতিহাসিক আরএস নকশার সাথে ড্রোন বিডিএস ২০২৬ এর নিখুঁত সামঞ্জস্য।',
        drillDownTarget: 'drone',
      },
      {
        pillarId: 'KHAS_PROXIMITY',
        titleEn: 'Government Khas & Wetland Buffer',
        titleBn: 'সরকারি খাস ও জলাশয় বাফার যাচাই',
        status: isEncroached ? 'FAIL' : 'PASS',
        score: isEncroached ? 15 : 100,
        weightPercent: 20,
        weightedScore: isEncroached ? 3 : 20,
        highlightMetric: isEncroached ? '15m Riverbed Encroachment' : '1,239m Safe Distance',
        summaryEn: isEncroached
          ? 'CRITICAL_ENCROACHMENT: Boundary intersects 1 No. Khas Riverbed foreshore.'
          : 'Clear Title: Property is well outside statutory Khas and wetland buffers.',
        summaryBn: isEncroached
          ? 'মারাত্মক দখল: সীমানা ১নং খাস নদী সিকস্তি জমির অন্তর্ভুক্ত।'
          : 'নিরাপদ স্বত্ব: কোনো সরকারি খাস বা জলাশয় সীমানার নিকটে নয়।',
        drillDownTarget: 'khas',
      },
      {
        pillarId: 'EVIDENCE_CHAIN',
        titleEn: 'Cryptographic Chain-of-Custody',
        titleBn: 'ক্রিপ্টোগ্রাফিক সাক্ষ্য লেজার',
        status: 'PASS',
        score: 100,
        weightPercent: 15,
        weightedScore: 15,
        highlightMetric: '7 Blocks Verified',
        summaryEn: 'SHA-256 hash continuity and Ed25519 digital signatures verified across all blocks.',
        summaryBn: 'সকল ব্লকে অপরিবর্তনীয় SHA-256 হ্যাশ চেইন ও ডিজিটাল স্বাক্ষর সুরক্ষিত।',
        drillDownTarget: 'evidence',
      },
      {
        pillarId: 'LAND_LOCK',
        titleEn: 'Biometric Anti-Fraud Land Lock',
        titleBn: 'বায়োমেট্রিক জমি সুরক্ষা লক',
        status: isEncroached ? 'WARNING' : 'PASS',
        score: isEncroached ? 70 : 100,
        weightPercent: 15,
        weightedScore: isEncroached ? 10 : 15,
        highlightMetric: isEncroached ? 'UNLOCKED' : 'ACTIVE / FROZEN',
        summaryEn: isEncroached
          ? 'Property Lock is inactive. Unauthorized conveyance deeds could be attempted.'
          : 'Biometric Property Lock active. Registry transfers and mutations frozen.',
        summaryBn: isEncroached
          ? 'জমি লক নিষ্ক্রিয়। বায়োমেট্রিক সুরক্ষা সক্রিয় করার সুপারিশ করা হচ্ছে।'
          : 'বায়োমেট্রিক জমি লক সক্রিয়। সাব-রেজিস্ট্রি এবং নামজারি মিউটেশন স্থগিত।',
        drillDownTarget: 'lock',
      },
    ];

    const auditedAt = new Date().toISOString();
    return {
      parcelId,
      mouza,
      upazila,
      district,
      ownerName,
      khatianNo,
      dagNo,
      areaDecimal,
      trustScore,
      verdict,
      verdictTitleEn: isEncroached ? 'Critical Fraud & Legal Risk Detected' : 'Cleared & Protected Title',
      verdictTitleBn: isEncroached ? 'মারাত্মক জালিয়াতি বা আইনি জটিলতা শনাক্ত' : 'স্বত্ব সম্পূর্ণ সুরক্ষিত ও ত্রুটিমুক্ত',
      aiExplanationEn: isEncroached
        ? 'CRITICAL ALERT: AI LandGuard has detected active stay order and drone cadastral canal encroachment. Conveyance deeds must be halted.'
        : 'AI LandGuard has verified all 5 security dimensions. The deed lineage is authentic, drone vectors match RS 1988 boundaries within 0.45m, and tamper-evident ledger is cryptographically sealed.',
      aiExplanationBn: isEncroached
        ? 'জরুরি সতর্কবার্তা: এআই ল্যান্ডগার্ড আদালতের নিষেধাজ্ঞা এবং সরকারি খালে সীমানা বিকৃতি শনাক্ত করেছে। দলিল রেজিস্ট্রি স্থগিত রাখা বাধ্যতামূলক।'
        : 'এআই ল্যান্ডগার্ড ৫টি স্তরেই জমিটিকে যাচাই করেছে। দলিলের শুদ্ধতা, ড্রোনের নিখুঁত নকশা এবং ক্রিপ্টোগ্রাফিক সাক্ষ্য সুরক্ষিত রয়েছে। জমিটি সম্পূর্ণ নিরাপদ।',
      isLocked: !isEncroached,
      pillars,
      auditedAt,
      qrPayload: `AILG:v2:${parcelId}:${trustScore}:${verdict}:${auditedAt.substring(0, 10)}`,
    };
  }
}

export async function toggleLandGuardLock(
  parcelId: string,
  nidNumber?: string,
  biometricToken?: string
): Promise<{ parcelId: string; isLocked: boolean; blockAppended: boolean }> {
  try {
    return await req<{ parcelId: string; isLocked: boolean; blockAppended: boolean }>('/api/landguard/toggle-lock', {
      method: 'POST',
      body: JSON.stringify({ parcelId, nidNumber, biometricToken }),
    });
  } catch {
    setSource('demo');
    const isLocked = toggleDemoParcelLock(parcelId, biometricToken || '1234');
    return {
      parcelId,
      isLocked,
      blockAppended: true,
    };
  }
}

export async function exportLandGuardDossier(parcelId: string): Promise<LandGuardDossier> {
  try {
    return await req<LandGuardDossier>(`/api/landguard/dossier/${encodeURIComponent(parcelId)}`);
  } catch {
    setSource('demo');
    const audit = await getLandGuardAudit(parcelId);
    const dossierId = `LG-DOSSIER-${parcelId}-${Date.now().toString(36).toUpperCase()}`;
    return {
      dossierId,
      parcelId,
      audit,
      exportedAt: new Date().toISOString(),
      qrPayload: `AILG-CERT:${dossierId}:${parcelId}:${audit.trustScore}:${audit.verdict}`,
      issuerAuthority: 'Ministry of Land AI LandGuard National Verification Cell, Government of Bangladesh',
      legalDisclaimerBn: 'ভূমি মন্ত্রণালয়ের এআই ল্যান্ডগার্ড স্মার্ট যাচাইকরণ প্রতিবেদন। দ্য রেজিস্ট্রেশন অ্যাক্ট ১৯০৮ (ধারা ৫২এ) এবং ডিজিটাল সাক্ষ্য আইন অনুযায়ী সত্যায়িত।',
      legalDisclaimerEn: 'Authoritative AI LandGuard Property Verification Dossier. Certified under Registration Act 1908 (Sec 52A) and Bangladesh Digital Evidence framework.',
    };
  }
}

/* =============================================================
 * INTER-REGISTRY LOCK & TITLE ENCUMBRANCE API CLIENT
 * ============================================================= */

export async function getInterAgencyDashboard(parcelId: string): Promise<InterAgencyDashboardState> {
  try {
    return await req<InterAgencyDashboardState>(`/api/registry-locks/${encodeURIComponent(parcelId)}`);
  } catch {
    setSource('demo');
    const isDisputed = parcelId.includes('000003');
    const isSylhet = parcelId.toUpperCase().includes('SYL');
    const hasMortgage = parcelId.includes('000002');
    const hasEscrow = parcelId.includes('000001');

    return {
      parcelId,
      isFullyClear: !isDisputed && !hasMortgage && !hasEscrow,
      overallStatusEn: isDisputed
        ? 'DISPUTED_STAY_LOCKED'
        : hasEscrow
        ? 'ESCROW_FROZEN'
        : hasMortgage
        ? 'BANK_MORTGAGED'
        : 'CLEAN_UNENCUMBERED',
      overallStatusBn: isDisputed
        ? 'আদালতের স্থগিতাদেশযুক্ত / বিতর্কিত জমি (Judicial Stay Locked)'
        : hasEscrow
        ? 'বায়না চুক্তি ও এসক্রো প্রক্রিয়াধীন (Escrow Transfer Frozen)'
        : hasMortgage
        ? 'ব্যাংক চার্জ ও বন্ধকযুক্ত (Bank Mortgage Encumbered)'
        : 'সম্পূর্ণ দায়মুক্ত ও লেনদেন নিরাপদ (Clean & Unencumbered)',
      activeLockCount: isDisputed ? 1 : hasMortgage ? 1 : hasEscrow ? 1 : 0,
      locks: isDisputed
        ? [
            {
              id: 'lck-001',
              lockToken: 'LCK-2025-CRT-14209',
              parcelId,
              lockType: 'JUDICIAL_STAY',
              status: 'ACTIVE',
              priority: 1,
              lockingAuthority: 'Senior Assistant Judge Court, Savar, Dhaka',
              authorityCategory: 'JUDICIARY',
              initiatorName: 'Alhaj Mokhlesur Rahman (Claimant in TS-142/2025)',
              referenceNumber: 'TS-142/2025',
              statutoryBasis: 'CPC 1908 (Order 39 Rules 1-2) & Section 52 Transfer of Property Act',
              orderSummaryEn: 'Temporary injunction restraining alienation, conveyance, or mutation of Dag #482.',
              orderSummaryBn: 'মামলার চূড়ান্ত নিষ্পত্তি না হওয়া পর্যন্ত হস্তান্তর ও নামজারি সম্পূর্ণ নিষিদ্ধ।',
              acquiredAt: '2025-02-01T10:00:00.000Z',
              ed25519Signature: 'sig_court_ed25519_verified_003',
              auditHash: '0x88fbc92193e8a4d019f2a994',
            },
          ]
        : hasMortgage
        ? [
            {
              id: 'lck-002',
              lockToken: 'LCK-2024-BNK-88120',
              parcelId,
              lockType: 'MORTGAGE_LIEN',
              status: 'ACTIVE',
              priority: 4,
              lockingAuthority: 'Sonali Bank PLC (Savar Cantonment Branch)',
              authorityCategory: 'BANKING',
              initiatorName: 'Mohammad Rafiqul Islam (Borrower)',
              referenceNumber: 'LN-2024-SONALI-4812 / CIB-BB-2026-904812',
              statutoryBasis: 'Transfer of Property Act 1882 Sec 58 & BB BRPD Circular 2018',
              orderSummaryEn: '1st charge equitable mortgage securing institutional loan of BDT 2,500,000.',
              orderSummaryBn: 'সোনালী ব্যাংক পিএলসি এর অনুকূলে ২৫,০০,০০০ টাকার ১ম চার্জ বন্ধকি দায়।',
              acquiredAt: '2024-03-12T10:00:00.000Z',
              ed25519Signature: 'sig_bank_ed25519_verified_002',
              auditHash: '0x1928374a9bc81726f5e4d3c2',
            },
          ]
        : hasEscrow
        ? [
            {
              id: 'lck-003',
              lockToken: 'LCK-2026-ESC-08141',
              parcelId,
              lockType: 'ESCROW_CONVEYANCE',
              status: 'ACTIVE',
              priority: 3,
              lockingAuthority: 'Smart LandLock Escrow Engine (ESC-2026-0814)',
              authorityCategory: 'LAND_MINISTRY',
              initiatorName: 'Tanvir Ahmed (Contracted Buyer)',
              referenceNumber: 'ESC-2026-0814',
              statutoryBasis: 'Zero-Trust Land Conveyance Protocol & Registration Act 1908',
              orderSummaryEn: 'In-flight purchase escrow. Transfer frozen against secondary sale.',
              orderSummaryBn: 'দ্বৈত বিক্রয় রোধে এই দাগের অন্য কোনো দলিল রেজিস্ট্রি সাময়িক স্থগিত।',
              acquiredAt: '2026-09-18T09:15:00.000Z',
              ed25519Signature: 'sig_escrow_ed25519_verified_001',
              auditHash: '0xabcde12345ff990088776655',
            },
          ]
        : [],
      agencyStatuses: {
        landMinistry: {
          status: isDisputed ? 'HEARING_FROZEN' : 'UNRESTRICTED',
          canMutate: !isDisputed,
          activeKhatian: isSylhet ? 'BS-5510' : 'RS-4412',
          summaryEn: isDisputed
            ? 'e-Mutation hearings suspended by AC (Land) following Civil Court stay notice.'
            : 'Pre-requisites satisfied for instant digital e-Mutation upon deed registration.',
          summaryBn: isDisputed
            ? 'আদালতের নিষেধাজ্ঞার কারণে সহকারী কমিশনার (ভূমি) এজলাসে নামজারি শুনানি স্থগিত।'
            : 'দলিল রেজিস্ট্রি সাপেক্ষে তাৎক্ষণিক ই-নামজারি নিষ্পত্তির জন্য প্রস্তুত।',
        },
        lawMinistry: {
          status: isDisputed ? 'REGISTRATION_BARRED' : hasMortgage ? 'CONDITIONAL_NOC' : 'UNRESTRICTED',
          canConvey: !isDisputed && !hasMortgage && !hasEscrow,
          subRegistryOffice: isSylhet ? 'Sreemangal Sub-Registry Office' : 'Savar Sub-Registry Office',
          summaryEn: isDisputed
            ? 'Deed registration barred under Section 52A Registration Act 1908 & CPC Order 39.'
            : hasMortgage
            ? 'Conditional: Requires Bank No Objection Certificate (NOC) before deed execution.'
            : hasEscrow
            ? 'Parallel deed registration locked out under active purchase escrow agreement.'
            : 'Deed registration eligible with zero caveats in Sub-Registry Book 1 archives.',
          summaryBn: isDisputed
            ? 'সাব-রেজিস্ট্রি অফিসে সাফ-কবলা দলিল সম্পাদন আইনত নিষিদ্ধ।'
            : hasMortgage
            ? 'ব্যাংকের অনাপত্তিপত্র (NOC) দাখিল সাপেক্ষে দলিল রেজিস্ট্রি সম্ভব।'
            : 'দলিল সম্পাদনের জন্য সম্পূর্ণ প্রস্তুত ও নির্বিঘ্ন।',
        },
        judiciary: {
          status: isDisputed ? 'INJUNCTION_ACTIVE' : 'CLEAN',
          hasInjunction: isDisputed,
          courtName: isDisputed ? 'Senior Assistant Judge Court, Savar, Dhaka' : undefined,
          caseNumber: isDisputed ? 'TS-142/2025' : undefined,
          summaryEn: isDisputed
            ? 'Temporary Injunction active in Suit TS-142/2025. Restrains alienation of land.'
            : 'Zero civil injunctions, stay orders, or pending lis pendens caveats on court dockets.',
          summaryBn: isDisputed
            ? 'মামলা নং TS-142/2025 এ সিনিয়র সহকারী জজ আদালত কর্তৃক অস্থায়ী নিষেধাজ্ঞা বলবৎ।'
            : 'দেওয়ানি আদালতে কোনো মামলা বা স্থগিতাদেশ নেই।',
        },
        centralBankCib: {
          status: hasMortgage ? 'FIRST_CHARGE_ACTIVE' : 'NO_LIEN',
          hasActiveMortgage: hasMortgage,
          primaryBank: hasMortgage ? 'Sonali Bank PLC' : undefined,
          sanctionedBdt: hasMortgage ? 2500000 : 0,
          summaryEn: hasMortgage
            ? 'Registered 1st charge in CIB II by Sonali Bank PLC (BDT 2,500,000).'
            : 'Zero active mortgages or institutional charges in Bangladesh Bank CIB II.',
          summaryBn: hasMortgage
            ? 'সোনালী ব্যাংক পিএলসি এ ২৫,০০,০০০ টাকার বন্ধকি চার্জ সিআইবিতে অন্তর্ভুক্ত রয়েছে।'
            : 'বাংলাদেশ ব্যাংক সিআইবি ডাটাবেজে কোনো বন্ধক বা আর্থিক দায় নেই।',
        },
      },
      lastSyncedAt: new Date().toISOString(),
    };
  }
}

export async function inquireCibMortgages(parcelId: string): Promise<CibInquiryResult> {
  try {
    return await req<CibInquiryResult>(`/api/registry-locks/${encodeURIComponent(parcelId)}/mortgages`);
  } catch {
    setSource('demo');
    const hasMortgage = parcelId.includes('000002');
    return {
      parcelId,
      hasActiveMortgage: hasMortgage,
      totalMortgageCount: hasMortgage ? 1 : 0,
      totalSanctionedAmountBDT: hasMortgage ? 2500000 : 0,
      primaryChargeHolder: hasMortgage ? 'Sonali Bank PLC' : undefined,
      liens: hasMortgage
        ? [
            {
              cibTrackingToken: 'CIB-BB-2026-904812',
              parcelId,
              bankCode: 'SONALI',
              bankName: 'Sonali Bank PLC',
              branchName: 'Savar Cantonment Branch',
              routingNumber: '200260481',
              sanctionedAmountBDT: 2500000,
              outstandingBalanceBDT: 1850000,
              chargeRank: 1,
              isPariPassuConsent: false,
              status: 'ACTIVE_LIEN',
              sanctionDate: '2024-03-12T10:00:00.000Z',
              mortgageDeedNumber: 'DALIL-MTG-8812/2024',
              borrowerNid: '19852691234567890',
              borrowerName: 'Mohammad Rafiqul Islam',
            },
          ]
        : [],
      cibScore: hasMortgage ? 685 : 820,
      canPledgeNewMortgage: !hasMortgage,
      rejectionReason: hasMortgage
        ? 'DOUBLE_MORTGAGE_COLLISION: Active 1st Charge held by Sonali Bank PLC. Secondary charge prohibited without Pari-Passu consortium consent.'
        : undefined,
      inquiryTimestamp: new Date().toISOString(),
      inquiryReference: `CIB-INQ-${Date.now().toString().slice(-8)}`,
    };
  }
}

export async function registerCibMortgage(parcelId: string, data: any): Promise<any> {
  return await req<any>(`/api/registry-locks/${encodeURIComponent(parcelId)}/mortgages`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function issueBankNoc(token: string): Promise<{ success: boolean; nocNumber?: string }> {
  try {
    return await req<{ success: boolean; nocNumber?: string }>(`/api/registry-locks/mortgages/${encodeURIComponent(token)}/noc`, {
      method: 'POST',
      body: JSON.stringify({ officerNid: '19852691234567890' }),
    });
  } catch {
    setSource('demo');
    return { success: true, nocNumber: `NOC-SONALI-2026-${Math.floor(10000 + Math.random() * 90000)}` };
  }
}

export async function dischargeCibMortgage(token: string, satisfactionDeedNo?: string): Promise<{ success: boolean }> {
  try {
    return await req<{ success: boolean }>(`/api/registry-locks/mortgages/${encodeURIComponent(token)}/satisfy`, {
      method: 'POST',
      body: JSON.stringify({ satisfactionDeedNo }),
    });
  } catch {
    setSource('demo');
    return { success: true };
  }
}

export async function getNonEncumbranceCertificate(
  parcelId: string,
  params?: { applicantName?: string; applicantNid?: string; purpose?: string }
): Promise<NonEncumbranceCertificate> {
  const query = new URLSearchParams();
  if (params?.applicantName) query.set('applicantName', params.applicantName);
  if (params?.applicantNid) query.set('applicantNid', params.applicantNid);
  if (params?.purpose) query.set('purpose', params.purpose);

  const qs = query.toString() ? `?${query.toString()}` : '';
  try {
    return await req<NonEncumbranceCertificate>(`/api/registry-locks/${encodeURIComponent(parcelId)}/nec${qs}`);
  } catch {
    setSource('demo');
    const isDisputed = parcelId.includes('000003');
    const hasMortgage = parcelId.includes('000002');
    const isSylhet = parcelId.toUpperCase().includes('SYL');

    const certNo = `NEC-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date().toISOString();

    return {
      certificateNumber: certNo,
      parcelId,
      mouza: isSylhet ? 'Radhanagar Mouza' : 'Savar Mouza',
      upazila: isSylhet ? 'Sreemangal' : 'Savar',
      district: isSylhet ? 'Moulvibazar' : 'Dhaka',
      khatianNo: isSylhet ? 'BS-5510' : 'RS-4412',
      dagNo: isSylhet ? '2041' : '112',
      areaDecimal: isSylhet ? 45.0 : 5.5,
      currentOwnerName: isSylhet ? 'Tanvir Ahmed' : 'Kamal Hossain',
      currentOwnerNid: isSylhet ? '19882691002233441' : '19852692011000123',
      applicantName: params?.applicantName || 'Tanvir Ahmed',
      applicantNid: params?.applicantNid || '19882691234567891',
      purpose: params?.purpose || 'Bank Loan Underwriting / Property Conveyance Due Diligence',
      isFullyUnencumbered: !isDisputed && !hasMortgage,
      encumbranceStatusEn: isDisputed
        ? 'STRICTLY_ENCUMBERED'
        : hasMortgage
        ? 'CONDITIONAL_CAUTION'
        : 'CLEAN_UNENCUMBERED',
      encumbranceStatusBn: isDisputed
        ? 'আদালতের স্থগিতাদেশযুক্ত (হস্তান্তর নিষিদ্ধ)'
        : hasMortgage
        ? 'শর্তসাপেক্ষ দায়যুক্ত (ব্যাংক চার্জ বিদ্যমান)'
        : 'নির্দায় ও দায়মুক্ত (সম্পূর্ণ পরিষ্কার স্বত্ব)',
      registryClearances: {
        cibBankMortgages: {
          status: hasMortgage ? 'FAIL' : 'PASS',
          findingEn: hasMortgage
            ? 'Active 1st charge equitable mortgage in CIB II (BDT 2,500,000).'
            : 'Zero active registered mortgages in Bangladesh Bank CIB II.',
          findingBn: hasMortgage ? 'সোনালী ব্যাংকে বন্ধকি দায় বিদ্যমান।' : 'কোনো ব্যাংক বন্ধক বা আর্থিক দায় নেই।',
          activeLienCount: hasMortgage ? 1 : 0,
          totalLienBdt: hasMortgage ? 2500000 : 0,
        },
        judicialCourts: {
          status: isDisputed ? 'FAIL' : 'PASS',
          findingEn: isDisputed
            ? 'Active Civil Court injunction under CPC Order 39 (TS-142/2025).'
            : 'Zero active stay orders or injunctions in District & Assistant Judge Courts.',
          findingBn: isDisputed ? 'আদালতের স্থগিতাদেশ বলবৎ রয়েছে।' : 'কোনো মামলা বা নিষেধাজ্ঞা নেই।',
          activeInjunctionCount: isDisputed ? 1 : 0,
        },
        subRegistryArchives: {
          status: 'PASS',
          findingEn: 'Continuous 30-year unbroken chain of title verified in Sub-Registry Book 1.',
          findingBn: 'সাব-রেজিস্ট্রি বালাম বই ১ এ ৩০ বছরের ধারাবাহিকতা প্রত্যয়িত।',
          historicalDeedCount: 3,
        },
        governmentKhasCanal: {
          status: 'PASS',
          findingEn: 'Safe private title. Distance to nearest public canal/wetland is 142m.',
          findingBn: 'নিরাপদ ব্যক্তিমালিকানাধীন জমি। নিকটস্থ সরকারি খাস জলাশয় হতে দূরত্ব ১৪২ মিটার।',
          khasRiskLevel: 'CLEAN',
        },
      },
      thirtyYearAuditChain: [
        {
          periodYears: '1920 - 1956',
          surveyEpoch: 'CS (1920)',
          deedOrKhatianRef: 'CS Khatian #104',
          grantor: 'Cadastral Survey Registry',
          grantee: 'Late Alimuddin Sarkar',
          transferType: 'Cadastral Allotment',
          status: 'CLEAR_VALID',
        },
        {
          periodYears: '1956 - 1978',
          surveyEpoch: 'SA (1956)',
          deedOrKhatianRef: 'SA Khatian #218',
          grantor: 'State Acquisition Settlement',
          grantee: 'Azharuddin Sarkar',
          transferType: 'Hereditary Succession (Faraiz)',
          status: 'CLEAR_VALID',
        },
        {
          periodYears: '1978 - 2015',
          surveyEpoch: 'RS (1978)',
          deedOrKhatianRef: 'RS Khatian #482',
          grantor: 'Azharuddin Sarkar',
          grantee: 'Abdul Karim Mia',
          transferType: 'Baya Dalil #1982-SAV-3109',
          status: 'CLEAR_VALID',
        },
        {
          periodYears: '2015 - 2026',
          surveyEpoch: 'BS (2015)',
          deedOrKhatianRef: 'DALIL-2018-SAV-4821',
          grantor: 'Abdul Karim Mia',
          grantee: 'Kamal Hossain',
          transferType: 'Registered Conveyance Deed (Kabala)',
          status: isDisputed ? 'DISPUTED' : hasMortgage ? 'ENCUMBERED' : 'CLEAR_VALID',
        },
      ],
      issuedAt: now,
      expiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
      issuingAuthorityEn: 'Office of the Assistant Commissioner (Land) & Sub-Registry Joint Clearance Cell',
      issuingAuthorityBn: 'সহকারী কমিশনার (ভূমি) ও সাব-রেজিস্ট্রার যৌথ স্বত্ব ও দায়মুক্তি সেল',
      statutoryDisclaimerEn:
        'Certified under Section 57 Registration Act 1908 and Section 143 SAT Act 1950 via synchronized multi-agency registry audit.',
      statutoryDisclaimerBn:
        'রেজিস্ট্রেশন আইন ১৯০৮ এর ৫৭ ধারা ও প্রজাস্বত্ব আইন ১৯৫০ এর ১৪৩ ধারা অনুযায়ী চারটি সরকারি ডাটাবেজের সমন্বয়ে প্রদত্ত।',
      ed25519Signature: 'sig_ed25519_verified_nec_clearance_hash_2026',
      verificationHash: `0x${certNo.slice(-6)}${Date.now().toString(16)}`,
      publicKeyBase64: 'MCowBQYDK2VwAyEANkP...',
      qrPayload: `BDSIG:v1:${certNo}:HASH9901:${Date.now()}`,
    };
  }
}

export async function simulateCrossAgencyEvent(
  parcelId: string,
  scenario: string,
  extraParams?: any
): Promise<any> {
  try {
    return await req<any>(`/api/registry-locks/${encodeURIComponent(parcelId)}/simulate`, {
      method: 'POST',
      body: JSON.stringify({ scenario, extraParams }),
    });
  } catch {
    setSource('demo');
    if (scenario === 'DOUBLE_SALE_ATTEMPT') {
      return {
        success: true,
        event: 'DOUBLE_SALE_INTERCEPTED',
        messageEn: 'FRAUD PREVENTED: Sub-Registry locked out second buyer deed registration! Parcel is locked under active purchase escrow (ESC-2026-0814). Parallel conveyance prohibited.',
        messageBn: 'জালিয়াতি প্রতিহত: সাব-রেজিস্ট্রারে দ্বিতীয় ক্রেতার সাফ-কবলা দলিল রেজিস্ট্রি স্বয়ংক্রিয়ভাবে আটকে দেওয়া হয়েছে! জমিটি সক্রিয় বায়না চুক্তির অধীনে লক রয়েছে।',
        outcome: { blocked: true, statuteRef: 'Registration Act 1908 Sec 52A & Penal Code Sec 420' },
      };
    } else if (scenario === 'DOUBLE_MORTGAGE_ATTEMPT') {
      return {
        success: true,
        event: 'DOUBLE_MORTGAGE_BLOCKED',
        messageEn: 'CIB COLLISION PREVENTED: Secondary bank loan rejected! Parcel is already encumbered by Sonali Bank PLC (1st Charge BDT 2,500,000). Multiple 1st charges prohibited.',
        messageBn: 'দ্বৈত বন্ধক প্রতিহত: বাংলাদেশ ব্যাংক সিআইবি ডাটাবেজে দ্বিতীয় ব্যাংকের বন্ধক চেষ্টা আটকে দেওয়া হয়েছে! সোনালী ব্যাংকের ১ম চার্জ বন্ধক বিদ্যমান।',
        outcome: { blocked: true, statuteRef: 'Transfer of Property Act 1882 Sec 58' },
      };
    } else if (scenario === 'COURT_INJUNCTION_ISSUED') {
      return {
        success: true,
        event: 'JUDICIAL_STAY_APPLIED',
        messageEn: 'Civil court injunction issued (TS-142/2026). All 4 registries locked instantly under CPC Order 39!',
        messageBn: 'আদালতের নিষেধাজ্ঞা জারি (TS-142/2026)। এসিল্যান্ড ও সাব-রেজিস্ট্রিতে জমি তাৎক্ষণিক লক!',
        outcome: { caseNumber: 'TS-142/2026' },
      };
    } else if (scenario === 'COURT_INJUNCTION_VACATED') {
      return {
        success: true,
        event: 'JUDICIAL_STAY_VACATED',
        messageEn: 'Civil court injunction vacated. Title unlocked across all agencies.',
        messageBn: 'আদালতের নিষেধাজ্ঞা প্রত্যাহার সম্পন্ন। জমি পুনরায় লেনদেনের জন্য উন্মুক্ত।',
        outcome: { isLocked: false },
      };
    } else if (scenario === 'BANK_NOC_ISSUED') {
      return {
        success: true,
        event: 'BANK_NOC_ISSUED',
        messageEn: 'Bank No Objection Certificate (NOC-SONALI-2026-90412) registered. Conditional conveyance permitted.',
        messageBn: 'ব্যাংকের অনাপত্তিপত্র (NOC-SONALI-2026-90412) নিবন্ধিত। শর্তসাপেক্ষ জমি হস্তান্তর অনুমোদিত।',
        outcome: { nocNumber: 'NOC-SONALI-2026-90412' },
      };
    } else {
      return {
        success: true,
        event: 'OWNER_LOCK_TOGGLED',
        messageEn: 'Citizen property lock status toggled successfully.',
        messageBn: 'মালিকানা বায়োমেট্রিক লক সফলভাবে আপডেট করা হয়েছে।',
        outcome: { toggled: true },
      };
    }
  }
}

