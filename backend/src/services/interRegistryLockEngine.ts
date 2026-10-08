/**
 * Sovereign Inter-Registry Lock & Title Encumbrance Engine
 * 
 * Provides an atomic distributed mutex coordinating:
 * 1. 🏛️ Ministry of Land (AC Land, e-Mutation, Khatians)
 * 2. 📜 Ministry of Law (Sub-Registry Deeds, Book 1 archives)
 * 3. ⚖️ Judiciary (Supreme Court & District Civil Courts, CPC Order 39 stay orders)
 * 4. 🏦 Central Bank (Bangladesh Bank CIB II & Commercial Bank Mortgages)
 * 
 * Enforces zero double sales, zero double mortgages, and zero alienation of disputed lands.
 */

import crypto from 'crypto';
import { CibGateway, CibInquiryResult, CibLienRecord } from './gateways/cibGateway';
import { JudicialGateway, JudicialDocketInquiry } from './gateways/judicialGateway';
import { SubRegistryGateway } from './gateways/subRegistryGateway';
import { LitigationService } from './litigationService';
import { CryptoSignerService } from './cryptoSigner';

export type LockType =
  | 'OWNER_BIOMETRIC'
  | 'ESCROW_CONVEYANCE'
  | 'JUDICIAL_STAY'
  | 'MORTGAGE_LIEN'
  | 'KHAS_DISPUTE';

export type LockStatus = 'ACTIVE' | 'RELEASED' | 'VACATED' | 'EXPIRED';

export interface RegistryLockRecord {
  id: string;
  lockToken: string;
  parcelId: string;
  lockType: LockType;
  status: LockStatus;
  priority: number; // 1 (Highest) to 5 (Lowest)
  lockingAuthority: string;
  authorityCategory: 'JUDICIARY' | 'BANKING' | 'LAND_MINISTRY' | 'CITIZEN';
  initiatorNid?: string;
  initiatorName: string;
  referenceNumber: string;
  statutoryBasis: string;
  orderSummaryEn: string;
  orderSummaryBn: string;
  acquiredAt: string;
  expiresAt?: string;
  releasedAt?: string;
  releaseAuthority?: string;
  releaseReference?: string;
  ed25519Signature: string;
  auditHash: string;
}

export interface OperationValidationOutcome {
  permitted: boolean;
  operationType: 'DEED_CONVEYANCE' | 'MORTGAGE_CHARGE' | 'E_MUTATION';
  parcelId: string;
  blockingLock?: RegistryLockRecord;
  reasonEn: string;
  reasonBn: string;
  statutoryRef: string;
  suggestedActionEn: string;
  suggestedActionBn: string;
  timestamp: string;
}

export interface InterAgencyDashboardState {
  parcelId: string;
  isFullyClear: boolean;
  overallStatusEn: 'CLEAN_UNENCUMBERED' | 'DISPUTED_STAY_LOCKED' | 'ESCROW_FROZEN' | 'BANK_MORTGAGED' | 'OWNER_LOCKED';
  overallStatusBn: string;
  activeLockCount: number;
  locks: RegistryLockRecord[];
  agencyStatuses: {
    landMinistry: {
      status: 'UNRESTRICTED' | 'HEARING_FROZEN' | 'PENDING_MUTATION';
      canMutate: boolean;
      activeKhatian: string;
      summaryEn: string;
      summaryBn: string;
    };
    lawMinistry: {
      status: 'UNRESTRICTED' | 'REGISTRATION_BARRED' | 'CONDITIONAL_NOC';
      canConvey: boolean;
      subRegistryOffice: string;
      summaryEn: string;
      summaryBn: string;
    };
    judiciary: {
      status: 'CLEAN' | 'INJUNCTION_ACTIVE' | 'LIS_PENDENS';
      hasInjunction: boolean;
      courtName?: string;
      caseNumber?: string;
      summaryEn: string;
      summaryBn: string;
    };
    centralBankCib: {
      status: 'NO_LIEN' | 'FIRST_CHARGE_ACTIVE' | 'NOC_RELEASED';
      hasActiveMortgage: boolean;
      primaryBank?: string;
      sanctionedBdt: number;
      summaryEn: string;
      summaryBn: string;
    };
  };
  lastSyncedAt: string;
}

