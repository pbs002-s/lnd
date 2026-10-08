/**
 * Judicial Case Information System (JCIS) Gateway
 * Interfaces with Bangladesh Civil Courts (Senior Assistant Judge,
 * Joint District Judge, and High Court Division) to monitor
 * Lis Pendens, Temporary Injunctions, and stay orders.
 */

import { LitigationService, LitigationCase } from '../litigationService';

export interface JudicialDocketInquiry {
  parcelId: string;
  hasActiveInjunction: boolean;
  activeStayOrders: LitigationCase[];
  pendingSuits: LitigationCase[];
  lisPendensWarning: boolean;
  statutoryDirectivesEn: string[];
  statutoryDirectivesBn: string[];
  inquiryTimestamp: string;
}

export class JudicialGateway {
  /**
   * Performs an instant judicial caveat & injunction scan for a parcel
   */
  public static queryDocket(parcelId: string): JudicialDocketInquiry {
    const cases = LitigationService.getByParcelId(parcelId);
    const activeStayOrders = cases.filter((c) => c.stayOrderActive && c.status === 'ACTIVE_STAY');
    const pendingSuits = cases.filter((c) => c.status === 'PENDING_HEARING');
    const hasActiveInjunction = activeStayOrders.length > 0;

    const directivesEn: string[] = [];
    const directivesBn: string[] = [];

    if (hasActiveInjunction) {
      directivesEn.push(
        'STATUTORY RESTRAINT: Civil Court temporary injunction in effect under Order 39 Rules 1-2 CPC. Section 52 Transfer of Property Act 1882 prohibits alienation, deed conveyance, or mutation. Violation constitutes criminal Contempt of Court.'
      );
      directivesBn.push(
        'আইনগত নিষেধাজ্ঞা: দেওয়ানি কার্যবিধির ৩৯ আদেশের ১-২ নিয়ম মতে আদালত কর্তৃক অস্থায়ী নিষেধাজ্ঞা বলবৎ। সম্পত্তি হস্তান্তর আইন ১৮৮২ এর ৫২ ধারা মতে এই জমির কোনো সাফ-কবলা দলিল বা নামজারি সম্পূর্ণ নিষিদ্ধ ও আদালত অবমাননার শামিল।'
      );
    } else if (pendingSuits.length > 0) {
      directivesEn.push(
        'LIS PENDENS ADVISORY: Pending title suit registered. Any conveyance executed during pendency is subject to the final judicial decree under Section 52 Transfer of Property Act.'
      );
      directivesBn.push(
        'লিস পেনডেন্স সতর্কতা: বাটোয়ারা বা স্বত্ব মামলা বিচারাধীন। মামলার রায় অনুযায়ী জমি হস্তান্তরের বৈধতা নির্ধারিত হবে।'
      );
    }

    return {
      parcelId,
      hasActiveInjunction,
      activeStayOrders,
      pendingSuits,
      lisPendensWarning: pendingSuits.length > 0,
      statutoryDirectivesEn: directivesEn,
      statutoryDirectivesBn: directivesBn,
      inquiryTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Files a new judicial stay order or temporary injunction
   */
  public static issueCourtStay(params: {
    parcelId: string;
    caseNumber: string;
    courtName: string;
    suitType: LitigationCase['suitType'];
    suitTypeBn: string;
    claimant: string;
    defendant: string;
    orderSummary: string;
    orderSummaryBn: string;
    statutorySection?: string;
  }): LitigationCase {
    return LitigationService.addCase({
      parcelId: params.parcelId,
      caseNumber: params.caseNumber,
      courtName: params.courtName,
      suitType: params.suitType,
      suitTypeBn: params.suitTypeBn,
      claimant: params.claimant,
      defendant: params.defendant,
      filedDate: new Date().toISOString().split('T')[0],
      stayOrderActive: true,
      stayOrderDate: new Date().toISOString().split('T')[0],
      nextHearingDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      status: 'ACTIVE_STAY',
      orderSummary: params.orderSummary,
      orderSummaryBn: params.orderSummaryBn,
      statutorySection:
        params.statutorySection || 'Code of Civil Procedure 1908 (Order 39 Rules 1-2) & Section 52 Transfer of Property Act 1882',
    });
  }

  /**
   * Vacates an injunction upon official judicial decree
   */
  public static vacateStay(caseNumber: string): boolean {
    return LitigationService.vacateStayOrder(caseNumber);
  }
}
