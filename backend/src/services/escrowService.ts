/**
 * Zero-Trust Land Buy/Sell Escrow Service
 * Governs multi-stage transaction settlement, automated security holds,
 * statutory tax deductions, and conditional fund disbursement.
 */

import { InterRegistryLockEngine } from './interRegistryLockEngine';

export type EscrowStage =
  | 'OFFER_PENDING'
  | 'LAND_LOCKED'
  | 'ESCROW_DEPOSITED'
  | 'TITLE_AUDITED'
  | 'SUB_REGISTRY_SCHEDULED'
  | 'DEED_EXECUTED'
  | 'MUTATION_RECORDED'
  | 'FUNDS_RELEASED'
  | 'REFUNDED_DISPUTED';

export interface EscrowTimelineEvent {
  stage: EscrowStage;
  timestamp: string;
  descriptionEn: string;
  descriptionBn: string;
  actor: string;
  referenceNumber?: string;
}

export interface EscrowContract {
  id: string;
  parcelId: string;
  mouza: string;
  areaDecimal: number;
  buyerNid: string;
  buyerName: string;
  buyerPhone: string;
  sellerNid: string;
  sellerName: string;
  sellerPhone: string;
  sellerBankAccount: string;
  sellerBankRouting: string;
  totalConsiderationBdt: number;
  earnestDepositBdt: number;
  balanceBdt: number;
  depositedAmountBdt: number;
  escrowBankName: string;
  escrowVaultAccount: string;
  stage: EscrowStage;
  isLocked: boolean;
  lockTimestamp?: string;
  forensicsVerdict?: string;
  deedNumber?: string;
  deedVolumeNumber?: string;
  mutationCaseNumber?: string;
  newKhatianNo?: string;
  // Statutory government deductions (calculated at registration)
  stampDutyBdt: number; // 3%
  localGovTaxBdt: number; // 2%
  registrationFeeBdt: number; // 1%
  aitSourceTaxBdt: number; // 4% (Income Tax Act 2023 Sec 120)
  totalStatutoryFeesBdt: number;
  netPayableToSellerBdt: number;
  createdAt: string;
  updatedAt: string;
  timeline: EscrowTimelineEvent[];
}

export interface CreateEscrowContractParams {
  parcelId: string;
  mouza?: string;
  areaDecimal: number;
  buyerNid: string;
  buyerName: string;
  buyerPhone: string;
  sellerNid: string;
  sellerName: string;
  sellerPhone: string;
  sellerBankAccount?: string;
  sellerBankRouting?: string;
  totalConsiderationBdt: number;
  earnestDepositBdt?: number;
  escrowBankName?: string;
}

const IN_MEMORY_ESCROW_CONTRACTS: EscrowContract[] = [
  {
    id: 'ESC-2026-0814',
    parcelId: 'BD-DHK-SAV-000001',
    mouza: 'Savar Mouza (সাভার মৌজা)',
    areaDecimal: 5.5,
    buyerNid: '19882691234567891',
    buyerName: 'Tanvir Ahmed (Property Buyer)',
    buyerPhone: '01811-223344',
    sellerNid: '19852692011000123',
    sellerName: 'Kamal Hossain',
    sellerPhone: '01711-223344',
    sellerBankAccount: 'Sonali Bank A/C 201100482910',
    sellerBankRouting: '200260481',
    totalConsiderationBdt: 4800000,
    earnestDepositBdt: 500000,
    balanceBdt: 4300000,
    depositedAmountBdt: 4800000,
    escrowBankName: 'Sonali Bank PLC (Digital Land Escrow Vault)',
    escrowVaultAccount: 'VAULT-BD-LAND-990182',
    stage: 'TITLE_AUDITED',
    isLocked: true,
    lockTimestamp: '2026-09-18T10:30:00.000Z',
    forensicsVerdict: 'AUTHENTIC_VERIFIED',
    stampDutyBdt: 144000, // 3%
    localGovTaxBdt: 96000, // 2%
    registrationFeeBdt: 48000, // 1%
    aitSourceTaxBdt: 192000, // 4%
    totalStatutoryFeesBdt: 480000,
    netPayableToSellerBdt: 4320000,
    createdAt: '2026-09-18T09:00:00.000Z',
    updatedAt: '2026-09-18T14:20:00.000Z',
    timeline: [
      {
        stage: 'OFFER_PENDING',
        timestamp: '2026-09-18T09:00:00.000Z',
        descriptionEn: 'Purchase offer registered by buyer Tanvir Ahmed.',
        descriptionBn: 'ক্রেতা তানভীর আহমেদ কর্তৃক ক্রয় প্রস্তাব দাখিল।',
        actor: 'Buyer',
        referenceNumber: 'OFFER-814',
      },
      {
        stage: 'LAND_LOCKED',
        timestamp: '2026-09-18T09:15:00.000Z',
        descriptionEn: 'Anti-fraud land lock activated. Parcel BD-DHK-SAV-000001 frozen from parallel conveyance.',
        descriptionBn: 'দ্বৈত বিক্রয় রোধকল্পে জমি সাময়িক লক করা হয়েছে।',
        actor: 'Smart LandLock Engine',
        referenceNumber: 'LOCK-SAV-001',
      },
      {
        stage: 'ESCROW_DEPOSITED',
        timestamp: '2026-09-18T11:00:00.000Z',
        descriptionEn: 'Consideration deposit of BDT 4,800,000 secured in Sonali Bank Escrow Vault.',
        descriptionBn: 'সোনালী ব্যাংক ডিজিটাল এসক্রো ভল্টে মোট ৪৮,০০,০০০ টাকা জমা নিশ্চিত।',
        actor: 'Sonali eSheba Gateway',
        referenceNumber: 'TRX-ESC-90412',
      },
      {
        stage: 'TITLE_AUDITED',
        timestamp: '2026-09-18T14:20:00.000Z',
        descriptionEn: 'Deed Forensics Scorer cleared title with 0 penalty points. Zero civil court stay orders.',
        descriptionBn: 'দলিল ফরেনসিক্স যাচাই সম্পন্ন: কোনো জালিয়াতি বা আদালতের স্থগিতাদেশ নেই।',
        actor: 'Deed Forensics Engine',
        referenceNumber: 'FORENSIC-PASS-001',
      },
    ],
  },
];

