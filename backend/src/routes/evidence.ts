import { Router, Request, Response } from 'express';
import { DigitalEvidenceService, EvidenceModality, EvidenceActor } from '../services/digitalEvidenceService';
import { ok, fail } from '../lib/respond';

const router = Router();

/**
 * GET /api/evidence/timeline/:parcelId
 * Retrieve the full chronological evidence hash chain with live verification
 */
router.get('/timeline/:parcelId', (req: Request, res: Response) => {
  const { parcelId } = req.params;
  if (!parcelId) {
    return fail(res, 'parcelId is required', 400);
  }

  const blocks = DigitalEvidenceService.getEvidenceTimeline(parcelId);
  const verification = DigitalEvidenceService.verifyChainIntegrity(parcelId);

  ok(res, {
    parcelId,
    totalBlocks: blocks.length,
    verification,
    blocks,
  });
});

/**
 * POST /api/evidence/verify/:parcelId
 * Run full cryptographic integrity audit on the evidence chain
 */
router.post('/verify/:parcelId', (req: Request, res: Response) => {
  const { parcelId } = req.params;
  if (!parcelId) {
    return fail(res, 'parcelId is required', 400);
  }

  const verification = DigitalEvidenceService.verifyChainIntegrity(parcelId);
  ok(res, verification);
});

/**
 * POST /api/evidence/ingest
 * Ingest multi-modal evidence (Message, File, Location ping, or Device Event)
 */
router.post('/ingest', (req: Request, res: Response) => {
  const {
    parcelId,
    modality,
    title,
    summaryBn,
    actor,
    capturedAt,
    metadata,
  } = req.body;

  if (!parcelId || !modality || !title || !actor) {
    return fail(
      res,
      'Missing required fields: parcelId, modality (MESSAGE | FILE | LOCATION | DEVICE_EVENT), title, and actor are required.',
      400
    );
  }

  const validModalities: EvidenceModality[] = ['MESSAGE', 'FILE', 'LOCATION', 'DEVICE_EVENT'];
  if (!validModalities.includes(modality)) {
    return fail(
      res,
      `Invalid modality: ${modality}. Must be one of: ${validModalities.join(', ')}`,
      400
    );
  }

  try {
    const block = DigitalEvidenceService.ingestEvidence({
      parcelId,
      modality,
      title,
      summaryBn,
      actor: actor as EvidenceActor,
      capturedAt,
      metadata: metadata || {},
    });

    const verification = DigitalEvidenceService.verifyChainIntegrity(parcelId);

    ok(
      res,
      {
        message: 'Evidence successfully ingested and cryptographically sealed into timeline.',
        block,
        verification,
      },
      201
    );
  } catch (err: any) {
    fail(res, err.message || 'Failed to ingest evidence into ledger', 500);
  }
});

/**
 * POST /api/evidence/simulate-tamper
 * Demonstrate forensic tampering detection by altering a field in an existing block
 */
router.post('/simulate-tamper', (req: Request, res: Response) => {
  const { parcelId, targetBlockIndex, field, maliciousValue, reasonBn } = req.body;

  if (!parcelId || targetBlockIndex === undefined || !field) {
    return fail(res, 'parcelId, targetBlockIndex, and field are required.', 400);
  }

  try {
    const result = DigitalEvidenceService.simulateTamper(parcelId, Number(targetBlockIndex), {
      field,
      maliciousValue,
      reasonBn: reasonBn || 'অননুমোদিত রেকর্ড পরিবর্তন (Malicious alteration)',
    });

    const verification = DigitalEvidenceService.verifyChainIntegrity(parcelId);

    ok(res, {
      ...result,
      verification,
    });
  } catch (err: any) {
    fail(res, err.message || 'Failed to simulate tamper', 400);
  }
});

/**
 * POST /api/evidence/reset-chain
 * Revert ledger back to authentic untouched state
 */
router.post('/reset-chain', (req: Request, res: Response) => {
  const { parcelId } = req.body;
  if (!parcelId) {
    return fail(res, 'parcelId is required.', 400);
  }

  const result = DigitalEvidenceService.resetChain(parcelId);
  const verification = DigitalEvidenceService.verifyChainIntegrity(parcelId);

  ok(res, {
    message: 'Evidence chain restored to pristine authentic state.',
    result,
    verification,
  });
});

/**
 * GET /api/evidence/export-dossier/:parcelId
 * Export court-admissible Digital Evidence Dossier with QR verification payload
 */
router.get('/export-dossier/:parcelId', (req: Request, res: Response) => {
  const { parcelId } = req.params;
  if (!parcelId) {
    return fail(res, 'parcelId is required.', 400);
  }

  try {
    const dossier = DigitalEvidenceService.exportCourtDossier(parcelId);
    ok(res, dossier);
  } catch (err: any) {
    fail(res, err.message || 'Failed to export evidence dossier', 500);
  }
});

export default router;
