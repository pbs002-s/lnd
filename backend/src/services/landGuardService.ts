/**
 * AI LandGuard — Smart Land Ownership Verification & Fraud Detection Service
 * 
 * Synthesizes all 5 specialized anti-fraud engines into a unified security rating:
 * 1. 📜 Deed Forensics (Area inflation, deceased vendor NID, civil court stay orders)
 * 2. 🛰️ Drone Cadastre Multi-Epoch Drift (CS 1924, RS 1988, BS 2015, BDS 2026)
 * 3. 🌊 Government Khas & Wetland Buffer Protection (Riverbed foreshore, public canal)
 * 4. 🔗 Cryptographic Evidence Chain-of-Custody (SHA-256 hash continuity & Ed25519 signatures)
 * 5. 🔒 Biometric Anti-Fraud Land Lock (Real-time record freeze against unauthorized deeds)
 */

import { DeedVerifierService } from './deedVerifier';
import { DroneCadastreService } from './droneCadastreService';
import { KhasService } from './khasService';
import { DigitalEvidenceService } from './digitalEvidenceService';
import { LitigationService } from './litigationService';
import { CryptoSignerService } from './cryptoSigner';

export type LandGuardVerdict = 
  | 'CLEARED_PROTECTED'       // 85 - 100: Pristine title, verified boundaries, active protection
  | 'CAUTION_ADVISORY'        // 60 - 84:  Minor survey variance, un-locked record, or pending verification
  | 'CRITICAL_FRAUD_FLAGGED'; // 0 - 59:   Active civil stay order, canal encroachment, or deed area inflation

export type PillarStatus = 'PASS' | 'WARNING' | 'FAIL';

export interface LandGuardPillarEvaluation {
  pillarId: 'DEED_FORENSICS' | 'DRONE_CADASTRE' | 'KHAS_PROXIMITY' | 'EVIDENCE_CHAIN' | 'LAND_LOCK';
  titleEn: string;
  titleBn: string;
  status: PillarStatus;
  score: number; // 0 to 100 for this pillar
  weightPercent: number;
  weightedScore: number;
  highlightMetric: string;
  summaryEn: string;
  summaryBn: string;
  drillDownTarget: 'deed' | 'drone' | 'khas' | 'evidence' | 'lock';
}

export interface LandGuardAuditResult {
  parcelId: string;
  mouza: string;
  upazila: string;
  district: string;
  ownerName: string;
  khatianNo: string;
  dagNo: string;
  areaDecimal: number;
  trustScore: number; // 0 to 100
  verdict: LandGuardVerdict;
  verdictTitleEn: string;
  verdictTitleBn: string;
  aiExplanationEn: string;
  aiExplanationBn: string;
  isLocked: boolean;
  pillars: LandGuardPillarEvaluation[];
  auditedAt: string;
  qrPayload: string;
}

export interface LandGuardDossier {
  dossierId: string;
  parcelId: string;
  audit: LandGuardAuditResult;
  exportedAt: string;
  qrPayload: string;
  issuerAuthority: string;
  legalDisclaimerBn: string;
  legalDisclaimerEn: string;
}

export class LandGuardService {
  private static parcelLockState: Map<string, boolean> = new Map([
    ['BD-DHK-SAV-000001', true],
    ['BD-SYL-SRM-000108', true],
    ['BD-DHK-SAV-000002', false],
    ['BD-DHK-SAV-000003', false],
  ]);

  /**
   * Toggle biometric property lock status
   */
  public static toggleLock(parcelId: string): boolean {
    const current = this.parcelLockState.get(parcelId) || false;
    const next = !current;
    this.parcelLockState.set(parcelId, next);
    return next;
  }

  /**
   * Get lock status
   */
  public static isLocked(parcelId: string): boolean {
    return this.parcelLockState.get(parcelId) ?? false;
  }