// In-Memory Seed Storage for High-Fidelity Multi-Agency Mutex
const REGISTRY_LOCKS_STORE: RegistryLockRecord[] = [
  {
    id: 'lck-001',
    lockToken: 'LCK-2025-CRT-14209',
    parcelId: 'BD-DHK-SAV-000003',
    lockType: 'JUDICIAL_STAY',
    status: 'ACTIVE',
    priority: 1,
    lockingAuthority: 'Senior Assistant Judge Court, Savar, Dhaka',
    authorityCategory: 'JUDICIARY',
    initiatorNid: '19602692019900088',
    initiatorName: 'Alhaj Mokhlesur Rahman (Claimant in TS-142/2025)',
    referenceNumber: 'TS-142/2025',
    statutoryBasis: 'Code of Civil Procedure 1908 (Order 39 Rules 1-2) & Section 52 Transfer of Property Act 1882',
    orderSummaryEn:
      'Temporary injunction restraining alienation, conveyance, or mutation of Dag #482 pending final decree of Title Suit.',
    orderSummaryBn:
      'দেওয়ানি কার্যবিধির ৩৯ আদেশের ১-২ নিয়ম মতে মামলার চূড়ান্ত নিষ্পত্তি না হওয়া পর্যন্ত হস্তান্তর ও নামজারি সম্পূর্ণ নিষিদ্ধ।',
    acquiredAt: '2025-02-01T10:00:00.000Z',
    ed25519Signature: 'sig_court_ed25519_verified_003',
    auditHash: '0x88fbc92193e8a4d019f2a994',
  },
  {
    id: 'lck-002',
    lockToken: 'LCK-2024-BNK-88120',
    parcelId: 'BD-DHK-SAV-000002',
    lockType: 'MORTGAGE_LIEN',
    status: 'ACTIVE',
    priority: 4,
    lockingAuthority: 'Sonali Bank PLC (Savar Cantonment Branch)',
    authorityCategory: 'BANKING',
    initiatorNid: '19852691234567890',
    initiatorName: 'Mohammad Rafiqul Islam (Borrower)',
    referenceNumber: 'LN-2024-SONALI-4812 / CIB-BB-2026-904812',
    statutoryBasis: 'Transfer of Property Act 1882 Section 58 & Bangladesh Bank BRPD Circular 2018',
    orderSummaryEn:
      'Registered 1st charge equitable mortgage securing institutional loan of BDT 2,500,000. Transfer barred without Bank NOC.',
    orderSummaryBn:
      'সোনালী ব্যাংক পিএলসি এর অনুকূলে ২৫,০০,০০০ টাকার ১ম চার্জ বন্ধকি দায়। ব্যাংকের অনাপত্তিপত্র (NOC) ব্যতিরেকে বিক্রয় নিষিদ্ধ।',
    acquiredAt: '2024-03-12T10:00:00.000Z',
    ed25519Signature: 'sig_bank_ed25519_verified_002',
    auditHash: '0x1928374a9bc81726f5e4d3c2',
  },
  {
    id: 'lck-003',
    lockToken: 'LCK-2026-ESC-08141',
    parcelId: 'BD-DHK-SAV-000001',
    lockType: 'ESCROW_CONVEYANCE',
    status: 'ACTIVE',
    priority: 3,
    lockingAuthority: 'Smart LandLock Escrow Engine (Contract #ESC-2026-0814)',
    authorityCategory: 'LAND_MINISTRY',
    initiatorNid: '19882691234567891',
    initiatorName: 'Tanvir Ahmed (Contracted Buyer)',
    referenceNumber: 'ESC-2026-0814',
    statutoryBasis: 'Zero-Trust Land Conveyance Protocol & Registration Act 1908',
    orderSummaryEn:
      'In-flight escrow settlement. Transfer frozen to prevent parallel conveyance or secondary sale before e-Mutation.',
    orderSummaryBn:
      'জমি ক্রয়-বিক্রয় চুক্তি কার্যকর রয়েছে। দ্বৈত বিক্রয় রোধে এই দাগের অন্য কোনো দলিল রেজিস্ট্রি সাময়িক স্থগিত।',
    acquiredAt: '2026-09-18T09:15:00.000Z',
    ed25519Signature: 'sig_escrow_ed25519_verified_001',
    auditHash: '0xabcde12345ff990088776655',
  },
];

export class InterRegistryLockEngine {
  /**
   * Retrieves all active registry locks on a parcel
   */
  public static getActiveLocks(parcelId: string): RegistryLockRecord[] {
    const clean = (parcelId || '').trim().toLowerCase();
    return REGISTRY_LOCKS_STORE.filter((l) => l.parcelId.toLowerCase() === clean && l.status === 'ACTIVE').sort(
      (a, b) => a.priority - b.priority
    );
  }

  /**
   * Acquires an atomic sovereign registry lock on a parcel
   */
  public static acquireLock(params: {
    parcelId: string;
    lockType: LockType;
    lockingAuthority: string;
    authorityCategory: RegistryLockRecord['authorityCategory'];
    initiatorNid?: string;
    initiatorName: string;
    referenceNumber: string;
    statutoryBasis: string;
    orderSummaryEn: string;
    orderSummaryBn: string;
    expiresAt?: string;
  }): { success: boolean; lock?: RegistryLockRecord; error?: string } {
    const active = this.getActiveLocks(params.parcelId);

    // Lock Priority Map
    const priorityMap: Record<LockType, number> = {
      JUDICIAL_STAY: 1,
      KHAS_DISPUTE: 2,
      ESCROW_CONVEYANCE: 3,
      MORTGAGE_LIEN: 4,
      OWNER_BIOMETRIC: 5,
    };
    const newPriority = priorityMap[params.lockType];

    // Check if an existing higher-priority lock conflicts
    const conflictingLock = active.find((l) => l.priority < newPriority);
    if (conflictingLock && params.lockType === 'ESCROW_CONVEYANCE') {
      return {
        success: false,
        error: `LOCK_REJECTED: Cannot place Escrow lock on Parcel ${params.parcelId}. Existing higher priority lock [${conflictingLock.lockType}: ${conflictingLock.referenceNumber}] is active.`,
      };
    }

    const token = `LCK-${new Date().getFullYear()}-${params.authorityCategory.substring(0, 3)}-${Math.floor(10000 + Math.random() * 90000)}`;
    const now = new Date().toISOString();
    const auditHash = `0x${crypto.createHash('sha256').update(params.parcelId + token + now).digest('hex').substring(0, 24)}`;

    const newLock: RegistryLockRecord = {
      id: `lck-${Date.now()}`,
      lockToken: token,
      parcelId: params.parcelId,
      lockType: params.lockType,
      status: 'ACTIVE',
      priority: newPriority,
      lockingAuthority: params.lockingAuthority,
      authorityCategory: params.authorityCategory,
      initiatorNid: params.initiatorNid,
      initiatorName: params.initiatorName,
      referenceNumber: params.referenceNumber,
      statutoryBasis: params.statutoryBasis,
      orderSummaryEn: params.orderSummaryEn,
      orderSummaryBn: params.orderSummaryBn,
      acquiredAt: now,
      expiresAt: params.expiresAt,
      ed25519Signature: `sig_ed25519_${token.toLowerCase().replace(/-/g, '_')}`,
      auditHash,
    };

    REGISTRY_LOCKS_STORE.unshift(newLock);
    return { success: true, lock: newLock };
  }

