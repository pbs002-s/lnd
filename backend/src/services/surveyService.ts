/**
 * Field Survey, Offline Synchronization & Amin Cadastre Service
 * Governs rural field survey measurements, GPS/BTM benchmark pegs,
 * Gunther chain calculations, co-sharer spot testimonies, and offline sync.
 */

export interface BenchmarkPeg {
  id: string;
  pegNumber: string; // e.g. "P-01 (North-East Corner)"
  lat: number;
  lng: number;
  btmEasting: number;
  btmNorthing: number;
  elevationMeters: number;
  chainageToNextLinks: number; // Gunther chain links (1 link = 0.66 ft)
  chainageToNextFeet: number;
  physicalMarkerType: 'CONCRETE_PILLAR' | 'IRON_ROD' | 'CANAL_BOUNDARY_MARK' | 'WOODEN_PEG';
  timestamp: string;
}

export interface CoSharerStatement {
  id: string;
  personName: string;
  nid: string;
  relationship: 'CO_SHARER' | 'ADJACENT_OWNER' | 'VILLAGE_PRADHAN';
  adjacentDagNo?: string;
  statementText: string;
  hasObjection: boolean;
  objectionDetail?: string;
  timestamp: string;
}

export type SurveyStatus =
  | 'DRAFT_IN_FIELD'
  | 'OFFLINE_QUEUED'
  | 'SYNCED'
  | 'KANUNGO_APPROVED'
  | 'DISPUTE_REFERRED';

export interface SurveyRecord {
  id: string;
  parcelId: string;
  mouza: string;
  upazila: string;
  district: string;
  aminId: string;
  aminName: string;
  aminLicenseNo: string;
  surveyDate: string;
  status: SurveyStatus;
  physicalLandUse: 'AGRICULTURAL_PADDY' | 'RESIDENTIAL_HOMESTEAD' | 'COMMERCIAL_SHOP' | 'POND_WATERBODY' | 'CHAR_LAND';
  physicalLandUseBn: string;
  benchmarkPegs: BenchmarkPeg[];
  computedAreaSqFt: number;
  computedAreaDecimal: number;
  khatianRecordedDecimal: number;
  areaVarianceDecimal: number;
  boundaryDisputeFlag: boolean;
  disputeSummary?: string;
  coSharerStatements: CoSharerStatement[];
  kanungoReviewed: boolean;
  kanungoComments?: string;
  syncedAt?: string;
  offlineCreated: boolean;
  createdAt: string;
  updatedAt: string;
}

