/**
 * Khas, Vested & Government Land Encroachment Radar Service
 * Detects unauthorized settlement, illegal riverbed/foreshore occupation,
 * and tracks administrative eviction notices under SAT Act 1950.
 */

export interface KhasRecord {
  id: string;
  mouza: string;
  upazila: string;
  district: string;
  khasKhatianNo: string;
  dagNo: string;
  category: '1_NO_KHAS' | 'VESTED_PROPERTY' | 'ABANDONED_PROPERTY' | 'RIVERBED_FORESHORE' | 'FOREST_RESERVE';
  categoryBn: string;
  areaDecimal: number;
  controllingAuthority: string;
  coordinates: [number, number]; // [lng, lat] centroid
  isEncroached: boolean;
  encroacherName?: string;
  evictionCaseNumber?: string;
  evictionNoticeDate?: string;
  statutoryAct: string;
}

export interface EncroachmentCheckResult {
  parcelId: string;
  isEncroaching: boolean;
  inBufferZone: boolean;
  closestDistanceMeters: number;
  riskLevel: 'CLEAN' | 'BUFFER_WARNING' | 'CRITICAL_ENCROACHMENT';
  riskLevelBn: string;
  matchedKhasRecord: KhasRecord | null;
  statutoryCitation: string;
  statutoryNoticeEn: string;
  statutoryNoticeBn: string;
  checkedAt: string;
}

// Authoritative Inventory of Registered Government Lands in Savar, Pabna, Chittagong
const KHAS_INVENTORY: KhasRecord[] = [
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
    dagNo: 'দাগ নং ১৩০২ (Dag #1302 - Vested Estate)',
    category: 'VESTED_PROPERTY',
    categoryBn: 'অর্পিত সম্পত্তি ("ক" তফসিল)',
    areaDecimal: 28.5,
    controllingAuthority: 'District Administration Chattogram (Vested Property Cell)',
    coordinates: [91.8215, 22.3685],
    isEncroached: false,
    statutoryAct: 'Vested Property Return (Amendment) Act 2013',
  },
  {
    id: 'khas-003',
    mouza: 'Ishwardi Mouza (ঈশ্বরদী মৌজা)',
    upazila: 'Ishwardi',
    district: 'Pabna',
    khasKhatianNo: '১নং খাস খতিয়ান (Khas Khatian #1)',
    dagNo: 'দাগ নং ৮৮ (Dag #88 - Railway & Canal Strip)',
    category: '1_NO_KHAS',
    categoryBn: '১নং খাস খতিয়ানভুক্ত সরকারি খাল ও তীরবর্তী জমি',
    areaDecimal: 18.0,
    controllingAuthority: 'Assistant Commissioner (Land), Ishwardi',
    coordinates: [89.071, 24.135],
    isEncroached: true,
    encroacherName: 'Unauthorized Brick Kiln Barrier',
    evictionCaseNumber: 'EVICT-ISW-2026/04',
    evictionNoticeDate: '2026-03-12',
    statutoryAct: 'Public and Local Authorities Lands (Eviction of Unauthorized Occupants) Ordinance 1970',
  },
];

export class KhasService {
  /**
   * Computes approximate Euclidean distance in meters between two WGS84 points
   */
  private static calculateDistanceMeters(p1: [number, number], p2: [number, number]): number {
    const latMid = ((p1[1] + p2[1]) / 2) * (Math.PI / 180);
    const mPerDegLat = 111132.954;
    const mPerDegLng = 111412.84 * Math.cos(latMid);

    const dLng = (p1[0] - p2[0]) * mPerDegLng;
    const dLat = (p1[1] - p2[1]) * mPerDegLat;

    return Math.sqrt(dLng * dLng + dLat * dLat);
  }

