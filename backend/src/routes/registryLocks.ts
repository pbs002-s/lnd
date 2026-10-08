import { Router, Request, Response } from 'express';
import { InterRegistryLockEngine } from '../services/interRegistryLockEngine';
import { CibGateway } from '../services/gateways/cibGateway';
import { JudicialGateway } from '../services/gateways/judicialGateway';
import { SubRegistryGateway } from '../services/gateways/subRegistryGateway';
import { NecService } from '../services/necService';
import { ok, fail } from '../lib/respond';

const router = Router();

// GET /api/registry-locks/:parcelId - Full 4-agency state dashboard
router.get('/:parcelId', (req: Request, res: Response) => {
  const { parcelId } = req.params;
  try {
    const dashboard = InterRegistryLockEngine.getDashboardState(parcelId);
    ok(res, dashboard);
  } catch (error: any) {
    fail(res, error.message);
  }
});

// GET /api/registry-locks/:parcelId/active - Active lock records
router.get('/:parcelId/active', (req: Request, res: Response) => {
  const { parcelId } = req.params;
  try {
    const activeLocks = InterRegistryLockEngine.getActiveLocks(parcelId);
    ok(res, activeLocks);
  } catch (error: any) {
    fail(res, error.message);
  }
});

// POST /api/registry-locks/:parcelId/acquire - Acquire a lock
router.post('/:parcelId/acquire', (req: Request, res: Response) => {
  const { parcelId } = req.params;
  const {
    lockType,
    lockingAuthority,
    authorityCategory,
    initiatorNid,
    initiatorName,
    referenceNumber,
    statutoryBasis,
    orderSummaryEn,
    orderSummaryBn,
    expiresAt,
  } = req.body;

  if (!lockType || !lockingAuthority || !initiatorName || !referenceNumber) {
    return fail(res, 'Missing required fields: lockType, lockingAuthority, initiatorName, referenceNumber.', 400);
  }

  const result = InterRegistryLockEngine.acquireLock({
    parcelId,
    lockType,
    lockingAuthority,
    authorityCategory: authorityCategory || 'CITIZEN',
    initiatorNid,
    initiatorName,
    referenceNumber,
    statutoryBasis: statutoryBasis || 'Digital Land Registry Regulations',
    orderSummaryEn: orderSummaryEn || 'Registry lock active.',
    orderSummaryBn: orderSummaryBn || 'রেজিস্ট্রি লক কার্যকর।',
    expiresAt,
  });

  if (!result.success) {
    return fail(res, result.error || 'Failed to acquire lock.', 409);
  }

  ok(res, result.lock, 201);
});

// POST /api/registry-locks/:parcelId/release - Release lock by token
router.post('/:parcelId/release', (req: Request, res: Response) => {
  const { lockToken, releaseAuthority, releaseReference } = req.body;

  if (!lockToken) {
    return fail(res, 'Missing lockToken in request body.', 400);
  }

  const result = InterRegistryLockEngine.releaseLock({
    lockToken,
    releaseAuthority: releaseAuthority || 'Authorized Officer',
    releaseReference: releaseReference || 'Standard Release Order',
  });

  if (!result.success) {
    return fail(res, result.error || 'Failed to release lock.', 400);
  }

  ok(res, result.releasedLock);
});

// GET /api/registry-locks/:parcelId/mortgages - Inquire CIB mortgages
router.get('/:parcelId/mortgages', (req: Request, res: Response) => {
  const { parcelId } = req.params;
  try {
    const inquiry = CibGateway.inquireCollateral(parcelId);
    ok(res, inquiry);
  } catch (error: any) {
    fail(res, error.message);
  }
});

