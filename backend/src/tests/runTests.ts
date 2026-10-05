/**
 * Comprehensive Automated Test Suite for Phase 1 Foundations
 * Tests Faraiz Islamic & Hindu succession, Ed25519 cryptographic signing,
 * and Cadastral polygon calculations.
 */

import assert from 'assert';
import { FaraizService } from '../services/faraizService';
import { CryptoSignerService } from '../services/cryptoSigner';
import { CadastralService } from '../services/cadastralService';
import { DeedVerifierService } from '../services/deedVerifier';
import { LitigationService } from '../services/litigationService';
import { EscrowService } from '../services/escrowService';
import { KhasService } from '../services/khasService';
import { SurveyService } from '../services/surveyService';
import { DroneCadastreService } from '../services/droneCadastreService';

function runTestSuite() {
  console.log('[TEST RUNNER] Starting Phase 1 test suite...');
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      console.log(`[PASS] ${name}`);
    } catch (err: any) {
      failed++;
      console.error(`[FAIL] ${name}:`, err.message);
    }
  }

  // --- 1. Faraiz Inheritance Tests ---
  test('Faraiz: 1 Wife, 2 Sons, 1 Daughter (Total 80 Decimals)', () => {
    const res = FaraizService.calculate({
      deceasedGender: 'MALE',
      totalDecimal: 80,
      sons: 2,
      daughters: 1,
      wives: 1,
    });

    assert.strictEqual(res.shares.length, 3, 'Expected 3 share categories');
    const wifeShare = res.shares.find((s) => s.relation === 'Wife');
    assert.ok(wifeShare, 'Wife share must exist');
    // Wife gets 1/8 of 80 = 10 decimals
    assert.strictEqual(wifeShare.totalDecimal, 10, 'Wife should receive 10 decimals');

    // Remaining 70 divided into 5 units (2 sons * 2 + 1 daughter * 1 = 5 units)
    // 1 unit = 14 decimals. 2 sons get 28 each = 56 total. Daughter gets 14.
    const sonsShare = res.shares.find((s) => s.relation.startsWith('Sons'));
    const daughterShare = res.shares.find((s) => s.relation.startsWith('Daughter'));
    assert.strictEqual(sonsShare?.totalDecimal, 56, 'Sons should receive 56 decimals total');
    assert.strictEqual(daughterShare?.totalDecimal, 14, 'Daughter should receive 14 decimals');
    assert.strictEqual(res.totalDistributedDecimal, 80, 'Total distributed must equal 80');
  });

  test('Faraiz: Awl Doctrine (Husband + 2 Daughters, Total 60 Decimals)', () => {
    // Husband (1/4 or 1/2) -> with daughters gets 1/4. 2 daughters get 2/3.
    // 1/4 + 2/3 = 11/12 (No Awl here).
    // Let's test Husband (1/2) + 2 Sisters (2/3) or Husband (1/4) + Mother (1/6) + 2 Daughters (2/3):
    // 1/4 (3/12) + 1/6 (2/12) + 2/3 (8/12) = 13/12 > 1 -> Awl!
    const res = FaraizService.calculate({
      deceasedGender: 'FEMALE',
      totalDecimal: 65,
      husband: true,
      motherPresent: true,
      daughters: 2,
      sons: 0,
    });

    assert.strictEqual(res.awlApplied, true, 'Awl doctrine must be flagged as applied');
    assert.ok(Math.abs(res.totalDistributedDecimal - 65) < 0.01, 'Awl-adjusted sum must equal total');
  });

  test('Faraiz: Dayabhaga Hindu Law (2 Sons, Total 50 Decimals)', () => {
    const res = FaraizService.calculate({
      deceasedGender: 'MALE',
      religion: 'HINDU',
      totalDecimal: 50,
      sons: 2,
      daughters: 0,
    });

    assert.strictEqual(res.religion, 'HINDU');
    assert.strictEqual(res.shares.length, 1);
    assert.strictEqual(res.shares[0].perPersonDecimal, 25, 'Each son should receive 25 decimals');
  });

  // --- 2. Cryptographic Signer Tests ---
  test('CryptoSigner: Sign and verify Ed25519 certificate payload', () => {
    const payload = {
      certificateId: 'CERT-2026-DH-001',
      parcelId: 'BD-DHK-SAV-000001',
      documentType: 'TITLE_CLEARANCE' as const,
      issuedTo: 'Md. Rafiqul Islam',
      nidNumber: '19852691234567890',
      details: { score: 98, verdict: 'APPROVED_FOR_TRANSACTION' },
      issuedAt: '2026-09-23T12:00:00.000Z',
      issuerAuthority: 'Assistant Commissioner (Land), Savar',
    };

    const signed = CryptoSignerService.signCertificate(payload);
    assert.ok(signed.signature, 'Signature must be generated');
    assert.ok(signed.qrPayload.startsWith('BDSIG:v1:'), 'QR payload prefix must be BDSIG:v1:');

    // Verify valid
    const verification = CryptoSignerService.verifySignature(payload, signed.signature, signed.publicKey);
    assert.strictEqual(verification.isValid, true, 'Valid signature must verify successfully');

    // Verify tampering detection
    const tamperedPayload = { ...payload, issuedTo: 'Fraudulent Impersonator' };
    const tamperedCheck = CryptoSignerService.verifySignature(tamperedPayload, signed.signature, signed.publicKey);
    assert.strictEqual(tamperedCheck.isValid, false, 'Tampered payload must be rejected');
  });

  // --- 3. Cadastral Spatial Tests ---
  test('CadastralService: Shoelace polygon area calculation', () => {
    // 4-point rectangle near Savar: ~0.001 deg lat by ~0.001 deg lng
    // ~111m * ~102m = ~11,322 sqm / 40.4686 = ~279.77 decimals
    const ring = [
      [90.258, 23.842],
      [90.259, 23.842],
      [90.259, 23.843],
      [90.258, 23.843],
      [90.258, 23.842],
    ];

    const area = CadastralService.calculatePolygonAreaDecimal(ring);
    assert.ok(area > 200 && area < 350, `Calculated area ${area} must be within reasonable geodesic range`);
  });

  test('CadastralService: Point in polygon check', () => {
    const ring = [
      [90.25, 23.84],
      [90.26, 23.84],
      [90.26, 23.85],
      [90.25, 23.85],
      [90.25, 23.84],
    ];

    const inside = CadastralService.isPointInPolygon([90.255, 23.845], ring);
    const outside = CadastralService.isPointInPolygon([90.27, 23.86], ring);
    assert.strictEqual(inside, true, 'Point [90.255, 23.845] must be inside ring');
    assert.strictEqual(outside, false, 'Point [90.27, 23.86] must be outside ring');
  });

  test('CadastralService: Boundary overlap detection between overlapping polygons', () => {
    const polyA = [
      [90.25, 23.84],
      [90.26, 23.84],
      [90.26, 23.85],
      [90.25, 23.85],
      [90.25, 23.84],
    ];
    // Overlapping polyB
    const polyB = [
      [90.255, 23.845],
      [90.265, 23.845],
      [90.265, 23.855],
      [90.255, 23.855],
      [90.255, 23.845],
    ];
    // Non-overlapping polyC
    const polyC = [
      [90.27, 23.86],
      [90.28, 23.86],
      [90.28, 23.87],
      [90.27, 23.87],
      [90.27, 23.86],
    ];

    const overlapAB = CadastralService.checkPolygonOverlap(polyA, polyB);
    const overlapAC = CadastralService.checkPolygonOverlap(polyA, polyC);

    assert.strictEqual(overlapAB.hasOverlap, true, 'PolyA and PolyB must overlap');
    assert.strictEqual(overlapAC.hasOverlap, false, 'PolyA and PolyC must not overlap');
  });

  // --- 4. Phase 2: Deed Forensics Verification Suite ---
  test('DeedVerifier: Clean conveyance deed receives AUTHENTIC_VERIFIED with 0 risk score', () => {
    const cleanParams = {
      deedNumber: 'DALIL-2026-9042',
      parcelId: 'BD-DHK-SAV-000001',
      sellerNid: '19852692011000123',
      sellerName: 'Kamal Hossain',
      declaredAreaDecimal: 5.5,
      declaredPriceBdt: 4800000,
      parentDeedNumber: '1998-SAV-4521',
      subRegistryOffice: 'Savar Sub-Registry, Dhaka',
    };

    const res = DeedVerifierService.verify(cleanParams, 5.5, 'Kamal Hossain', '19852692011000123', false);
    assert.strictEqual(res.overallScore, 0, 'Clean deed should have 0 risk score');
    assert.strictEqual(res.verdict, 'AUTHENTIC_VERIFIED', 'Clean deed should be AUTHENTIC_VERIFIED');
    assert.strictEqual(res.checks.length, 6, 'Must evaluate all 6 statutory checks');
    assert.ok(res.checks.every((c) => c.status === 'PASS'), 'All checks must PASS on clean deed');
  });

  test('DeedVerifier: Area inflation detected (>0.05 decimal excess) triggers FAIL and high risk penalty', () => {
    const inflatedParams = {
      deedNumber: 'DALIL-2026-INFLATED',
      parcelId: 'BD-DHK-SAV-000001',
      sellerNid: '19852692011000123',
      sellerName: 'Kamal Hossain',
      declaredAreaDecimal: 12.0, // Parcel only holds 5.5 decimal
      declaredPriceBdt: 9600000,
      parentDeedNumber: '1998-SAV-4521',
    };

    const res = DeedVerifierService.verify(inflatedParams, 5.5, 'Kamal Hossain', '19852692011000123', false);
    const areaCheck = res.checks.find((c) => c.category === 'AREA_INTEGRITY');
    assert.ok(areaCheck, 'Area check must exist');
    assert.strictEqual(areaCheck.status, 'FAIL', 'Inflated area must FAIL');
    assert.strictEqual(areaCheck.penaltyScore, 45, 'Over 25% inflation must incur 45 penalty points');
    assert.ok(res.areaInflationPercentage > 100, 'Inflation percentage should exceed 100%');
    assert.ok(res.overallScore >= 45, 'Risk score must reflect area penalty');
  });

  test('DeedVerifier: Deceased / flagged seller NID impersonation triggers FAIL and fraud locking', () => {
    const deceasedParams = {
      deedNumber: 'DALIL-2026-GHOST',
      parcelId: 'BD-DHK-SAV-000002',
      sellerNid: '19502692011000999', // Known deceased NID
      sellerName: 'Late Mofizur Rahman',
      declaredAreaDecimal: 4.0,
      declaredPriceBdt: 3200000,
      parentDeedNumber: '1975-SAV-1002',
    };

    const res = DeedVerifierService.verify(deceasedParams, 4.0, 'Late Mofizur Rahman', '19502692011000999', false);
    const sellerCheck = res.checks.find((c) => c.category === 'SELLER_AUTHENTICITY');
    assert.ok(sellerCheck, 'Seller authenticity check must exist');
    assert.strictEqual(sellerCheck.status, 'FAIL', 'Deceased vendor must FAIL');
    assert.strictEqual(sellerCheck.penaltyScore, 50, 'Mortis causa impersonation must incur 50 penalty points');
  });

  test('DeedVerifier: Active civil court stay order halts transfer and triggers SUSPECTED_FRAUD_LOCKED', () => {
    const enjoinedParams = {
      deedNumber: 'DALIL-2026-INJUNCTION',
      parcelId: 'BD-DHK-SAV-000003',
      sellerNid: '19852692011000123',
      sellerName: 'Kamal Hossain',
      declaredAreaDecimal: 8.0,
      declaredPriceBdt: 7000000,
      parentDeedNumber: '', // Missing parent deed
    };

    // Active injunction + missing parent deed (40 + 25 = 65 risk score >= 60)
    const res = DeedVerifierService.verify(enjoinedParams, 8.0, 'Kamal Hossain', '19852692011000123', true);
    const courtCheck = res.checks.find((c) => c.category === 'COURT_LITIGATION');
    assert.ok(courtCheck, 'Court litigation check must exist');
    assert.strictEqual(courtCheck.status, 'FAIL', 'Court stay order must FAIL check');
    assert.strictEqual(courtCheck.penaltyScore, 40, 'Injunction violation must incur 40 points');
    assert.strictEqual(res.verdict, 'SUSPECTED_FRAUD_LOCKED', 'Total score >= 60 must trigger SUSPECTED_FRAUD_LOCKED');
  });

  test('DeedVerifier: Under-declaration below statutory mouza benchmark triggers CAUTION for stamp duty evasion', () => {
    const undervaluedParams = {
      deedNumber: 'DALIL-2026-TAX-EVADE',
      parcelId: 'BD-DHK-SAV-000001',
      sellerNid: '19852692011000123',
      sellerName: 'Kamal Hossain',
      declaredAreaDecimal: 5.5,
      declaredPriceBdt: 200000, // Savar benchmark: 5.5 * 450,000 = 2,475,000; 200,000 is < 70%
      parentDeedNumber: '1998-SAV-4521',
    };

    const res = DeedVerifierService.verify(undervaluedParams, 5.5, 'Kamal Hossain', '19852692011000123', false);
    const valCheck = res.checks.find((c) => c.category === 'VALUATION_FAIRNESS');
    assert.ok(valCheck, 'Valuation check must exist');
    assert.strictEqual(valCheck.status, 'CAUTION', 'Severe under-valuation must trigger CAUTION');
    assert.strictEqual(valCheck.penaltyScore, 20, 'Under-valuation must incur 20 penalty points');
    assert.strictEqual(res.verdict, 'REVIEW_RECOMMENDED', 'Score of 20 with minor caution yields REVIEW_RECOMMENDED or AUTHENTIC_VERIFIED');
  });

  // --- 5. Phase 2: Civil Court Litigation & Injunction Radar Suite ---
  test('LitigationService: Detects active stay order for enjoined parcel BD-DHK-SAV-000003', () => {
    const isEnjoined = LitigationService.hasActiveInjunction('BD-DHK-SAV-000003');
    assert.strictEqual(isEnjoined, true, 'BD-DHK-SAV-000003 must have active injunction');

    const cases = LitigationService.getByParcelId('BD-DHK-SAV-000003');
    assert.ok(cases.length >= 1, 'Should find at least 1 litigation case');
    assert.strictEqual(cases[0].caseNumber, 'TS-142/2025', 'Case number must match TS-142/2025');
    assert.strictEqual(cases[0].stayOrderActive, true, 'Stay order must be active');
    assert.strictEqual(cases[0].status, 'ACTIVE_STAY', 'Status must be ACTIVE_STAY');
  });

  test('LitigationService: Unlitigated or pending non-stay parcels return false for hasActiveInjunction', () => {
    const isCleanEnjoined = LitigationService.hasActiveInjunction('BD-DHK-SAV-000001');
    assert.strictEqual(isCleanEnjoined, false, 'Clean parcel must have no active injunction');

    // BD-DHK-SAV-000007 has partition suit but no active stay order
    const isPartitionEnjoined = LitigationService.hasActiveInjunction('BD-DHK-SAV-000007');
    assert.strictEqual(isPartitionEnjoined, false, 'Pending partition suit without stay order must not block transfer');
  });

  test('LitigationService: Dynamically register new litigation case and verify radar lookup', () => {
    const tempParcelId = 'BD-DHK-SAV-999999';
    assert.strictEqual(LitigationService.hasActiveInjunction(tempParcelId), false);

    LitigationService.addCase({
      parcelId: tempParcelId,
      caseNumber: 'TS-999/2026',
      courtName: 'Joint District Judge 1st Court, Dhaka',
      suitType: 'TEMPORARY_INJUNCTION',
      suitTypeBn: 'অস্থায়ী নিষেধাজ্ঞা মোকদ্দমা',
      claimant: 'Test Plaintiff',
      defendant: 'Test Defendant',
      filedDate: '2026-09-01',
      stayOrderActive: true,
      stayOrderDate: '2026-09-10',
      nextHearingDate: '2026-12-01',
      status: 'ACTIVE_STAY',
      orderSummary: 'Restraining order prohibiting mutation or encumbrance.',
      orderSummaryBn: 'উক্ত দাগের জমি হস্তান্তর ও নামজারির ওপর স্থগিতাদেশ।',
      statutorySection: 'CPC Order 39 Rules 1-2',
    });

    assert.strictEqual(LitigationService.hasActiveInjunction(tempParcelId), true, 'Dynamic parcel must now show active injunction');
  });

  // --- 6. Phase 3: Zero-Trust Land Escrow Pipeline Suite ---
  test('EscrowService: Tax calculations follow statutory rates (3% stamp, 2% local govt, 1% reg, 4% AIT)', () => {
    const totalConsideration = 5000000; // BDT 5,000,000
    const taxes = EscrowService.calculateTaxes(totalConsideration);

    assert.strictEqual(taxes.stampDutyBdt, 150000, '3% Stamp Duty should be 150,000');
    assert.strictEqual(taxes.localGovTaxBdt, 100000, '2% Local Govt Tax should be 100,000');
    assert.strictEqual(taxes.registrationFeeBdt, 50000, '1% Registration Fee should be 50,000');
    assert.strictEqual(taxes.aitSourceTaxBdt, 200000, '4% AIT should be 200,000');
    assert.strictEqual(taxes.totalStatutoryFeesBdt, 500000, 'Total fees should be 500,000 (10%)');
    assert.strictEqual(taxes.netPayableToSellerBdt, 4500000, 'Net payable should be 4,500,000');
  });

  test('EscrowService: Contract lifecycle progresses from creation to fund release and unlocks parcel', () => {
    const contract = EscrowService.createContract({
      parcelId: 'BD-DHK-SAV-000001',
      areaDecimal: 5.5,
      buyerNid: '19882691234567891',
      buyerName: 'Tanvir Ahmed',
      buyerPhone: '01811-223344',
      sellerNid: '19852692011000123',
      sellerName: 'Kamal Hossain',
      sellerPhone: '01711-223344',
      totalConsiderationBdt: 4800000,
    });

    assert.ok(contract.id.startsWith('ESC-'), 'Contract ID must have ESC- prefix');
    assert.strictEqual(contract.isLocked, true, 'Parcel must be locked on contract initiation');
    assert.strictEqual(contract.stage, 'LAND_LOCKED');

    // 1. Buyer deposits earnest
    const funded = EscrowService.depositEscrow(contract.id, 500000, 'TRX-TEST-001');
    assert.ok(funded);
    assert.strictEqual(funded?.stage, 'ESCROW_DEPOSITED');
    assert.strictEqual(funded?.depositedAmountBdt, 500000);

    // 2. Title audit passes
    const audited = EscrowService.certifyTitle(contract.id, 'AUTHENTIC_VERIFIED', 0);
    assert.ok(audited);
    assert.strictEqual(audited?.stage, 'TITLE_AUDITED');

    // 3. Deed execution recorded
    const deeded = EscrowService.recordDeedExecution(contract.id, 'DALIL-2026-9042', 'VOL-12');
    assert.ok(deeded);
    assert.strictEqual(deeded?.stage, 'DEED_EXECUTED');
    assert.strictEqual(deeded?.deedNumber, 'DALIL-2026-9042');

    // 4. Mutation recorded
    const mutated = EscrowService.recordMutationApproved(contract.id, 'MUT-2026-004', 'KHT-SAV-991');
    assert.ok(mutated);
    assert.strictEqual(mutated?.stage, 'MUTATION_RECORDED');

    // 5. Fund released & parcel unlocked
    const settled = EscrowService.releaseFunds(contract.id);
    assert.ok(settled);
    assert.strictEqual(settled?.stage, 'FUNDS_RELEASED');
    assert.strictEqual(settled?.isLocked, false, 'Parcel must be unlocked after fund release');
  });

  // --- 7. Phase 3: Khas & Government Land Encroachment Radar Suite ---
  test('KhasService: Identifies critical encroachment on riverbed foreshore within 15 meters', () => {
    // Bangshi Riverbed foreshore centroid in Savar is [90.2582, 23.8436]
    const testCoords: [number, number] = [90.25821, 23.84362]; // ~2 meters away
    const result = KhasService.checkEncroachment('BD-DHK-SAV-TEST-RIVER', testCoords);

    assert.strictEqual(result.isEncroaching, true, 'Must flag direct boundary encroachment');
    assert.strictEqual(result.riskLevel, 'CRITICAL_ENCROACHMENT');
    assert.ok(result.closestDistanceMeters <= 15);
    assert.ok(result.matchedKhasRecord);
    assert.strictEqual(result.matchedKhasRecord?.category, 'RIVERBED_FORESHORE');
  });

  test('KhasService: Identifies statutory buffer warning for land within 50 meters of Khas parcel', () => {
    // Offset by ~35 meters
    const testCoords: [number, number] = [90.2585, 23.8438];
    const result = KhasService.checkEncroachment('BD-DHK-SAV-BUFFER', testCoords);

    assert.strictEqual(result.isEncroaching, false, 'Must not be direct encroachment');
    assert.strictEqual(result.inBufferZone, true, 'Must fall inside 50m buffer');
    assert.strictEqual(result.riskLevel, 'BUFFER_WARNING');
  });

  test('KhasService: Returns CLEAN status for distant private titled land (>500 meters)', () => {
    // Savar residential center coordinates away from river/khas
    const distantCoords: [number, number] = [90.275, 23.855]; // >1.5 km away
    const result = KhasService.checkEncroachment('BD-DHK-SAV-CLEAN', distantCoords);

    assert.strictEqual(result.isEncroaching, false);
    assert.strictEqual(result.inBufferZone, false);
    assert.strictEqual(result.riskLevel, 'CLEAN');
    assert.strictEqual(result.matchedKhasRecord, null);
  });

  test('KhasService: Dynamically issues administrative eviction notice under Public Lands Ordinance 1970', () => {
    const updated = KhasService.issueEvictionNotice('khas-002', 'EVICT-CTG-2026/01', 'Illegal Encroacher Party');
    assert.ok(updated);
    assert.strictEqual(updated?.isEncroached, true);
    assert.strictEqual(updated?.evictionCaseNumber, 'EVICT-CTG-2026/01');
    assert.strictEqual(updated?.encroacherName, 'Illegal Encroacher Party');
  });

  // --- 8. Phase 4: Field Survey & Offline Amin Sync Suite ---
  test('SurveyService: Gunter links to feet conversion (1 link = 0.66 ft) and square links to decimals', () => {
    // 100 links = 66 feet (1 Gunter chain)
    assert.strictEqual(SurveyService.linksToFeet(100), 66.0);
    assert.strictEqual(SurveyService.linksToFeet(50), 33.0);
    // 1,000 square links = 1 Decimal = 435.6 sq ft
    assert.strictEqual(SurveyService.sqLinksToDecimal(1000), 1.0);
    assert.strictEqual(SurveyService.sqFtToDecimal(435.6), 1.0);
  });

  test('SurveyService: Computes polygon area from benchmark pegs and flags area variance', () => {
    const survey = SurveyService.createSurvey({
      parcelId: 'BD-DHK-SAV-FIELD-TEST',
      mouza: 'Savar Mouza',
      upazila: 'Savar',
      district: 'Dhaka',
      aminId: 'amin-004',
      aminName: 'Md. Abdur Rahim',
      aminLicenseNo: 'AMIN-DHK-2018/88',
      khatianRecordedDecimal: 5.5,
      isOffline: true,
    });
    assert.ok(survey.id);
    assert.strictEqual(survey.status, 'OFFLINE_QUEUED');

    // Add 4 pegs forming a rectangle ~5.5 decimals
    // 1 meter in BTM ~ 1 unit
    // Rectangle: width = 24.14m (79.2 ft), height = 15.08m (49.5 ft) -> Area ~ 364 sq m = 3918 sq ft = ~9 decimals
    SurveyService.addStationPeg(survey.id, {
      pegNumber: 'P-1',
      lat: 23.8441,
      lng: 90.2589,
      btmEasting: 526300,
      btmNorthing: 2637400,
      elevationMeters: 11.2,
      chainageToNextLinks: 120,
      chainageToNextFeet: 79.2,
      physicalMarkerType: 'CONCRETE_PILLAR',
    });
    SurveyService.addStationPeg(survey.id, {
      pegNumber: 'P-2',
      lat: 23.8441,
      lng: 90.2596,
      btmEasting: 526370,
      btmNorthing: 2637400,
      elevationMeters: 11.1,
      chainageToNextLinks: 75,
      chainageToNextFeet: 49.5,
      physicalMarkerType: 'CONCRETE_PILLAR',
    });
    SurveyService.addStationPeg(survey.id, {
      pegNumber: 'P-3',
      lat: 23.8436,
      lng: 90.2596,
      btmEasting: 526370,
      btmNorthing: 2637350,
      elevationMeters: 11.0,
      chainageToNextLinks: 120,
      chainageToNextFeet: 79.2,
      physicalMarkerType: 'IRON_ROD',
    });
    const updated = SurveyService.addStationPeg(survey.id, {
      pegNumber: 'P-4',
      lat: 23.8436,
      lng: 90.2589,
      btmEasting: 526300,
      btmNorthing: 2637350,
      elevationMeters: 11.1,
      chainageToNextLinks: 75,
      chainageToNextFeet: 49.5,
      physicalMarkerType: 'CONCRETE_PILLAR',
    });

    assert.ok(updated);
    assert.ok(updated.computedAreaSqFt > 0, 'Must compute positive area');
    assert.ok(updated.computedAreaDecimal > 0, 'Must compute positive decimal area');
    assert.strictEqual(updated.benchmarkPegs.length, 4);
  });

  test('SurveyService: Batch syncs offline survey queue and updates existing draft', () => {
    const list = SurveyService.listSurveys();
    const target = list[0];
    const modifiedRecord = {
      ...target,
      aminName: 'Md. Abdur Rahim (Offline Synced)',
    };

    const syncResult = SurveyService.syncOfflineQueue([modifiedRecord]);
    assert.strictEqual(syncResult.syncedCount, 1);
    assert.strictEqual(syncResult.updatedSurveys[0].status, 'SYNCED');
    assert.ok(syncResult.updatedSurveys[0].syncedAt);
  });

  // --- 9. Phase 4: Drone Cadastre Multi-Epoch Comparison Suite ---
  test('DroneCadastreService: Retrieves multi-epoch progression CS 1924, RS 1988, BS 2015, BDS 2026', () => {
    const epochs = DroneCadastreService.getEpochs('BD-DHK-SAV-000001');
    assert.strictEqual(epochs.length, 4);
    assert.strictEqual(epochs[0].epochId, 'CS_1924');
    assert.strictEqual(epochs[1].epochId, 'RS_1988');
    assert.strictEqual(epochs[2].epochId, 'BS_2015');
    assert.strictEqual(epochs[3].epochId, 'BDS_2026');
  });

  test('DroneCadastreService: Identifies congruent match for verified parcel BD-DHK-SAV-000001', () => {
    const comparison = DroneCadastreService.compareEpochs('BD-DHK-SAV-000001');
    assert.strictEqual(comparison.canalEncroachmentFlag, false);
    assert.strictEqual(comparison.verdict, 'CONGRUENT_MATCH');
    assert.ok(comparison.maxVertexShiftMeters <= 0.5);
  });

  test('DroneCadastreService: Detects canal encroachment and large vertex shift on encroached parcel BD-DHK-SAV-000003', () => {
    const comparison = DroneCadastreService.compareEpochs('BD-DHK-SAV-000003');
    assert.strictEqual(comparison.canalEncroachmentFlag, true);
    assert.strictEqual(comparison.verdict, 'SUSPECTED_CANAL_ENCROACHMENT');
    assert.ok(comparison.maxVertexShiftMeters > 5.0, 'Must detect substantial vertex expansion into canal');
    assert.ok(comparison.canalEncroachmentAreaSqFt && comparison.canalEncroachmentAreaSqFt > 0);
  });

  console.log(`\n[TEST SUMMARY] Total Passed: ${passed}, Total Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();

