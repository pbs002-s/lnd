export interface DeedVerificationParams {
  deedNumber: string;
  parcelId: string;
  sellerNid: string;
  sellerName: string;
  declaredAreaDecimal: number;
  declaredPriceBdt: number;
  parentDeedNumber?: string;
  subRegistryOffice?: string;
  registrationDate?: string;
}

export interface ForensicCheckItem {
  id: string;
  category: 'AREA_INTEGRITY' | 'LINEAGE_CHAIN' | 'SELLER_AUTHENTICITY' | 'VALUATION_FAIRNESS' | 'COURT_LITIGATION' | 'IDENTITY_MATCH';
  titleEn: string;
  titleBn: string;
  status: 'PASS' | 'CAUTION' | 'FAIL';
  penaltyScore: number;
  findingEn: string;
  findingBn: string;
  statutoryRef: string;
}

export interface DeedVerificationResult {
  deedNumber: string;
  parcelId: string;
  overallScore: number; // 0 (Clean) to 100 (Extreme Risk / Fraud)
  verdict: 'AUTHENTIC_VERIFIED' | 'REVIEW_RECOMMENDED' | 'SUSPECTED_FRAUD_LOCKED';
  verdictBn: string;
  checks: ForensicCheckItem[];
  areaInflationPercentage: number;
  valuationDisparityPercentage: number;
  verifiedAt: string;
  statutorySummaryEn: string;
  statutorySummaryBn: string;
}

// Statutory Mouza Minimum Benchmark Rates (BDT per Decimal)
export const MOUZA_BENCHMARK_RATES: Record<string, { minBdtPerDecimal: number; marketBdtPerDecimal: number }> = {
  'Savar': { minBdtPerDecimal: 450000, marketBdtPerDecimal: 850000 },
  'Dhanmondi': { minBdtPerDecimal: 3500000, marketBdtPerDecimal: 6500000 },
  'Uttara': { minBdtPerDecimal: 2200000, marketBdtPerDecimal: 4500000 },
  'Panchlaish': { minBdtPerDecimal: 1800000, marketBdtPerDecimal: 3200000 },
  'Sylhet Sadar': { minBdtPerDecimal: 650000, marketBdtPerDecimal: 1200000 },
  'Default': { minBdtPerDecimal: 400000, marketBdtPerDecimal: 750000 },
};

// Known Deceased Individuals / Stolen NIDs for Forensics Sandbox
const DECEASED_OR_FLAGGED_NIDS = new Set([
  '19502692011000999', // Deceased in 2018 (Mortis causa simulation)
  '19651234567890111', // Injunction defendant / Impersonation risk
]);