export class EscrowService {
  /**
   * Calculates statutory government taxes and net proceeds for a land transfer
   */
  public static calculateTaxes(totalBdt: number): {
    stampDutyBdt: number;
    localGovTaxBdt: number;
    registrationFeeBdt: number;
    aitSourceTaxBdt: number;
    totalStatutoryFeesBdt: number;
    netPayableToSellerBdt: number;
  } {
    const stampDutyBdt = Math.round(totalBdt * 0.03); // 3% Stamp Duty
    const localGovTaxBdt = Math.round(totalBdt * 0.02); // 2% Local Govt Tax
    const registrationFeeBdt = Math.round(totalBdt * 0.01); // 1% Registration Fee
    const aitSourceTaxBdt = Math.round(totalBdt * 0.04); // 4% Advance Income Tax
    const totalStatutoryFeesBdt = stampDutyBdt + localGovTaxBdt + registrationFeeBdt + aitSourceTaxBdt;
    const netPayableToSellerBdt = totalBdt - totalStatutoryFeesBdt;

    return {
      stampDutyBdt,
      localGovTaxBdt,
      registrationFeeBdt,
      aitSourceTaxBdt,
      totalStatutoryFeesBdt,
      netPayableToSellerBdt,
    };
  }

  /**
   * Initializes a new secure escrow contract and triggers automated parcel locking
   */
  public static createContract(params: CreateEscrowContractParams): EscrowContract {
    const total = Math.max(0, Number(params.totalConsiderationBdt) || 0);
    const earnest = Math.max(0, Number(params.earnestDepositBdt) || Math.round(total * 0.1));
    const balance = total - earnest;
    const taxes = this.calculateTaxes(total);

    const now = new Date().toISOString();
    const contractId = `ESC-${new Date().getFullYear()}-${String(IN_MEMORY_ESCROW_CONTRACTS.length + 1).padStart(4, '0')}`;

    const newContract: EscrowContract = {
      id: contractId,
      parcelId: params.parcelId,
      mouza: params.mouza || 'Savar Mouza (সাভার মৌজা)',
      areaDecimal: params.areaDecimal,
      buyerNid: params.buyerNid,
      buyerName: params.buyerName,
      buyerPhone: params.buyerPhone,
      sellerNid: params.sellerNid,
      sellerName: params.sellerName,
      sellerPhone: params.sellerPhone,
      sellerBankAccount: params.sellerBankAccount || 'Pending Seller Verification',
      sellerBankRouting: params.sellerBankRouting || '000000000',
      totalConsiderationBdt: total,
      earnestDepositBdt: earnest,
      balanceBdt: balance,
      depositedAmountBdt: 0,
      escrowBankName: params.escrowBankName || 'Sonali Bank PLC (Digital Land Escrow Vault)',
      escrowVaultAccount: `VAULT-BD-LAND-${Math.floor(100000 + Math.random() * 900000)}`,
      stage: 'LAND_LOCKED',
      isLocked: true,
      lockTimestamp: now,
      ...taxes,
      createdAt: now,
      updatedAt: now,
      timeline: [
        {
          stage: 'OFFER_PENDING',
          timestamp: now,
          descriptionEn: `Purchase offer initiated for BDT ${total.toLocaleString()}.`,
          descriptionBn: `মোট ${total.toLocaleString()} টাকা মূল্যে জমি ক্রয়ের বায়না প্রস্তাব দাখিল।`,
          actor: 'Buyer',
          referenceNumber: `REQ-${Date.now().toString().slice(-6)}`,
        },
        {
          stage: 'LAND_LOCKED',
          timestamp: now,
          descriptionEn: `Automatic transaction lock applied to Parcel ${params.parcelId}. Transfer frozen.`,
          descriptionBn: `দাগ নং ${params.parcelId} এর ওপর স্বয়ংক্রিয় লেনদেন লক কার্যকর করা হয়েছে।`,
          actor: 'System LandLock',
          referenceNumber: `LOCK-${contractId}`,
        },
      ],
    };

    IN_MEMORY_ESCROW_CONTRACTS.unshift(newContract);

    // Synchronize lock with sovereign InterRegistryLockEngine
    InterRegistryLockEngine.acquireLock({
      parcelId: params.parcelId,
      lockType: 'ESCROW_CONVEYANCE',
      lockingAuthority: 'Smart LandLock Escrow Engine',
      authorityCategory: 'LAND_MINISTRY',
      initiatorNid: params.buyerNid,
      initiatorName: params.buyerName,
      referenceNumber: contractId,
      statutoryBasis: 'Zero-Trust Escrow Protocol & Registration Act 1908',
      orderSummaryEn: `Active purchase escrow initiated for BDT ${total.toLocaleString()}. Secondary conveyance frozen.`,
      orderSummaryBn: `মোট ${total.toLocaleString()} টাকা মূল্যে জমি ক্রয় বায়না কার্যকর। দ্বৈত বিক্রয় রোধে জমি লক।`,
    });

    return newContract;
  }

