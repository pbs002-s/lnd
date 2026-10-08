/**
 * Bangladesh Bank CIB II & National Collateral Registry Gateway
 * Simulates inter-bank mortgage lien verification, collateral pledges,
 * LTV compliance, and No Objection Certificate (NOC) issuance.
 */

export interface CibLienRecord {
  cibTrackingToken: string;
  parcelId: string;
  bankCode: string;
  bankName: string;
  branchName: string;
  routingNumber: string;
  sanctionedAmountBDT: number;
  outstandingBalanceBDT: number;
  chargeRank: number; // 1 = First Charge, 2 = Second Charge
  isPariPassuConsent: boolean;
  status: 'ACTIVE_LIEN' | 'NOC_ISSUED' | 'DISCHARGED' | 'DEFAULT_AUCTION';
  nocReferenceNumber?: string;
  sanctionDate: string;
  mortgageDeedNumber?: string;
  borrowerNid: string;
  borrowerName: string;
}

export interface CibInquiryResult {
  parcelId: string;
  hasActiveMortgage: boolean;
  totalMortgageCount: number;
  totalSanctionedAmountBDT: number;
  primaryChargeHolder?: string;
  liens: CibLienRecord[];
  cibScore: number; // 300 to 900
  canPledgeNewMortgage: boolean;
  rejectionReason?: string;
  inquiryTimestamp: string;
  inquiryReference: string;
}

// In-Memory Seed Registry for Realistic Bangladesh Banking Simulation
const CIB_DATABASE: CibLienRecord[] = [
  {
    cibTrackingToken: 'CIB-BB-2026-904812',
    parcelId: 'BD-DHK-SAV-000002',
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
  {
    cibTrackingToken: 'CIB-BB-2025-110294',
    parcelId: 'BD-SYL-SRM-000108',
    bankCode: 'BRAC',
    bankName: 'BRAC Bank PLC',
    branchName: 'Sreemangal Branch',
    routingNumber: '060261942',
    sanctionedAmountBDT: 4000000,
    outstandingBalanceBDT: 0,
    chargeRank: 1,
    isPariPassuConsent: false,
    status: 'DISCHARGED',
    sanctionDate: '2021-06-15T09:30:00.000Z',
    mortgageDeedNumber: 'DALIL-MTG-4102/2021',
    borrowerNid: '19882691002233441',
    borrowerName: 'Tanvir Ahmed',
  },
];

export class CibGateway {
  /**
   * Cross-references parcel against Bangladesh Bank CIB II & Collateral Ledger
   */
  public static inquireCollateral(parcelId: string): CibInquiryResult {
    const cleanId = (parcelId || '').trim();
    const activeLiens = CIB_DATABASE.filter(
      (l) => l.parcelId.toLowerCase() === cleanId.toLowerCase() && l.status !== 'DISCHARGED'
    );

    const hasActiveMortgage = activeLiens.length > 0;
    const totalSanctioned = activeLiens.reduce((acc, l) => acc + l.sanctionedAmountBDT, 0);

    let canPledge = true;
    let rejectionReason: string | undefined;

    if (hasActiveMortgage) {
      const firstCharge = activeLiens.find((l) => l.chargeRank === 1);
      if (firstCharge && !firstCharge.isPariPassuConsent) {
        canPledge = false;
        rejectionReason = `DOUBLE_MORTGAGE_COLLISION: Active 1st Charge held by ${firstCharge.bankName} (BDT ${firstCharge.sanctionedAmountBDT.toLocaleString()}). Secondary charge prohibited without written Pari-Passu consortium consent.`;
      }
    }

    return {
      parcelId: cleanId,
      hasActiveMortgage,
      totalMortgageCount: activeLiens.length,
      totalSanctionedAmountBDT: totalSanctioned,
      primaryChargeHolder: activeLiens.length > 0 ? activeLiens[0].bankName : undefined,
      liens: CIB_DATABASE.filter((l) => l.parcelId.toLowerCase() === cleanId.toLowerCase()),
      cibScore: hasActiveMortgage ? 685 : 820,
      canPledgeNewMortgage: canPledge,
      rejectionReason,
      inquiryTimestamp: new Date().toISOString(),
      inquiryReference: `CIB-INQ-${Date.now().toString().slice(-8)}`,
    };
  }

  /**
   * Registers a new institutional mortgage charge on a parcel
   */
  public static registerLien(params: {
    parcelId: string;
    bankCode: string;
    bankName: string;
    branchName: string;
    routingNumber: string;
    sanctionedAmountBDT: number;
    borrowerNid: string;
    borrowerName: string;
    chargeRank?: number;
    isPariPassuConsent?: boolean;
    mortgageDeedNumber?: string;
  }): { success: boolean; record?: CibLienRecord; error?: string } {
    const inquiry = this.inquireCollateral(params.parcelId);

    // Enforce Double Mortgage Prevention
    if (inquiry.hasActiveMortgage && (params.chargeRank || 1) === 1) {
      return {
        success: false,
        error: `DOUBLE_MORTGAGE_VIOLATION: Parcel ${params.parcelId} is already encumbered by ${inquiry.primaryChargeHolder}. Cannot register parallel 1st Charge under Bangladesh Bank Prudential Regulations.`,
      };
    }

    if (inquiry.hasActiveMortgage && !params.isPariPassuConsent) {
      return {
        success: false,
        error: `PARI_PASSU_CONSENT_REQUIRED: Secondary charge requires explicit tripartite consent from primary lender (${inquiry.primaryChargeHolder}).`,
      };
    }

    const token = `CIB-BB-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const newRecord: CibLienRecord = {
      cibTrackingToken: token,
      parcelId: params.parcelId,
      bankCode: params.bankCode,
      bankName: params.bankName,
      branchName: params.branchName,
      routingNumber: params.routingNumber,
      sanctionedAmountBDT: params.sanctionedAmountBDT,
      outstandingBalanceBDT: params.sanctionedAmountBDT,
      chargeRank: params.chargeRank || (inquiry.hasActiveMortgage ? 2 : 1),
      isPariPassuConsent: !!params.isPariPassuConsent,
      status: 'ACTIVE_LIEN',
      sanctionDate: new Date().toISOString(),
      mortgageDeedNumber: params.mortgageDeedNumber || `DALIL-MTG-${Date.now().toString().slice(-5)}`,
      borrowerNid: params.borrowerNid,
      borrowerName: params.borrowerName,
    };

    CIB_DATABASE.unshift(newRecord);
    return { success: true, record: newRecord };
  }

  /**
   * Issues Bank No Objection Certificate (NOC) allowing conveyance with loan transfer/settlement
   */
  public static issueBankNoc(cibTrackingToken: string, issuingOfficerNid: string): { success: boolean; nocNumber?: string; error?: string } {
    const record = CIB_DATABASE.find((l) => l.cibTrackingToken === cibTrackingToken);
    if (!record) {
      return { success: false, error: 'CIB lien record not found.' };
    }

    const nocNumber = `NOC-${record.bankCode}-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    record.status = 'NOC_ISSUED';
    record.nocReferenceNumber = nocNumber;

    return { success: true, nocNumber };
  }

  /**
   * Discharges an institutional mortgage lien upon full loan satisfaction
   */
  public static dischargeLien(cibTrackingToken: string, satisfactionDeedNo: string): { success: boolean; error?: string } {
    const record = CIB_DATABASE.find((l) => l.cibTrackingToken === cibTrackingToken);
    if (!record) {
      return { success: false, error: 'CIB lien record not found.' };
    }

    record.status = 'DISCHARGED';
    record.outstandingBalanceBDT = 0;
    return { success: true };
  }
}
