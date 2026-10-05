import { Router, Request, Response } from 'express';
import { KhasService } from '../services/khasService';
import { ok, fail } from '../lib/respond';

const router = Router();

// GET /api/khas/records - List government Khas and vested records
router.get('/records', (req: Request, res: Response) => {
  const { upazila } = req.query;
  const list = KhasService.listKhasRecords(typeof upazila === 'string' ? upazila : undefined);
  ok(res, list);
});

// POST /api/khas/check-encroachment - Check parcel proximity to Khas records
router.post('/check-encroachment', (req: Request, res: Response) => {
  const { parcelId, coordinates } = req.body;

  if (!parcelId) {
    return fail(res, 'parcelId is required.', 400);
  }

  // Default coordinate if not provided (e.g. Savar sample centroid [90.258, 23.843])
  const coords: [number, number] = Array.isArray(coordinates) && coordinates.length === 2
    ? [Number(coordinates[0]), Number(coordinates[1])]
    : [90.258, 23.843];

  const result = KhasService.checkEncroachment(parcelId, coords);
  ok(res, result);
});

// POST /api/khas/eviction-notice - Administrative eviction order logging
router.post('/eviction-notice', (req: Request, res: Response) => {
  const { khasId, caseNumber, encroacherName } = req.body;
  if (!khasId || !caseNumber || !encroacherName) {
    return fail(res, 'khasId, caseNumber, and encroacherName are required.', 400);
  }

  const updated = KhasService.issueEvictionNotice(khasId, caseNumber, encroacherName);
  if (!updated) {
    return fail(res, `Khas record ${khasId} not found.`, 404);
  }
  ok(res, updated, 201);
});

export default router;