  /**
   * Simulates funding of the regulated escrow vault by the buyer
   */
  public static depositEscrow(
    contractId: string,
    amountBdt: number,
    trxId?: string
  ): EscrowContract | null {
    const contract = IN_MEMORY_ESCROW_CONTRACTS.find((c) => c.id === contractId);
    if (!contract) return null;

    contract.depositedAmountBdt += amountBdt;
    contract.stage = 'ESCROW_DEPOSITED';
    contract.updatedAt = new Date().toISOString();

    contract.timeline.push({
      stage: 'ESCROW_DEPOSITED',
      timestamp: contract.updatedAt,
      descriptionEn: `Escrow deposit of BDT ${amountBdt.toLocaleString()} verified in bank vault. Total deposited: BDT ${contract.depositedAmountBdt.toLocaleString()}.`,
      descriptionBn: `ব্যাংক এসক্রো ভল্টে ${amountBdt.toLocaleString()} টাকা সফলভাবে জমা নিশ্চিত।`,
      actor: 'Escrow Bank Gateway',
      referenceNumber: trxId || `TRX-${Date.now().toString().slice(-6)}`,
    });

    return contract;
  }

  /**
   * Records completed Title Forensics audit certification
   */
  public static certifyTitle(
    contractId: string,
    verdict: string,
    forensicScore: number
  ): EscrowContract | null {
    const contract = IN_MEMORY_ESCROW_CONTRACTS.find((c) => c.id === contractId);
    if (!contract) return null;

    contract.forensicsVerdict = verdict;
    contract.stage = 'TITLE_AUDITED';
    contract.updatedAt = new Date().toISOString();

    contract.timeline.push({
      stage: 'TITLE_AUDITED',
      timestamp: contract.updatedAt,
      descriptionEn: `Statutory deed forensics audit completed with verdict: ${verdict} (Risk score: ${forensicScore}/100).`,
      descriptionBn: `দলিল ফরেনসিক্স অডিট সম্পন্ন: ${verdict} (ঝুঁকি স্কোর: ${forensicScore}/১০০)।`,
      actor: 'Deed Forensics Scorer',
      referenceNumber: `AUDIT-${Date.now().toString().slice(-6)}`,
    });

    return contract;
  }