  /**
   * Run full multi-engine AI LandGuard audit on a parcel
   */
  public static auditParcel(parcelId: string): LandGuardAuditResult {
    const isEncroachedDemo = parcelId.includes('000003');
    const isSylhet = parcelId.toUpperCase().includes('SYL') || parcelId.toUpperCase().includes('SRM');

    const mouza = isSylhet ? 'Radhanagar Mouza' : 'Savar Mouza';
    const upazila = isSylhet ? 'Sreemangal' : 'Savar';
    const district = isSylhet ? 'Moulvibazar' : 'Dhaka';
    const ownerName = isSylhet ? 'Tanvir Ahmed' : 'Mohammad Rafiqul Islam';
    const khatianNo = isSylhet ? 'BS-5510' : 'RS-4412';
    const dagNo = isSylhet ? '2041' : '112';
    const areaDecimal = isSylhet ? 45.0 : 5.5;

    // 1. Audit Pillar 1: Deed & Dalil Forensics
    const hasInjunction = LitigationService.hasActiveInjunction(parcelId);
    const registeredNid = isSylhet ? '19882691002233441' : '19852691234567890';
    const sellerNid = isEncroachedDemo ? '19502692011000999' : registeredNid;
    const declaredArea = isEncroachedDemo ? areaDecimal + 2.5 : areaDecimal;

    const deedRes = DeedVerifierService.verify(
      {
        deedNumber: `2018-${upazila.substring(0, 3).toUpperCase()}-4821`,
        parcelId,
        subRegistryOffice: `${upazila} Sub-Registry Office`,
        sellerNid,
        sellerName: ownerName,
        declaredAreaDecimal: declaredArea,
        declaredPriceBdt: (isSylhet ? 650000 : 450000) * areaDecimal,
      },
      areaDecimal,
      ownerName,
      registeredNid,
      hasInjunction
    );

    const deedScore = Math.max(0, 100 - deedRes.overallScore);
    const deedStatus: PillarStatus = 
      deedRes.verdict === 'AUTHENTIC_VERIFIED' ? 'PASS' :
      deedRes.verdict === 'REVIEW_RECOMMENDED' ? 'WARNING' : 'FAIL';

    const failedChecks = deedRes.checks.filter((c) => c.status !== 'PASS');
    const deedSummaryEn = deedRes.verdict === 'AUTHENTIC_VERIFIED'
      ? 'Dalil deed chain verified across 6 statutory fraud vectors. No area inflation or stay orders.'
      : `High risk detected: ${failedChecks.map((c) => c.titleEn).join(', ')}`;
    const deedSummaryBn = deedRes.verdict === 'AUTHENTIC_VERIFIED'
      ? 'দলিল সম্পূর্ণ খাঁটি ও ৬-দফা যাচাইয়ে উত্তীর্ণ। অতিরিক্ত জমি দাবি বা স্থগিতাদেশ নেই।'
      : `ঝুঁকি শনাক্ত: ${failedChecks.map((c) => c.titleBn).join(', ')}`;

    // 2. Audit Pillar 2: Drone Cadastre Multi-Epoch Boundary Drift
    const droneComparison = DroneCadastreService.compareEpochs(parcelId);
    let droneScore = 100;
    let droneStatus: PillarStatus = 'PASS';
    if (droneComparison.canalEncroachmentFlag || isEncroachedDemo) {
      droneScore = 20;
      droneStatus = 'FAIL';
    } else if (droneComparison.maxVertexShiftMeters > 1.5) {
      droneScore = 65;
      droneStatus = 'WARNING';
    }

    const droneSummaryEn = droneStatus === 'PASS'
      ? `Drone BDS 2026 vector is congruent with RS 1988 within ${droneComparison.maxVertexShiftMeters}m geodetic tolerance.`
      : `Boundary drift alert: Max shift ${droneComparison.maxVertexShiftMeters}m extends into adjacent public canal.`;
    const droneSummaryBn = droneStatus === 'PASS'
      ? `ড্রোন বিডিএস ২০২৬ নকশার সাথে ঐতিহাসিক আরএস নকশার নিখুঁত সামঞ্জস্য (বিচ্যুতি মাত্র ${droneComparison.maxVertexShiftMeters} মি)।`
      : `সীমানা বিচ্যুতির সতর্কবার্তা: নকশা সংলগ্ন সরকারি খালে ${droneComparison.maxVertexShiftMeters} মিটার অননুমোদিতভাবে বর্ধিত।`;

    // 3. Audit Pillar 3: Khas Land & Wetland Proximity
    const coords: [number, number] = isSylhet 
      ? [91.7315, 24.3065] 
      : isEncroachedDemo 
      ? [90.2583, 23.8437] 
      : [90.2671, 23.8512];
    const khasRes = KhasService.checkEncroachment(parcelId, coords);
    let khasScore = 100;
    let khasStatus: PillarStatus = 'PASS';
    if (khasRes.riskLevel === 'CRITICAL_ENCROACHMENT') {
      khasScore = 15;
      khasStatus = 'FAIL';
    } else if (khasRes.riskLevel === 'BUFFER_WARNING') {
      khasScore = 60;
      khasStatus = 'WARNING';
    }

    const khasSummaryEn = khasRes.riskLevel === 'CLEAN'
      ? `Safe private title. Distance to nearest government riverbed/wetland is ${khasRes.closestDistanceMeters}m.`
      : `${khasRes.riskLevel}: Parcel is within ${khasRes.closestDistanceMeters}m of public foreshore ${khasRes.matchedKhasRecord?.mouza || 'Govt Khas'}.`;
    const khasSummaryBn = khasRes.riskLevel === 'CLEAN'
      ? `নিরাপদ ব্যক্তিমালিকানাধীন জমি। নিকটস্থ সরকারি খাল বা নদী তীর হতে দূরত্ব ${khasRes.closestDistanceMeters} মিটার।`
      : `সরকারি খাস জমি সতর্কবার্তা: খাস তীর সীমানা হতে দূরত্ব মাত্র ${khasRes.closestDistanceMeters} মিটার (${khasRes.matchedKhasRecord?.categoryBn || 'খাস জমি'})।`;

    // 4. Audit Pillar 4: Cryptographic Evidence Ledger
    const evidenceReport = DigitalEvidenceService.verifyChainIntegrity(parcelId);
    let evidenceScore = evidenceReport.isValid ? 100 : 25;
    let evidenceStatus: PillarStatus = evidenceReport.isValid ? 'PASS' : 'FAIL';

    const evidenceSummaryEn = evidenceReport.isValid
      ? `SHA-256 hash chain intact across all ${evidenceReport.totalBlocks} blocks. Ed25519 signatures verified.`
      : `Ledger compromised: Tampering flagged at Block #${evidenceReport.tamperedBlockIndex}. Signatures invalid.`;
    const evidenceSummaryBn = evidenceReport.isValid
      ? `সকল ${evidenceReport.totalBlocks} টি ব্লকে SHA-256 হ্যাশ চেইন অক্ষুণ্ণ এবং Ed25519 ডিজিটাল স্বাক্ষর প্রত্যয়িত।`
      : `লেজারে ট্যাম্পারিং শনাক্ত: ব্লক #${evidenceReport.tamperedBlockIndex} এর তথ্য বিকৃত বা জাল।`;

    // 5. Audit Pillar 5: Biometric Property Lock
    const isLocked = this.isLocked(parcelId);
    const lockScore = isLocked ? 100 : 70;
    const lockStatus: PillarStatus = isLocked ? 'PASS' : 'WARNING';

    const lockSummaryEn = isLocked
      ? 'Biometric Property Lock is ACTIVE. Sub-registry deeds and mutation transfers are frozen against fraud.'
      : 'Property Lock is INACTIVE. We recommend enabling biometric lock to guard against unauthorized mutations.';
    const lockSummaryBn = isLocked
      ? 'বায়োমেট্রিক জমি লক সক্রিয়। সাব-রেজিস্ট্রিতে অননুমোদিত হস্তান্তর ও ভুয়া নামজারি বন্ধ রাখা হয়েছে।'
      : 'জমি লক নিষ্ক্রিয়। অননুমোদিত হস্তান্তর রোধে বায়োমেট্রিক জমি লক চালু করার পরামর্শ দেওয়া হচ্ছে।';

    // Assemble 5 Pillars
    const pillars: LandGuardPillarEvaluation[] = [
      {
        pillarId: 'DEED_FORENSICS',
        titleEn: 'Dalil Deed & Title Forgery Scan',
        titleBn: 'দলিল জালিয়াতি ও স্বত্ব বিশ্লেষণ',
        status: deedStatus,
        score: deedScore,
        weightPercent: 30,
        weightedScore: Math.round(deedScore * 0.30),
        highlightMetric: deedStatus === 'PASS' ? '100% Authentic' : 'Defect Detected',
        summaryEn: deedSummaryEn,
        summaryBn: deedSummaryBn,
        drillDownTarget: 'deed',
      },
      {
        pillarId: 'DRONE_CADASTRE',
        titleEn: 'Drone Cadastre & Boundary Drift',
        titleBn: 'ড্রোন ক্যাডাস্ট্রে ও সীমানা পরিবর্তন',
        status: droneStatus,
        score: droneScore,
        weightPercent: 20,
        weightedScore: Math.round(droneScore * 0.20),
        highlightMetric: droneStatus === 'PASS' ? `±${droneComparison.maxVertexShiftMeters}m Congruent` : 'Encroachment Flag',
        summaryEn: droneSummaryEn,
        summaryBn: droneSummaryBn,
        drillDownTarget: 'drone',
      },
      {
        pillarId: 'KHAS_PROXIMITY',
        titleEn: 'Government Khas & Wetland Buffer',
        titleBn: 'সরকারি খাস ও জলাশয় বাফার যাচাই',
        status: khasStatus,
        score: khasScore,
        weightPercent: 20,
        weightedScore: Math.round(khasScore * 0.20),
        highlightMetric: `${khasRes.closestDistanceMeters}m ${khasRes.riskLevel === 'CLEAN' ? 'Safe Distance' : 'Proximity'}`,
        summaryEn: khasSummaryEn,
        summaryBn: khasSummaryBn,
        drillDownTarget: 'khas',
      },
      {
        pillarId: 'EVIDENCE_CHAIN',
        titleEn: 'Cryptographic Chain-of-Custody',
        titleBn: 'ক্রিপ্টোগ্রাফিক সাক্ষ্য লেজার',
        status: evidenceStatus,
        score: evidenceScore,
        weightPercent: 15,
        weightedScore: Math.round(evidenceScore * 0.15),
        highlightMetric: `${evidenceReport.totalBlocks} Blocks Verified`,
        summaryEn: evidenceSummaryEn,
        summaryBn: evidenceSummaryBn,
        drillDownTarget: 'evidence',
      },
      {
        pillarId: 'LAND_LOCK',
        titleEn: 'Biometric Anti-Fraud Land Lock',
        titleBn: 'বায়োমেট্রিক জমি সুরক্ষা লক',
        status: lockStatus,
        score: lockScore,
        weightPercent: 15,
        weightedScore: Math.round(lockScore * 0.15),
        highlightMetric: isLocked ? 'ACTIVE / FROZEN' : 'UNLOCKED',
        summaryEn: lockSummaryEn,
        summaryBn: lockSummaryBn,
        drillDownTarget: 'lock',
      },
    ];

    // Compute composite trust score
    let compositeScore = pillars.reduce((sum, p) => sum + p.weightedScore, 0);
    // Severe overrides: if critical fraud or court stay order exists, cap trust score
    if (deedStatus === 'FAIL' || droneStatus === 'FAIL' || evidenceStatus === 'FAIL') {
      compositeScore = Math.min(compositeScore, 48);
    }

    let verdict: LandGuardVerdict = 'CLEARED_PROTECTED';
    let verdictTitleEn = 'Cleared & Protected Title';
    let verdictTitleBn = 'স্বত্ব সম্পূর্ণ সুরক্ষিত ও ত্রুটিমুক্ত';

    if (compositeScore < 60) {
      verdict = 'CRITICAL_FRAUD_FLAGGED';
      verdictTitleEn = 'Critical Fraud & Legal Risk Detected';
      verdictTitleBn = 'মারাত্মক জালিয়াতি বা আইনি জটিলতা শনাক্ত';
    } else if (compositeScore < 85) {
      verdict = 'CAUTION_ADVISORY';
      verdictTitleEn = 'Caution Advisory & Verification Needed';
      verdictTitleBn = 'সতর্কতা আবশ্যক / পরীক্ষা পর্যালোচনাধীন';
    }

    const aiExplanationEn = verdict === 'CLEARED_PROTECTED'
      ? `AI LandGuard has analyzed all 5 security dimensions for Parcel ${parcelId}. The conveyance deed is authentic with no area inflation, cadastral drone vectors congruently match historical CS/RS boundaries within ${droneComparison.maxVertexShiftMeters}m, no khas wetland encroachment is detected, and all ${evidenceReport.totalBlocks} chronological events are cryptographically sealed with Ed25519 signatures. This property is fully recommended for mortgage underwriting and secure conveyance.`
      : verdict === 'CAUTION_ADVISORY'
      ? `AI LandGuard detected advisory conditions for Parcel ${parcelId}. While major fraud vectors are clean, enabling the Biometric Land Lock is strongly recommended to protect against unauthorized future mutation filings.`
      : `CRITICAL ALERT: AI LandGuard has flagged high-probability land fraud or active litigation on Parcel ${parcelId}. Do not proceed with title transfer, deed execution, or bank loan disbursement until flagged discrepancies are legally resolved.`;

    const aiExplanationBn = verdict === 'CLEARED_PROTECTED'
      ? `এআই ল্যান্ডগার্ড পার্সেল ${parcelId} এর ৫টি প্রধান নিরাপত্তা স্তর পুঙ্খানুপুঙ্খ বিশ্লেষণ করেছে। সাফ-কবলা দলিলের ধারাবাহিকতা অক্ষুণ্ণ, ড্রোন নকশায় সিএস/আরএস সীমানার কোনো বিকৃতি নেই, খাস জমি দখলমুক্ত এবং সবগুলো রেকর্ড ক্রিপ্টোগ্রাফিক ডিজিটাল স্বাক্ষরে সুরক্ষিত। জমিটি যেকোনো ব্যাংক ঋণ বা রেজিস্ট্রেশনের জন্য সম্পূর্ণ নিরাপদ।`
      : verdict === 'CAUTION_ADVISORY'
      ? `পার্সেল ${parcelId} এর জন্য সতর্কতামূলক পরামর্শ: জমিটিতে কোনো বড় ধরনের জালিয়াতি নেই, তবে অনাকাঙ্ক্ষিত নামজারি রোধ করতে এখনই বায়োমেট্রিক জমি লক সক্রিয় করার পরামর্শ দেওয়া হচ্ছে।`
      : `জরুরি সতর্কবার্তা: পার্সেল ${parcelId} এ আদালতের স্থগিতাদেশ বা ড্রোন নকশায় গুরুতর সীমানা বিকৃতি শনাক্ত হয়েছে। আইনগত সমাধান না হওয়া পর্যন্ত যেকোনো প্রকার বায়না, রেজিস্ট্রেশন বা ব্যাংক ঋণ প্রদান স্থগিত রাখুন।`;

    const auditedAt = new Date().toISOString();
    const qrPayload = `AILG:v2:${parcelId}:${compositeScore}:${verdict}:${auditedAt.substring(0, 10)}`;

    return {
      parcelId,
      mouza,
      upazila,
      district,
      ownerName,
      khatianNo,
      dagNo,
      areaDecimal,
      trustScore: compositeScore,
      verdict,
      verdictTitleEn,
      verdictTitleBn,
      aiExplanationEn,
      aiExplanationBn,
      isLocked,
      pillars,
      auditedAt,
      qrPayload,
    };
  }