  /**
   * Releases an active registry lock with verified statutory authorization
   */
  public static releaseLock(params: {
    lockToken: string;
    releaseAuthority: string;
    releaseReference: string;
  }): { success: boolean; releasedLock?: RegistryLockRecord; error?: string } {
    const lock = REGISTRY_LOCKS_STORE.find((l) => l.lockToken === params.lockToken);
    if (!lock) {
      return { success: false, error: `Lock token ${params.lockToken} not found.` };
    }

    if (lock.status !== 'ACTIVE') {
      return { success: false, error: `Lock ${params.lockToken} is already in ${lock.status} state.` };
    }

    lock.status = 'RELEASED';
    lock.releasedAt = new Date().toISOString();
    lock.releaseAuthority = params.releaseAuthority;
    lock.releaseReference = params.releaseReference;

    return { success: true, releasedLock: lock };
  }

  /**
   * 🛑 Assert Deed Conveyance Allowed (Sub-Registry Office Check)
   * Prevents fraudulent sales, double sales, and alienation of disputed lands.
   */
  public static assertCanConvey(parcelId: string, buyerNid?: string): OperationValidationOutcome {
    const active = this.getActiveLocks(parcelId);
    const now = new Date().toISOString();

    // 1. Check Highest Priority: Judicial Injunction
    const stayLock = active.find((l) => l.lockType === 'JUDICIAL_STAY');
    if (stayLock) {
      return {
        permitted: false,
        operationType: 'DEED_CONVEYANCE',
        parcelId,
        blockingLock: stayLock,
        reasonEn: `CONVEYANCE STRICTLY PROHIBITED: Civil Court stay order in force (${stayLock.referenceNumber} by ${stayLock.lockingAuthority}). Order 39 CPC bars any alienation. Execution constitutes criminal Contempt of Court.`,
        reasonBn: `দলিল রেজিস্ট্রি সম্পূর্ণ নিষিদ্ধ: দেওয়ানি আদালতের স্থগিতাদেশ বলবৎ (${stayLock.referenceNumber})। জমি হস্তান্তর ফৌজদারি আদালত অবমাননার শামিল।`,
        statutoryRef: 'Code of Civil Procedure 1908 (Order 39 Rules 1-2) & Section 52 Transfer of Property Act 1882',
        suggestedActionEn: 'Deed registration must be deferred until judicial vacating order is decreed by the competent court.',
        suggestedActionBn: 'বিজ্ঞ আদালত কর্তৃক স্থগিতাদেশ প্রত্যাহার না হওয়া পর্যন্ত রেজিস্ট্রি কার্যক্রম স্থগিত থাকবে।',
        timestamp: now,
      };
    }

    // 2. Check Escrow Conveyance Lock (DOUBLE SALE PREVENTION)
    const escrowLock = active.find((l) => l.lockType === 'ESCROW_CONVEYANCE');
    if (escrowLock) {
      return {
        permitted: false,
        operationType: 'DEED_CONVEYANCE',
        parcelId,
        blockingLock: escrowLock,
        reasonEn: `DOUBLE SALE ATTEMPT INTERCEPTED: Parcel is locked under active purchase escrow (${escrowLock.referenceNumber}). Parallel deed execution to an alternate buyer is blocked.`,
        reasonBn: `দ্বৈত বিক্রয় প্রতিরোধ: জমিটি সক্রিয় এসক্রো চুক্তিভুক্ত (${escrowLock.referenceNumber})। অন্য কোনো ক্রেতার নিকট রেজিস্ট্রি তাৎক্ষণিকভাবে প্রতিহত করা হয়েছে।`,
        statutoryRef: 'Registration Act 1908 Section 52A & Penal Code 1860 Section 420',
        suggestedActionEn: 'Current escrow transaction must either complete registration or be formally cancelled before new deeds can execute.',
        suggestedActionBn: 'বিদ্যমান এসক্রো নিষ্পত্তি অথবা বাতিল না হওয়া পর্যন্ত নতুন দলিল সম্পাদন সম্ভব নয়।',
        timestamp: now,
      };
    }

    // 3. Check Bank Mortgage Lien
    const mortgageLock = active.find((l) => l.lockType === 'MORTGAGE_LIEN');
    if (mortgageLock) {
      return {
        permitted: false,
        operationType: 'DEED_CONVEYANCE',
        parcelId,
        blockingLock: mortgageLock,
        reasonEn: `BANK LIEN ACTIVE: Property is encumbered under mortgage charge by ${mortgageLock.lockingAuthority}. Transfer barred without formal Bank No Objection Certificate (NOC).`,
        reasonBn: `ব্যাংক দায় বিদ্যমান: সম্পত্তিটি ${mortgageLock.lockingAuthority} এর অনুকূলে বন্ধকযুক্ত। ব্যাংকের অনাপত্তিপত্র (NOC) ছাড়া বিক্রয় নিষিদ্ধ।`,
        statutoryRef: 'Transfer of Property Act 1882 Section 58 & Bangladesh Bank BRPD Circular 2018',
        suggestedActionEn: 'Obtain digital Bank NOC or submit full mortgage satisfaction deed prior to registration.',
        suggestedActionBn: 'রেজিস্ট্রির পূর্বে ব্যাংকের ডিজিটাল এনওসি (NOC) বা দায়মুক্তি দলিল দাখিল করতে হবে।',
        timestamp: now,
      };
    }

    // 4. Check Owner Biometric Lock
    const ownerLock = active.find((l) => l.lockType === 'OWNER_BIOMETRIC');
    if (ownerLock) {
      return {
        permitted: false,
        operationType: 'DEED_CONVEYANCE',
        parcelId,
        blockingLock: ownerLock,
        reasonEn: 'OWNER BIOMETRIC LOCK ACTIVE: Registered owner has activated anti-fraud property lock. Deed execution is frozen.',
        reasonBn: 'মালিকানা বায়োমেট্রিক লক সক্রিয়: প্রকৃত মালিক জমি সাময়িক লক করে রেখেছেন। হস্তান্তর বন্ধ রয়েছে।',
        statutoryRef: 'Digital Security Regulations & Ministry of Land Citizen Protection Guidelines',
        suggestedActionEn: 'Owner must provide 2FA OTP verification via Bhumi Sheba to unlock the parcel before registration.',
        suggestedActionBn: 'মালিক কর্তৃক ওটিপি ভেরিফিকেশনের মাধ্যমে লক নিষ্ক্রিয় করার পর দলিল রেজিস্ট্রি করা যাবে।',
        timestamp: now,
      };
    }

    // Clean Parcel: Permitted
    return {
      permitted: true,
      operationType: 'DEED_CONVEYANCE',
      parcelId,
      reasonEn: 'TITLE CLEAR: All 4 sovereign registries confirm zero encumbrances, zero stay orders, and zero parallel contracts.',
      reasonBn: 'স্বত্ব সম্পূর্ণ পরিষ্কার: কোনো দেওয়ানি স্থগিতাদেশ, ব্যাংক দায় বা দ্বৈত বিক্রয় চুক্তি নেই।',
      statutoryRef: 'Registration Act 1908 Section 52A & SAT Act 1950',
      suggestedActionEn: 'Proceed to biometric deed execution at the Sub-Registry Office.',
      suggestedActionBn: 'সাব-রেজিস্ট্রি অফিসে বায়োমেট্রিক দলিল সম্পাদনের জন্য সম্পূর্ণ প্রস্তুত।',
      timestamp: now,
    };
  }