// In-Memory Database for Field Surveys
const SURVEY_DATABASE: SurveyRecord[] = [
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
        chainageToNextLinks: 120, // 79.2 ft
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
        chainageToNextLinks: 75, // 49.5 ft
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
        chainageToNextLinks: 120, // 79.2 ft
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
        chainageToNextLinks: 75, // 49.5 ft
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
        statementText: 'উভয় পক্ষের উপস্থিতিতে সীমানা নির্ধারণ সম্পন্ন হয়েছে। কোনো দাবি বা আপত্তি নেই।',
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

export class SurveyService {
  /**
   * List survey records with optional parcelId or aminId filter
   */
  public static listSurveys(filter?: { parcelId?: string; aminId?: string }): SurveyRecord[] {
    if (!filter) return [...SURVEY_DATABASE];
    return SURVEY_DATABASE.filter((s) => {
      if (filter.parcelId && s.parcelId.toLowerCase() !== filter.parcelId.toLowerCase()) return false;
      if (filter.aminId && s.aminId.toLowerCase() !== filter.aminId.toLowerCase()) return false;
      return true;
    });
  }

  /**
   * Get specific survey record by ID
   */
  public static getSurvey(id: string): SurveyRecord | null {
    return SURVEY_DATABASE.find((s) => s.id === id) || null;
  }

  /**
   * Convert Gunther chain links to feet (1 link = 0.66 ft)
   */
  public static linksToFeet(links: number): number {
    return Number((links * 0.66).toFixed(2));
  }

  /**
   * Convert square feet to Decimals (1 Decimal = 435.6 sq ft)
   */
  public static sqFtToDecimal(sqft: number): number {
    return Number((sqft / 435.6).toFixed(4));
  }

  /**
   * Convert square links to Decimals (1000 sq links = 1 Decimal)
   */
  public static sqLinksToDecimal(sqLinks: number): number {
    return Number((sqLinks / 1000).toFixed(4));
  }

  /**
   * Recalculate polygon area from benchmark station pegs using Shoelace algorithm on BTM coordinates
   */
  public static computePolygonArea(pegs: BenchmarkPeg[]): { areaSqFt: number; areaDecimal: number } {
    if (pegs.length < 3) {
      return { areaSqFt: 0, areaDecimal: 0 };
    }

    // Shoelace formula on BTM Easting (X) and Northing (Y) in meters
    let sum1 = 0;
    let sum2 = 0;
    const n = pegs.length;

    for (let i = 0; i < n; i++) {
      const current = pegs[i];
      const next = pegs[(i + 1) % n];
      sum1 += current.btmEasting * next.btmNorthing;
      sum2 += current.btmNorthing * next.btmEasting;
    }

    const areaSqMeters = Math.abs(sum1 - sum2) / 2.0;
    // 1 sq meter = 10.7639 sq ft
    const areaSqFt = Number((areaSqMeters * 10.7639).toFixed(2));
    const areaDecimal = Number((areaSqFt / 435.6).toFixed(4));

    return { areaSqFt, areaDecimal };
  }

  /**
   * Create a new field survey session
   */
  public static createSurvey(data: {
    parcelId: string;
    mouza: string;
    upazila: string;
    district: string;
    aminId: string;
    aminName: string;
    aminLicenseNo: string;
    physicalLandUse?: SurveyRecord['physicalLandUse'];
    khatianRecordedDecimal: number;
    isOffline?: boolean;
  }): SurveyRecord {
    const newSurvey: SurveyRecord = {
      id: `SURV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      parcelId: data.parcelId,
      mouza: data.mouza,
      upazila: data.upazila,
      district: data.district,
      aminId: data.aminId,
      aminName: data.aminName,
      aminLicenseNo: data.aminLicenseNo,
      surveyDate: new Date().toISOString().slice(0, 10),
      status: data.isOffline ? 'OFFLINE_QUEUED' : 'DRAFT_IN_FIELD',
      physicalLandUse: data.physicalLandUse || 'AGRICULTURAL_PADDY',
      physicalLandUseBn: 'কৃষি ফসলি জমি',
      benchmarkPegs: [],
      computedAreaSqFt: 0,
      computedAreaDecimal: 0,
      khatianRecordedDecimal: data.khatianRecordedDecimal,
      areaVarianceDecimal: 0,
      boundaryDisputeFlag: false,
      coSharerStatements: [],
      kanungoReviewed: false,
      offlineCreated: !!data.isOffline,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    SURVEY_DATABASE.unshift(newSurvey);
    return newSurvey;
  }

  /**
   * Add a benchmark station peg to an active field survey
   */
  public static addStationPeg(
    surveyId: string,
    peg: Omit<BenchmarkPeg, 'id' | 'timestamp'>
  ): SurveyRecord | null {
    const survey = this.getSurvey(surveyId);
    if (!survey) return null;

    const newPeg: BenchmarkPeg = {
      id: `peg-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      ...peg,
      timestamp: new Date().toISOString(),
    };

    survey.benchmarkPegs.push(newPeg);

    // If 3 or more pegs, recalculate polygon area
    if (survey.benchmarkPegs.length >= 3) {
      const calc = this.computePolygonArea(survey.benchmarkPegs);
      survey.computedAreaSqFt = calc.areaSqFt;
      survey.computedAreaDecimal = calc.areaDecimal;
      survey.areaVarianceDecimal = Number(
        (calc.areaDecimal - survey.khatianRecordedDecimal).toFixed(4)
      );
      if (Math.abs(survey.areaVarianceDecimal) > 0.05) {
        survey.boundaryDisputeFlag = true;
        survey.disputeSummary = `Field survey area (${calc.areaDecimal} dec) deviates from recorded Khatian (${survey.khatianRecordedDecimal} dec) by ${Math.abs(survey.areaVarianceDecimal)} decimals.`;
      }
    }

    survey.updatedAt = new Date().toISOString();
    return survey;
  }

  /**
   * Add adjacent owner or co-sharer testimony
   */
  public static addCoSharerStatement(
    surveyId: string,
    statement: Omit<CoSharerStatement, 'id' | 'timestamp'>
  ): SurveyRecord | null {
    const survey = this.getSurvey(surveyId);
    if (!survey) return null;

    const newStmt: CoSharerStatement = {
      id: `stmt-${Date.now()}`,
      ...statement,
      timestamp: new Date().toISOString(),
    };

    survey.coSharerStatements.push(newStmt);
    if (statement.hasObjection) {
      survey.boundaryDisputeFlag = true;
      survey.disputeSummary = statement.objectionDetail || 'Boundary objection raised by adjacent co-sharer.';
    }

    survey.updatedAt = new Date().toISOString();
    return survey;
  }

  /**
   * Submit completed field survey for Kanungo review
   */
  public static submitToKanungo(surveyId: string): SurveyRecord | null {
    const survey = this.getSurvey(surveyId);
    if (!survey) return null;

    survey.status = survey.boundaryDisputeFlag ? 'DISPUTE_REFERRED' : 'SYNCED';
    survey.updatedAt = new Date().toISOString();
    return survey;
  }

  /**
   * Batch synchronize offline surveys captured by rural field Amins
   */
  public static syncOfflineQueue(records: SurveyRecord[]): {
    syncedCount: number;
    updatedSurveys: SurveyRecord[];
  } {
    const synced: SurveyRecord[] = [];

    for (const r of records) {
      const existing = this.getSurvey(r.id);
      if (existing) {
        existing.benchmarkPegs = r.benchmarkPegs;
        existing.computedAreaSqFt = r.computedAreaSqFt;
        existing.computedAreaDecimal = r.computedAreaDecimal;
        existing.areaVarianceDecimal = r.areaVarianceDecimal;
        existing.boundaryDisputeFlag = r.boundaryDisputeFlag;
        existing.coSharerStatements = r.coSharerStatements;
        existing.status = 'SYNCED';
        existing.syncedAt = new Date().toISOString();
        existing.updatedAt = new Date().toISOString();
        synced.push(existing);
      } else {
        const imported: SurveyRecord = {
          ...r,
          status: 'SYNCED',
          syncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        SURVEY_DATABASE.unshift(imported);
        synced.push(imported);
      }
    }

    return {
      syncedCount: synced.length,
      updatedSurveys: synced,
    };
  }
}