// POST /api/registry-locks/:parcelId/mortgages - Register institutional mortgage (with Double Mortgage prevention)
router.post('/:parcelId/mortgages', (req: Request, res: Response) => {
  const { parcelId } = req.params;
  const {
    bankCode,
    bankName,
    branchName,
    routingNumber,
    sanctionedAmountBDT,
    borrowerNid,
    borrowerName,
    chargeRank,
    isPariPassuConsent,
    mortgageDeedNumber,
  } = req.body;

  if (!bankCode || !bankName || !sanctionedAmountBDT || !borrowerNid) {
    return fail(res, 'Missing required mortgage details: bankCode, bankName, sanctionedAmountBDT, borrowerNid.', 400);
  }

  // Pre-check with InterRegistryLockEngine
  const assertion = InterRegistryLockEngine.assertCanMortgage(parcelId, bankCode, Number(chargeRank) || 1);
  if (!assertion.permitted) {
    return fail(res, assertion.reasonEn, 409);
  }

  const result = CibGateway.registerLien({
    parcelId,
    bankCode,
    bankName,
    branchName: branchName || 'Principal Branch',
    routingNumber: routingNumber || '000000000',
    sanctionedAmountBDT: Number(sanctionedAmountBDT),
    borrowerNid,
    borrowerName: borrowerName || 'Borrower',
    chargeRank: Number(chargeRank) || 1,
    isPariPassuConsent: !!isPariPassuConsent,
    mortgageDeedNumber,
  });

  if (!result.success) {
    return fail(res, result.error || 'Mortgage registration failed.', 409);
  }

  // Register in lock engine as MORTGAGE_LIEN
  InterRegistryLockEngine.acquireLock({
    parcelId,
    lockType: 'MORTGAGE_LIEN',
    lockingAuthority: `${bankName} (${branchName || 'Branch'})`,
    authorityCategory: 'BANKING',
    initiatorNid: borrowerNid,
    initiatorName: borrowerName || 'Borrower',
    referenceNumber: result.record?.cibTrackingToken || `LN-${Date.now()}`,
    statutoryBasis: 'Transfer of Property Act 1882 Section 58 & Bangladesh Bank BRPD Guidelines',
    orderSummaryEn: `Institutional mortgage of BDT ${Number(sanctionedAmountBDT).toLocaleString()} registered. Transfer barred without Bank NOC.`,
    orderSummaryBn: `মোট ${Number(sanctionedAmountBDT).toLocaleString()} টাকার বন্ধকি দায় নিবন্ধিত। ব্যাংকের অনাপত্তিপত্র ব্যতিরেকে বিক্রয় নিষিদ্ধ।`,
  });

  ok(res, result.record, 201);
});

// POST /api/registry-locks/mortgages/:token/noc - Bank issues NOC
router.post('/mortgages/:token/noc', (req: Request, res: Response) => {
  const { token } = req.params;
  const { officerNid } = req.body;

  const result = CibGateway.issueBankNoc(token, officerNid || '19852691234567890');
  if (!result.success) {
    return fail(res, result.error || 'NOC issuance failed.', 400);
  }

  ok(res, { success: true, nocNumber: result.nocNumber });
});

// POST /api/registry-locks/mortgages/:token/satisfy - Full loan discharge
router.post('/mortgages/:token/satisfy', (req: Request, res: Response) => {
  const { token } = req.params;
  const { satisfactionDeedNo } = req.body;

  const result = CibGateway.dischargeLien(token, satisfactionDeedNo || `SAT-${Date.now()}`);
  if (!result.success) {
    return fail(res, result.error || 'Discharge failed.', 400);
  }

  // Also release in lock engine
  const locks = InterRegistryLockEngine.getActiveLocks(token);
  const matchingLock = locks.find((l) => l.referenceNumber.includes(token));
  if (matchingLock) {
    InterRegistryLockEngine.releaseLock({
      lockToken: matchingLock.lockToken,
      releaseAuthority: matchingLock.lockingAuthority,
      releaseReference: `Deed of Satisfaction #${satisfactionDeedNo || 'RELEASED'}`,
    });
  }

  ok(res, { success: true, message: 'Mortgage lien discharged.' });
});

// GET /api/registry-locks/:parcelId/nec - Generate certified Non-Encumbrance Certificate (NEC)
router.get('/:parcelId/nec', (req: Request, res: Response) => {
  const { parcelId } = req.params;
  const { applicantName, applicantNid, purpose } = req.query;

  try {
    const cert = NecService.generateCertificate({
      parcelId,
      applicantName: typeof applicantName === 'string' ? applicantName : undefined,
      applicantNid: typeof applicantNid === 'string' ? applicantNid : undefined,
      purpose: typeof purpose === 'string' ? purpose : undefined,
    });
    ok(res, cert);
  } catch (error: any) {
    fail(res, error.message);
  }
});

// POST /api/registry-locks/:parcelId/simulate - Cross-Agency Simulation Sandbox Trigger
router.post('/:parcelId/simulate', (req: Request, res: Response) => {
  const { parcelId } = req.params;
  const { scenario, extraParams } = req.body;

  if (!scenario) {
    return fail(res, 'Missing simulation scenario in request body.', 400);
  }

  try {
    const simResult = InterRegistryLockEngine.simulateCrossAgencyEvent(scenario, parcelId, extraParams);
    ok(res, simResult);
  } catch (error: any) {
    fail(res, error.message);
  }
});

export default router;
