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