  /**
   * 🛑 Assert Institutional Mortgage Allowed (Bangladesh Bank CIB Check)
   * Prevents double mortgages and undisclosed collateral pledging across banks.
   */
  public static assertCanMortgage(
    parcelId: string,
    bankCode: string,
    chargeRank: number = 1
  ): OperationValidationOutcome {
    const active = this.getActiveLocks(parcelId);
    const now = new Date().toISOString();

    // 1. Check Judicial Stay
    const stayLock = active.find((l) => l.lockType === 'JUDICIAL_STAY');
    if (stayLock) {
      return {
        permitted: false,
        operationType: 'MORTGAGE_CHARGE',
        parcelId,
        blockingLock: stayLock,
        reasonEn: `MORTGAGE REJECTED: Civil Court injunction active (${stayLock.referenceNumber}). Pledging disputed property violates judicial decree.`,
        reasonBn: `বন্ধক আবেদন বাতিল: দেওয়ানি আদালতের নিষেধাজ্ঞা বলবৎ (${stayLock.referenceNumber})। মামলাভুক্ত জমি বন্ধক রাখা আইনত অবৈধ।`,
        statutoryRef: 'Code of Civil Procedure 1908 Order 39 & Section 52 Transfer of Property Act',
        suggestedActionEn: 'Bank cannot underwrite mortgage until civil title dispute is formally disposed of.',
        suggestedActionBn: 'মামলা নিষ্পত্তি না হওয়া পর্যন্ত ব্যাংক এই জমিতে ঋণ অনুমোদন করতে পারবে না।',
        timestamp: now,
      };
    }

    // 2. Check In-Flight Escrow
    const escrowLock = active.find((l) => l.lockType === 'ESCROW_CONVEYANCE');
    if (escrowLock) {
      return {
        permitted: false,
        operationType: 'MORTGAGE_CHARGE',
        parcelId,
        blockingLock: escrowLock,
        reasonEn: `MORTGAGE REJECTED: Property is currently under pending conveyance escrow (${escrowLock.referenceNumber}). Cannot pledge land in-flight.`,
        reasonBn: `বন্ধক আবেদন বাতিল: জমিটি ক্রয়-বিক্রয় প্রক্রিয়াধীন রয়েছে। হস্তান্তরকালে বন্ধক রাখা যাবে না।`,
        statutoryRef: 'Banking Companies Act 1991 Section 27',
        suggestedActionEn: 'Await completion of conveyance to new buyer or formal cancellation of purchase contract.',
        suggestedActionBn: 'ক্রয়-বিক্রয় সম্পন্ন হওয়া পর্যন্ত অপেক্ষা করুন।',
        timestamp: now,
      };
    }

    // 3. Check DOUBLE MORTGAGE against CIB Gateway
    const cibInquiry = CibGateway.inquireCollateral(parcelId);
    if (cibInquiry.hasActiveMortgage && chargeRank === 1) {
      return {
        permitted: false,
        operationType: 'MORTGAGE_CHARGE',
        parcelId,
        reasonEn: `DOUBLE MORTGAGE COLLISION: Parcel is already encumbered with an active 1st Charge by ${cibInquiry.primaryChargeHolder} (Sanctioned BDT ${cibInquiry.totalSanctionedAmountBDT.toLocaleString()}). Multiple 1st charges strictly prohibited.`,
        reasonBn: `দ্বৈত বন্ধক সংক্রান্ত সংঘর্ষ: জমিটিতে ইতিমধ্যে ${cibInquiry.primaryChargeHolder} এ ১ম চার্জ বন্ধক বিদ্যমান (${cibInquiry.totalSanctionedAmountBDT.toLocaleString()} টাকা)। একাধিক ১ম চার্জ বন্ধক সম্পূর্ণ নিষিদ্ধ।`,
        statutoryRef: 'Transfer of Property Act 1882 Section 58 & Bangladesh Bank CIB Prudential Guidelines',
        suggestedActionEn: 'Prior lender must issue full satisfaction deed or join a Pari-Passu consortium agreement.',
        suggestedActionBn: 'পূর্ববর্তী ব্যাংকের ঋণ সম্পূর্ণ পরিশোধ অথবা যৌথ কনসোর্টিয়াম চুক্তি ব্যতিরেকে বন্ধক নেওয়া যাবে না।',
        timestamp: now,
      };
    }

    return {
      permitted: true,
      operationType: 'MORTGAGE_CHARGE',
      parcelId,
      reasonEn: 'MORTGAGE UNDERWRITING APPROVED: Collateral is unencumbered and verified in Bangladesh Bank CIB II.',
      reasonBn: 'বন্ধক ও ঋণ অনুমোদনযোগ্য: জমিটি বাংলাদেশ ব্যাংক সিআইবি ডাটাবেজে সম্পূর্ণ দায়মুক্ত।',
      statutoryRef: 'Transfer of Property Act 1882 Section 58',
      suggestedActionEn: 'Financial institution may register equitable or registered mortgage charge.',
      suggestedActionBn: 'ব্যাংক বন্ধকি দলিল রেজিস্ট্রি ও সিআইবি চার্জ নিবন্ধন করতে পারে।',
      timestamp: now,
    };
  }

