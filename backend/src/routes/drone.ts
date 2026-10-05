import { Router, Request, Response } from 'express';
import { DroneCadastreService } from '../services/droneCadastreService';
import { ok, fail } from '../lib/respond';

const router = Router();

// GET /api/drone/epochs/:parcelId - Get historical survey epochs for parcel
router.get('/epochs/:parcelId', (req: Request, res: Response) => {
  const epochs = DroneCadastreService.getEpochs(req.params.parcelId);
  ok(res, epochs);
});

// POST /api/drone/compare-epochs - Run multi-epoch comparison
router.post('/compare-epochs', (req: Request, res: Response) => {
  const { parcelId } = req.body;
  if (!parcelId) {
    return fail(res, 'parcelId is required.', 400);
  }

  const comparison = DroneCadastreService.compareEpochs(parcelId);
  ok(res, comparison);
});

export default router;