  /**
   * Export Court & Bank Admissible AI LandGuard Dossier
   */
  public static exportDossier(parcelId: string): LandGuardDossier {
    const audit = this.auditParcel(parcelId);
    const exportedAt = new Date().toISOString();
    const dossierId = `LG-DOSSIER-${parcelId}-${Date.now().toString(36).toUpperCase()}`;

    return {
      dossierId,
      parcelId,
      audit,
      exportedAt,
      qrPayload: `AILG-CERT:${dossierId}:${parcelId}:${audit.trustScore}:${audit.verdict}`,
      issuerAuthority: 'Ministry of Land AI LandGuard National Verification Cell, Government of Bangladesh',
      legalDisclaimerBn: 'ভূমি মন্ত্রণালয়ের এআই ল্যান্ডগার্ড স্মার্ট যাচাইকরণ প্রতিবেদন। দ্য রেজিস্ট্রেশন অ্যাক্ট ১৯০৮ (ধারা ৫২এ) এবং ডিজিটাল সাক্ষ্য আইন অনুযায়ী সত্যায়িত।',
      legalDisclaimerEn: 'Authoritative AI LandGuard Property Verification Dossier. Certified under Registration Act 1908 (Sec 52A) and Bangladesh Digital Evidence framework.',
    };
  }
}
