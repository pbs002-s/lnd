import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { DeedVerifierService, DeedVerificationParams } from '../services/deedVerifier';
import { LitigationService } from '../services/litigationService';
import { ok, fail } from '../lib/respond';

const router = Router();
const prisma = new PrismaClient();

// Pre-packaged test scenarios for interactive forensics demo
const SAMPLE_PRESETS: Array<{
  id: string;
  titleEn: string;
  titleBn: string;
  descriptionEn: string;
  descriptionBn: string;
  expectedVerdict: string;
  params: DeedVerificationParams;
}> = [
  {
    id: 'preset-clean',
    titleEn: 'Authentic Conveyance Deed (বৈধ সাফ-কবলা দলিল)',
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
    titleEn: 'Area Inflation Forgery (অতিরিক্ত জমি দাবি জালিয়াতি)',
    titleBn: 'খতিয়ান অপেক্ষা অতিরিক্ত জমির জাল দাবি',
    descriptionEn: 'Deed claims 9.20 decimals on a parcel with only 5.50 decimals registered.',
    descriptionBn: 'খতিয়ানে মোট পরিমাণ ৫.৫০ শতক হলেও দলিলে প্রতারণামূলকভাবে ৯.২০ শতক দাবি করা হয়েছে।',
    expectedVerdict: 'SUSPECTED_FRAUD_LOCKED',
    params: {
      deedNumber: 'DALIL-2026-7811',
      parcelId: 'BD-DHK-SAV-000001',
      sellerNid: '19852692011000123',
      sellerName: 'Kamal Hossain',
      declaredAreaDecimal: 9.2,
      declaredPriceBdt: 3500000,
      parentDeedNumber: '1998-SAV-4521',
      subRegistryOffice: 'Savar Sub-Registry, Dhaka',
    },
  },
  {
    id: 'preset-deceased',
    titleEn: 'Deceased Seller Impersonation (মৃত ব্যক্তির ভুয়া বিক্রেতা সাজানো)',
    titleBn: 'মৃত ব্যক্তির এনআইডি ব্যবহার করে প্রতারণামূলক হস্তান্তর',
    descriptionEn: 'Vendor NID is flagged as deceased in 2018 national vital statistics registry.',
    descriptionBn: 'বিক্রেতার এনআইডি জাতীয় তথ্যভাণ্ডারে ২০১৮ সালে মৃত হিসেবে চিহ্নিত। জালিয়াতি সুস্পষ্ট।',
    expectedVerdict: 'SUSPECTED_FRAUD_LOCKED',
    params: {
      deedNumber: 'DALIL-2026-1029',
      parcelId: 'BD-DHK-SAV-000001',
      sellerNid: '19502692011000999',
      sellerName: 'Late Mofizul Islam',
      declaredAreaDecimal: 5.5,
      declaredPriceBdt: 4500000,
      parentDeedNumber: '',
      subRegistryOffice: 'Savar Sub-Registry, Dhaka',
    },
  },
  {
    id: 'preset-injunction',
    titleEn: 'Civil Injunction Violation (আদালতের নিষেধাজ্ঞা লঙ্ঘন)',
    titleBn: 'দেওয়ানি আদালতের স্থগিতাদেশ অমান্য করে জমি বিক্রির চেষ্টা',
    descriptionEn: 'Senior Assistant Judge Court issued a formal stay order on Dag #482.',
    descriptionBn: 'সিনিয়র সহকারী জজ আদালত কর্তৃক উক্ত দাগের ওপর স্থগিতাদেশ বলবৎ থাকা সত্ত্বেও বিক্রয়ের চেষ্টা।',
    expectedVerdict: 'SUSPECTED_FRAUD_LOCKED',
    params: {
      deedNumber: 'DALIL-2026-4433',
      parcelId: 'BD-DHK-SAV-000003',
      sellerNid: '19752692011000456',
      sellerName: 'Rafiqul Islam',
      declaredAreaDecimal: 4.8,
      declaredPriceBdt: 3800000,
      parentDeedNumber: '2005-SAV-9912',
      subRegistryOffice: 'Savar Sub-Registry, Dhaka',
    },
  },
];

// Perform algorithmic forensic audit on a deed
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const params: DeedVerificationParams = req.body;
    if (!params.parcelId || !params.declaredAreaDecimal) {
      return fail(res, 'Please provide parcelId and declaredAreaDecimal.', 400);
    }

    // Lookup parcel in DB or fallback
    let parcelArea = 5.5;
    let ownerName = 'Kamal Hossain';
    let ownerNid = '19852692011000123';

    try {
      const p = await prisma.parcel.findUnique({ where: { id: params.parcelId } });
      if (p) {
        parcelArea = p.areaDecimal;
        ownerName = p.currentOwner;
        ownerNid = p.nidNumber;
      }
    } catch {
      // Offline / demo fallback
    }

    const hasInjunction = LitigationService.hasActiveInjunction(params.parcelId);
    const result = DeedVerifierService.verify(params, parcelArea, ownerName, ownerNid, hasInjunction);

    return ok(res, result);
  } catch (error: any) {
    console.error('Error in /api/deed-verifier/verify:', error);
    return fail(res, 'Failed to perform deed verification.', 500);
  }
});

// Fetch pre-packaged scenarios for testing
router.get('/presets', (req: Request, res: Response) => {
  return ok(res, SAMPLE_PRESETS);
});

export default router;