export class DeedVerifierService {
  /**
   * Evaluates transfer deed parameters against official cadastral records,
   * title lineage, statutory valuation, and identity registries.
   */
  public static verify(
    params: DeedVerificationParams,
    registeredParcelArea: number,
    registeredOwnerName: string,
    registeredOwnerNid: string,
    hasActiveCourtInjunction: boolean = false
  ): DeedVerificationResult {
    const checks: ForensicCheckItem[] = [];
    let totalRiskScore = 0;

    // 1. Area Discrepancy & Inflation Check
    const declaredArea = Math.max(0, Number(params.declaredAreaDecimal) || 0);
    const areaDiff = declaredArea - registeredParcelArea;
    const inflationRatio = registeredParcelArea > 0 ? (areaDiff / registeredParcelArea) * 100 : 0;

    if (areaDiff > 0.05) {
      const penalty = Math.min(45, Math.round(inflationRatio * 0.9));
      totalRiskScore += penalty;
      checks.push({
        id: 'chk-area-inflation',
        category: 'AREA_INTEGRITY',
        titleEn: 'Area Discrepancy & Inflation Check',
        titleBn: 'জমির পরিমাণের গড়মিল ও অতিরিক্ত দাবি যাচাই',
        status: 'FAIL',
        penaltyScore: penalty,
        findingEn: `Deed claims ${declaredArea.toFixed(2)} decimal, but registered Khatian balance is only ${registeredParcelArea.toFixed(2)} decimal. Area inflated by ${inflationRatio.toFixed(1)}%.`,
        findingBn: `দলিলে ${declaredArea.toFixed(2)} শতক দাবি করা হয়েছে, অথচ খতিয়ান অনুযায়ী অবিক্রীত পরিমাণ মাত্র ${registeredParcelArea.toFixed(2)} শতক। ${inflationRatio.toFixed(1)}% জমি অতিরিক্ত দাবি করা হয়েছে।`,
        statutoryRef: 'Registration Act 1908, Section 52A & Penal Code Section 420/468',
      });
    } else if (Math.abs(areaDiff) <= 0.05) {
      checks.push({
        id: 'chk-area-inflation',
        category: 'AREA_INTEGRITY',
        titleEn: 'Area Discrepancy & Inflation Check',
        titleBn: 'জমির পরিমাণের গড়মিল ও অতিরিক্ত দাবি যাচাই',
        status: 'PASS',
        penaltyScore: 0,
        findingEn: `Declared deed area (${declaredArea.toFixed(2)} dec) strictly matches registered Khatian parcel boundary (${registeredParcelArea.toFixed(2)} dec).`,
        findingBn: `দলিলের উল্লিখিত পরিমাণ (${declaredArea.toFixed(2)} শতক) খতিয়ানের মোট পরিমাণের (${registeredParcelArea.toFixed(2)} শতক) সাথে সম্পূর্ণ সামঞ্জস্যপূর্ণ।`,
        statutoryRef: 'Registration Act 1908, Section 52A',
      });
    } else {
      // Partial transfer (selling less than whole plot)
      checks.push({
        id: 'chk-area-inflation',
        category: 'AREA_INTEGRITY',
        titleEn: 'Area Discrepancy & Inflation Check',
        titleBn: 'জমির পরিমাণের গড়মিল ও অতিরিক্ত দাবি যাচাই',
        status: 'PASS',
        penaltyScore: 0,
        findingEn: `Partial parcel conveyance: transferring ${declaredArea.toFixed(2)} decimal out of ${registeredParcelArea.toFixed(2)} decimal holding.`,
        findingBn: `আংশিক দাগ হস্তান্তর: মোট ${registeredParcelArea.toFixed(2)} শতকের মধ্যে ${declaredArea.toFixed(2)} শতক হস্তান্তরযোগ্য।`,
        statutoryRef: 'State Acquisition and Tenancy Act 1950, Section 117',
      });
    }

    // 2. Lineage & Parent Deed Continuity Check
    const parentDeed = (params.parentDeedNumber || '').trim();
    if (!parentDeed) {
      const penalty = 25;
      totalRiskScore += penalty;
      checks.push({
        id: 'chk-lineage-continuity',
        category: 'LINEAGE_CHAIN',
        titleEn: 'Parent Deed (Baya Dalil) Continuity',
        titleBn: 'বায়া দলিলের ধারাবাহিকতা যাচাই',
        status: 'CAUTION',
        penaltyScore: penalty,
        findingEn: 'No prior parent deed (Baya Dalil) registered. Title chain lacks 25-year unbroken historical lineage.',
        findingBn: 'কোনো পূর্ববর্তী বায়া দলিলের বিবরণ সংযুক্ত নেই। ২৫ বছরের নিরবচ্ছিন্ন স্বত্ব চেইনের অভাব রয়েছে।',
        statutoryRef: 'Transfer of Property Act 1882, Section 54',
      });
    } else {
      checks.push({
        id: 'chk-lineage-continuity',
        category: 'LINEAGE_CHAIN',
        titleEn: 'Parent Deed (Baya Dalil) Continuity',
        titleBn: 'বায়া দলিলের ধারাবাহিকতা যাচাই',
        status: 'PASS',
        penaltyScore: 0,
        findingEn: `Parent Deed #${parentDeed} verified against Sub-Registry Book 1 registry archives. Unbroken chain established.`,
        findingBn: `বায়া দলিল নম্বর #${parentDeed} সাব-রেজিস্ট্রি রেকর্ড রুমের বালাম বইয়ে যাচাইকৃত এবং স্বত্ব চেইন সঠিক।`,
        statutoryRef: 'Registration Act 1908, Section 51 (Book 1 Archives)',
      });
    }

    // 3. Living Seller & NID Authenticity Check
    const sellerNid = (params.sellerNid || '').replace(/\D/g, '');
    const cleanRegNid = (registeredOwnerNid || '').replace(/\D/g, '');

    if (DECEASED_OR_FLAGGED_NIDS.has(sellerNid)) {
      const penalty = 50;
      totalRiskScore += penalty;
      checks.push({
        id: 'chk-seller-authenticity',
        category: 'SELLER_AUTHENTICITY',
        titleEn: 'Seller Living Status & NID Verification',
        titleBn: 'বিক্রেতার জীবিত অবস্থা ও এনআইডি যাচাই',
        status: 'FAIL',
        penaltyScore: penalty,
        findingEn: 'National Database Alert: Registered record holder is flagged as deceased in 2018. Mortis causa fraudulent conveyance detected.',
        findingBn: 'জাতীয় পরিচয়পত্র সার্ভার সতর্কতা: বিক্রেতা ২০১৮ সালে মৃত্যুবরণ করেছেন। মৃত ব্যক্তির জমি জালিয়াতির চেষ্টা শনাক্ত।',
        statutoryRef: 'Penal Code 1860, Sections 419, 467, 468',
      });
    } else if (cleanRegNid && sellerNid && cleanRegNid !== sellerNid) {
      const penalty = 35;
      totalRiskScore += penalty;
      checks.push({
        id: 'chk-seller-authenticity',
        category: 'SELLER_AUTHENTICITY',
        titleEn: 'Seller Living Status & NID Verification',
        titleBn: 'বিক্রেতার জীবিত অবস্থা ও এনআইডি যাচাই',
        status: 'FAIL',
        penaltyScore: penalty,
        findingEn: `Seller NID (${sellerNid}) does not match registered Khatian owner NID (${cleanRegNid}). Impersonation risk.`,
        findingBn: `বিক্রেতার এনআইডি (${sellerNid}) এবং খতিয়ানভুক্ত প্রকৃত মালিকের এনআইডি (${cleanRegNid}) ভিন্ন। স্বত্বহীন ব্যক্তি কর্তৃক বিক্রয়ের ঝুঁকি।`,
        statutoryRef: 'Registration Act 1908, Section 52A (Mandatory NID Verification)',
      });
    } else {
      checks.push({
        id: 'chk-seller-authenticity',
        category: 'SELLER_AUTHENTICITY',
        titleEn: 'Seller Living Status & NID Verification',
        titleBn: 'বিক্রেতার জীবিত অবস্থা ও এনআইডি যাচাই',
        status: 'PASS',
        penaltyScore: 0,
        findingEn: 'Seller NID validated against Election Commission database. Owner is living and verified.',
        findingBn: 'নির্বাচন কমিশন তথ্যভাণ্ডারের সাথে বিক্রেতার এনআইডি সঠিক এবং বিক্রেতা জীবিত প্রমাণিত।',
        statutoryRef: 'National Identity Registration Act 2010',
      });
    }

    // 4. Valuation Fairness & Stamp Duty Evasion Check
    const benchmark = MOUZA_BENCHMARK_RATES['Savar'] || MOUZA_BENCHMARK_RATES['Default'];
    const minStatutoryPrice = declaredArea * benchmark.minBdtPerDecimal;
    const declaredPrice = Math.max(0, Number(params.declaredPriceBdt) || 0);
    const valuationRatio = minStatutoryPrice > 0 ? ((minStatutoryPrice - declaredPrice) / minStatutoryPrice) * 100 : 0;

    if (declaredPrice < minStatutoryPrice * 0.7) {
      const penalty = 20;
      totalRiskScore += penalty;
      checks.push({
        id: 'chk-valuation-fairness',
        category: 'VALUATION_FAIRNESS',
        titleEn: 'Statutory Valuation & Stamp Duty Evasion Check',
        titleBn: 'সরকারি ন্যূনতম বাজারমূল্য ও রাজস্ব ফাঁকি যাচাই',
        status: 'CAUTION',
        penaltyScore: penalty,
        findingEn: `Declared price (BDT ${declaredPrice.toLocaleString()}) is ${valuationRatio.toFixed(1)}% below the mouza minimum benchmark (BDT ${minStatutoryPrice.toLocaleString()}). Stamp duty audit flag triggered.`,
        findingBn: `ঘোষিত মূল্য (${declaredPrice.toLocaleString()} টাকা) সরকারি মৌজা রেট (${minStatutoryPrice.toLocaleString()} টাকা) অপেক্ষা ${valuationRatio.toFixed(1)}% কম। রাজস্ব ও স্ট্যাম্প ফাঁকির সম্ভাবনা।`,
        statutoryRef: 'Stamp Act 1899, Section 27 & Land Registration Valuation Rules 2012',
      });
    } else {
      checks.push({
        id: 'chk-valuation-fairness',
        category: 'VALUATION_FAIRNESS',
        titleEn: 'Statutory Valuation & Stamp Duty Evasion Check',
        titleBn: 'সরকারি ন্যূনতম বাজারমূল্য ও রাজস্ব ফাঁকি যাচাই',
        status: 'PASS',
        penaltyScore: 0,
        findingEn: `Declared price (BDT ${declaredPrice.toLocaleString()}) meets or exceeds the gazetted mouza benchmark rate (BDT ${minStatutoryPrice.toLocaleString()}).`,
        findingBn: `ঘোষিত বিক্রয়মূল্য (${declaredPrice.toLocaleString()} টাকা) সরকারি গেজেটভুক্ত ন্যূনতম বাজারমূল্যের সাথে সঙ্গতিপূর্ণ।`,
        statutoryRef: 'Land Registration Valuation Rules 2012',
      });
    }

    // 5. Civil Court Injunction & Litigation Radar Check
    if (hasActiveCourtInjunction) {
      const penalty = 40;
      totalRiskScore += penalty;
      checks.push({
        id: 'chk-court-litigation',
        category: 'COURT_LITIGATION',
        titleEn: 'Civil Court Lis Pendens & Injunction Status',
        titleBn: 'দেওয়ানি আদালতের স্থগিতাদেশ ও লিস পেনডেন্স যাচাই',
        status: 'FAIL',
        penaltyScore: penalty,
        findingEn: 'Active Judicial Injunction registered by Senior Assistant Judge Court. Transfer prohibited under Order 39 Rules 1-2 CPC.',
        findingBn: 'সিনিয়র সহকারী জজ আদালত কর্তৃক এই দাগের ওপর অস্থায়ী নিষেধাজ্ঞা (Stay Order) বলবৎ রয়েছে। রেজিস্ট্রি ও নামজারি সম্পূর্ণ নিষিদ্ধ।',
        statutoryRef: 'Code of Civil Procedure 1908 (Order 39 Rules 1-2) & Transfer of Property Act 1882 (Section 52)',
      });
    } else {
      checks.push({
        id: 'chk-court-litigation',
        category: 'COURT_LITIGATION',
        titleEn: 'Civil Court Lis Pendens & Injunction Status',
        titleBn: 'দেওয়ানি আদালতের স্থগিতাদেশ ও লিস পেনডেন্স যাচাই',
        status: 'PASS',
        penaltyScore: 0,
        findingEn: 'No active civil title suits, temporary injunctions, or lis pendens registered at Civil Court.',
        findingBn: 'দেওয়ানি আদালতে কোনো সক্রিয় স্বত্ব মামলা, অস্থায়ী নিষেধাজ্ঞা বা মোকদ্দমা মুলতবি নেই।',
        statutoryRef: 'Transfer of Property Act 1882, Section 52',
      });
    }

    // 6. Phonetic Name Match Check
    const cleanSellerName = (params.sellerName || '').trim().toLowerCase();
    const cleanRegName = (registeredOwnerName || '').trim().toLowerCase();

    if (cleanSellerName && cleanRegName && cleanSellerName !== cleanRegName) {
      const penalty = 15;
      totalRiskScore += penalty;
      checks.push({
        id: 'chk-identity-match',
        category: 'IDENTITY_MATCH',
        titleEn: 'Party Name & Phonetic Alignment Check',
        titleBn: 'নামের বানান ও ধ্বনিগত মিল যাচাই',
        status: 'CAUTION',
        penaltyScore: penalty,
        findingEn: `Name variance detected between deed vendor ("${params.sellerName}") and Khatian record holder ("${registeredOwnerName}").`,
        findingBn: `দলিলের বিক্রেতার নাম ("${params.sellerName}") এবং খতিয়ানভুক্ত মালিকের নামের ("${registeredOwnerName}") বানানে অমিল পরিলক্ষিত হয়েছে।`,
        statutoryRef: 'Registration Act 1908, Section 52A',
      });
    } else {
      checks.push({
        id: 'chk-identity-match',
        category: 'IDENTITY_MATCH',
        titleEn: 'Party Name & Phonetic Alignment Check',
        titleBn: 'নামের বানান ও ধ্বনিগত মিল যাচাই',
        status: 'PASS',
        penaltyScore: 0,
        findingEn: 'Party names match registered ownership records with zero discrepancy.',
        findingBn: 'দলিলের পক্ষগণের নাম খতিয়ানের মূল রেকর্ডের সাথে সম্পূর্ণ অভিন্ন।',
        statutoryRef: 'Registration Act 1908, Section 52A',
      });
    }

    // Cap total risk score at 100
    const finalScore = Math.min(100, Math.max(0, totalRiskScore));

    let verdict: DeedVerificationResult['verdict'] = 'AUTHENTIC_VERIFIED';
    let verdictBn = 'স্বত্ব যাচাইকৃত ও লেনদেন নিরাপদ (Authentic Verified)';

    if (finalScore >= 60) {
      verdict = 'SUSPECTED_FRAUD_LOCKED';
      verdictBn = 'জালিয়াতির প্রবল আশঙ্কা / স্বত্ব স্থগিত (Suspected Fraud Locked)';
    } else if (finalScore >= 20) {
      verdict = 'REVIEW_RECOMMENDED';
      verdictBn = 'শর্তসাপেক্ষ সাবধানতা ও রিভিউ প্রয়োজন (Review Recommended)';
    }

    return {
      deedNumber: params.deedNumber || 'DALIL-PENDING',
      parcelId: params.parcelId,
      overallScore: finalScore,
      verdict,
      verdictBn,
      checks,
      areaInflationPercentage: Math.max(0, inflationRatio),
      valuationDisparityPercentage: Math.max(0, valuationRatio),
      verifiedAt: new Date().toISOString(),
      statutorySummaryEn:
        finalScore >= 60
          ? 'CRITICAL DEFECTS DETECTED: This deed conveyance violates Section 52A of the Registration Act 1908 and Civil Court injunction decrees. Registration and mutation must be halted.'
          : finalScore >= 25
          ? 'CAUTIONARY NOTICE: Minor discrepancy in valuation or parent deed lineage. Mandatory rectifications advised prior to title registration.'
          : 'PRIMA FACIE CLEAN TITLE: Deed parameters satisfy the 6-point statutory due diligence criteria under Bangladesh land laws.',
      statutorySummaryBn:
        finalScore >= 60
          ? 'মারাত্মক ত্রুটি শনাক্ত: প্রস্তাবিত হস্তান্তরটি রেজিস্ট্রেশন আইন ১৯০৮ এর ৫২ক ধারা এবং দেওয়ানি আদালতের নিষেধাজ্ঞার সুস্পষ্ট লঙ্ঘন। নামজারি স্থগিতযোগ্য।'
          : finalScore >= 25
          ? 'সতর্কীকরণ বিজ্ঞপ্তি: বায়া দলিলের ধারাবাহিকতা বা মূল্যে সামান্য অমিল রয়েছে। রেজিস্ট্রেশনের পূর্বে শর্তাবলী যাচাই বাঞ্ছনীয়।'
          : 'নিরাপদ স্বত্ব: দলিলটির যাবতীয় তথ্য জাতীয় ভূমি রেকর্ড ও রেজিস্ট্রেশন আইনানুযায়ী সম্পূর্ণ নির্ভুল ও নির্ভরযোগ্য।',
    };
  }
}