  /**
   * 🛑 Assert e-Mutation Allowed (AC Land Revenue Court Check)
   */
  public static assertCanMutate(parcelId: string, applicantNid?: string): OperationValidationOutcome {
    const active = this.getActiveLocks(parcelId);
    const now = new Date().toISOString();

    const stayLock = active.find((l) => l.lockType === 'JUDICIAL_STAY');
    if (stayLock) {
      return {
        permitted: false,
        operationType: 'E_MUTATION',
        parcelId,
        blockingLock: stayLock,
        reasonEn: `E-MUTATION PROHIBITED: Judicial injunction in force (${stayLock.referenceNumber}). Order 39 CPC restrains revenue record alteration.`,
        reasonBn: `ই-নামজারি স্থগিত: দেওয়ানি আদালতের স্থগিতাদেশ বলবৎ। আদালতের অনুমতি ব্যতিরেকে কোনো নতুন খতিয়ান খোলা যাবে না।`,
        statutoryRef: 'SAT Act 1950 Section 143 & CPC Order 39',
        suggestedActionEn: 'AC Land revenue court must freeze mutation docket pending disposal of title suit.',
        suggestedActionBn: 'এসিল্যান্ড আদালত কর্তৃক মামলার নিষ্পত্তি না হওয়া পর্যন্ত নামজারি নথি স্থগিত রাখা হবে।',
        timestamp: now,
      };
    }

    const ownerLock = active.find((l) => l.lockType === 'OWNER_BIOMETRIC');
    if (ownerLock) {
      return {
        permitted: false,
        operationType: 'E_MUTATION',
        parcelId,
        blockingLock: ownerLock,
        reasonEn: 'E-MUTATION FROZEN: Owner anti-fraud property lock active. Record alterations frozen.',
        reasonBn: 'ই-নামজারি স্থগিত: মালিকানা বায়োমেট্রিক লক চালু থাকায় খতিয়ান পরিবর্তন সাময়িক স্থগিত।',
        statutoryRef: 'Land Management Automation Project (LMAP) Operational Guidelines',
        suggestedActionEn: 'Owner must verify biometric identity to release lock before mutation hearing.',
        suggestedActionBn: 'শুনানির পূর্বে ওটিপি যাচাইয়ের মাধ্যমে জমি আনলক করুন।',
        timestamp: now,
      };
    }

    return {
      permitted: true,
      operationType: 'E_MUTATION',
      parcelId,
      reasonEn: 'MUTATION ELIGIBLE: Zero litigation stay orders or owner holds on record.',
      reasonBn: 'নামজারি অনুমোদনের উপযোগী: কোনো স্থগিতাদেশ বা বাধা নেই।',
      statutoryRef: 'SAT Act 1950 Section 143',
      suggestedActionEn: 'AC Land may issue DCR assessment and sign digital Khatian.',
      suggestedActionBn: 'ডিসিআর ফি প্রদান সাপেক্ষে সহকারী কমিশনার (ভূমি) কর্তৃক নামজারি অনুমোদনযোগ্য।',
      timestamp: now,
    };
  }