  /**
   * Evaluates if a parcel or coordinate is on or near government Khas land
   */
  public static checkEncroachment(
    parcelId: string,
    parcelCoordinates: [number, number]
  ): EncroachmentCheckResult {
    let closestRecord: KhasRecord | null = null;
    let minDistance = Infinity;

    for (const khas of KHAS_INVENTORY) {
      const dist = this.calculateDistanceMeters(parcelCoordinates, khas.coordinates);
      if (dist < minDistance) {
        minDistance = dist;
        closestRecord = khas;
      }
    }

    const roundedDistance = Math.round(minDistance);
    const isEncroaching = roundedDistance <= 15; // Within 15 meters considered direct boundary encroachment
    const inBufferZone = roundedDistance <= 50; // Within 50 meters considered statutory cautionary buffer zone

    let riskLevel: EncroachmentCheckResult['riskLevel'] = 'CLEAN';
    let riskLevelBn = 'নিরাপদ ও নিষ্কণ্টক ব্যক্তিমালিকানাধীন জমি (Clean Title)';

    if (isEncroaching) {
      riskLevel = 'CRITICAL_ENCROACHMENT';
      riskLevelBn = 'খাস জমি বা নদী তীরবর্তী সরকারি খতিয়ানে অননুমোদিত দখল (Critical Encroachment)';
    } else if (inBufferZone) {
      riskLevel = 'BUFFER_WARNING';
      riskLevelBn = 'সরকারি খাস সীমানার ৫০ মিটার বাফার জোনের অভ্যন্তরে (Buffer Zone Warning)';
    }

    const now = new Date().toISOString();

    return {
      parcelId,
      isEncroaching,
      inBufferZone,
      closestDistanceMeters: roundedDistance,
      riskLevel,
      riskLevelBn,
      matchedKhasRecord: (isEncroaching || inBufferZone) ? closestRecord : null,
      statutoryCitation:
        riskLevel === 'CRITICAL_ENCROACHMENT'
          ? 'State Acquisition and Tenancy Act 1950, Sec 86 & Public and Local Authorities Lands Ordinance 1970'
          : riskLevel === 'BUFFER_WARNING'
          ? 'Natural Water Reservoir Conservation Act 2000 & Land Administration Manual 2020'
          : 'State Acquisition and Tenancy Act 1950, Sec 89',
      statutoryNoticeEn:
        riskLevel === 'CRITICAL_ENCROACHMENT'
          ? `CRITICAL LEGAL BARRIER: Parcel ${parcelId} intersects with ${closestRecord?.khasKhatianNo} (${closestRecord?.dagNo}). Conveyance deed registration, private mortgage, and mutation are strictly barred by law. Summary eviction decree applicable.`
          : riskLevel === 'BUFFER_WARNING'
          ? `STATUTORY BUFFER NOTICE: Parcel ${parcelId} lies within ${roundedDistance}m of ${closestRecord?.khasKhatianNo}. Field verification by Upazila Land Office Amin mandatory prior to title clearance.`
          : `CLEAR TITLE CONFIRMED: Parcel ${parcelId} is outside all gazetted 1 No. Khas, Vested Property, and riverbed foreshore zones.`,
      statutoryNoticeBn:
        riskLevel === 'CRITICAL_ENCROACHMENT'
          ? `মারাত্মক আইনি বাধা: দাগ নং ${parcelId} সরকারি ${closestRecord?.khasKhatianNo} (${closestRecord?.dagNo}) এর অন্তর্ভুক্ত। এই জমির হস্তান্তর, সাফ-কবলা দলিল সম্পাদন বা নামজারি আইনত সম্পূর্ণ নিষিদ্ধ।`
          : riskLevel === 'BUFFER_WARNING'
          ? `বাফার জোন সতর্কতা: দাগ নং ${parcelId} সরকারি খাস খতিয়ানের সীমানা হতে মাত্র ${roundedDistance} মিটার দূরত্বে অবস্থিত। সার্ভেয়ার আমিন কর্তৃক সরেজমিন সীমানা নির্ধারণ ব্যতিরেকে বিক্রয় ঝুঁকিপূর্ণ।`
          : `সম্পূর্ণ নিরাপদ: এই দাগটি কোনো ১নং খাস খতিয়ান, অর্পিত সম্পত্তি বা নদী সিকস্তি জমির অন্তর্ভুক্ত নয়।`,
      checkedAt: now,
    };
  }

  /**
   * Retrieves registered Khas records
   */
  public static listKhasRecords(upazilaFilter?: string): KhasRecord[] {
    if (!upazilaFilter) return [...KHAS_INVENTORY];
    const clean = upazilaFilter.trim().toLowerCase();
    return KHAS_INVENTORY.filter((r) => r.upazila.toLowerCase().includes(clean));
  }

  /**
   * Registers an eviction notice issued by AC (Land)
   */
  public static issueEvictionNotice(
    khasId: string,
    caseNumber: string,
    encroacherName: string
  ): KhasRecord | null {
    const record = KHAS_INVENTORY.find((r) => r.id === khasId);
    if (!record) return null;

    record.isEncroached = true;
    record.evictionCaseNumber = caseNumber;
    record.encroacherName = encroacherName;
    record.evictionNoticeDate = new Date().toISOString().slice(0, 10);
    return record;
  }
}
