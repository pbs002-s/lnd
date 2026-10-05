export interface LitigationCase {
  id: string;
  parcelId: string;
  caseNumber: string;
  courtName: string;
  suitType: 'TITLE_SUIT' | 'PARTITION_SUIT' | 'TEMPORARY_INJUNCTION' | 'LIS_PENDENS';
  suitTypeBn: string;
  claimant: string;
  defendant: string;
  filedDate: string;
  stayOrderActive: boolean;
  stayOrderDate?: string;
  nextHearingDate: string;
  status: 'ACTIVE_STAY' | 'PENDING_HEARING' | 'DISPOSED' | 'VACATED';
  orderSummary: string;
  orderSummaryBn: string;
  statutorySection: string;
}

const LITIGATION_REGISTRY: LitigationCase[] = [
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
    orderSummary:
      'Temporary injunction issued under Order 39 Rules 1-2 of CPC restraining defendant from alienating, conveying, transferring, or changing possession of Dag #482.',
    orderSummaryBn:
      'দেওয়ানি কার্যবিধির ৩৯ আদেশের ১-২ নিয়মমতে বিবাদীদের বিরুদ্ধে উক্ত দাগের জমি বিক্রয়, হস্তান্তর বা হস্তান্তরমূলক দলিল রেজিস্ট্রি ও নামজারির ওপর নিষেধাজ্ঞা বলবৎ।',
    statutorySection: 'Code of Civil Procedure 1908 (Order 39 Rules 1-2) & Section 52 Transfer of Property Act 1882',
  },
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

export class LitigationService {
  public static getByParcelId(parcelId: string): LitigationCase[] {
    const cleanId = (parcelId || '').trim();
    return LITIGATION_REGISTRY.filter((c) => c.parcelId.toLowerCase() === cleanId.toLowerCase());
  }

  public static hasActiveInjunction(parcelId: string): boolean {
    const cases = this.getByParcelId(parcelId);
    return cases.some((c) => c.stayOrderActive && c.status === 'ACTIVE_STAY');
  }

  public static addCase(entry: Omit<LitigationCase, 'id'>): LitigationCase {
    const newCase: LitigationCase = {
      id: `lit-${Date.now()}`,
      ...entry,
    };
    LITIGATION_REGISTRY.push(newCase);
    return newCase;
  }

  public static vacateStayOrder(caseNumber: string): boolean {
    const record = LITIGATION_REGISTRY.find((c) => c.caseNumber === caseNumber);
    if (!record) return false;
    record.stayOrderActive = false;
    record.status = 'VACATED';
    return true;
  }
}