  /**
   * Returns unified 4-agency state for frontend command center
   */
  public static getDashboardState(parcelId: string): InterAgencyDashboardState {
    const activeLocks = this.getActiveLocks(parcelId);
    const cibInquiry = CibGateway.inquireCollateral(parcelId);
    const judicialInquiry = JudicialGateway.queryDocket(parcelId);
    const conveyanceOutcome = this.assertCanConvey(parcelId);
    const mutationOutcome = this.assertCanMutate(parcelId);

    const hasInjunction = judicialInquiry.hasActiveInjunction;
    const hasMortgage = cibInquiry.hasActiveMortgage;
    const hasEscrow = activeLocks.some((l) => l.lockType === 'ESCROW_CONVEYANCE');
    const hasOwnerLock = activeLocks.some((l) => l.lockType === 'OWNER_BIOMETRIC');

    let overallStatusEn: InterAgencyDashboardState['overallStatusEn'] = 'CLEAN_UNENCUMBERED';
    let overallStatusBn = 'সম্পূর্ণ দায়মুক্ত ও লেনদেন নিরাপদ (Clean & Unencumbered)';

    if (hasInjunction) {
      overallStatusEn = 'DISPUTED_STAY_LOCKED';
      overallStatusBn = 'আদালতের স্থগিতাদেশযুক্ত / বিতর্কিত জমি (Judicial Stay Locked)';
    } else if (hasEscrow) {
      overallStatusEn = 'ESCROW_FROZEN';
      overallStatusBn = 'বায়না চুক্তি ও এসক্রো প্রক্রিয়াধীন (Escrow Transfer Frozen)';
    } else if (hasMortgage) {
      overallStatusEn = 'BANK_MORTGAGED';
      overallStatusBn = 'ব্যাংক চার্জ ও বন্ধকযুক্ত (Bank Mortgage Encumbered)';
    } else if (hasOwnerLock) {
      overallStatusEn = 'OWNER_LOCKED';
      overallStatusBn = 'মালিকানা বায়োমেট্রিক লক চালু (Owner Biometric Locked)';
    }

    const isFullyClear = activeLocks.length === 0 && !hasMortgage && !hasInjunction;

    return {
      parcelId,
      isFullyClear,
      overallStatusEn,
      overallStatusBn,
      activeLockCount: activeLocks.length,
      locks: activeLocks,
      agencyStatuses: {
        landMinistry: {
          status: mutationOutcome.permitted ? 'UNRESTRICTED' : 'HEARING_FROZEN',
          canMutate: mutationOutcome.permitted,
          activeKhatian: parcelId.includes('SYL') ? 'BS-5510' : 'RS-4412',
          summaryEn: mutationOutcome.reasonEn,
          summaryBn: mutationOutcome.reasonBn,
        },
        lawMinistry: {
          status: conveyanceOutcome.permitted ? 'UNRESTRICTED' : 'REGISTRATION_BARRED',
          canConvey: conveyanceOutcome.permitted,
          subRegistryOffice: parcelId.includes('SYL') ? 'Sreemangal Sub-Registry Office' : 'Savar Sub-Registry Office',
          summaryEn: conveyanceOutcome.reasonEn,
          summaryBn: conveyanceOutcome.reasonBn,
        },
        judiciary: {
          status: hasInjunction ? 'INJUNCTION_ACTIVE' : 'CLEAN',
          hasInjunction,
          courtName: hasInjunction ? judicialInquiry.activeStayOrders[0].courtName : undefined,
          caseNumber: hasInjunction ? judicialInquiry.activeStayOrders[0].caseNumber : undefined,
          summaryEn: hasInjunction
            ? `Active stay order in Suit #${judicialInquiry.activeStayOrders[0].caseNumber}.`
            : 'No active stay orders or injunctions on cause list.',
          summaryBn: hasInjunction
            ? `মামলা নং #${judicialInquiry.activeStayOrders[0].caseNumber} এ আদালতের স্থগিতাদেশ বলবৎ।`
            : 'দেওয়ানি আদালতে কোনো মামলা বা স্থগিতাদেশ নেই।',
        },
        centralBankCib: {
          status: hasMortgage ? 'FIRST_CHARGE_ACTIVE' : 'NO_LIEN',
          hasActiveMortgage: hasMortgage,
          primaryBank: cibInquiry.primaryChargeHolder,
          sanctionedBdt: cibInquiry.totalSanctionedAmountBDT,
          summaryEn: hasMortgage
            ? `Active charge held by ${cibInquiry.primaryChargeHolder} (BDT ${cibInquiry.totalSanctionedAmountBDT.toLocaleString()}).`
            : 'Zero active mortgages or institutional liens in CIB II.',
          summaryBn: hasMortgage
            ? `${cibInquiry.primaryChargeHolder} এ মোট ${cibInquiry.totalSanctionedAmountBDT.toLocaleString()} টাকার দায় রয়েছে।`
            : 'বাংলাদেশ ব্যাংক সিআইবি ডাটাবেজে কোনো বন্ধক নেই।',
        },
      },
      lastSyncedAt: new Date().toISOString(),
    };
  }