  /**
   * Advances the contract to Sub-Registry deed execution
   */
  public static recordDeedExecution(
    contractId: string,
    deedNumber: string,
    volumeNumber?: string
  ): EscrowContract | null {
    const contract = IN_MEMORY_ESCROW_CONTRACTS.find((c) => c.id === contractId);
    if (!contract) return null;

    contract.deedNumber = deedNumber;
    contract.deedVolumeNumber = volumeNumber || 'VOL-42/2026';
    contract.stage = 'DEED_EXECUTED';
    contract.updatedAt = new Date().toISOString();

    contract.timeline.push({
      stage: 'DEED_EXECUTED',
      timestamp: contract.updatedAt,
      descriptionEn: `Conveyance deed executed at Sub-Registry Office. Deed No: ${deedNumber}, Volume: ${contract.deedVolumeNumber}.`,
      descriptionBn: `সাব-রেজিস্ট্রি অফিসে সাফ-কবলা দলিল সম্পাদিত। দলিল নং: ${deedNumber}।`,
      actor: 'Sub-Registrar',
      referenceNumber: deedNumber,
    });

    return contract;
  }

  /**
   * Records electronic mutation approval and DCR generation
   */
  public static recordMutationApproved(
    contractId: string,
    mutationCaseNumber: string,
    newKhatianNo: string
  ): EscrowContract | null {
    const contract = IN_MEMORY_ESCROW_CONTRACTS.find((c) => c.id === contractId);
    if (!contract) return null;

    contract.mutationCaseNumber = mutationCaseNumber;
    contract.newKhatianNo = newKhatianNo;
    contract.stage = 'MUTATION_RECORDED';
    contract.updatedAt = new Date().toISOString();

    contract.timeline.push({
      stage: 'MUTATION_RECORDED',
      timestamp: contract.updatedAt,
      descriptionEn: `e-Mutation approved by AC (Land). Case No: ${mutationCaseNumber}, New Khatian: ${newKhatianNo}.`,
      descriptionBn: `সহকারী কমিশনার (ভূমি) কর্তৃক নামজারি মঞ্জুর। কেস নং: ${mutationCaseNumber}, নতুন খতিয়ান: ${newKhatianNo}।`,
      actor: 'AC Land Office',
      referenceNumber: mutationCaseNumber,
    });

    return contract;
  }

  /**
   * Finalizes the escrow settlement: releases net consideration to seller,
   * remits statutory taxes to NBR, and releases the land lock.
   */
  public static releaseFunds(contractId: string): EscrowContract | null {
    const contract = IN_MEMORY_ESCROW_CONTRACTS.find((c) => c.id === contractId);
    if (!contract) return null;

    contract.stage = 'FUNDS_RELEASED';
    contract.isLocked = false;
    contract.updatedAt = new Date().toISOString();

    contract.timeline.push({
      stage: 'FUNDS_RELEASED',
      timestamp: contract.updatedAt,
      descriptionEn: `Net funds of BDT ${contract.netPayableToSellerBdt.toLocaleString()} disbursed to seller's bank account. Statutory taxes of BDT ${contract.totalStatutoryFeesBdt.toLocaleString()} transferred to NBR. LandLock unlocked.`,
      descriptionBn: `বিক্রেতার ব্যাংক হিসাবে নীট ${contract.netPayableToSellerBdt.toLocaleString()} টাকা প্রদান সম্পন্ন। সরকারি রাজস্ব ${contract.totalStatutoryFeesBdt.toLocaleString()} টাকা চালান মারফত সরকারি কোষাগারে জমা। জমি আনলককৃত।`,
      actor: 'Escrow Settlement Engine',
      referenceNumber: `SETTLE-${contract.id}`,
    });

    // Release escrow lock in sovereign InterRegistryLockEngine
    const activeLocks = InterRegistryLockEngine.getActiveLocks(contract.parcelId);
    const escrowLock = activeLocks.find((l) => l.lockType === 'ESCROW_CONVEYANCE');
    if (escrowLock) {
      InterRegistryLockEngine.releaseLock({
        lockToken: escrowLock.lockToken,
        releaseAuthority: 'Escrow Settlement Protocol',
        releaseReference: `SETTLE-${contract.id}`,
      });
    }

    return contract;
  }

  /**
   * Retrieves all contracts filtered by parcel or user NID
   */
  public static listContracts(filter?: { parcelId?: string; nid?: string }): EscrowContract[] {
    let result = [...IN_MEMORY_ESCROW_CONTRACTS];
    if (filter?.parcelId) {
      const p = filter.parcelId.trim().toLowerCase();
      result = result.filter((c) => c.parcelId.toLowerCase() === p);
    }
    if (filter?.nid) {
      const cleanNid = filter.nid.replace(/\D/g, '');
      result = result.filter(
        (c) => c.buyerNid.replace(/\D/g, '') === cleanNid || c.sellerNid.replace(/\D/g, '') === cleanNid
      );
    }
    return result;
  }

  /**
   * Retrieves single contract by ID
   */
  public static getContract(contractId: string): EscrowContract | null {
    return IN_MEMORY_ESCROW_CONTRACTS.find((c) => c.id === contractId) || null;
  }
}
