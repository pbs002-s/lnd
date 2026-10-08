import { Router, Request, Response } from 'express';
import { LandGuardService } from '../services/landGuardService';
import { ok, fail } from '../lib/respond';

const router = Router();

/**
 * GET /api/landguard/audit/:parcelId
 * Get consolidated 5-pillar fraud detection audit and trust score
 */
router.get('/audit/:parcelId', (req: Request, res: Response) => {
  const { parcelId } = req.params;
  if (!parcelId) {
    return fail(res, 'parcelId is required.', 400);
  }

  try {
    const audit = LandGuardService.auditParcel(parcelId);
    ok(res, audit);
  } catch (err: any) {
    fail(res, err.message || 'Failed to execute LandGuard audit', 500);
  }
});

/**
 * POST /api/landguard/toggle-lock
 * Toggle biometric anti-fraud property lock
 */
router.post('/toggle-lock', (req: Request, res: Response) => {
  const { parcelId } = req.body;
  if (!parcelId) {
    return fail(res, 'parcelId is required in body.', 400);
  }

  try {
    const isLocked = LandGuardService.toggleLock(parcelId);
    const audit = LandGuardService.auditParcel(parcelId);
    ok(res, {
      message: isLocked ? 'Property locked and frozen against fraud.' : 'Property unlocked.',
      isLocked,
      audit,
    });
  } catch (err: any) {
    fail(res, err.message || 'Failed to toggle lock', 500);
  }
});

/**
 * GET /api/landguard/dossier/:parcelId
 * Export official court & bank admissible LandGuard Security Dossier
 */
router.get('/dossier/:parcelId', (req: Request, res: Response) => {
  const { parcelId } = req.params;
  if (!parcelId) {
    return fail(res, 'parcelId is required.', 400);
  }

  try {
    const dossier = LandGuardService.exportDossier(parcelId);
    ok(res, dossier);
  } catch (err: any) {
    fail(res, err.message || 'Failed to export LandGuard dossier', 500);
  }
});

export default router;