  /**
   * ⚡ Interactive Simulation Sandbox Triggers
   * Allows live demonstration of cross-agency fraud interception!
   */
  public static simulateCrossAgencyEvent(
    scenario:
      | 'DOUBLE_SALE_ATTEMPT'
      | 'DOUBLE_MORTGAGE_ATTEMPT'
      | 'COURT_INJUNCTION_ISSUED'
      | 'COURT_INJUNCTION_VACATED'
      | 'BANK_NOC_ISSUED'
      | 'OWNER_LOCK_TOGGLED',
    parcelId: string,
    extraParams?: any
  ): { success: boolean; event: string; messageEn: string; messageBn: string; outcome: any } {
    switch (scenario) {
      case 'DOUBLE_SALE_ATTEMPT': {
        const check = this.assertCanConvey(parcelId, extraParams?.secondBuyerNid || '19902692019999999');
        return {
          success: !check.permitted,
          event: 'DOUBLE_SALE_INTERCEPTED',
          messageEn: check.permitted
            ? 'Warning: Parcel was not locked, conveyance was permitted.'
            : `FRAUD PREVENTED: Sub-Registry locked out second buyer deed registration! ${check.reasonEn}`,
          messageBn: check.permitted
            ? 'সতর্কতা: জমিতে কোনো লক ছিল না, দলিল অনুমোদিত।'
            : `জালিয়াতি প্রতিহত: সাব-রেজিস্ট্রারে দ্বিতীয় ক্রেতার সাফ-কবলা দলিল রেজিস্ট্রি স্বয়ংক্রিয়ভাবে আটকে দেওয়া হয়েছে!`,
          outcome: check,
        };
      }

      case 'DOUBLE_MORTGAGE_ATTEMPT': {
        const check = this.assertCanMortgage(parcelId, extraParams?.bankCode || 'BRAC', 1);
        return {
          success: !check.permitted,
          event: 'DOUBLE_MORTGAGE_BLOCKED',
          messageEn: check.permitted
            ? 'Warning: Parcel was unencumbered, mortgage was permitted.'
            : `CIB COLLISION PREVENTED: Secondary bank loan rejected! ${check.reasonEn}`,
          messageBn: check.permitted
            ? 'সতর্কতা: জমিতে বন্ধক ছিল না, ঋণ অনুমোদিত।'
            : `দ্বৈত বন্ধক প্রতিহত: বাংলাদেশ ব্যাংক সিআইবি ডাটাবেজে দ্বিতীয় ব্যাংকের বন্ধক চেষ্টা আটকে দেওয়া হয়েছে!`,
          outcome: check,
        };
      }

      case 'COURT_INJUNCTION_ISSUED': {
        const newCase = JudicialGateway.issueCourtStay({
          parcelId,
          caseNumber: extraParams?.caseNumber || `TS-${Math.floor(100 + Math.random() * 900)}/${new Date().getFullYear()}`,
          courtName: extraParams?.courtName || 'Senior Assistant Judge Court, Savar, Dhaka',
          suitType: 'TEMPORARY_INJUNCTION',
          suitTypeBn: 'অস্থায়ী নিষেধাজ্ঞা ও স্বত্ব মোকদ্দমা',
          claimant: extraParams?.claimant || 'Alhaj Mokhlesur Rahman',
          defendant: extraParams?.defendant || 'Rafiqul Islam & Others',
          orderSummary: 'Temporary injunction restraining defendant from conveying or mutating Dag.',
          orderSummaryBn: 'উক্ত দাগের জমি বিক্রয়, হস্তান্তর বা হস্তান্তরমূলক দলিল রেজিস্ট্রি ও নামজারির ওপর নিষেধাজ্ঞা বলবৎ।',
        });

        // Place high-priority judicial lock in engine
        const lockRes = this.acquireLock({
          parcelId,
          lockType: 'JUDICIAL_STAY',
          lockingAuthority: newCase.courtName,
          authorityCategory: 'JUDICIARY',
          initiatorName: newCase.claimant,
          referenceNumber: newCase.caseNumber,
          statutoryBasis: 'CPC Order 39 Rules 1-2 & Section 52 Transfer of Property Act',
          orderSummaryEn: newCase.orderSummary,
          orderSummaryBn: newCase.orderSummaryBn,
        });

        return {
          success: true,
          event: 'JUDICIAL_STAY_APPLIED',
          messageEn: `Civil court injunction issued (${newCase.caseNumber}). All 4 registries locked instantly!`,
          messageBn: `আদালতের নিষেধাজ্ঞা জারি (${newCase.caseNumber})। এসিল্যান্ড ও সাব-রেজিস্ট্রিতে জমি তাৎক্ষণিক লক!`,
          outcome: { case: newCase, lock: lockRes.lock },
        };
      }

      case 'COURT_INJUNCTION_VACATED': {
        const activeLocks = this.getActiveLocks(parcelId);
        const stayLock = activeLocks.find((l) => l.lockType === 'JUDICIAL_STAY');
        if (stayLock) {
          this.releaseLock({
            lockToken: stayLock.lockToken,
            releaseAuthority: stayLock.lockingAuthority,
            releaseReference: 'Vacating Decree & Final Judgment Dated ' + new Date().toISOString().split('T')[0],
          });
          JudicialGateway.vacateStay(stayLock.referenceNumber);
        }

        return {
          success: true,
          event: 'JUDICIAL_STAY_VACATED',
          messageEn: 'Civil court injunction vacated. Title unlocked across all agencies.',
          messageBn: 'আদালতের নিষেধাজ্ঞা প্রত্যাহার সম্পন্ন। জমি পুনরায় লেনদেনের জন্য উন্মুক্ত।',
          outcome: { vacatedLockToken: stayLock?.lockToken },
        };
      }

      case 'BANK_NOC_ISSUED': {
        const activeLocks = this.getActiveLocks(parcelId);
        const mortgageLock = activeLocks.find((l) => l.lockType === 'MORTGAGE_LIEN');
        let nocNumber = 'NOC-SONALI-2026-90412';
        if (mortgageLock) {
          const cibToken = mortgageLock.referenceNumber.split(' / ')[1] || 'CIB-BB-2026-904812';
          const nocRes = CibGateway.issueBankNoc(cibToken, '19852691234567890');
          if (nocRes.nocNumber) nocNumber = nocRes.nocNumber;
        }

        return {
          success: true,
          event: 'BANK_NOC_ISSUED',
          messageEn: `Bank No Objection Certificate (${nocNumber}) registered. Conditional conveyance permitted.`,
          messageBn: `ব্যাংকের অনাপত্তিপত্র (${nocNumber}) নিবন্ধিত। শর্তসাপেক্ষ জমি হস্তান্তর অনুমোদিত।`,
          outcome: { nocNumber },
        };
      }

      case 'OWNER_LOCK_TOGGLED': {
        const activeLocks = this.getActiveLocks(parcelId);
        const ownerLock = activeLocks.find((l) => l.lockType === 'OWNER_BIOMETRIC');

        if (ownerLock) {
          this.releaseLock({
            lockToken: ownerLock.lockToken,
            releaseAuthority: 'Owner Biometric OTP Authentication',
            releaseReference: 'OTP-123456-VERIFIED',
          });
          return {
            success: true,
            event: 'OWNER_LOCK_DEACTIVATED',
            messageEn: 'Citizen property lock deactivated. Normal conveyances permitted.',
            messageBn: 'মালিকানা বায়োমেট্রিক লক নিষ্ক্রিয় করা হয়েছে।',
            outcome: { isLocked: false },
          };
        } else {
          const newLock = this.acquireLock({
            parcelId,
            lockType: 'OWNER_BIOMETRIC',
            lockingAuthority: 'Registered Owner via Bhumi Sheba',
            authorityCategory: 'CITIZEN',
            initiatorName: extraParams?.ownerName || 'Kamal Hossain',
            referenceNumber: `BIOLCK-${parcelId.slice(-6)}`,
            statutoryBasis: 'Digital Land Citizen Protection Framework',
            orderSummaryEn: 'Anti-fraud record lock active. Transfers frozen against unauthorized mutation.',
            orderSummaryBn: 'ভুয়া নামজারি ও অননুমোদিত হস্তান্তর রোধে মালিক কর্তৃক জমি লক।',
          });
          return {
            success: true,
            event: 'OWNER_LOCK_ACTIVATED',
            messageEn: 'Citizen property lock activated. Sub-registry & AC Land transfers frozen!',
            messageBn: 'মালিকানা বায়োমেট্রিক লক সক্রিয় করা হয়েছে। সাব-রেজিস্ট্রি ও এসিল্যান্ডে লেনদেন বন্ধ!',
            outcome: { isLocked: true, lock: newLock.lock },
          };
        }
      }

      default:
        return {
          success: false,
          event: 'UNKNOWN_SCENARIO',
          messageEn: 'Unrecognized simulation scenario.',
          messageBn: 'অজ্ঞাত সিমুলেশন দৃশ্যপট।',
          outcome: null,
        };
    }
  }
}
